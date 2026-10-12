import { createHash } from "node:crypto";
import { z } from "zod";
import { Id } from "../contracts/base.js";
import { Correlacao } from "../contracts/f1/correlacao.js";
import { lerDraft, listarDrafts, salvarDraft } from "../kernel/comandos/portas.js";
import type { ServidorDeps } from "./rotas.js";
import type { criarRuntimeExtracaoLlm } from "../kernel/llm/openai/runtime.js";
import { lerPaciente } from "./leituras.js";

const Pedido = z.object({ draftId: Id, patientId: Id, encounterId: Id, tumorLotId: Id.nullable(), idempotencyKey: Id }).strict();
type DepsExtracao = ServidorDeps & { extracaoLlm?: ReturnType<typeof criarRuntimeExtracaoLlm> };
const hash = (v: unknown) => createHash("sha256").update(JSON.stringify(v)).digest("hex");
export async function executarExtracaoLlm(raw: unknown, token: string, deps: DepsExtracao): Promise<{ status: number; body: Record<string, unknown> }> {
  const responder = (status: number, codigo: string, extra: Record<string, unknown> = {}) => ({ status, body: { codigo, ...extra } });
  const p = Pedido.safeParse(raw); if (!p.success) return responder(400, "PAYLOAD_INVALIDO");
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
    const anterior = (jaSalvo.payload as { resultado?: { correlacao?: unknown } }).resultado?.correlacao;
    if (hash(anterior) !== hash(correlacao)) return responder(409, "PROPOSTA_LLM_DESATUALIZADA");
    return responder(200, "PROPOSTA_LLM_REPLAY", { draftId: jaSalvo.draftId, criaEventoClinico: false });
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
    const salvo = salvarDraft(deps.db, { draftId: `llm:${hash(p.data.idempotencyKey)}`, patientId: ctx.patientId, sourceId: draft.sourceId,
      rawRef: draft.rawRef, revision: 0, criadoEm: deps.agora(), diagnostics: ["REVISAO_MEDICA_OBRIGATORIA"],
      payload: { kind: "LLM_EXTRACAO_RASCUNHO", operationId: p.data.idempotencyKey, sourceDraftId: draft.draftId, sourceDraftHash: fonteAntes, resultado } });
    return responder(201, "PROPOSTA_LLM_SALVA", { draftId: salvo.draftId, revision: salvo.revision, proposta: resultado, criaEventoClinico: false });
  } finally { runtime.descartar(p.data.idempotencyKey); }
}
