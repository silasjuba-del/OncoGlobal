import { createHash } from "node:crypto";
import type { DatabaseSync } from "node:sqlite";
import { z } from "zod";
import { Sessao, type DraftEnvelope } from "../contracts/base.js";
import { ContextoAcaoComposta } from "../contracts/api/acoesCompostas.js";
import { ImportarEstudoPedidoSchema, RevisarEstudoPedidoSchema, AvaliarEstudoPedidoSchema,
  EstudoServicoSchema, StudyReviewSchema, ListarEstudosRespostaSchema, AvaliacaoEstudoRespostaSchema,
  type EstudoServico } from "../contracts/api/trialsServico.js";
import { ingestDocument, draftStudyCandidate, reviewStudy, verifyStudyReview, evaluateMatch } from "../modules/pesquisa/index.js";
import { lerDraft, listarDraftsGlobaisPorTipo, salvarDraft, transacao } from "../kernel/comandos/portas.js";
import { hashConteudoExibido as hash, type GerenciadorSessao } from "./sessao.js";
import { lerFatosTrials } from "./trialsFatos.js";
import { dataCivilDoServico } from "../rules/tempoServico.js";
import type { criarMotorF1 } from "../kernel/orquestracao/runtime.js";

interface Deps { db: DatabaseSync; sessoes: GerenciadorSessao; agora: () => string; motorF1?: ReturnType<typeof criarMotorF1> }
interface Resposta { status: number; body: unknown }
export type OperacaoTrials = "listar" | "importar" | "revisar" | "avaliar" | "fatos";
const negar = (codigo: string, status = 409): Resposta => ({ status, body: { codigo } });
const digest = async (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");
const RegistroEstudo = z.object({
  kind: z.literal("TRIAL_ESTUDO"), importacaoHash: z.string(), atorImportacao: z.string(),
  estudo: EstudoServicoSchema,
  revisoes: z.array(z.object({ operationId: z.string(), requestHash: z.string(), review: StudyReviewSchema }).strict()),
}).strict();
type Registro = z.infer<typeof RegistroEstudo>;

function leitura(draft: DraftEnvelope | null): Registro | null {
  if (!draft || draft.patientId !== null) return null;
  const p = RegistroEstudo.safeParse(draft.payload);
  if (!p.success || p.data.estudo.draftId !== draft.draftId || p.data.estudo.revision !== draft.revision
    || hash(p.data.estudo.candidate) !== p.data.estudo.candidateHash) return null;
  const { source, candidate } = p.data.estudo;
  if (source.originalContent === null || createHash("sha256").update(source.originalContent).digest("hex") !== source.contentHash
    || candidate.sourceHash !== source.contentHash) return null;
  if (draft.revision !== p.data.revisoes.length || p.data.revisoes.some((r, i) => !verifyStudyReview(r.review) || r.review.version !== i + 1
    || r.review.candidateHash !== p.data.estudo.candidateHash)) return null;
  if (hash(p.data.revisoes.at(-1)?.review ?? null) !== hash(p.data.estudo.review)) return null;
  return p.data;
}

function autenticar(deps: Deps, token: string) {
  const s = Sessao.safeParse(deps.sessoes.obter(token)), em = deps.agora();
  return s.success && Number.isFinite(Date.parse(em)) && Date.parse(s.data.emitidaEm) <= Date.parse(em)
    && Date.parse(s.data.expiraEm) > Date.parse(em) ? { sessao: s.data, em } : null;
}

export async function operarTrials(deps: Deps, token: string, operacao: OperacaoTrials, raw: unknown): Promise<Resposta> {
  const auth = autenticar(deps, token);
  if (!auth) return negar("SESSAO_INVALIDA", 401);
  if (operacao === "importar") {
    const p = ImportarEstudoPedidoSchema.safeParse(raw);
    if (!p.success) return negar("PAYLOAD_INVALIDO", 400);
    const entrada = p.data, key = hash([auth.sessao.medicoId, entrada.idempotencyKey]);
    const draftId = `trial-estudo-${key}`, importacaoHash = hash(entrada);
    try {
      const source = await ingestDocument({ sourceId: `trial-fonte-${key}`, sourceRef: `draft:${draftId}`,
        originalName: entrada.nome, mimeType: entrada.mimeType, content: entrada.conteudo }, digest);
      const candidate = await draftStudyCandidate(source, `trial-candidato-${key}`, digest);
      // Leitura de bytes pode ser assíncrona; não prolonga autorização de uma sessão expirada.
      if (!autenticar(deps, token)) return negar("SESSAO_INVALIDA", 401);
      return transacao(deps.db, () => {
        const existente = lerDraft(deps.db, draftId);
        if (existente) {
          const registro = leitura(existente);
          if (!registro || registro.importacaoHash !== importacaoHash || registro.atorImportacao !== auth.sessao.medicoId)
            return negar("IDEMPOTENCIA_CONFLITO");
          return { status: 200, body: registro.estudo };
        }
        const estudo = EstudoServicoSchema.parse({ draftId, revision: 0, source, candidate,
          candidateHash: hash(candidate), review: null });
        salvarDraft(deps.db, { draftId, patientId: null, sourceId: source.sourceId, rawRef: "referencia-local",
          payload: { kind: "TRIAL_ESTUDO", importacaoHash, atorImportacao: auth.sessao.medicoId, estudo, revisoes: [] },
          diagnostics: ["PROTOCOLO_AGUARDA_REVISAO"], revision: 0, criadoEm: auth.em });
        return { status: 200, body: estudo };
      });
    } catch { return negar("FONTE_ESTUDO_INVALIDA", 400); }
  }
  if (operacao === "listar") {
    if (!z.object({}).strict().safeParse(raw).success) return negar("PAYLOAD_INVALIDO", 400);
    const rows = listarDraftsGlobaisPorTipo(deps.db, "TRIAL_ESTUDO"), estudos: EstudoServico[] = [];
    for (const row of rows) {
      const r = leitura(row);
      if (!r) return negar("ESTUDO_PERSISTIDO_INVALIDO");
      estudos.push(r.estudo);
    }
    return { status: 200, body: ListarEstudosRespostaSchema.parse({ estudos }) };
  }
  if (operacao === "revisar") {
    const p = RevisarEstudoPedidoSchema.safeParse(raw);
    if (!p.success) return negar("PAYLOAD_INVALIDO", 400);
    return transacao(deps.db, () => {
      const entrada = p.data, draft = lerDraft(deps.db, entrada.draftId), registro = leitura(draft);
      if (!draft || !registro) return negar("ESTUDO_NAO_ENCONTRADO");
      const requestHash = hash({ entrada, atorId: auth.sessao.medicoId });
      const anterior = registro.revisoes.find(r => r.operationId === entrada.idempotencyKey);
      if (anterior) return anterior.requestHash === requestHash
        ? { status: 200, body: { ...registro.estudo, revision: anterior.review.version, review: anterior.review } } : negar("IDEMPOTENCIA_CONFLITO");
      if (draft.revision !== entrada.expectedRevision || registro.estudo.candidateHash !== entrada.candidateHash)
        return negar("REVISAO_ESTUDO_ALTERADA");
      const candidate = registro.estudo.candidate;
      const criterios = [...candidate.inclusionCriteria, ...candidate.exclusionCriteria];
      const mapeados = entrada.bindings.map(b => {
        const c = criterios.find(c => c.criterionId === b.criterionId);
        return c ? { ...b, polarity: c.polarity, rawText: c.rawText, evidence: c.evidence } : null;
      });
      if (mapeados.some(c => c === null) || mapeados.length !== criterios.length) return negar("REVISAO_CRITERIOS_INCOMPLETA");
      try {
        const review = reviewStudy(candidate, { decisionId: `trial-decisao-${hash([draft.draftId, entrada.idempotencyKey])}`,
          reviewerId: auth.sessao.medicoId, reviewedAt: auth.em, decision: entrada.decision,
          version: registro.revisoes.length + 1, studyId: entrada.studyId, titleText: entrada.titleText,
          titleEvidenceLocator: entrada.titleEvidenceLocator, reviewedCriteria: mapeados.filter(c => c !== null),
          reviewedArmIds: entrada.reviewedArmIds });
        const estudo = EstudoServicoSchema.parse({ ...registro.estudo, revision: draft.revision + 1, review });
        const salvo = salvarDraft(deps.db, { ...draft, revision: estudo.revision,
          payload: { ...registro, estudo, revisoes: [...registro.revisoes, { operationId: entrada.idempotencyKey, requestHash, review }] },
          diagnostics: [review.decision === "CONFIRMAR" ? "PROTOCOLO_REVISADO" : "PROTOCOLO_REJEITADO"] });
        if (salvo.draftId !== draft.draftId) throw new Error("REVISAO_ESTUDO_ALTERADA");
        return { status: 200, body: estudo };
      } catch { return negar("REVISAO_ESTUDO_INVALIDA"); }
    });
  }
  const p = operacao === "avaliar" ? AvaliarEstudoPedidoSchema.safeParse(raw) : null;
  const ctx = ContextoAcaoComposta.safeParse(p?.success ? p.data.contexto : raw);
  if (!ctx.success || operacao === "avaliar" && !p?.success) return negar("PAYLOAD_INVALIDO", 400);
  const selecionado = deps.sessoes.consultaSelecionada(token);
  if (!selecionado || selecionado.patientId !== ctx.data.patientId || selecionado.encounterId !== ctx.data.encounterId
    || (selecionado.tumorLotId ?? null) !== ctx.data.tumorLotId) return negar("CONTEXTO_CONSULTA_ALTERADO");
  const fatos = lerFatosTrials(deps.db, ctx.data, auth.em, deps.motorF1?.retrato(ctx.data, undefined, undefined, auth.em));
  if (operacao === "fatos") return { status: 200, body: fatos };
  if (!p?.success) return negar("PAYLOAD_INVALIDO", 400);
  const registro = leitura(lerDraft(deps.db, p.data.draftId));
  if (!registro?.estudo.review || registro.estudo.review.decision !== "CONFIRMAR") return negar("ESTUDO_NAO_REVISADO");
  if (registro.estudo.revision !== p.data.expectedRevision || registro.estudo.review.reviewHash !== p.data.expectedReviewHash)
    return negar("REVISAO_ESTUDO_ALTERADA");
  const civil = dataCivilDoServico(auth.em);
  if (civil.estado !== "OK") return negar("RELOGIO_INVALIDO");
  try {
    const resultado = evaluateMatch({ patientId: ctx.data.patientId, candidate: registro.estudo.candidate,
      review: registro.estudo.review, facts: fatos.fatos, asOf: civil.dataCivil });
    return { status: 200, body: AvaliacaoEstudoRespostaSchema.parse({
      ...fatos, estudo: registro.estudo, resultado, elegivel: false }) };
  } catch { return negar("ESTUDO_NAO_AVALIAVEL"); }
}
