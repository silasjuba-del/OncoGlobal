import { createHash } from "node:crypto";
import { z } from "zod";
import { Id } from "../contracts/base.js";
import { Correlacao } from "../contracts/f1/correlacao.js";
import { lerDraft, listarDrafts, salvarDraft } from "../kernel/comandos/portas.js";
import type { ServidorDeps } from "./rotas.js";
import type { criarRuntimeExtracaoLlm } from "../kernel/llm/openai/runtime.js";
import { lerPaciente } from "./leituras.js";
import { avaliarExtracaoCognitiva } from "../kernel/llm/cognitivoExtracao.js";
import { RelatorioCognitivoExtracaoSchema } from "../contracts/cognitivoExtracao.js";
import { FiltrosConhecimentoBrainSchema } from "../contracts/conhecimentoBrain.js";
import { lerConhecimentoBrain } from "./conhecimentoBrain.js";
import { fonteDeVoz, MetodoCapturaTranscricao } from "../contracts/capturaTranscricao.js";
import { PaginacaoExtracoesCognitivas, type PaginaExtracoesCognitivas } from "../contracts/api/oncoassist.js";

const Pedido = z.object({ draftId: Id, patientId: Id, encounterId: Id, tumorLotId: Id.nullable(), idempotencyKey: Id }).strict();
const PedidoSintese = Pedido.omit({ draftId: true });
const PedidoLeitura = Pedido.omit({ idempotencyKey: true });
const PedidoExtracao = Pedido.extend({ filtrosBiblioteca: FiltrosConhecimentoBrainSchema.optional() });
const RegistroExtracao = z.object({ kind: z.literal("LLM_EXTRACAO_RASCUNHO"), sourceDraftId: Id, sourceDraftHash: z.string(),
  resultado: z.object({ correlacao: Correlacao }).passthrough(), cognitivo: z.unknown().optional() });
type DepsExtracao = ServidorDeps & { extracaoLlm?: ReturnType<typeof criarRuntimeExtracaoLlm> };
const hash = (v: unknown) => createHash("sha256").update(JSON.stringify(v ?? null)).digest("hex");

/** Leitura contextual do rascunho inerte; não abre a via genérica de confirmação. */
export function lerResultadoExtracaoLlm(raw: unknown, token: string, deps: DepsExtracao): { status: number; body: Record<string, unknown> } {
  const responder = (status: number, codigo: string, extra: Record<string, unknown> = {}) => ({ status, body: { codigo, ...extra } });
  const p = PedidoLeitura.safeParse(raw); if (!p.success) return responder(400, "PAYLOAD_INVALIDO");
  if (!deps.sessoes.obter(token)) return responder(401, "SESSAO_EXPIRADA");
  const ctx = deps.sessoes.consultaSelecionada(token);
  if (!ctx || ctx.patientId !== p.data.patientId || ctx.encounterId !== p.data.encounterId || (ctx.tumorLotId ?? null) !== p.data.tumorLotId)
    return responder(409, "CONTEXTO_CONSULTA_ALTERADO");
  const draft = lerDraft(deps.db, p.data.draftId);
  const registro = RegistroExtracao.safeParse(draft?.payload);
  if (!draft || draft.patientId !== ctx.patientId || !registro.success) return responder(409, "DRAFT_FORA_DO_ESCOPO");
  const { correlacao } = registro.data.resultado;
  if (correlacao.patientId !== ctx.patientId || correlacao.encounterId !== ctx.encounterId || correlacao.tumorLotId !== (ctx.tumorLotId ?? null))
    return responder(409, "DRAFT_FORA_DO_ESCOPO");
  const atual = deps.motorF1?.retrato({ patientId: ctx.patientId, encounterId: ctx.encounterId, tumorLotId: ctx.tumorLotId ?? null });
  const relatorio = RelatorioCognitivoExtracaoSchema.safeParse(registro.data.cognitivo);
  return responder(200, "PROPOSTA_LLM_CARREGADA", { draftId: draft.draftId, criaEventoClinico: false,
    proposta: registro.data.resultado, cognitivo: relatorio.success ? relatorio.data : null,
    validadeFonte: hash(lerDraft(deps.db, registro.data.sourceDraftId)) === registro.data.sourceDraftHash ? "ATUAL" : "FONTE_ALTERADA",
    validadeContexto: atual && hash([atual.revisao, atual.regras, atual.biblioteca]) === hash([correlacao.revisaoFatos, correlacao.regras, correlacao.biblioteca])
      ? "ATUAL" : "CONTEXTO_ALTERADO",
    validadePolitica: relatorio.success ? "MESMA_VERSAO" : "NAO_VERIFICAVEL" });
}

/** Projeção do mesmo ledger, sem fila paralela e sem conteúdo clínico na listagem. */
export function listarExtracoesCognitivas(raw: unknown, token: string, deps: DepsExtracao):
  { status: number; codigo: string; pagina?: PaginaExtracoesCognitivas } {
  const pedido = PedidoLeitura.omit({ draftId: true }).extend(PaginacaoExtracoesCognitivas.shape).safeParse(raw);
  if (!pedido.success) return { status: 400, codigo: "PAYLOAD_INVALIDO" };
  if (!deps.sessoes.obter(token)) return { status: 401, codigo: "SESSAO_EXPIRADA" };
  const ctx = deps.sessoes.consultaSelecionada(token), p = pedido.data;
  const mesmo = (c: { patientId: string; encounterId: string; tumorLotId?: string | null }) =>
    c.patientId === p.patientId && c.encounterId === p.encounterId && (c.tumorLotId ?? null) === p.tumorLotId;
  if (!ctx || !mesmo(ctx)) return { status: 409, codigo: "CONTEXTO_CONSULTA_ALTERADO" };
  const registros = listarDrafts(deps.db, ctx.patientId).flatMap(draft => {
    const r = RegistroExtracao.safeParse(draft.payload);
    return r.success && mesmo(r.data.resultado.correlacao) ? [{ draft, registro: r.data }] : [];
  }).sort((a, b) => Date.parse(b.draft.criadoEm) - Date.parse(a.draft.criadoEm) || b.draft.draftId.localeCompare(a.draft.draftId));
  const indice = p.cursorExtracoes === undefined ? -1 : registros.findIndex(r => r.draft.draftId === p.cursorExtracoes);
  if (p.cursorExtracoes !== undefined && indice === -1) return { status: 400, codigo: "CURSOR_EXTRACOES_INVALIDO" };
  const selecionados = registros.slice(indice + 1, indice + 1 + (p.limiteExtracoes ?? 20));
  const retrato = deps.motorF1?.retrato({ patientId: p.patientId, encounterId: p.encounterId, tumorLotId: p.tumorLotId });
  const atual = retrato ? hash([retrato.revisao, retrato.regras, retrato.biblioteca]) : null;
  const itens: PaginaExtracoesCognitivas["itens"] = selecionados.map(({ draft, registro }) => {
    const r = RelatorioCognitivoExtracaoSchema.safeParse(registro.cognitivo);
    const c = registro.resultado.correlacao;
    const avaliado = r.success && r.data.estado === "AVALIADO" ? r.data : null;
    return { draftId: draft.draftId, sourceDraftId: registro.sourceDraftId, sourceId: draft.sourceId, criadoEm: draft.criadoEm,
      status: avaliado?.harness.status ?? "NAO_VERIFICADO",
      validadeFonte: hash(lerDraft(deps.db, registro.sourceDraftId)) === registro.sourceDraftHash ? "ATUAL" : "FONTE_ALTERADA",
      validadeContexto: atual === hash([c.revisaoFatos, c.regras, c.biblioteca]) ? "ATUAL" : "CONTEXTO_ALTERADO",
      validadePolitica: r.success ? "MESMA_VERSAO" : "NAO_VERIFICAVEL",
      alegacoes: avaliado?.proposta.itensPropostos.length ?? 0, pendencias: avaliado?.harness.manifestacoes.length ?? 0,
      criaEventoClinico: false };
  });
  return { status: 200, codigo: "EXTRACOES_COGNITIVAS_LISTADAS", pagina: { itens,
    proximoCursor: indice + 1 + selecionados.length < registros.length ? selecionados.at(-1)?.draft.draftId ?? null : null } };
}
export async function executarExtracaoLlm(raw: unknown, token: string, deps: DepsExtracao): Promise<{ status: number; body: Record<string, unknown> }> {
  const responder = (status: number, codigo: string, extra: Record<string, unknown> = {}) => ({ status, body: { codigo, ...extra } });
  const p = PedidoExtracao.safeParse(raw); if (!p.success) return responder(400, "PAYLOAD_INVALIDO");
  const filtrosBiblioteca = p.data.filtrosBiblioteca ?? {};
  const sessao = deps.sessoes.obter(token); if (!sessao) return responder(401, "SESSAO_EXPIRADA");
  const ctx = deps.sessoes.consultaSelecionada(token);
  if (!ctx || ctx.patientId !== p.data.patientId || ctx.encounterId !== p.data.encounterId || (ctx.tumorLotId ?? null) !== p.data.tumorLotId)
    return responder(409, "CONTEXTO_CONSULTA_ALTERADO");
  const runtime = deps.extracaoLlm;
  if (!runtime || runtime.status().status !== "DISPONIVEL") return responder(409, "PENDENTE", { motivo: runtime?.status().codigo ?? "LLM_DESABILITADA" });
  const draft = lerDraft(deps.db, p.data.draftId);
  if (!draft || draft.patientId !== ctx.patientId) return responder(409, "DRAFT_FORA_DO_ESCOPO");
  const payload = draft.payload as Record<string, unknown> | null;
  const vinculo = z.object({ patientId: Id, encounterId: Id, tumorLotId: Id.nullable(), segmentId: Id }).safeParse(payload?.patientLinkReview);
  if (payload?.kind !== "EXTRACAO_RASCUNHO" || !vinculo.success || vinculo.data.patientId !== ctx.patientId
    || vinculo.data.encounterId !== ctx.encounterId || vinculo.data.tumorLotId !== (ctx.tumorLotId ?? null)) return responder(409, "VINCULO_FONTE_NAO_CONFIRMADO");
  const state = payload.state as { segments?: unknown[] } | undefined;
  const segmento = state?.segments?.map(s => z.object({ id: Id, sourceId: Id, rawTranscript: z.string().min(1) }).safeParse(s))
    .find(s => s.success && s.data.id === vinculo.data.segmentId && s.data.sourceId === draft.sourceId);
  if (!segmento?.success) return responder(409, "FONTE_LOCAL_INDISPONIVEL");
  const paciente = lerPaciente(deps.db, ctx.patientId); if (!paciente || !deps.motorF1) return responder(409, "CONTEXTO_CLINICO_INDISPONIVEL");
  const escopo = { patientId: ctx.patientId, encounterId: ctx.encounterId, tumorLotId: ctx.tumorLotId ?? null };
  const retrato = deps.motorF1.retrato(escopo);
  const correlacao = Correlacao.parse({ ...escopo, operationId: p.data.idempotencyKey, revisaoFatos: retrato.revisao,
    regras: retrato.regras, biblioteca: retrato.biblioteca, proposta: null });
  const fonteAntes = hash(draft), pacienteAntes = hash(paciente), retratoAntes = hash([retrato.revisao, retrato.regras, retrato.biblioteca]);
  const atual = () => {
    const atualCtx = deps.sessoes.consultaSelecionada(token);
    if (!deps.sessoes.obter(token) || !atualCtx || atualCtx.patientId !== escopo.patientId || atualCtx.encounterId !== escopo.encounterId || (atualCtx.tumorLotId ?? null) !== escopo.tumorLotId) return false;
    const r = deps.motorF1!.retrato(escopo);
    return hash(lerDraft(deps.db, draft.draftId)) === fonteAntes && hash(lerPaciente(deps.db, escopo.patientId)) === pacienteAntes
      && hash([r.revisao, r.regras, r.biblioteca]) === retratoAntes;
  };
  const jaSalvo = listarDrafts(deps.db, ctx.patientId).find(d => {
    const v = d.payload as Record<string, unknown> | null;
    return v?.kind === "LLM_EXTRACAO_RASCUNHO" && v.operationId === p.data.idempotencyKey && v.sourceDraftHash === fonteAntes;
  });
  if (jaSalvo) {
    if (hash((jaSalvo.payload as { filtrosBiblioteca?: unknown }).filtrosBiblioteca ?? {}) !== hash(filtrosBiblioteca))
      return responder(409, "FILTROS_BIBLIOTECA_DIVERGENTES");
    const anterior = (jaSalvo.payload as { resultado?: { correlacao?: unknown } }).resultado?.correlacao;
    if (hash(anterior) !== hash(correlacao)) return responder(409, "PROPOSTA_LLM_DESATUALIZADA");
    const relatorio = RelatorioCognitivoExtracaoSchema.safeParse((jaSalvo.payload as Record<string, unknown>).cognitivo);
    return responder(200, "PROPOSTA_LLM_REPLAY", { draftId: jaSalvo.draftId, criaEventoClinico: false,
      ...(relatorio.success ? { cognitivo: relatorio.data } : {}) });
  }
  const preparo = runtime.preparar(p.data.idempotencyKey,
    { fonte: { id: draft.sourceId, paginas: [{ n: 1, texto: segmento.data.rawTranscript }] }, correlacao },
    { dicionario: { nomes: [paciente.nome], identificadores: [paciente.patientId, ...paciente.identificadores.map(i => i.valor)] } },
    draft.revision + 1, atual);
  if (preparo.status !== "PRONTO") return responder(409, "PENDENTE", { motivo: preparo.codigo });
  try {
    const g = await deps.gateway.executar({ verbo: "LLM_EXTRACAO", objeto: { tipo: "FONTE", id: draft.sourceId, versao: draft.revision + 1 },
      escopo: { patientId: ctx.patientId, encounterId: ctx.encounterId }, destino: null, idempotencyKey: p.data.idempotencyKey }, sessao);
    if (!atual()) return responder(409, "FONTE_OU_CONTEXTO_DESATUALIZADO");
    const resultado = runtime.resultado(p.data.idempotencyKey);
    if (!resultado || resultado.status !== "PROPOSTA" || (g.decisao !== "EXECUTADA" && g.decisao !== "REPLAY"))
      return responder(409, "PENDENTE", { motivo: resultado?.status === "PENDENTE" ? resultado.codigo : g.motivoCodigo });
    const origem = (payload.input as { sourceType?: string; captureMethod?: string; rawTranscript?: string; capturedTranscript?: string } | undefined) ?? {};
    const metodo = MetodoCapturaTranscricao.safeParse(origem.captureMethod);
    const hashTexto = (s: string) => createHash("sha256").update(s, "utf8").digest("hex");
    const captura = metodo.success ? { metodo: metodo.data,
      transcricaoOriginalHash: typeof origem.capturedTranscript === "string" ? hashTexto(origem.capturedTranscript) : null,
      transcricaoRevisadaHash: hashTexto(origem.rawTranscript ?? segmento.data.rawTranscript),
      transcricaoEditada: typeof origem.capturedTranscript === "string" ? origem.capturedTranscript !== origem.rawTranscript : null,
      audioConferido: false as const } : undefined;
    const conhecimento = lerConhecimentoBrain(deps.db, filtrosBiblioteca);
    const cognitivo = avaliarExtracaoCognitiva({ resultado, agora: deps.agora(), ...conhecimento, ...(captura ? { captura } : {}), fonte: {
      sourceId: draft.sourceId, versao: String(draft.revision),
      modalidade: fonteDeVoz(origem) ? "AUDIO" : "TEXTO",
      conteudoOriginal: segmento.data.rawTranscript,
      // Página 1 é o envelope enviado ao modelo, não a numeração física do documento.
      localizadores: [{ localizador: `segmento:${vinculo.data.segmentId}`, trecho: segmento.data.rawTranscript }],
      contentHash: createHash("sha256").update(segmento.data.rawTranscript, "utf8").digest("hex"),
    } });
    const salvo = salvarDraft(deps.db, { draftId: `llm:${hash(p.data.idempotencyKey)}`, patientId: ctx.patientId, sourceId: draft.sourceId,
      rawRef: draft.rawRef, revision: 0, criadoEm: deps.agora(), diagnostics: ["REVISAO_MEDICA_OBRIGATORIA",
        cognitivo.estado === "AVALIADO" ? cognitivo.harness.status : cognitivo.codigo],
      payload: { kind: "LLM_EXTRACAO_RASCUNHO", operationId: p.data.idempotencyKey, sourceDraftId: draft.draftId, sourceDraftHash: fonteAntes, resultado, cognitivo, filtrosBiblioteca } });
    return responder(201, "PROPOSTA_LLM_SALVA", { draftId: salvo.draftId, revision: salvo.revision, proposta: resultado, cognitivo, criaEventoClinico: false });
  } finally { runtime.descartar(p.data.idempotencyKey); }
}

/** Literal, cited proposal over the current confirmed snapshot; never replaces its canonical summary. */
export async function executarSinteseRetratoLlm(raw: unknown, token: string, deps: DepsExtracao): Promise<{ status: number; body: Record<string, unknown> }> {
  const p = PedidoSintese.safeParse(raw);
  if (!p.success) return { status: 400, body: { codigo: "PAYLOAD_INVALIDO" } };
  const contexto = { patientId: p.data.patientId, encounterId: p.data.encounterId, tumorLotId: p.data.tumorLotId };
  const pendente = (motivo: string) => ({ status: 409, body: { codigo: "PENDENTE", contexto, criaEventoClinico: false, motivo, fatosRetrato: [] } });
  const sessao = deps.sessoes.obter(token); if (!sessao) return { status: 401, body: { codigo: "SESSAO_EXPIRADA" } };
  const c = deps.sessoes.consultaSelecionada(token);
  if (!c || c.patientId !== contexto.patientId || c.encounterId !== contexto.encounterId || (c.tumorLotId ?? null) !== contexto.tumorLotId)
    return pendente("CONTEXTO_CONSULTA_ALTERADO");
  const runtime = deps.extracaoLlm;
  if (!runtime || runtime.status().status !== "DISPONIVEL") return pendente(runtime?.status().codigo ?? "LLM_DESABILITADA");
  const paciente = lerPaciente(deps.db, contexto.patientId); if (!paciente || !deps.motorF1) return pendente("CONTEXTO_CLINICO_INDISPONIVEL");
  const r = deps.motorF1.retrato(contexto);
  if (!r.resumo.length || r.resumo.length > 40) return pendente(!r.resumo.length ? "RESUMO_CONFIRMADO_AUSENTE" : "RESUMO_EXCEDE_LIMITE_PROPOSTA");
  const fontes = new Set(r.fatos.map(f => hash(f.ref)));
  if (r.resumo.some(b => !b.fatos.length || b.fatos.some(f => !fontes.has(hash(f))))) return pendente("RESUMO_SEM_REFERENCIA_VIGENTE");
  const snapshot = hash([r.revisao, r.regras, r.biblioteca, r.resumo]);
  const pacienteAntes = hash(paciente);
  const correlacao = Correlacao.parse({ ...contexto, operationId: p.data.idempotencyKey, revisaoFatos: r.revisao,
    regras: r.regras, biblioteca: r.biblioteca, proposta: null });
  const atuais = r.fatos.map(f => f.ref);
  const atual = () => {
    const s = deps.sessoes.consultaSelecionada(token);
    if (!deps.sessoes.obter(token) || !s || s.patientId !== contexto.patientId || s.encounterId !== contexto.encounterId || (s.tumorLotId ?? null) !== contexto.tumorLotId) return false;
    const novo = deps.motorF1!.retrato(contexto);
    return hash([novo.revisao, novo.regras, novo.biblioteca, novo.resumo]) === snapshot && hash(lerPaciente(deps.db, contexto.patientId)) === pacienteAntes;
  };
  const salvoAnterior = listarDrafts(deps.db, contexto.patientId).find(d => {
    const v = d.payload as Record<string, unknown> | null;
    return v?.kind === "SINTESE_RASCUNHO" && v.operationId === p.data.idempotencyKey;
  });
  if (salvoAnterior) {
    const v = salvoAnterior.payload as { snapshot?: string; proposta?: unknown };
    return v.snapshot === snapshot ? { status: 200, body: { codigo: "PROPOSTA_SINTESE_REPLAY", contexto, draftId: salvoAnterior.draftId,
      proposta: v.proposta, fatosRetrato: atuais, criaEventoClinico: false } } : pendente("PROPOSTA_SINTESE_DESATUALIZADA");
  }
  const preparo = runtime.preparar(p.data.idempotencyKey,
    { fonte: { id: `retrato:${snapshot}`, paginas: r.resumo.map((b, i) => ({ n: i + 1, texto: b.texto })) }, correlacao },
    { dicionario: { nomes: [paciente.nome], identificadores: [paciente.patientId, ...paciente.identificadores.map(i => i.valor)] } }, 1, atual, "RETRATO_CONFIRMADO");
  if (preparo.status !== "PRONTO") return pendente(preparo.codigo);
  try {
    const g = await deps.gateway.executar({ verbo: "LLM_EXTRACAO", objeto: { tipo: "RETRATO_SINTESE", id: `retrato:${snapshot}`, versao: 1 },
      escopo: { patientId: contexto.patientId, encounterId: contexto.encounterId }, destino: null, idempotencyKey: p.data.idempotencyKey }, sessao);
    if (!atual()) return pendente("RETRATO_OU_CONTEXTO_DESATUALIZADO");
    const resultado = runtime.resultado(p.data.idempotencyKey);
    if (!resultado || resultado.status !== "PROPOSTA" || !resultado.resumo.length || (g.decisao !== "EXECUTADA" && g.decisao !== "REPLAY"))
      return pendente(resultado?.status === "PENDENTE" ? resultado.codigo : "SINTESE_SEM_CITACAO_LITERAL");
    const citacoes = resultado.resumo.map(b => ({ texto: b.texto,
      fatos: [...new Map(b.referencias.flatMap(ref => r.resumo[ref.pagina - 1]?.fatos ?? []).map(f => [hash(f), f])).values()] }));
    if (citacoes.some(b => !b.fatos.length || b.fatos.some(f => !fontes.has(hash(f))))) return pendente("SINTESE_SEM_FATO_REAL");
    const proposta = { status: "PROPOSTA_DE_SINTESE" as const, revisaoObrigatoria: true, correlacao, citacoes };
    const salvo = salvarDraft(deps.db, { draftId: `sintese:${hash(p.data.idempotencyKey)}`, patientId: contexto.patientId,
      sourceId: `retrato:${snapshot}`, rawRef: `retrato-local:${r.revisao}`, revision: 0, criadoEm: deps.agora(), diagnostics: ["PROPOSTA_DE_SINTESE", "REVISAO_MEDICA_OBRIGATORIA"],
      payload: { kind: "SINTESE_RASCUNHO", operationId: p.data.idempotencyKey, snapshot, proposta } });
    return { status: 201, body: { codigo: "PROPOSTA_SINTESE_SALVA", contexto, draftId: salvo.draftId, proposta, fatosRetrato: atuais, criaEventoClinico: false } };
  } finally { runtime.descartar(p.data.idempotencyKey); }
}

/** D-W9-66 is a separate, explicit PDF operation; an ordinary extraction never falls through to it. */
export async function executarDocumentoOriginalLlm(raw: unknown, token: string, deps: DepsExtracao): Promise<{ status: number; body: Record<string, unknown> }> {
  const responder = (status: number, codigo: string, extra: Record<string, unknown> = {}) => ({ status, body: { codigo, ...extra } });
  const p = Pedido.safeParse(raw); if (!p.success) return responder(400, "PAYLOAD_INVALIDO");
  const sessao = deps.sessoes.obter(token); if (!sessao) return responder(401, "SESSAO_EXPIRADA");
  const selecionado = deps.sessoes.consultaSelecionada(token);
  const ctx = { patientId: p.data.patientId, encounterId: p.data.encounterId, tumorLotId: p.data.tumorLotId };
  if (!selecionado || selecionado.patientId !== ctx.patientId || selecionado.encounterId !== ctx.encounterId || (selecionado.tumorLotId ?? null) !== ctx.tumorLotId)
    return responder(409, "CONTEXTO_CONSULTA_ALTERADO");
  const runtime = deps.extracaoLlm;
  if (!runtime || runtime.statusDocumentoOriginal().status !== "DISPONIVEL") return responder(409, "PENDENTE", { motivo: runtime?.statusDocumentoOriginal().codigo ?? "D_W9_66_DESABILITADA" });
  const draft = lerDraft(deps.db, p.data.draftId), paciente = lerPaciente(deps.db, ctx.patientId);
  if (!draft || !paciente || !deps.motorF1) return responder(409, "FONTE_LOCAL_INDISPONIVEL");
  const payload = draft.payload as Record<string, unknown> | null;
  const upload = z.object({ tipo: z.literal("PDF"), bytesBase64: z.string().min(1), contentHash: z.string().regex(/^[a-f0-9]{64}$/) }).safeParse(payload?.original);
  const contexto = z.object({ patientId: Id, encounterId: Id, tumorLotId: Id.nullable() }).safeParse(payload?.contextoUpload);
  if (payload?.kind !== "EXTRACAO_RASCUNHO" || !draft.rawRef.startsWith("upload-local:") || !upload.success || !contexto.success
    || hash(contexto.data) !== hash(ctx) || (draft.patientId !== null && draft.patientId !== ctx.patientId)) return responder(409, "DOCUMENTO_ORIGINAL_FORA_DO_ESCOPO");
  const vinculo = payload.patientLinkReview;
  if (vinculo !== undefined) {
    const v = z.object({ patientId: Id, encounterId: Id, tumorLotId: Id.nullable() }).safeParse(vinculo);
    if (!v.success || hash(v.data) !== hash(ctx)) return responder(409, "VINCULO_DOCUMENTO_DIVERGENTE");
  }
  const bytes = Buffer.from(upload.data.bytesBase64, "base64");
  if (createHash("sha256").update(bytes).digest("hex") !== upload.data.contentHash) return responder(409, "HASH_DOCUMENTO_ORIGINAL_DIVERGENTE");
  const fonteAntes = hash(draft), pacienteAntes = hash(paciente);
  const retrato = deps.motorF1.retrato(ctx);
  const correlacao = Correlacao.parse({ ...ctx, operationId: p.data.idempotencyKey, revisaoFatos: retrato.revisao,
    regras: retrato.regras, biblioteca: retrato.biblioteca, proposta: null });
  const revisaoAntes = hash([retrato.revisao, retrato.regras, retrato.biblioteca]);
  const atual = () => {
    const c = deps.sessoes.consultaSelecionada(token); if (!deps.sessoes.obter(token) || !c
      || c.patientId !== ctx.patientId || c.encounterId !== ctx.encounterId || (c.tumorLotId ?? null) !== ctx.tumorLotId) return false;
    const r = deps.motorF1!.retrato(ctx);
    return hash(lerDraft(deps.db, draft.draftId)) === fonteAntes && hash(lerPaciente(deps.db, ctx.patientId)) === pacienteAntes
      && hash([r.revisao, r.regras, r.biblioteca]) === revisaoAntes;
  };
  const salvoAnterior = listarDrafts(deps.db, ctx.patientId).find(d => {
    const v = d.payload as Record<string, unknown> | null;
    return v?.kind === "D66_TRANSCRICAO_RASCUNHO" && v.operationId === p.data.idempotencyKey;
  });
  if (salvoAnterior) {
    const v = salvoAnterior.payload as { sourceDraftHash?: string; correlacao?: unknown };
    return v.sourceDraftHash === fonteAntes && hash(v.correlacao) === hash(correlacao)
      ? responder(200, "D66_TRANSCRICAO_REPLAY", { draftId: salvoAnterior.draftId, criaEventoClinico: false })
      : responder(409, "D66_TRANSCRICAO_DESATUALIZADA");
  }
  const preparo = await runtime.prepararDocumentoOriginal(p.data.idempotencyKey,
    { fonteId: draft.sourceId, base64: upload.data.bytesBase64, correlacao }, draft.revision + 1, sessao, atual);
  if (preparo.status !== "PRONTO") return responder(409, "PENDENTE", { motivo: preparo.codigo });
  try {
    const g = await deps.gateway.executar({ verbo: "LLM_EXTRACAO", objeto: { tipo: "PDF_ORIGINAL_D_W9_66", id: draft.sourceId, versao: draft.revision + 1 },
      escopo: { patientId: ctx.patientId, encounterId: ctx.encounterId }, destino: null, idempotencyKey: p.data.idempotencyKey }, sessao);
    if (!atual()) return responder(409, "FONTE_OU_CONTEXTO_DESATUALIZADO");
    const resultado = runtime.resultadoDocumentoOriginal(p.data.idempotencyKey);
    if (!resultado || resultado.status !== "DERIVADO_LLM_NAO_VERIFICADO" || (g.decisao !== "EXECUTADA" && g.decisao !== "REPLAY"))
      return responder(409, "PENDENTE", { motivo: resultado?.status === "PENDENTE" ? resultado.codigo : g.motivoCodigo });
    const salvo = salvarDraft(deps.db, { draftId: `d66:${hash(p.data.idempotencyKey)}`, patientId: ctx.patientId, sourceId: draft.sourceId,
      rawRef: draft.rawRef, revision: 0, criadoEm: deps.agora(), diagnostics: ["DERIVADO_LLM_NAO_VERIFICADO", "REVISAO_MEDICA_OBRIGATORIA"],
      payload: { kind: "D66_TRANSCRICAO_RASCUNHO", operationId: p.data.idempotencyKey, sourceDraftId: draft.draftId, sourceDraftHash: fonteAntes,
        correlacao, resultado } });
    return responder(201, "D66_TRANSCRICAO_NAO_VERIFICADA", { draftId: salvo.draftId, resultado, criaEventoClinico: false });
  } finally { runtime.descartar(p.data.idempotencyKey); }
}
