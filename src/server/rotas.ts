import { createHash, randomUUID } from "node:crypto";
import type { IncomingMessage, ServerResponse } from "node:http";
import type { DatabaseSync } from "node:sqlite";
import { z } from "zod";
import { DataCivil, Id } from "../contracts/base.js";
import { ActionIntent, ConfirmarBloco, type ConfirmarBloco as Confirmar } from "../contracts/operacao.js";
import { lerDraft, listarDrafts, salvarDraft } from "../kernel/ledger/drafts.js";
import { sqliteIdempotencia } from "../kernel/ledger/idempotencia.js";
import { confirmar } from "../kernel/ledger/writeRouter.js";
import { g25EscopoAssinatura } from "../kernel/harness/gates.js";
import type { criarGateway } from "../kernel/gateway/gateway.js";
import { autorizarSaida } from "./autorizacao.js";
import { hashConteudoExibido, type GerenciadorSessao } from "./sessao.js";
import { executarPipelineExtracao } from "../orchestration/pipeline-extracao.js";
import { g07Lateralidade, g08AnatomiaSexo, g09PtDeBiopsia } from "../kernel/harness/gates.js";
import { lerAgenda, lerApacs, lerCanal, lerConsulta, lerMensagensChat, lerPaciente, lerRecist, lerSalao } from "./leituras.js";
import type { SettingsService } from "../config/settings.js";
import type { carregarCorpusServidor } from "./corpus.js";
import { parserLinha } from "../rules/prescricao/parserLinha.js";
import { classificarDocumento } from "../rules/prescricao/classificarDocumento.js";
import { instanciarProtocolo } from "../rules/prescricao/instanciarProtocolo.js";
import { dataCivilDoServico } from "../kernel/gateway/tempo.js";
import { projetarEstatisticaLedger } from "../estatistica/index.js";
import { consultarGrafoLocal } from "../app/pesquisa/conhecimento.js";
import { prepararRevisaoExtracao } from "../app/revisaoExtracao.js";
import { criarOncoassistJev } from "../app/oncoassist.js";

export interface ServidorDeps {
  db: DatabaseSync;
  sessoes: GerenciadorSessao;
  gateway: ReturnType<typeof criarGateway>;
  salaoRuleset?: unknown;
  settings?: SettingsService | null;
  configRootDir?: string;
  corpus?: ReturnType<typeof carregarCorpusServidor> | null;
  oncoassistJev?: ReturnType<typeof criarOncoassistJev>;
  agora: () => string;
  log: (entry: { rota: string; codigo: string; status: number }) => void;
}
const sha = (s: string) => createHash("sha256").update(s).digest("hex");
const ExibirBundle = z.object({
  patientId: Id,
  encounterId: Id,
  draftIds: z.array(Id),
  tumorLotId: Id.nullable().optional(),
}).strict();
class JsonInvalido extends Error {}
function contentTypeJson(req: IncomingMessage): boolean {
  const header = req.headers["content-type"];
  return typeof header === "string"
    && /^application\/json(?:\s*;\s*charset\s*=\s*(?:utf-8|"utf-8"))?$/i.test(header.trim());
}
function send(res: ServerResponse, status: number, object: unknown) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" });
  res.end(JSON.stringify(object));
}
async function body(req: IncomingMessage): Promise<unknown> {
  let value = "";
  for await (const chunk of req) {
    value += String(chunk);
    if (value.length > 1_000_000) throw new Error("BODY_TOO_LARGE");
  }
  try {
    return JSON.parse(value);
  } catch (error) {
    // Só a falha do corpo HTTP é 400; JSON interno do ledger continua erro interno.
    if (error instanceof SyntaxError) throw new JsonInvalido();
    throw error;
  }
}

function payloadDocumento(value: unknown): { documentId: string; documentVersion: number; documentHash: string } | null {
  if (!value || typeof value !== "object") return null;
  const d = value as Record<string, unknown>;
  return typeof d.documentId === "string" && Number.isInteger(d.documentVersion)
    && typeof d.documentHash === "string"
    ? { documentId: d.documentId, documentVersion: d.documentVersion as number, documentHash: d.documentHash }
    : null;
}

function contextoDraft(value: unknown): { encounterId: string; tumorLotId: string | null } | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const outer = value as Record<string, unknown>;
  const inner = outer.contexto && typeof outer.contexto === "object" && !Array.isArray(outer.contexto)
    ? outer.contexto as Record<string, unknown> : outer;
  return typeof inner.encounterId === "string"
    && (typeof inner.tumorLotId === "string" || inner.tumorLotId === null)
    ? { encounterId: inner.encounterId, tumorLotId: inner.tumorLotId } : null;
}

/** W4-03 · a tela recebe conteúdo/hash calculado no servidor, nunca uma declaração do cliente. */
function exibirBundle(deps: ServidorDeps, token: string,
  input: z.infer<typeof ExibirBundle>): { status: number; body: unknown } {
  if (new Set(input.draftIds).size !== input.draftIds.length)
    return { status: 400, body: { codigo: "DRAFT_DUPLICADO" } };
  const documentos: { draftId: string; documentId: string; documentVersion: number;
    conteudo: unknown; conteudoHash: string }[] = [];
  const chaves = new Set<string>();
  for (const draftId of input.draftIds) {
    const draft = lerDraft(deps.db, draftId);
    if (!draft || draft.patientId !== input.patientId)
      return { status: 409, body: { codigo: "DRAFT_NAO_ENCONTRADO" } };
    const contexto = contextoDraft(draft.payload);
    if (contexto && contexto.encounterId !== input.encounterId)
      return { status: 409, body: { codigo: "DRAFT_ENCONTRO_DIVERGENTE" } };
    if (contexto && input.tumorLotId !== undefined && contexto.tumorLotId !== input.tumorLotId)
      return { status: 409, body: { codigo: "DRAFT_LOTE_DIVERGENTE" } };
    // Generic facts also need a server-issued reference and exact displayed content.
    const doc = payloadDocumento(draft.payload) ?? { documentId: draft.draftId, documentVersion: draft.revision + 1 };
    const chave = JSON.stringify([doc.documentId, doc.documentVersion]);
    if (chaves.has(chave)) return { status: 409, body: { codigo: "DOCUMENTO_DUPLICADO" } };
    chaves.add(chave);
    documentos.push({
      draftId, documentId: doc.documentId, documentVersion: doc.documentVersion,
      conteudo: draft.payload, conteudoHash: hashConteudoExibido(draft.payload),
    });
  }
  deps.sessoes.registrarBundleExibido(token,
    { patientId: input.patientId, encounterId: input.encounterId, tumorLotId: input.tumorLotId ?? null },
    documentos.map(({ draftId, documentId, documentVersion, conteudoHash }) =>
      ({ draftId, documentId, documentVersion, conteudoHash })));
  return { status: 200, body: { patientId: input.patientId, encounterId: input.encounterId, documentos } };
}

/** ConfirmarBloco is strict; all clinical contents are fetched from local drafts, not HTTP input. */
function confirmarBloco(deps: ServidorDeps, token: string, input: Confirmar): { status: number; body: unknown } {
  const sessao = deps.sessoes.obter(token)!;
  const contexto = { patientId: input.patientId, encounterId: input.encounterId, tumorLotId: input.tumorLotId };
  const exibidosNoServidor = deps.sessoes.bundleExibido(token, contexto);
  if (!exibidosNoServidor) return { status: 409, body: { codigo: "BUNDLE_NAO_EXIBIDO" } };
  if (g25EscopoAssinatura(input.documentosExibidos, exibidosNoServidor).decisao !== "PASSA")
    return { status: 409, body: { codigo: "ESCOPO_ASSINATURA_INVALIDO" } };
  if (new Set(input.registros.map((r) => r.id)).size !== input.registros.length)
    return { status: 409, body: { codigo: "DRAFT_DUPLICADO" } };
  const drafts = input.registros.map((r) => lerDraft(deps.db, r.id));
  if (drafts.some((draft) => !draft || draft.patientId !== input.patientId))
    return { status: 409, body: { codigo: "DRAFT_NAO_ENCONTRADO" } };
  if (drafts.some((draft) => {
    const contexto = contextoDraft(draft?.payload);
    return contexto && (contexto.encounterId !== input.encounterId || contexto.tumorLotId !== input.tumorLotId);
  })) return { status: 409, body: { codigo: "DRAFT_FORA_DO_ESCOPO" } };
  if (drafts.some((draft) => {
    const kind = draft?.payload && typeof draft.payload === "object" && "kind" in draft.payload
      ? draft.payload.kind : null;
    return kind === "EXTRACAO_RASCUNHO" || kind === "PRESCRICAO_RASCUNHO" || kind === "EVOLUCAO_RASCUNHO";
  })) return { status: 409, body: { codigo: "DRAFT_AINDA_RASCUNHO" } };
  const consulta = deps.sessoes.consultaSelecionada(token);
  if (consulta && (consulta.patientId !== contexto.patientId || consulta.encounterId !== contexto.encounterId
    || (consulta.tumorLotId ?? null) !== contexto.tumorLotId))
    return { status: 409, body: { codigo: "CONTEXTO_CONSULTA_ALTERADO" } };
  const escolhidos = input.documentosExibidos;
  const docs = drafts.map((d) => payloadDocumento(d!.payload));
  const refs = docs.map((doc, i) => doc ?? { documentId: drafts[i]!.draftId,
    documentVersion: input.registros[i]!.expectedRevision + 1 });
  if (refs.length !== escolhidos.length || new Set(refs.map((r) => JSON.stringify([r.documentId, r.documentVersion]))).size !== refs.length
    || refs.some((ref) => !escolhidos.some((d) => d.documentId === ref.documentId && d.documentVersion === ref.documentVersion)))
    return { status: 409, body: { codigo: "DOCUMENTO_NAO_SELECIONADO" } };
  // A13: só assina o conteúdo EXATO exibido. Hash ausente ou diferente ⇒ 409 (o draft mudou depois da tela).
  const hashes = drafts.map((d) => hashConteudoExibido(d!.payload));
  const alterado = refs.some((doc, i) => !exibidosNoServidor.some((x) => x.documentId === doc.documentId
      && x.documentVersion === doc.documentVersion && x.conteudoHash === hashes[i]
      && x.draftId === drafts[i]!.draftId));
  if (alterado) return { status: 409, body: { codigo: "CONTEUDO_ALTERADO_APOS_EXIBICAO" } };
  const em = deps.db.prepare("SELECT criadoEm FROM operation WHERE operationId=?")
    .get(input.idempotencyKey)?.criadoEm as string | undefined ?? deps.agora();
  const reviewDecisionId = sha(JSON.stringify({ input, medicoId: sessao.medicoId }));
  const registros = input.registros.map((r, i) => {
    const doc = docs[i];
    const selected = doc && escolhidos.some((e) =>
      e.documentId === doc.documentId && e.documentVersion === doc.documentVersion);
    const draft = drafts[i]!;
    return { draftId: r.id, expectedRevision: r.expectedRevision,
      eventId: sha(`${input.idempotencyKey}:${r.id}:${i}`), tipo: doc ? "DOCUMENTO" : "FATO",
      payload: selected ? { data: draft.payload,
        signature: { documentId: doc.documentId, documentVersion: doc.documentVersion,
          documentHash: hashes[i]!, declaredHash: doc.documentHash, reviewDecisionId, serverActorId: sessao.medicoId } }
        : draft.payload,
      fontes: [], revisao: selected ? "ASSINADO" as const : "CONFIRMADO" as const };
  });
  const result = confirmar(deps.db, { operationId: input.idempotencyKey,
    patientId: input.patientId, tumorLotId: input.tumorLotId, encounterId: input.encounterId,
    reviewDecisionId, sessao, em, registros });
  return { status: result.estado === "NEGADA" ? 409 : 200,
    body: { codigo: result.estado, resultRef: result.resultRef } };
}

export async function rotear(deps: ServidorDeps, req: IncomingMessage, res: ServerResponse): Promise<void> {
  const rota = req.url === "/login" ? "login"
    : req.url === "/consulta/bundle" ? "bundle"
      : req.url === "/consulta/confirmar" ? "confirmar"
        : req.url === "/consulta/extrair" ? "extrair"
          : req.url === "/consulta/prescricao/rascunho" ? "rascunhoPrescricao"
          : req.url === "/consulta/rascunho" ? "rascunho"
            : req.url === "/consulta/rascunho/revisar" ? "revisarRascunho"
            : req.url === "/consulta/rascunho/preparar-revisao" ? "prepararRevisao"
            : req.url === "/consulta/oncoassist/status" ? "oncoassistStatus"
            : req.url === "/consulta/oncoassist/classificar-fonte" ? "oncoassistClassificar"
            : req.url === "/consulta/oncoassist/fontes" ? "oncoassistFontes"
              : req.url === "/consulta/carregar" ? "carregarConsulta"
                : req.url === "/consulta/agenda" ? "agenda"
                  : req.url === "/consulta/salao" ? "salao"
                    : req.url === "/consulta/canal" ? "canal"
                      : req.url === "/consulta/apac" ? "apac"
                        : req.url === "/consulta/chat" ? "chat"
                          : req.url === "/consulta/recist" ? "recist"
      : req.url === "/consulta/estatistica" ? "estatistica"
                            : req.url === "/conhecimento/consultar" ? "consultarConhecimento"
                          : req.url === "/config/perfil" ? "lerPerfil"
                            : req.url === "/config/perfil/salvar" ? "salvarPerfil"
                              : req.url === "/config/caixa/ler" ? "lerCaixa"
                                : req.url === "/config/caixa/alterar" ? "alterarCaixa"
            : req.url === "/config/historico" ? "historicoConfig"
                          : req.url === "/acao" ? "acao" : "desconhecida";
  const reply = (status: number, codigo: string, result: unknown = { codigo }) => {
    deps.log({ rota, codigo, status }); send(res, status, result);
  };
  if (req.method !== "POST" || rota === "desconhecida") return reply(404, "ROTA_NAO_ENCONTRADA");
  try {
    if (rota === "login") {
      const parsed = z.object({ senha: z.string() }).strict().safeParse(await body(req));
      if (!parsed.success) return reply(400, "PAYLOAD_INVALIDO");
      const login = deps.sessoes.login(parsed.data.senha);
      return login ? reply(200, "LOGIN_OK", { token: login.token, expiraEm: login.sessao.expiraEm })
        : reply(401, "LOGIN_NEGADO");
    }
    const auth = req.headers.authorization;
    const token = auth?.startsWith("Bearer ") ? auth.slice(7) : "";
    const sessao = deps.sessoes.obter(token);
    if (!sessao) return reply(401, "SESSAO_INVALIDA");
    // A rota de efeito externo não aceita JSON sob um tipo de mídia diferente.
    // O gate de autenticação continua anterior a esta checagem.
    if (rota === "acao" && !contentTypeJson(req)) return reply(415, "CONTENT_TYPE_INVALIDO");
    const raw = await body(req);
    if (rota === "oncoassistStatus") {
      if (!z.object({}).strict().safeParse(raw).success) return reply(400, "PAYLOAD_INVALIDO");
      const service = deps.oncoassistJev ?? criarOncoassistJev();
      return reply(200, "ONCOASSIST_STATUS", service.status());
    }
    if (rota === "oncoassistClassificar" || rota === "oncoassistFontes") {
      const parsed = z.object({ draftId: Id.optional(), patientId: Id, encounterId: Id, tumorLotId: Id.nullable() }).strict()
        .refine((value) => rota === "oncoassistClassificar" ? !!value.draftId : value.draftId === undefined)
        .safeParse(raw);
      if (!parsed.success) return reply(400, "PAYLOAD_INVALIDO");
      const contexto = deps.sessoes.consultaSelecionada(token);
      if (!contexto) return reply(409, "CONTEXTO_CONSULTA_NAO_SELECIONADO");
      if (contexto.patientId !== parsed.data.patientId || contexto.encounterId !== parsed.data.encounterId
        || (contexto.tumorLotId ?? null) !== parsed.data.tumorLotId)
        return reply(409, "CONTEXTO_CONSULTA_ALTERADO");
      const escopoFonte = (value: unknown) => z.object({ kind: z.literal("EXTRACAO_RASCUNHO"),
        patientLinkReview: z.object({ patientId: z.literal(contexto.patientId),
          encounterId: z.literal(contexto.encounterId), tumorLotId: z.literal(contexto.tumorLotId ?? null) }) })
        .safeParse(value).success;
      if (rota === "oncoassistFontes") {
        const fontes = listarDrafts(deps.db, contexto.patientId).filter((draft) => escopoFonte(draft.payload))
          .map((draft, index) => ({ draftId: draft.draftId, rotulo: `Fonte local ${index + 1}`, criadoEm: draft.criadoEm }));
        return reply(200, "ONCOASSIST_FONTES", { fontes });
      }
      const draft = lerDraft(deps.db, parsed.data.draftId!);
      if (!draft || draft.patientId !== contexto.patientId) return reply(409, "DRAFT_FORA_DO_ESCOPO");
      if (!escopoFonte(draft.payload)) return reply(409, "DRAFT_FORA_DO_ESCOPO");
      const payload = z.object({ kind: z.literal("EXTRACAO_RASCUNHO"),
        input: z.object({ sourceId: z.string().min(1), rawTranscript: z.string().min(1) }),
        patientLinkReview: z.object({ patientId: Id }) }).safeParse(draft.payload);
      if (!payload.success || payload.data.patientLinkReview.patientId !== contexto.patientId)
        return reply(409, "VINCULO_PACIENTE_NAO_CONFIRMADO");
      const paciente = lerPaciente(deps.db, contexto.patientId);
      if (!paciente) return reply(409, "PACIENTE_DESTINO_NAO_ENCONTRADO");
      const controller = new AbortController();
      const desconectado = () => controller.abort();
      res.once("close", desconectado);
      try {
        const service = deps.oncoassistJev ?? criarOncoassistJev();
        const result = await service.avaliar({ fonte: { id: payload.data.input.sourceId,
          texto: payload.data.input.rawTranscript } }, { dicionario: {
          nomes: [paciente.nome], identificadores: [paciente.patientId, sessao.medicoId, sessao.crm,
            ...paciente.identificadores.map((item) => item.valor), ...(paciente.nascimento ? [paciente.nascimento] : [])],
        } }, controller.signal);
        if (!deps.sessoes.obter(token)) return reply(401, "SESSAO_INVALIDA");
        const atual = deps.sessoes.consultaSelecionada(token);
        const draftAtual = lerDraft(deps.db, draft.draftId);
        if (!atual || atual.patientId !== contexto.patientId || atual.encounterId !== contexto.encounterId
          || (atual.tumorLotId ?? null) !== (contexto.tumorLotId ?? null))
          return reply(409, "CONTEXTO_CONSULTA_ALTERADO");
        if (!draftAtual || draftAtual.patientId !== draft.patientId || draftAtual.revision !== draft.revision
          || hashConteudoExibido(draftAtual.payload) !== hashConteudoExibido(draft.payload))
          return reply(409, "FONTE_ALTERADA");
        return reply(200, "ONCOASSIST_RESULTADO", result);
      } finally { res.off("close", desconectado); }
    }
    if (rota === "consultarConhecimento") {
      const parsed = z.object({ query: z.string().min(1).max(240), tipos: z.array(z.string()).optional(),
        status: z.array(z.string()).optional(), proveniencia: z.object({ modulo: z.string().optional(), aula: z.string().optional() })
          .strict().optional(), topK: z.number().int().positive().max(100).optional() }).strict().safeParse(raw);
      if (!parsed.success) return reply(400, "CONSULTA_INVALIDA");
      const proveniencia = parsed.data.proveniencia === undefined ? undefined : {
        ...(parsed.data.proveniencia.modulo === undefined ? {} : { modulo: parsed.data.proveniencia.modulo }),
        ...(parsed.data.proveniencia.aula === undefined ? {} : { aula: parsed.data.proveniencia.aula }),
      };
      const consulta = { query: parsed.data.query,
        ...(parsed.data.tipos === undefined ? {} : { tipos: parsed.data.tipos }),
        ...(parsed.data.status === undefined ? {} : { status: parsed.data.status }),
        ...(proveniencia === undefined ? {} : { proveniencia }),
        ...(parsed.data.topK === undefined ? {} : { topK: parsed.data.topK }) };
      const result = await consultarGrafoLocal(consulta);
      return reply(result.status === "OK" ? 200 : 409,
        result.status === "OK" ? "REFERENCIAS_CARREGADAS" : result.codigo, result);
    }
    if (rota === "recist") {
      const parsed = z.object({ patientId: Id }).strict().safeParse(raw);
      if (!parsed.success) return reply(400, "PAYLOAD_INVALIDO");
      const result = lerRecist(deps.db, parsed.data.patientId);
      return reply(result.estado === "PENDENTE" ? 404 : 200,
        "codigo" in result ? result.codigo : "RECIST_PROPOSTO", result);
    }
    if (rota === "estatistica") {
      const parsed = z.object({ periodoClinico: z.object({ inicio: DataCivil, fim: DataCivil }).strict()
        .refine((value) => value.inicio <= value.fim).optional() }).strict().safeParse(raw);
      if (!parsed.success) return reply(400, "PAYLOAD_INVALIDO");
      return reply(200, "ESTATISTICA_DERIVADA", projetarEstatisticaLedger(deps.db,
        parsed.data.periodoClinico ? { periodoClinico: parsed.data.periodoClinico } : undefined));
    }
    if (rota === "rascunhoPrescricao") {
      const parsed = z.object({ patientId: Id, encounterId: Id, tumorLotId: Id.nullable(),
        templateId: z.string().min(1).optional(), expression: z.string().min(1).max(5000).optional() })
        .strict().refine((x) => Number(!!x.templateId) + Number(!!x.expression) === 1).safeParse(raw);
      if (!parsed.success) return reply(400, "PAYLOAD_INVALIDO");
      const contexto = deps.sessoes.consultaSelecionada(token);
      if (!contexto) return reply(409, "CONTEXTO_CONSULTA_NAO_SELECIONADO");
      if (contexto.patientId !== parsed.data.patientId || contexto.encounterId !== parsed.data.encounterId
        || (contexto.tumorLotId ?? null) !== parsed.data.tumorLotId)
        return reply(409, "CONTEXTO_CONSULTA_ALTERADO");
      const hoje = dataCivilDoServico(deps.agora(), "-03:00");
      if (parsed.data.templateId) {
        const template = deps.corpus?.templatesProtocolo.find((t) => t.templateId === parsed.data.templateId);
        if (!template) return reply(404, "TEMPLATE_NAO_ENCONTRADO");
        const instanciacao = hoje.estado === "OK"
          ? instanciarProtocolo(template, { pesoKg: null, alturaCm: null, bsaM2: null, clcr: null, medidoEm: null })
          : { ok: false as const, recusa: { codigo: "DADOS_CORPORAIS_PENDENTES", motivo: hoje.codigo } };
        const itens = instanciacao.ok ? instanciacao.itens.map((item) => item.item) : [];
        const seguranca = { resultado: "NOT_EVALUABLE" as const,
          motivos: [{ codigo: "REQUISITOS_DE_SEGURANCA_NAO_DISPONIVEIS",
            texto: "requisitos de segurança e medidas de paciente ainda não foram validados para esta ficha",
            fonte: template.fonte }] };
        const saved = salvarDraft(deps.db, { draftId: randomUUID(), patientId: contexto.patientId,
          sourceId: "selecao-local-de-prescricao", rawRef: "proposta-prescricao-local",
          payload: { kind: "PRESCRICAO_RASCUNHO", contexto, template, instanciacao, seguranca,
            status: "RASCUNHO", assinada: false },
          diagnostics: [template.status === "RASCUNHO" ? "TEMPLATE_NAO_CONFERIDO" : "REVISAO_MEDICA_OBRIGATORIA",
            "SEGURANCA_NAO_AVALIAVEL"],
          revision: 0, criadoEm: deps.agora() });
        return reply(201, "PRESCRICAO_RASCUNHO_SALVA", { draftId: saved.draftId,
          instanciacao, classificacao: template.itens.map((item) => classificarDocumento(item.drug, deps.corpus?.regulatorio ?? null)),
          seguranca, assina: false, exporta: false });
      }
      const quickLine = parserLinha(parsed.data.expression!);
      const classificacao = classificarDocumento(quickLine.parsed.drug ?? "", deps.corpus?.regulatorio ?? null);
      const seguranca = { resultado: "NOT_EVALUABLE" as const,
        motivos: [{ codigo: "SEM_ITEM_E_REQUISITO_TIPADO",
          texto: "linha em rascunho sem item validado e sem requisitos de segurança declarados",
          fonte: "prescricao local: fonte/manual" }] };
      const saved = salvarDraft(deps.db, { draftId: randomUUID(), patientId: contexto.patientId,
        sourceId: "linha-manual-de-prescricao", rawRef: "proposta-prescricao-local",
        payload: { kind: "PRESCRICAO_RASCUNHO", contexto, quickLine, classificacao, seguranca,
          status: "RASCUNHO", assinada: false },
        diagnostics: [...quickLine.pendencias, ...(classificacao.estado === "PENDENTE" ? ["CLASSIFICACAO_DOCUMENTAL_PENDENTE"] : []),
          "SEGURANCA_NAO_AVALIAVEL", "REVISAO_MEDICA_OBRIGATORIA"], revision: 0, criadoEm: deps.agora() });
      return reply(201, "PRESCRICAO_RASCUNHO_SALVA", { draftId: saved.draftId, quickLine,
        classificacao, seguranca, assina: false, exporta: false });
    }
    if (["lerPerfil", "salvarPerfil", "lerCaixa", "alterarCaixa", "historicoConfig"].includes(rota)) {
      if (!deps.settings) return reply(503, "CONFIGURACAO_INDISPONIVEL");
      if (rota === "lerPerfil") {
        if (!z.object({}).strict().safeParse(raw).success) return reply(400, "PAYLOAD_INVALIDO");
        return reply(200, "PERFIL_CARREGADO", deps.settings.readProfile(sessao));
      }
      if (rota === "salvarPerfil") {
        const parsed = z.object({ operationId: z.string().min(8), expectedRevision: z.number().int().nonnegative(),
          perfil: z.unknown(), motivo: z.string().max(1000).nullable().optional() }).strict().safeParse(raw);
        if (!parsed.success) return reply(400, "PAYLOAD_INVALIDO");
        const result = deps.settings.saveProfile({ ...parsed.data, motivo: parsed.data.motivo ?? null }, sessao);
        return reply(result.estado === "CONFLITO" || result.estado === "NEGADA" ? 409 : 200, result.estado, result);
      }
      if (rota === "lerCaixa") {
        const parsed = z.object({ numero: z.number().int().positive() }).strict().safeParse(raw);
        if (!parsed.success) return reply(400, "PAYLOAD_INVALIDO");
        const catalog = deps.corpus?.caixasTodas.find((box) => box.numero === parsed.data.numero);
        if (!catalog) return reply(404, "CAIXA_DESCONHECIDA");
        if (catalog.chave.startsWith("apac.")) return reply(409, "CONTEXTO_PACIENTE_OBRIGATORIO");
        if (!catalog.chave.startsWith("config.")) return reply(409, "CAIXA_FORA_DA_CONFIGURACAO_GLOBAL");
        return reply(200, "CAIXA_CARREGADA", deps.settings.readBox(parsed.data.numero, sessao));
      }
      if (rota === "alterarCaixa") {
        const parsed = z.object({ numero: z.number().int().positive(), valorNovo: z.unknown(),
          expectedRevision: z.number().int().nonnegative(), operationId: z.string().min(8),
          motivo: z.string().max(1000).nullable().optional() }).strict().safeParse(raw);
        if (!parsed.success) return reply(400, "PAYLOAD_INVALIDO");
        const catalog = deps.corpus?.caixasTodas.find((box) => box.numero === parsed.data.numero);
        if (!catalog) return reply(404, "CAIXA_DESCONHECIDA");
        if (catalog.chave.startsWith("apac.")) return reply(409, "CONTEXTO_PACIENTE_OBRIGATORIO");
        if (!catalog.chave.startsWith("config.")) return reply(409, "CAIXA_FORA_DA_CONFIGURACAO_GLOBAL");
        const result = deps.settings.changeBox({ ...parsed.data, motivo: parsed.data.motivo ?? null,
          autorizacaoMedica: true }, sessao);
        return reply(result.estado === "CONFLITO" || result.estado === "NEGADA" ? 409 : 200, result.estado, result);
      }
      if (!z.object({}).strict().safeParse(raw).success) return reply(400, "PAYLOAD_INVALIDO");
      return reply(200, "HISTORICO_CARREGADO", { itens: deps.settings.readHistory(sessao) });
    }
    if (rota === "carregarConsulta") {
      const parsed = z.object({ patientId: Id, tumorLotId: Id.nullable().optional() }).strict().safeParse(raw);
      if (!parsed.success) return reply(400, "PAYLOAD_INVALIDO");
      const result = lerConsulta(deps.db, parsed.data.patientId, deps.agora(), sessao, parsed.data.tumorLotId);
      if (!("codigo" in result)) deps.sessoes.selecionarConsulta(token, {
        patientId: result.patientId, encounterId: result.encounterId, tumorLotId: result.tumorLotId,
      });
      else deps.sessoes.selecionarConsulta(token, null);
      return reply("codigo" in result ? 404 : 200, "codigo" in result ? result.codigo : "CONSULTA_CARREGADA", result);
    }
    if (rota === "agenda") {
      const parsed = z.object({}).strict().safeParse(raw);
      if (!parsed.success) return reply(400, "PAYLOAD_INVALIDO");
      const result = lerAgenda(deps.db, deps.agora());
      return reply(200, result.estado === "FONTE_AUSENTE" ? "FONTE_AGENDA_AUSENTE" : "AGENDA_CARREGADA", result);
    }
    if (rota === "salao") {
      const parsed = z.object({}).strict().safeParse(raw);
      if (!parsed.success) return reply(400, "PAYLOAD_INVALIDO");
      const result = lerSalao(deps.db, deps.agora(), deps.salaoRuleset);
      return reply(200, "estado" in result && result.estado === "PENDENTE" ? result.codigo : "SALAO_CARREGADO", result);
    }
    if (rota === "canal") {
      const parsed = z.object({}).strict().safeParse(raw);
      if (!parsed.success) return reply(400, "PAYLOAD_INVALIDO");
      const result = lerCanal(deps.db);
      return reply(200, result.estado === "FONTE_AUSENTE" ? "FONTE_CANAL_AUSENTE" : "CANAL_CARREGADO", result);
    }
    if (rota === "apac") {
      const parsed = z.object({}).strict().safeParse(raw);
      if (!parsed.success) return reply(400, "PAYLOAD_INVALIDO");
      const cnes = deps.settings?.readProfile(sessao).perfil.instituicao.cnes ?? "";
      const result = lerApacs(deps.db, deps.agora(), { caixas: deps.corpus?.caixasTodas ?? [],
        sigtap: {}, cnesConfigurado: cnes });
      return reply(200, result.estado === "FONTE_AUSENTE" ? "FONTE_APAC_AUSENTE" : "APAC_CARREGADA", result);
    }
    if (rota === "chat") {
      const parsed = z.object({ setor: z.enum(["TRIAGEM", "FARMACIA", "SECRETARIA", "MEDICO"]) }).strict().safeParse(raw);
      if (!parsed.success) return reply(400, "PAYLOAD_INVALIDO");
      const contexto = deps.sessoes.consultaSelecionada(token);
      if (!contexto) return reply(409, "CONTEXTO_CHAT_NAO_SELECIONADO", { setor: parsed.data.setor, mensagens: [] });
      const mensagens = lerMensagensChat(deps.db, parsed.data.setor, contexto);
      return reply(200, "CHAT_CARREGADO", { ...contexto, setor: parsed.data.setor, mensagens, prescricao: null });
    }
    if (rota === "bundle") {
      const parsed = ExibirBundle.safeParse(raw);
      if (parsed.success) {
        const result = exibirBundle(deps, token, parsed.data);
        return reply(result.status, (result.body as { codigo?: string }).codigo ?? "BUNDLE_EXIBIDO", result.body);
      }
      const pedido = z.object({ patientId: Id, encounterId: Id, tumorLotId: Id.nullable() }).strict().safeParse(raw);
      if (!pedido.success) return reply(400, "PAYLOAD_INVALIDO");
      const draftIds = listarDrafts(deps.db, pedido.data.patientId).filter((draft) => {
        const kind = draft.payload && typeof draft.payload === "object" && "kind" in draft.payload
          ? draft.payload.kind : null;
        const contexto = contextoDraft(draft.payload);
        return kind !== "EXTRACAO_RASCUNHO" && kind !== "PRESCRICAO_RASCUNHO"
          && contexto?.encounterId === pedido.data.encounterId
          && contexto.tumorLotId === pedido.data.tumorLotId && payloadDocumento(draft.payload) !== null;
      }).map((draft) => draft.draftId);
      const result = exibirBundle(deps, token, { ...pedido.data, draftIds });
      return reply(result.status, (result.body as { codigo?: string }).codigo ?? "BUNDLE_EXIBIDO", result.body);
    }
    if (rota === "confirmar") {
      const parsed = ConfirmarBloco.safeParse(raw);
      if (!parsed.success) return reply(400, "PAYLOAD_INVALIDO");
      const result = confirmarBloco(deps, token, parsed.data);
      return reply(result.status, (result.body as { codigo: string }).codigo, result.body);
    }
    if (rota === "extrair") {
      const inputSchema = z.object({
        recordingId: z.string().min(1), sourceId: z.string().min(1),
        sourceType: z.enum(["pathology", "imaging_report", "prescription", "medical_note", "nursing", "plaud", "administration"]),
        page: z.number().int().nonnegative().optional(), rawTranscript: z.string().min(1).max(200_000),
      }).strict();
      const parsed = inputSchema.safeParse(raw);
      if (!parsed.success) return reply(400, "PAYLOAD_INVALIDO");
      const input = { recordingId: parsed.data.recordingId, sourceId: parsed.data.sourceId,
        sourceType: parsed.data.sourceType, rawTranscript: parsed.data.rawTranscript,
        ...(parsed.data.page === undefined ? {} : { page: parsed.data.page }) };
      const state = executarPipelineExtracao(input);
      // Gates are advisory at draft time: absent anatomy/laterality/specimen stays
      // pending and never prevents local persistence or consultation.
      const stages = state.facts.filter((f) => f.domain === "stage" && typeof f.value === "string");
      const alerts = [
        g07Lateralidade({}),
        g08AnatomiaSexo({}),
        ...stages.map((f) => {
          const prefix = String(f.value).match(/(?:^|\s)(yp|p|c)t/i)?.[1] ?? "";
          return g09PtDeBiopsia({ prefixo: prefix, tnmExplicito: true,
            specimen: parsed.data.sourceType === "pathology" ? "DESCONHECIDO" : undefined });
        }),
      ];
      const saved = salvarDraft(deps.db, {
        draftId: randomUUID(), patientId: null, sourceId: parsed.data.sourceId,
        rawRef: `importacao-local:${parsed.data.recordingId}`,
        payload: { kind: "EXTRACAO_RASCUNHO", input: parsed.data, state, alerts },
        diagnostics: ["VINCULO_MEDICO_PENDENTE", ...state.confirmationRequired.map((e) => e.kind),
          ...alerts.filter((a) => a.decisao !== "PASSA").map((a) => `${a.gate}_${a.decisao}`)],
        revision: 0, criadoEm: deps.agora(),
      });
      return reply(201, "RASCUNHO_SALVO", { draftId: saved.draftId, revision: saved.revision,
        linkedPatientId: null, facts: state.facts, exceptions: state.confirmationRequired,
        timeline: null, alerts, requiresMedicalReview: true });
    }
    if (rota === "rascunho") {
      const parsed = z.object({ draftId: z.string().min(1) }).strict().safeParse(raw);
      if (!parsed.success) return reply(400, "PAYLOAD_INVALIDO");
      const draft = lerDraft(deps.db, parsed.data.draftId);
      if (!draft) return reply(404, "RASCUNHO_NAO_ENCONTRADO");
      return reply(200, "RASCUNHO_CARREGADO", { draft });
    }
    if (rota === "revisarRascunho" || rota === "prepararRevisao") {
      const parsed = z.object({ draftId: z.string().min(1), expectedRevision: z.number().int().nonnegative(),
        patientId: Id, factIds: z.array(Id).min(1).optional(), operationId: z.string().min(8).optional(),
        comprovanteExibicao: z.object({ documentId: Id, documentVersion: z.number().int().positive(),
          conteudoHash: z.string().regex(/^[0-9a-f]{64}$/) }).strict().optional() })
        .strict().refine((value) => value.factIds === undefined || value.operationId !== undefined).safeParse(raw);
      if (!parsed.success) return reply(400, "PAYLOAD_INVALIDO");
      if (rota === "prepararRevisao" && (!parsed.data.factIds || parsed.data.comprovanteExibicao))
        return reply(400, "PAYLOAD_INVALIDO");
      let draft = lerDraft(deps.db, parsed.data.draftId);
      if (!draft || draft.revision !== parsed.data.expectedRevision)
        return reply(409, "REVISAO_RASCUNHO_CONFLITANTE");
      const draftKind = draft.payload && typeof draft.payload === "object" && "kind" in draft.payload
        ? draft.payload.kind : null;
      if (draftKind !== "EXTRACAO_RASCUNHO")
        return reply(409, "TIPO_RASCUNHO_NAO_PODE_SER_VINCULADO");
      if (!lerPaciente(deps.db, parsed.data.patientId)) return reply(404, "PACIENTE_DESTINO_NAO_ENCONTRADO");
      const payloadOriginal = draft.payload && typeof draft.payload === "object" && !Array.isArray(draft.payload)
        ? draft.payload as Record<string, unknown> : null;
      const linkReview = payloadOriginal?.patientLinkReview && typeof payloadOriginal.patientLinkReview === "object"
        ? payloadOriginal.patientLinkReview as Record<string, unknown> : null;
      if (draft.patientId !== null && draft.patientId !== parsed.data.patientId)
        return reply(409, "RASCUNHO_VINCULADO_A_OUTRO_PACIENTE");
      if (draft.patientId === null) {
        if (parsed.data.factIds) return reply(409, "VINCULO_PACIENTE_NAO_CONFIRMADO");
        const consultaVinculo = deps.sessoes.consultaSelecionada(token);
        const reviewed = salvarDraft(deps.db, { ...draft, patientId: parsed.data.patientId,
          revision: draft.revision + 1,
          payload: { ...payloadOriginal, patientLinkReview: { patientId: parsed.data.patientId,
            medicoId: sessao.medicoId, em: deps.agora(),
            ...(consultaVinculo?.patientId === parsed.data.patientId ? {
              encounterId: consultaVinculo.encounterId, tumorLotId: consultaVinculo.tumorLotId ?? null,
            } : {}) } },
          diagnostics: [...draft.diagnostics, "VINCULO_PACIENTE_CONFIRMADO_POR_MEDICO"] });
        if (reviewed.diagnostics.includes("EXPECTED_REVISION_CONFLICT"))
          return reply(409, "REVISAO_RASCUNHO_CONFLITANTE");
        draft = reviewed;
      } else if (linkReview?.patientId !== parsed.data.patientId) {
        return reply(409, "VINCULO_PACIENTE_NAO_CONFIRMADO");
      }
      if (!parsed.data.factIds) return reply(200, "VINCULO_REVISTO", {
        codigo: "VINCULO_REVISTO", draftId: draft.draftId, revision: draft.revision,
        linkedPatientId: draft.patientId, fatosConfirmados: 0, criaEventoClinico: false,
      });

      const contexto = deps.sessoes.consultaSelecionada(token);
      if (!contexto) return reply(409, "CONTEXTO_CONSULTA_NAO_SELECIONADO");
      if (contexto.patientId !== parsed.data.patientId) return reply(409, "PACIENTE_FORA_DA_CONSULTA_SELECIONADA");
      if (linkReview?.encounterId !== undefined && (linkReview.encounterId !== contexto.encounterId
        || (linkReview.tumorLotId ?? null) !== (contexto.tumorLotId ?? null)))
        return reply(409, "DRAFT_FORA_DO_ESCOPO");
      if (!payloadOriginal || typeof payloadOriginal.input !== "object" || payloadOriginal.input === null
        || typeof payloadOriginal.state !== "object" || payloadOriginal.state === null)
        return reply(409, "EXTRACAO_RASCUNHO_INVALIDO");
      const extractionInput = payloadOriginal.input as Record<string, unknown>;
      const extractionState = payloadOriginal.state as Record<string, unknown>;
      if (typeof extractionInput.sourceId !== "string" || typeof extractionInput.sourceType !== "string"
        || typeof extractionInput.rawTranscript !== "string" || !Array.isArray(extractionState.facts)
        || !Array.isArray(extractionState.confirmationRequired))
        return reply(409, "EXTRACAO_RASCUNHO_INVALIDO");
      const operationId = parsed.data.operationId!;
      const operacaoExistente = deps.db.prepare("SELECT criadoEm FROM operation WHERE operationId=?").get(operationId);
      const summaryId = `evolucao-extracao-${sha(operationId).slice(0, 32)}`;
      const summaryDraft = lerDraft(deps.db, summaryId);
      const em = typeof operacaoExistente?.criadoEm === "string" ? operacaoExistente.criadoEm
        : summaryDraft?.criadoEm ?? deps.agora();
      let revisao: ReturnType<typeof prepararRevisaoExtracao>;
      try {
        revisao = prepararRevisaoExtracao({ draftId: draft.draftId, sourceId: extractionInput.sourceId,
          rawTranscript: extractionInput.rawTranscript, sourceType: extractionInput.sourceType,
          facts: extractionState.facts, exceptions: extractionState.confirmationRequired,
          patientId: parsed.data.patientId, encounterId: contexto.encounterId,
          tumorLotId: contexto.tumorLotId ?? null, factIds: parsed.data.factIds, operationId,
          medicoId: sessao.medicoId, em,
          origem: { draftId: draft.draftId, revision: draft.revision, conteudoHash: hashConteudoExibido(draft.payload) } });
      } catch (error) {
        const code = error instanceof Error ? error.message : "EXTRACAO_RASCUNHO_INVALIDO";
        return reply(409, ["FACT_IDS_INVALIDOS", "PROVENIENCIA_DIVERGENTE", "FATO_NAO_ENCONTRADO"].includes(code)
          ? code : "EXTRACAO_RASCUNHO_INVALIDO");
      }
      if (operacaoExistente && !summaryDraft)
        return reply(409, "CHAVE_IDEMPOTENCIA_REUTILIZADA");
      if (summaryDraft && (summaryDraft.patientId !== parsed.data.patientId
        || JSON.stringify(summaryDraft.payload) !== JSON.stringify(revisao.payload)))
        return reply(409, "CHAVE_IDEMPOTENCIA_REUTILIZADA");
      const documento = { documentId: revisao.draftId, documentVersion: 1,
        conteudoHash: hashConteudoExibido(revisao.payload) };
      const escopo = { ...contexto, tumorLotId: contexto.tumorLotId ?? null };
      if (rota === "prepararRevisao") {
        if (!summaryDraft) salvarDraft(deps.db, { draftId: revisao.draftId, patientId: parsed.data.patientId,
          sourceId: revisao.sourceId, rawRef: `revisao-local:${draft.draftId}`, payload: revisao.payload,
          diagnostics: ["EVOLUCAO_RASCUNHO", "REVISAO_MEDICA_PENDENTE"], revision: 0, criadoEm: em });
        deps.sessoes.registrarBundleExibido(token, escopo, [documento]);
        return reply(200, "REVISAO_PREPARADA", { codigo: "REVISAO_PREPARADA",
          conteudo: revisao.payload, comprovanteExibicao: documento, criaEventoClinico: false });
      }
      const exibidos = deps.sessoes.bundleExibido(token, escopo);
      const comprovante = parsed.data.comprovanteExibicao;
      if (!summaryDraft || !exibidos || !comprovante) return reply(409, "BUNDLE_NAO_EXIBIDO");
      if (g25EscopoAssinatura([comprovante], exibidos).decisao !== "PASSA"
        || comprovante.documentId !== documento.documentId || comprovante.documentVersion !== documento.documentVersion)
        return reply(409, "ESCOPO_ASSINATURA_INVALIDO");
      if (comprovante.conteudoHash !== documento.conteudoHash || !exibidos.some((item) =>
        item.documentId === documento.documentId && item.documentVersion === documento.documentVersion
        && item.conteudoHash === documento.conteudoHash)) return reply(409, "CONTEUDO_ALTERADO_APOS_EXIBICAO");
      const result = confirmar(deps.db, { operationId, patientId: parsed.data.patientId,
        tumorLotId: contexto.tumorLotId ?? null, encounterId: contexto.encounterId,
        reviewDecisionId: operationId, sessao, em,
        registros: revisao.registros.map((registro) => ({ draftId: revisao.draftId, expectedRevision: 0,
          eventId: registro.eventId, tipo: registro.tipo, payload: registro.payload, fontes: [...registro.fontes],
          revisao: "CONFIRMADO" as const })) });
      if (result.estado === "NEGADA") return reply(409, result.motivo ?? "REVISAO_NEGADA");
      const persisted = lerDraft(deps.db, revisao.draftId);
      return reply(200, result.estado === "REPLAY" ? "REVISAO_REPLAY" : "FATOS_REVISTOS", {
        codigo: result.estado, draftId: revisao.draftId, revision: persisted?.revision ?? 1,
        linkedPatientId: parsed.data.patientId, encounterId: contexto.encounterId,
        factIds: parsed.data.factIds, resultRef: result.resultRef, evolucaoRascunho: revisao.payload.resumo,
        revisaoMedica: { medicoId: sessao.medicoId, em },
      });
    }
    const parsed = ActionIntent.safeParse(raw);
    if (!parsed.success) return reply(400, "PAYLOAD_INVALIDO");
    const autorizacao = autorizarSaida(deps.db, parsed.data);
    if (!autorizacao.ok) return reply(409, autorizacao.codigo);
    // Uma rota /acao nunca usa a idempotencia volátil do caller: o ledger local
    // conserva a reserva OUTCOME_UNKNOWN antes do executor, inclusive após reiniciar.
    const result = await deps.gateway.withStore(sqliteIdempotencia(deps.db)).executar(parsed.data, sessao);
    return reply(result.decisao === "NEGADA" ? 409 : 200, result.motivoCodigo, result);
  } catch (error) {
    if (error instanceof JsonInvalido) return reply(400, "JSON_INVALIDO");
    if (error instanceof Error && error.message === "CONTEXTO_PACIENTE_OBRIGATORIO")
      return reply(409, "CONTEXTO_PACIENTE_OBRIGATORIO");
    // Never log request bodies, identifiers, thrown error text or stack.
    return reply(500, "ERRO_INTERNO");
  }
}
