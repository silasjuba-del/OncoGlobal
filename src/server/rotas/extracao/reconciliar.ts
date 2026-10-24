import { z } from "zod";
import { Id, type Sessao } from "../../../contracts/base.js";
import { MetodoCapturaTranscricao } from "../../../contracts/capturaTranscricao.js";
import { ClinicalFact as ClinicalFactContract, EncounterSegment, FactSourceType, ReviewAction, ReviewException } from "../../../contracts/w10/extracao.js";
import { lerDraft, listarEventos } from "../../../kernel/comandos/portas.js";
import { normalizarDataCivil } from "../../../kernel/extracao/normalizacao.js";
import { executarPipelineExtracao, type ExtractionInput } from "../../../kernel/extracao/pipeline.js";
import { farmacosMencionados, reconciliarCampos } from "../../../kernel/extracao/reconciliacao.js";
import type { ServidorDeps } from "../../rotas.js";
import { hashConteudoExibido } from "../../sessao.js";
import { sha } from "../confirmacao.js";
import type { RespostaRota } from "../salaoCanal.js";

function fatoSustentaDataClinica(fact: z.infer<typeof ClinicalFactContract>, data: string): boolean {
  const literal = /(?:\b\d{4}-\d{2}-\d{2}\b|\b\d{1,2}[/.]\d{1,2}[/.]\d{2,4}\b)/gu;
  const textoValor = typeof fact.value === "string" ? fact.value
    : fact.value && typeof fact.value === "object" && !Array.isArray(fact.value)
      ? ["raw", "normalizado", "marker"].map((key) => (fact.value as Record<string, unknown>)[key])
        .filter((value): value is string => typeof value === "string").join(" ") : "";
  const normalizar = (value: string) => value.normalize("NFD").replace(/\p{Diacritic}/gu, "")
    .toLocaleUpperCase("pt-BR").trim();
  const farmacos = farmacosMencionados(textoValor).map(normalizar);
  const clauses = fact.rawEvidence.split(/[;,]|\s+e\s+(?=(?:Hb|hemoglobina|creatinina|PSA|CEA|plaquetas)\b)/iu);
  return clauses.some((clause) => {
    const dates = [...clause.matchAll(literal)].map((match) => normalizarDataCivil(match[0]));
    if (!dates.includes(data)) return false;
    if (fact.domain === "plan" || fact.domain === "drug" || fact.domain === "regimen") {
      const normalizedClause = normalizar(clause);
      return farmacos.length > 0 && farmacos.some((term) => normalizedClause.includes(term));
    }
    if (fact.domain === "cycle") return /\bciclo\s*\d+/iu.test(clause);
    return true;
  });
}

/** Reconciliação de rascunhos: compara fatos de vários rascunhos do mesmo paciente sem promovê-los. */
export function reconciliarRascunhos(deps: ServidorDeps, token: string, sessao: Sessao, raw: unknown): RespostaRota | null {
  const reply = (status: number, codigo: string, body: unknown = { codigo }): RespostaRota => ({ status, codigo, body });
  const parsed = z.object({ draftIds: z.array(Id).min(2).max(12) }).strict().safeParse(raw);
  if (!parsed.success) return reply(400, "PAYLOAD_INVALIDO");
  if (new Set(parsed.data.draftIds).size !== parsed.data.draftIds.length)
    return reply(400, "DRAFT_DUPLICADO");
  const contexto = deps.sessoes.consultaSelecionada(token);
  if (!contexto) return reply(409, "CONTEXTO_CONSULTA_NAO_SELECIONADO");

  type FonteValidada = {
    draftId: string; sourceId: string; recordingId: string; segmentId: string;
    dataClinica: string; source: ExtractionInput; factIds: string[];
  };
  const fontesValidadas: FonteValidada[] = [];
  const confirmacoes: ReturnType<typeof ReviewAction.parse>[] = [];
  const confirmacoesFonte: NonNullable<ExtractionInput["confirmacoesFonte"]>[number][] = [];
  const eventosPersistidos = listarEventos(deps.db, contexto.patientId);
  for (const draftId of parsed.data.draftIds) {
    const draft = lerDraft(deps.db, draftId);
    if (!draft || draft.patientId !== contexto.patientId)
      return reply(409, "FONTE_FORA_DO_ESCOPO", { codigo: "FONTE_FORA_DO_ESCOPO", draftId });
    const payload = draft.payload && typeof draft.payload === "object" && !Array.isArray(draft.payload)
      ? draft.payload as Record<string, unknown> : null;
    const input = payload?.input && typeof payload.input === "object" && !Array.isArray(payload.input)
      ? payload.input as Record<string, unknown> : null;
    const link = payload?.patientLinkReview && typeof payload.patientLinkReview === "object"
      ? payload.patientLinkReview as Record<string, unknown> : null;
    if (payload?.kind !== "EXTRACAO_RASCUNHO" || !input || !link
      || typeof input.recordingId !== "string" || typeof input.sourceId !== "string"
      || typeof input.sourceType !== "string" || typeof input.rawTranscript !== "string"
      || typeof link.segmentId !== "string" || typeof link.exceptionId !== "string"
      || typeof link.reviewDecisionId !== "string" || typeof link.sourceHash !== "string")
      return reply(409, "VINCULO_OU_FONTE_PENDENTE", { codigo: "VINCULO_OU_FONTE_PENDENTE", draftId });
    if (link.patientId !== contexto.patientId || link.encounterId !== contexto.encounterId
      || (link.tumorLotId ?? null) !== (contexto.tumorLotId ?? null)
      || input.sourceId !== draft.sourceId)
      return reply(409, "CONTEXTO_CONSULTA_ALTERADO", { codigo: "CONTEXTO_CONSULTA_ALTERADO", draftId });
    const sourceType = FactSourceType.safeParse(input.sourceType);
    const state = payload.state && typeof payload.state === "object" && !Array.isArray(payload.state)
      ? payload.state as Record<string, unknown> : null;
    if (!sourceType.success || !state || !Array.isArray(state.segments) || !Array.isArray(state.facts)
      || !Array.isArray(state.confirmationRequired))
      return reply(409, "FONTE_PENDENTE", { codigo: "FONTE_PENDENTE", draftId });
    const segments = state.segments.map((value) => EncounterSegment.safeParse(value));
    const facts = state.facts.map((value) => ClinicalFactContract.safeParse(value));
    const exceptions = state.confirmationRequired.map((value) => ReviewException.safeParse(value));
    if (segments.some((item) => !item.success) || facts.some((item) => !item.success)
      || exceptions.some((item) => !item.success))
      return reply(409, "FONTE_PENDENTE", { codigo: "FONTE_PENDENTE", draftId });
    const segment = segments.find((item) => item.success && item.data.id === link.segmentId)?.data;
    if (!segment || segment.sourceId !== input.sourceId || segment.recordingId !== input.recordingId
      || segment.sourceType !== sourceType.data)
      return reply(409, "SEGMENTO_VINCULADO_NAO_CONSTA", { codigo: "SEGMENTO_VINCULADO_NAO_CONSTA", draftId });
    const exception = exceptions.find((item) => item.success && item.data.id === link.exceptionId)?.data;
    if (!exception || exception.kind !== "UNLINKED_PATIENT" || exception.segmentId !== segment.id
      || !exception.sourceIds.includes(input.sourceId))
      return reply(409, "EXCECAO_VINCULO_NAO_ENCONTRADA", { codigo: "EXCECAO_VINCULO_NAO_ENCONTRADA", draftId });

    const sourcePayload = { ...payload };
    delete sourcePayload.patientLinkReview;
    const sourceHash = hashConteudoExibido(sourcePayload);
    if (sourceHash !== link.sourceHash) return reply(409, "FONTE_ALTERADA", { codigo: "FONTE_ALTERADA", draftId });
    const linkReview = eventosPersistidos.filter((event) => event.tipo === "ReviewDecision"
      && event.operationId === link.reviewDecisionId && event.patientId === contexto.patientId
      && event.encounterId === contexto.encounterId && event.tumorLotId === (contexto.tumorLotId ?? null));
    if (linkReview.length !== 1) return reply(409, "DECISAO_VINCULO_NAO_PERSISTIDA", { codigo: "DECISAO_VINCULO_NAO_PERSISTIDA", draftId });
    const event = linkReview[0]!;
    const envelope = event.payload && typeof event.payload === "object"
      ? event.payload as Record<string, unknown> : null;
    const decision = envelope?.data && typeof envelope.data === "object"
      ? envelope.data as Record<string, unknown> : null;
    const actor = event.criadoPor;
    const ref = decision?.source && typeof decision.source === "object"
      ? decision.source as Record<string, unknown> : null;
    const action = ReviewAction.safeParse({
      exceptionId: decision?.exceptionId,
      acao: decision?.acao, medicoId: actor.id, em: event.criadoEm, patientId: decision?.patientId,
    });
    if (actor.tipo !== "SESSAO" || actor.id !== sessao.medicoId || !action.success
      || action.data.acao !== "LIGAR_PACIENTE" || action.data.patientId !== contexto.patientId
      || decision?.campo !== "patientLink" || decision.segmentId !== segment.id
      || decision.exceptionId !== link.exceptionId || ref?.draftId !== draft.draftId
      || ref.sourceId !== input.sourceId || ref.revision !== draft.revision - 1
      || ref.contentHash !== link.sourceHash)
      return reply(409, "DECISAO_VINCULO_NAO_PERSISTIDA", { codigo: "DECISAO_VINCULO_NAO_PERSISTIDA", draftId });

    const factsForSegment = facts.flatMap((item) => item.success && item.data.segmentId === segment.id ? [item.data] : []);
    const dominiosTratamento = new Set(["plan", "drug", "regimen", "cycle"]);
    const fatosDeTratamento = factsForSegment.filter((fact) => dominiosTratamento.has(fact.domain));
    if (fatosDeTratamento.length && fatosDeTratamento.some((fact) => fact.date === undefined))
      return reply(409, "DATA_CLINICA_PENDENTE", { codigo: "DATA_CLINICA_PENDENTE", draftId });
    const dateFacts = (fatosDeTratamento.length ? fatosDeTratamento : factsForSegment)
      .filter((fact) => fact.date !== undefined);
    const clinicalDates = dateFacts.map((fact) => {
      if (!fact.date) return null;
      const normalized = normalizarDataCivil(fact.date);
      if (!normalized || !fatoSustentaDataClinica(fact, normalized)) return null;
      return normalized;
    });
    const validDates = [...new Set(clinicalDates.filter((value): value is string => value !== null))];
    if (!dateFacts.length || validDates.length !== 1 || clinicalDates.some((value) => value === null))
      return reply(409, "DATA_CLINICA_PENDENTE", { codigo: "DATA_CLINICA_PENDENTE", draftId });
    const identitySchema = z.object({
      tipo: z.enum(["PATOLOGIA_IHQ", "IMAGEM", "OUTRO"]),
      laboratorio: z.string().nullable().optional(), numeroExame: z.string().nullable().optional(),
      dataEntrada: z.string().nullable().optional(), servico: z.string().nullable().optional(),
      registro: z.string().nullable().optional(), dataExame: z.string().nullable().optional(),
      versao: z.string().trim().min(1).nullable().optional(),
    });
    const identity = input.examIdentity === undefined ? null : identitySchema.safeParse(input.examIdentity);
    if (identity && !identity.success) return reply(409, "VERSAO_FONTE_PENDENTE", { codigo: "VERSAO_FONTE_PENDENTE", draftId });
    const examIdentity = identity?.success ? {
      tipo: identity.data.tipo,
      laboratorio: identity.data.laboratorio ?? null, numeroExame: identity.data.numeroExame ?? null,
      dataEntrada: identity.data.dataEntrada ?? null, servico: identity.data.servico ?? null,
      registro: identity.data.registro ?? null, dataExame: identity.data.dataExame ?? null,
      ...(identity.data.versao == null ? {} : { versao: identity.data.versao }),
    } : undefined;
    const page = Number.isInteger(input.page) ? input.page as number : undefined;
    const captureMethod = MetodoCapturaTranscricao.safeParse(input.captureMethod);
    if (input.captureMethod !== undefined && !captureMethod.success) return reply(409, "PROVENIENCIA_DIVERGENTE");
    fontesValidadas.push({
      draftId, sourceId: input.sourceId, recordingId: input.recordingId,
      segmentId: segment.id, dataClinica: validDates[0]!, factIds: factsForSegment.map((fact) => fact.id),
      source: {
        recordingId: input.recordingId, sourceId: input.sourceId, sourceType: sourceType.data,
        ...(captureMethod.success ? { captureMethod: captureMethod.data } : {}),
        rawTranscript: input.rawTranscript, contexto: { encounterId: contexto.encounterId, dataClinica: validDates[0]! },
        ...(page === undefined ? {} : { page }),
        ...(examIdentity === undefined ? {} : { examIdentity }),
      },
    });
    confirmacoes.push(action.data);
    confirmacoesFonte.push({
      exceptionId: exception.id, segmentId: segment.id,
      sourceId: input.sourceId, recordingId: input.recordingId, contentHash: sha(input.rawTranscript),
      sourceVersion: examIdentity?.versao?.trim() || "legado@1", patientId: contexto.patientId,
      reviewDecisionId: event.eventId,
    });
  }
  if (new Set(fontesValidadas.map((item) => item.recordingId)).size !== fontesValidadas.length)
    return reply(409, "RECORDING_ID_COLLISION", { codigo: "RECORDING_ID_COLLISION", draftIds: parsed.data.draftIds });
  const datasClinicas = [...new Set(fontesValidadas.map((item) => item.dataClinica))];
  if (datasClinicas.length !== 1)
    return reply(409, "DATAS_CLINICAS_DIVERGENTES", { codigo: "DATAS_CLINICAS_DIVERGENTES", draftIds: parsed.data.draftIds });
  const [principal, ...adicionais] = fontesValidadas.map((item) => item.source);
  if (!principal) return reply(409, "FONTES_INSUFICIENTES");
  let resultado: ReturnType<typeof executarPipelineExtracao>;
  try {
    const inputPipeline: ExtractionInput = { ...principal, additionalSources: adicionais, confirmacoes, confirmacoesFonte };
    resultado = executarPipelineExtracao(inputPipeline);
  } catch (error) {
    const codigo = error instanceof Error && /recordingId distintos/i.test(error.message)
      ? "RECORDING_ID_COLLISION" : "RECONCILIACAO_PENDENTE";
    return reply(409, codigo, { codigo, draftIds: parsed.data.draftIds });
  }
  const targetSegments = new Set(fontesValidadas.map((item) => item.segmentId));
  if (fontesValidadas.some((item) => !resultado.segments.some((segment) => segment.id === item.segmentId)))
    return reply(409, "SEGMENTO_VINCULADO_NAO_REPRODUZIDO", { codigo: "SEGMENTO_VINCULADO_NAO_REPRODUZIDO" });
  const targetFacts = resultado.facts.filter((fact) => targetSegments.has(fact.segmentId));
  const targetFactIds = new Set(targetFacts.map((fact) => fact.id));
  const conflitoEscopoSeguro = (item: { factIds: readonly string[]; segmentId: string | null }) =>
    (item.segmentId === null ? item.factIds.length > 0 : targetSegments.has(item.segmentId))
    && item.factIds.every((id) => targetFactIds.has(id));
  const repeticoes = resultado.deduplicacao.repeticoes.filter((item) =>
    [...item.fatoPrincipalIds, ...item.fatoRepetidoIds].every((id) => targetFactIds.has(id)));
  const versoesDiscordantes = resultado.deduplicacao.versoesDiscordantes.filter((item) =>
    item.factIds.every((id) => targetFactIds.has(id)));
  const campos: ReturnType<typeof reconciliarCampos> = Object.fromEntries(Object.entries(reconciliarCampos(targetFacts)).map(([chave, campo]) =>
    [chave, campo.conflict ? { ...campo, resolvedFactId: null } : campo]));
  const conflitosCampos = Object.entries(campos).filter(([, campo]) => campo.conflict)
    .map(([chave, campo]) => ({
      id: `exc:CONFLICT:multifonte:${sha(JSON.stringify([contexto, chave,
        campo.candidates.map((fato) => fato.id).sort()])).slice(0, 32)}`,
      kind: "CONFLICT" as const, segmentId: null,
      factIds: campo.candidates.map((fato) => fato.id),
      sourceIds: [...new Set(campo.candidates.map((fato) => fato.sourceId))],
      reason: `${chave}: fontes vinculadas divergem; decisão médica pendente, nenhum candidato eleito`,
    }));
  return reply(200, "RECONCILIACAO_PROPOSTA", {
    codigo: "RECONCILIACAO_PROPOSTA", decisaoClinicaTomada: false,
    contexto: {
      patientId: contexto.patientId, encounterId: contexto.encounterId,
      tumorLotId: contexto.tumorLotId ?? null, dataClinica: datasClinicas[0],
    },
    fontes: fontesValidadas.map(({ draftId, sourceId, recordingId, segmentId, dataClinica }) =>
      ({ draftId, sourceId, recordingId, segmentId, dataClinica })),
    segmentos: resultado.segments.filter((segment) => targetSegments.has(segment.id)),
    fatos: targetFacts, campos,
    conflitos: [...resultado.conflitos.filter(conflitoEscopoSeguro), ...conflitosCampos],
    excecoes: [...resultado.confirmationRequired.filter(conflitoEscopoSeguro), ...conflitosCampos],
    deduplicacao: {
      repeticoes, versoesDiscordantes,
      fatoRepetidoIds: resultado.deduplicacao.fatoRepetidoIds.filter((id) => targetFactIds.has(id)),
    },
    timelines: resultado.timelines.filter((timeline) => timeline.patientId === contexto.patientId),
  });
  return null;
}
