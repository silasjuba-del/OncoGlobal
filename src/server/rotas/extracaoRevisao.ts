import { randomUUID } from "node:crypto";
import { z } from "zod";
import { Id, type Sessao } from "../../contracts/base.js";
import { AcaoRevisaoPedido } from "../../contracts/w10/closure.js";
import {
  ClinicalFact as ClinicalFactContract,
  EncounterSegment,
  FactSourceType,
  ReviewAction,
  ReviewException,
} from "../../contracts/w10/extracao.js";
import { executarConfirmacao as confirmar } from "../../kernel/comandos/index.js";
import { lerDraft, listarDrafts, listarDraftsSemVinculo, listarEventos, salvarDraft } from "../../kernel/comandos/portas.js";
import { normalizarDataCivil } from "../../kernel/extracao/normalizacao.js";
import { executarPipelineExtracao, type ExtractionInput } from "../../kernel/extracao/pipeline.js";
import { prepararRevisaoExtracao } from "../../kernel/extracao/prepararRevisao.js";
import { farmacosMencionados, reconciliarCampos } from "../../kernel/extracao/reconciliacao.js";
import { g07Lateralidade, g08AnatomiaSexo, g09PtDeBiopsia, g25EscopoAssinatura } from "../../kernel/harness/gates.js";
import { rascunhoJevNaoPromovivel } from "../../kernel/ledger/writeRouter.js";
import { avaliarRadsRascunho } from "../radsRascunho.js";
import { confrontarNomeIdentificador } from "../../rules/w8/vinculoDocumento.js";
import { lerConsulta, lerPaciente } from "../leituras.js";
import type { ServidorDeps } from "../rotas.js";
import { hashConteudoExibido } from "../sessao.js";
import { sha } from "./confirmacao.js";
import type { RespostaRota } from "./salaoCanal.js";

function evidenciaIdentidade(texto: string): { nomeDocumento: string | null; identificador: { tipo: "CPF" | "CNS"; valor: string } | null; trecho: string | null } {
  const nomeMatch = texto.match(/^\s*(?:nome\s+do\s+paciente|paciente|nome)\s*[:\-]\s*([^\r\n]{2,120})/im);
  const idMatch = texto.match(/(?:\bCPF\b\s*[:\-]?\s*([\d.\-/ ]{11,18})|\bCNS\b\s*[:\-]?\s*([\d.\-/ ]{15,24}))/i);
  const rawId = idMatch?.[1] ?? idMatch?.[2] ?? null;
  const identificador = rawId ? { tipo: idMatch?.[1] ? "CPF" as const : "CNS" as const, valor: rawId.trim() } : null;
  const trecho = nomeMatch?.[0]?.trim() ?? (idMatch?.[0]?.trim() ?? null);
  return { nomeDocumento: nomeMatch?.[1]?.trim() ?? null, identificador, trecho };
}

function chaveVinculoLegado(input: {
  draftId: string; revision: number; patientId: string;
  encounterId: string; tumorLotId: string | null;
}): string {
  return `review-link-legacy-${sha(JSON.stringify([
    input.draftId, input.revision, input.patientId,
    input.encounterId, input.tumorLotId,
  ])).slice(0, 40)}`;
}

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

export function rotearExtracaoERevisao(
  deps: ServidorDeps,
  token: string,
  sessao: Sessao,
  rota: string,
  raw: unknown,
): RespostaRota | null {
  const reply = (status: number, codigo: string, body: unknown = { codigo }): RespostaRota => ({ status, codigo, body });

  if (rota === "reconciliarRascunhos") {
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
      fontesValidadas.push({
        draftId, sourceId: input.sourceId, recordingId: input.recordingId,
        segmentId: segment.id, dataClinica: validDates[0]!, factIds: factsForSegment.map((fact) => fact.id),
        source: {
          recordingId: input.recordingId, sourceId: input.sourceId, sourceType: sourceType.data,
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
  }

  if (rota === "oncoassistFontes") {
    const parsed = z.object({ draftId: Id.optional(), patientId: Id, encounterId: Id, tumorLotId: Id.nullable() }).strict()
      .refine((value) => value.draftId === undefined)
      .safeParse(raw);
    if (!parsed.success) return reply(400, "PAYLOAD_INVALIDO");
    const contexto = deps.sessoes.consultaSelecionada(token);
    if (!contexto) return reply(409, "CONTEXTO_CONSULTA_NAO_SELECIONADO");
    if (contexto.patientId !== parsed.data.patientId || contexto.encounterId !== parsed.data.encounterId
      || (contexto.tumorLotId ?? null) !== parsed.data.tumorLotId)
      return reply(409, "CONTEXTO_CONSULTA_ALTERADO");
    const escopoFonte = (value: unknown) => z.object({
      kind: z.literal("EXTRACAO_RASCUNHO"),
      patientLinkReview: z.object({
        patientId: z.literal(contexto.patientId),
        encounterId: z.literal(contexto.encounterId), tumorLotId: z.literal(contexto.tumorLotId ?? null),
        segmentId: Id,
      }),
    }).safeParse(value).success;
    const fontes = listarDrafts(deps.db, contexto.patientId).filter((draft) => escopoFonte(draft.payload))
      .map((draft, index) => ({ draftId: draft.draftId, rotulo: `Fonte local ${index + 1}`, criadoEm: draft.criadoEm }));
    const fontesSemVinculo = listarDraftsSemVinculo(deps.db).flatMap((draft, index) => {
      if (draft.patientId !== null || !draft.payload || typeof draft.payload !== "object") return [];
      const value = draft.payload as Record<string, unknown>;
      const input = value.input && typeof value.input === "object" ? value.input as Record<string, unknown> : null;
      if (value.kind !== "EXTRACAO_RASCUNHO" || !input || typeof input.sourceId !== "string"
        || typeof input.rawTranscript !== "string") return [];
      const state = value.state && typeof value.state === "object" ? value.state as Record<string, unknown> : null;
      const exceptions = Array.isArray(state?.confirmationRequired) ? state.confirmationRequired : [];
      const exceptionId = exceptions.find((item) => item && typeof item === "object"
        && (item as Record<string, unknown>).kind === "UNLINKED_PATIENT"
        && Array.isArray((item as Record<string, unknown>).sourceIds)
        && ((item as Record<string, unknown>).sourceIds as unknown[]).includes(input.sourceId));
      const segmentId = exceptionId && typeof exceptionId === "object"
        && typeof (exceptionId as Record<string, unknown>).segmentId === "string"
        ? (exceptionId as Record<string, unknown>).segmentId as string : null;
      const segments = Array.isArray(state?.segments) ? state.segments : [];
      const segment = segmentId ? segments.find((candidate) => candidate && typeof candidate === "object"
        && (candidate as Record<string, unknown>).id === segmentId
        && (candidate as Record<string, unknown>).sourceId === input.sourceId) as Record<string, unknown> | undefined : undefined;
      return [{
        draftId: draft.draftId, sourceId: input.sourceId, rotulo: `Trecho sem vínculo ${index + 1}`,
        exceptionId: exceptionId && typeof exceptionId === "object"
          && typeof (exceptionId as Record<string, unknown>).id === "string"
          ? (exceptionId as Record<string, unknown>).id as string : null,
        segmentId, criadoEm: draft.criadoEm, revision: draft.revision,
        textoOriginal: typeof segment?.rawTranscript === "string" ? segment.rawTranscript : "",
      }];
    });
    return reply(200, "ONCOASSIST_FONTES", { fontes, fontesSemVinculo });
  }

  if (rota === "extrair") {
    const inputSchema = z.object({
      recordingId: z.string().min(1), sourceId: z.string().min(1),
      sourceType: z.enum(["pathology", "imaging_report", "prescription", "medical_note", "nursing", "plaud", "administration"]),
      page: z.number().int().nonnegative().optional(), rawTranscript: z.string().min(1).max(200_000),
      contexto: z.object({ patientId: z.string().min(1), encounterId: z.string().min(1), tumorLotId: z.string().nullable() }).strict().optional(),
      captureMethod: z.enum(["LOCAL_DICTATION", "DEEPGRAM_CLOUD", "PASTED_TEXT"]).optional(),
      capturedTranscript: z.string().max(200_000).optional(),
    }).strict();
    const parsed = inputSchema.safeParse(raw);
    if (!parsed.success) return reply(400, "PAYLOAD_INVALIDO");
    if (!parsed.data.rawTranscript.trim()) return reply(400, "TRANSCRICAO_VAZIA");
    if (parsed.data.captureMethod && (!parsed.data.contexto || parsed.data.capturedTranscript === undefined))
      return reply(400, "PROVENIENCIA_TRANSCRICAO_INCOMPLETA");
    if (parsed.data.contexto) {
      const atual = deps.sessoes.consultaSelecionada(token), pedido = parsed.data.contexto;
      if (!atual || atual.patientId !== pedido.patientId || atual.encounterId !== pedido.encounterId || (atual.tumorLotId ?? null) !== pedido.tumorLotId)
        return reply(409, "CONTEXTO_TRANSCRICAO_DIVERGENTE");
    }
    const input = {
      recordingId: parsed.data.recordingId, sourceId: parsed.data.sourceId,
      sourceType: parsed.data.sourceType, rawTranscript: parsed.data.rawTranscript,
      ...(parsed.data.page === undefined ? {} : { page: parsed.data.page }),
    };
    const draftId = parsed.data.captureMethod ? `transcricao-${sha(JSON.stringify([
      parsed.data.contexto, parsed.data.recordingId, parsed.data.sourceId,
    ])).slice(0, 40)}` : randomUUID();
    const anterior = lerDraft(deps.db, draftId);
    if (anterior) {
      const payload = anterior.payload as { input?: unknown };
      if (anterior.patientId !== null || JSON.stringify(payload.input) !== JSON.stringify(parsed.data))
        return reply(409, "TRANSCRICAO_ID_CONFLITANTE");
      return reply(200, "REPLAY", { codigo: "REPLAY", draftId, revision: anterior.revision, linkedPatientId: null, requiresMedicalReview: true });
    }
    const state = executarPipelineExtracao(input);
    const rads = avaliarRadsRascunho(parsed.data.sourceType, parsed.data.rawTranscript, parsed.data.sourceId, deps.corpus?.rads);
    const { alertasRads } = rads;
    const stages = state.facts.filter((f) => f.domain === "stage" && typeof f.value === "string");
    const alerts = [
      g07Lateralidade({}),
      g08AnatomiaSexo({}),
      ...stages.map((f) => {
        const prefix = String(f.value).match(/(?:^|\s)(yp|p|c)t/i)?.[1] ?? "";
        return g09PtDeBiopsia({
          prefixo: prefix, tnmExplicito: true,
          specimen: parsed.data.sourceType === "pathology" ? "DESCONHECIDO" : undefined,
        });
      }),
    ];
    const saved = salvarDraft(deps.db, {
      draftId, patientId: null, sourceId: parsed.data.sourceId,
      rawRef: `importacao-local:${parsed.data.recordingId}`,
      payload: { kind: "EXTRACAO_RASCUNHO", input: parsed.data, state, alerts, alertasRads },
      diagnostics: [
        "VINCULO_MEDICO_PENDENTE", ...rads.diagnostics, ...state.confirmationRequired.map((e) => e.kind),
        ...alerts.filter((a) => a.decisao !== "PASSA").map((a) => `${a.gate}_${a.decisao}`),
      ],
      revision: 0, criadoEm: deps.agora(),
    });
    return reply(201, "RASCUNHO_SALVO", {
      codigo: "RASCUNHO_SALVO", draftId: saved.draftId, revision: saved.revision,
      linkedPatientId: null, facts: state.facts, exceptions: state.confirmationRequired,
      timeline: null, alerts, alertasRads, requiresMedicalReview: true,
    });
  }

  if (rota === "rascunho") {
    const parsed = z.object({ draftId: z.string().min(1) }).strict().safeParse(raw);
    if (!parsed.success) return reply(400, "PAYLOAD_INVALIDO");
    const draft = lerDraft(deps.db, parsed.data.draftId);
    if (!draft) return reply(404, "RASCUNHO_NAO_ENCONTRADO");
    if (rascunhoJevNaoPromovivel(draft.payload)) return reply(409, "PROPOSTA_DOCUMENTAL_USAR_HISTORICO");
    const payload = draft.payload && typeof draft.payload === "object" && !Array.isArray(draft.payload)
      ? draft.payload as Record<string, unknown> : null;
    if (payload?.kind === "EXTRACAO_RASCUNHO" && draft.patientId !== null) {
      const link = payload.patientLinkReview && typeof payload.patientLinkReview === "object"
        ? payload.patientLinkReview as Record<string, unknown> : null;
      const consulta = deps.sessoes.consultaSelecionada(token);
      const state = payload.state && typeof payload.state === "object" ? payload.state as Record<string, unknown> : null;
      const input = payload.input && typeof payload.input === "object" ? payload.input as Record<string, unknown> : null;
      const segments = Array.isArray(state?.segments) ? state.segments : [];
      const segment = segments.find((item) => item && typeof item === "object"
        && (item as Record<string, unknown>).id === link?.segmentId) as Record<string, unknown> | undefined;
      const facts = Array.isArray(state?.facts) ? state.facts : [];
      if (!consulta || consulta.patientId !== draft.patientId || !link
        || link.patientId !== consulta.patientId || link.encounterId !== consulta.encounterId
        || (link.tumorLotId ?? null) !== (consulta.tumorLotId ?? null)
        || !segment || typeof segment.rawTranscript !== "string" || !input || typeof input.sourceId !== "string")
        return reply(409, "SEGMENTO_VINCULADO_NAO_CONSTA");
      const scopedFacts = facts.filter((fact) => fact && typeof fact === "object"
        && (fact as Record<string, unknown>).segmentId === link.segmentId);
      const scopedExceptions = (value: unknown) => Array.isArray(value) ? value.filter((item) => item
        && typeof item === "object" && (item as Record<string, unknown>).segmentId === link.segmentId) : [];
      const rads = avaliarRadsRascunho(input.sourceType, segment.rawTranscript, input.sourceId, deps.corpus?.rads);
      const visibleDraft = {
        ...draft,
        diagnostics: [...draft.diagnostics.filter(c => c !== "RADS_NAO_AVALIADO"), ...rads.diagnostics],
        payload: {
          kind: "EXTRACAO_RASCUNHO", input: {
            recordingId: input.recordingId, sourceId: input.sourceId,
            sourceType: input.sourceType, ...(input.page === undefined ? {} : { page: input.page }),
            rawTranscript: segment.rawTranscript,
          },
          state: {
            segments: [segment], facts: scopedFacts,
            confirmationRequired: scopedExceptions(state?.confirmationRequired),
          },
          alertasRads: rads.alertasRads,
          patientLinkReview: link,
        },
      };
      return reply(200, "RASCUNHO_CARREGADO", { draft: visibleDraft });
    }
    return reply(200, "RASCUNHO_CARREGADO", { draft });
  }

  if (rota === "revisarRascunho" || rota === "prepararRevisao") {
    const parsed = z.object({
      draftId: z.string().min(1), expectedRevision: z.number().int().nonnegative(),
      patientId: Id, factIds: z.array(Id).optional(), operationId: z.string().min(8).optional(),
      incluirTextoOriginal: z.boolean().optional(),
      exceptionId: Id.optional(), acao: z.enum(["CONFIRMAR", "CORRIGIR", "DESCARTAR", "LIGAR_PACIENTE"]).optional(),
      sourceId: Id.optional(), encounterId: Id.optional(), tumorLotId: Id.nullable().optional(),
      idempotencyKey: z.string().min(8).optional(),
      comprovanteExibicao: z.object({
        documentId: Id, documentVersion: z.number().int().positive(),
        conteudoHash: z.string().regex(/^[0-9a-f]{64}$/),
      }).strict().optional(),
    }).strict().refine((value) => value.factIds === undefined
      ? value.incluirTextoOriginal !== true
      : value.operationId !== undefined && (value.factIds.length > 0 || value.incluirTextoOriginal === true)).safeParse(raw);
    if (!parsed.success) return reply(400, "PAYLOAD_INVALIDO");
    const legadoVinculo = z.object({ draftId: Id, expectedRevision: z.number().int().nonnegative(), patientId: Id })
      .strict().safeParse(raw);
    const isLegacyLink = rota === "revisarRascunho" && legadoVinculo.success;
    if (rota === "prepararRevisao" && (!parsed.data.factIds || parsed.data.comprovanteExibicao))
      return reply(400, "PAYLOAD_INVALIDO");
    let draft = lerDraft(deps.db, parsed.data.draftId);
    if (!draft) return reply(409, "REVISAO_RASCUNHO_CONFLITANTE");
    if (rascunhoJevNaoPromovivel(draft.payload)) return reply(409, "PROPOSTA_DOCUMENTAL_NAO_PROMOVIVEL");
    if (draft.revision !== parsed.data.expectedRevision) {
      const payload = draft.payload && typeof draft.payload === "object" ? draft.payload as Record<string, unknown> : null;
      const link = payload?.patientLinkReview && typeof payload.patientLinkReview === "object"
        ? payload.patientLinkReview as Record<string, unknown> : null;
      let selected = deps.sessoes.consultaSelecionada(token);
      let replayIdentityOnly = false;
      if (!selected && isLegacyLink && draft.patientId === parsed.data.patientId) {
        if (typeof link?.encounterId !== "string") return reply(409, "CONTEXTO_CONSULTA_NAO_SELECIONADO");
        const resolved = lerConsulta(deps.db, parsed.data.patientId, deps.agora(), sessao, null, { encounterId: link.encounterId });
        if (!("codigo" in resolved)) {
          selected = { patientId: parsed.data.patientId, encounterId: resolved.encounterId, tumorLotId: null };
          replayIdentityOnly = true;
        }
      }
      const replayKey = parsed.data.idempotencyKey ?? (isLegacyLink && selected
        ? chaveVinculoLegado({
          draftId: draft.draftId, revision: parsed.data.expectedRevision,
          patientId: parsed.data.patientId, encounterId: selected.encounterId,
          tumorLotId: replayIdentityOnly ? null : selected.tumorLotId ?? null,
        }) : null);
      const replayId = replayKey ? `review-link-${sha(replayKey).slice(0, 40)}` : null;
      const replayExists = replayId ? deps.db.prepare("SELECT 1 AS ok FROM operation WHERE operationId=?").get(replayId) : null;
      if (!parsed.data.factIds && draft.patientId === parsed.data.patientId && selected?.patientId === parsed.data.patientId
        && link?.patientId === parsed.data.patientId && link?.reviewDecisionId === replayId
        && link?.sourceId === (parsed.data.sourceId ?? draft.sourceId) && link?.encounterId === selected.encounterId
        && link?.exceptionId === (parsed.data.exceptionId ?? link?.exceptionId)
        && link?.identityOnly === replayIdentityOnly
        && (link?.tumorLotId ?? null) === (selected.tumorLotId ?? null) && replayExists)
        return reply(200, "REPLAY", {
          codigo: "VINCULO_REVISTO", draftId: draft.draftId,
          revision: draft.revision, linkedPatientId: draft.patientId, fatosConfirmados: 0,
          criaEventoClinico: false, replay: true,
        });
      return reply(409, "REVISAO_RASCUNHO_CONFLITANTE");
    }
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
      const identityOnly = false;
      if (!consultaVinculo) return reply(409, "CONTEXTO_CONSULTA_NAO_SELECIONADO");
      if (consultaVinculo.patientId !== parsed.data.patientId)
        return reply(409, "PACIENTE_FORA_DA_CONSULTA_SELECIONADA");
      if (!payloadOriginal || !payloadOriginal.input || typeof payloadOriginal.input !== "object")
        return reply(409, "EXTRACAO_RASCUNHO_INVALIDO");
      const extractionInput = payloadOriginal.input as Record<string, unknown>;
      if (typeof extractionInput.rawTranscript !== "string" || typeof extractionInput.sourceId !== "string")
        return reply(409, "EXTRACAO_RASCUNHO_INVALIDO");
      const exceptions = payloadOriginal.state && typeof payloadOriginal.state === "object"
        ? (payloadOriginal.state as Record<string, unknown>).confirmationRequired : null;
      const unlinkedExceptions = Array.isArray(exceptions) ? exceptions.filter((item) => item && typeof item === "object"
        && (item as Record<string, unknown>).kind === "UNLINKED_PATIENT"
        && Array.isArray((item as Record<string, unknown>).sourceIds)
        && ((item as Record<string, unknown>).sourceIds as unknown[]).includes(extractionInput.sourceId)) : [];
      if (isLegacyLink && unlinkedExceptions.length !== 1)
        return reply(409, "EXCECAO_VINCULO_AMBIGUA", { codigo: "EXCECAO_VINCULO_AMBIGUA" });
      const unlinkedException = isLegacyLink ? unlinkedExceptions[0]
        : unlinkedExceptions.find((item) => (item as Record<string, unknown>).id === parsed.data.exceptionId);
      const exceptionId = unlinkedException && typeof (unlinkedException as Record<string, unknown>).id === "string"
        ? (unlinkedException as Record<string, unknown>).id as string : null;
      const segmentId = unlinkedException && typeof (unlinkedException as Record<string, unknown>).segmentId === "string"
        ? (unlinkedException as Record<string, unknown>).segmentId as string : null;
      if (!exceptionId || !segmentId) return reply(409, "EXCECAO_VINCULO_NAO_ENCONTRADA");
      const idempotencyKey = isLegacyLink ? chaveVinculoLegado({
        draftId: draft.draftId,
        revision: draft.revision, patientId: parsed.data.patientId, encounterId: consultaVinculo.encounterId,
        tumorLotId: identityOnly ? null : consultaVinculo.tumorLotId ?? null,
      }) : parsed.data.idempotencyKey;
      const action = AcaoRevisaoPedido.safeParse({
        exceptionId: isLegacyLink ? exceptionId : parsed.data.exceptionId,
        acao: parsed.data.acao ?? (isLegacyLink ? "LIGAR_PACIENTE" : undefined),
        patientId: parsed.data.patientId, sourceId: isLegacyLink ? extractionInput.sourceId : parsed.data.sourceId,
        draftId: parsed.data.draftId, expectedRevision: parsed.data.expectedRevision,
        encounterId: isLegacyLink ? consultaVinculo.encounterId : parsed.data.encounterId,
        tumorLotId: isLegacyLink ? (identityOnly ? null : consultaVinculo.tumorLotId ?? null) : parsed.data.tumorLotId,
        idempotencyKey,
      });
      if (!action.success || action.data.acao !== "LIGAR_PACIENTE"
        || action.data.sourceId !== draft.sourceId || action.data.sourceId !== extractionInput.sourceId
        || action.data.encounterId !== consultaVinculo.encounterId
        || action.data.tumorLotId !== (identityOnly ? null : consultaVinculo.tumorLotId ?? null))
        return reply(400, "ACAO_REVISAO_INVALIDA");
      const sourceState = payloadOriginal.state && typeof payloadOriginal.state === "object"
        ? payloadOriginal.state as Record<string, unknown> : null;
      const sourceSegments = Array.isArray(sourceState?.segments) ? sourceState.segments : [];
      const segment = sourceSegments.find((item) => item && typeof item === "object"
        && (item as Record<string, unknown>).id === segmentId
        && (item as Record<string, unknown>).sourceId === extractionInput.sourceId) as Record<string, unknown> | undefined;
      if (!segment || typeof segment.rawTranscript !== "string")
        return reply(409, "SEGMENTO_VINCULADO_NAO_CONSTA");
      const identidade = evidenciaIdentidade(segment.rawTranscript);
      const confronto = confrontarNomeIdentificador({
        nomeDocumento: identidade.nomeDocumento,
        identificador: identidade.identificador, cadastroNome: lerPaciente(deps.db, parsed.data.patientId)!.nome,
        cadastroIdentificadores: lerPaciente(deps.db, parsed.data.patientId)!.identificadores,
      });
      if (!confronto.liga) return reply(409, "CONFLITO_IDENTIDADE_DOCUMENTAL", {
        codigo: "CONFLITO_IDENTIDADE_DOCUMENTAL", motivo: confronto.motivo,
        sourceId: extractionInput.sourceId, trecho: identidade.trecho, exigeDecisaoMedica: true,
      });
      const sourceHash = hashConteudoExibido(draft.payload);
      const operationId = `review-link-${sha(action.data.idempotencyKey).slice(0, 40)}`;
      const existingOperation = deps.db.prepare("SELECT criadoEm FROM operation WHERE operationId=?").get(operationId) as { criadoEm?: string } | undefined;
      const em = existingOperation?.criadoEm ?? deps.agora();
      const reviewAction = ReviewAction.parse({
        exceptionId: action.data.exceptionId, acao: action.data.acao,
        medicoId: sessao.medicoId, em, patientId: action.data.patientId,
      });
      const reviewDraftId = `review-link-draft-${sha(operationId).slice(0, 32)}`;
      const reviewPayload = {
        kind: "PATIENT_LINK_REVIEW", action: reviewAction.acao,
        context: {
          patientId: parsed.data.patientId, encounterId: consultaVinculo.encounterId,
          tumorLotId: identityOnly ? null : consultaVinculo.tumorLotId ?? null,
        },
        exceptionId: action.data.exceptionId, segmentId, identityOnly,
        sourceRef: {
          draftId: draft.draftId, revision: draft.revision, sourceId: extractionInput.sourceId,
          contentHash: sourceHash, excerpt: identidade.trecho,
        },
        targetPatientId: parsed.data.patientId,
      };
      const reviewDraft = lerDraft(deps.db, reviewDraftId);
      if (reviewDraft && (reviewDraft.patientId !== parsed.data.patientId
        || JSON.stringify(reviewDraft.payload) !== JSON.stringify(reviewPayload)))
        return reply(409, "CHAVE_IDEMPOTENCIA_REUTILIZADA");
      if (!reviewDraft) salvarDraft(deps.db, {
        draftId: reviewDraftId, patientId: parsed.data.patientId,
        sourceId: extractionInput.sourceId, rawRef: `review-link:${draft.draftId}`, payload: reviewPayload,
        diagnostics: ["DECISAO_DE_VINCULO_MEDICO"], revision: 0, criadoEm: em,
      });
      const fonte = {
        sourceId: extractionInput.sourceId, classe: "DOCUMENT" as const,
        localizador: identidade.trecho, dataClinica: null, dataCaptura: em,
        versao: `draft-r${draft.revision}`, contentHash: sourceHash,
      };
      const resultadoVinculo = confirmar(deps.db, {
        operationId, patientId: parsed.data.patientId,
        tumorLotId: identityOnly ? null : consultaVinculo.tumorLotId ?? null, encounterId: consultaVinculo.encounterId,
        reviewDecisionId: operationId, sessao, em, registros: [{
          draftId: reviewDraftId, expectedRevision: 0,
          eventId: `review-link-event-${sha(operationId).slice(0, 32)}`, tipo: "ReviewDecision",
          payload: {
            campo: "patientLink", exceptionId: reviewAction.exceptionId, acao: reviewAction.acao,
            medicoId: reviewAction.medicoId, em: reviewAction.em, patientId: parsed.data.patientId, segmentId, identityOnly,
            source: reviewPayload.sourceRef, trechoFonte: identidade.trecho,
          },
          fontes: [fonte], revisao: "CONFIRMADO",
        }],
      });
      if (resultadoVinculo.estado === "NEGADA") return reply(409, resultadoVinculo.motivo ?? "VINCULO_NEGADO");
      const atual = lerDraft(deps.db, draft.draftId);
      if (!atual || atual.revision !== parsed.data.expectedRevision || atual.patientId !== null)
        return reply(409, "REVISAO_RASCUNHO_CONFLITANTE");
      const reviewed = salvarDraft(deps.db, {
        ...atual, patientId: parsed.data.patientId,
        revision: draft.revision + 1,
        payload: {
          ...payloadOriginal, patientLinkReview: {
            patientId: parsed.data.patientId,
            encounterId: consultaVinculo.encounterId, tumorLotId: identityOnly ? null : consultaVinculo.tumorLotId ?? null,
            medicoId: sessao.medicoId, em, reviewDecisionId: operationId,
            exceptionId: action.data.exceptionId, segmentId, identityOnly,
            sourceId: extractionInput.sourceId, sourceHash,
          },
        },
        diagnostics: [...draft.diagnostics, "VINCULO_PACIENTE_CONFIRMADO_POR_MEDICO"],
      });
      if (reviewed.diagnostics.includes("EXPECTED_REVISION_CONFLICT"))
        return reply(409, "REVISAO_RASCUNHO_CONFLITANTE");
      draft = reviewed;
    } else if (linkReview?.patientId !== parsed.data.patientId) {
      return reply(409, "VINCULO_PACIENTE_NAO_CONFIRMADO");
    } else {
      const consultaAtual = deps.sessoes.consultaSelecionada(token);
      if (consultaAtual && consultaAtual.patientId !== parsed.data.patientId)
        return reply(409, "PACIENTE_FORA_DA_CONSULTA_SELECIONADA");
      if (consultaAtual && (linkReview?.encounterId !== consultaAtual.encounterId
        || (linkReview?.tumorLotId ?? null) !== (consultaAtual.tumorLotId ?? null)))
        return reply(409, "DRAFT_FORA_DO_ESCOPO");
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
    const linkedSegmentId = typeof linkReview?.segmentId === "string" ? linkReview.segmentId : null;
    if (!linkedSegmentId || typeof linkReview?.reviewDecisionId !== "string"
      || typeof linkReview.exceptionId !== "string") return reply(409, "SEGMENTO_VINCULADO_NAO_CONSTA");
    const linkedSegment = Array.isArray(extractionState.segments)
      ? extractionState.segments.map((value) => EncounterSegment.safeParse(value))
        .find((item) => item.success && item.data.id === linkedSegmentId)?.data ?? null
      : null;
    if (!linkedSegment || linkedSegment.sourceId !== extractionInput.sourceId)
      return reply(409, "SEGMENTO_VINCULADO_NAO_CONSTA");
    if (parsed.data.incluirTextoOriginal === true) {
      if (linkedSegment.sourceType !== extractionInput.sourceType
        || linkedSegment.recordingId !== extractionInput.recordingId) return reply(409, "PROVENIENCIA_DIVERGENTE");
      const fonteVinculada = { ...payloadOriginal };
      delete fonteVinculada.patientLinkReview;
      if (hashConteudoExibido(fonteVinculada) !== linkReview.sourceHash) return reply(409, "FONTE_ALTERADA");
    }
    const linkEventRow = deps.db.prepare(`SELECT * FROM clinical_event WHERE operationId=? AND tipo='ReviewDecision'`)
      .get(linkReview.reviewDecisionId) as Record<string, unknown> | undefined;
    let linkEvent: Record<string, unknown> | null = null;
    try {
      if (linkEventRow) linkEvent = {
        ...linkEventRow,
        payload: JSON.parse(String(linkEventRow.payload)),
        fontes: JSON.parse(String(linkEventRow.fontes)),
        criadoPor: JSON.parse(String(linkEventRow.criadoPor)),
      };
    } catch { return reply(409, "DECISAO_VINCULO_INVALIDA"); }
    const decisionEnvelope = linkEvent?.payload && typeof linkEvent.payload === "object"
      ? linkEvent.payload as Record<string, unknown> : null;
    const decision = decisionEnvelope?.data && typeof decisionEnvelope.data === "object"
      ? decisionEnvelope.data as Record<string, unknown> : null;
    const decisionActor = linkEvent?.criadoPor && typeof linkEvent.criadoPor === "object"
      ? linkEvent.criadoPor as Record<string, unknown> : null;
    const sourceRef = decision?.source && typeof decision.source === "object"
      ? decision.source as Record<string, unknown> : null;
    if (!linkEvent || linkEvent.patientId !== parsed.data.patientId || linkEvent.encounterId !== contexto.encounterId
      || (linkEvent.tumorLotId ?? null) !== (contexto.tumorLotId ?? null)
      || decisionActor?.tipo !== "SESSAO" || decisionActor.id !== sessao.medicoId
      || decision?.campo !== "patientLink" || decision.exceptionId !== linkReview.exceptionId
      || decision.patientId !== parsed.data.patientId || decision.segmentId !== linkedSegmentId
      || sourceRef?.draftId !== draft.draftId || sourceRef.sourceId !== extractionInput.sourceId
      || sourceRef.revision !== draft.revision - 1 || sourceRef.contentHash !== linkReview.sourceHash)
      return reply(409, "DECISAO_VINCULO_INVALIDA");
    const factsRaw = extractionState.facts as unknown[];
    const factsForLinkedSegment = factsRaw.flatMap((value) => {
      const parsedFact = ClinicalFactContract.safeParse(value);
      return parsedFact.success && parsedFact.data.segmentId === linkedSegmentId ? [parsedFact.data] : [];
    });
    for (const factId of parsed.data.factIds) {
      const fact = factsRaw.find((item) => item && typeof item === "object"
        && (item as Record<string, unknown>).id === factId) as Record<string, unknown> | undefined;
      if (!fact) continue;
      if (fact.segmentId !== linkedSegmentId) return reply(409, "FATO_FORA_DO_SEGMENTO_VINCULADO");
    }
    const operationId = parsed.data.operationId!;
    const operacaoExistente = deps.db.prepare("SELECT criadoEm FROM operation WHERE operationId=?").get(operationId);
    const summaryId = `evolucao-extracao-${sha(operationId).slice(0, 32)}`;
    const summaryDraft = lerDraft(deps.db, summaryId);
    const em = typeof operacaoExistente?.criadoEm === "string" ? operacaoExistente.criadoEm
      : summaryDraft?.criadoEm ?? deps.agora();
    let revisao: ReturnType<typeof prepararRevisaoExtracao>;
    try {
      revisao = prepararRevisaoExtracao({
        draftId: draft.draftId, sourceId: extractionInput.sourceId,
        rawTranscript: linkedSegment.rawTranscript, sourceType: extractionInput.sourceType, vinculoConfirmado: true,
        facts: factsForLinkedSegment,
        exceptions: extractionState.confirmationRequired.filter((value) => value && typeof value === "object"
          && (value as Record<string, unknown>).segmentId === linkedSegmentId),
        patientId: parsed.data.patientId, encounterId: contexto.encounterId,
        tumorLotId: contexto.tumorLotId ?? null, factIds: parsed.data.factIds, operationId,
        ...(parsed.data.incluirTextoOriginal === true ? {
          incluirTextoOriginal: true,
          segmentoVinculado: { id: linkedSegment.id, ...(linkedSegment.page ? { page: linkedSegment.page } : {}) },
        } : {}),
        medicoId: sessao.medicoId, em,
        origem: { draftId: draft.draftId, revision: draft.revision, conteudoHash: hashConteudoExibido(draft.payload) },
      });
    } catch (error) {
      const code = error instanceof Error ? error.message : "EXTRACAO_RASCUNHO_INVALIDO";
      return reply(409, ["FACT_IDS_INVALIDOS", "PROVENIENCIA_DIVERGENTE", "FATO_NAO_ENCONTRADO", "TEXTO_ORIGINAL_INVALIDO"].includes(code)
        ? code : "EXTRACAO_RASCUNHO_INVALIDO");
    }
    if (operacaoExistente && !summaryDraft)
      return reply(409, "CHAVE_IDEMPOTENCIA_REUTILIZADA");
    if (summaryDraft && (summaryDraft.patientId !== parsed.data.patientId
      || JSON.stringify(summaryDraft.payload) !== JSON.stringify(revisao.payload)))
      return reply(409, "CHAVE_IDEMPOTENCIA_REUTILIZADA");
    const documento = {
      documentId: revisao.draftId, documentVersion: 1,
      conteudoHash: hashConteudoExibido(revisao.payload),
    };
    const escopo = { ...contexto, tumorLotId: contexto.tumorLotId ?? null };
    if (rota === "prepararRevisao") {
      if (!summaryDraft) salvarDraft(deps.db, {
        draftId: revisao.draftId, patientId: parsed.data.patientId,
        sourceId: revisao.sourceId, rawRef: `revisao-local:${draft.draftId}`, payload: revisao.payload,
        diagnostics: ["EVOLUCAO_RASCUNHO", "REVISAO_MEDICA_PENDENTE"], revision: 0, criadoEm: em,
      });
      deps.sessoes.registrarBundleExibido(token, escopo, [documento]);
      return reply(200, "REVISAO_PREPARADA", {
        codigo: "REVISAO_PREPARADA",
        conteudo: revisao.payload, comprovanteExibicao: documento, criaEventoClinico: false,
      });
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
    const result = confirmar(deps.db, {
      operationId, patientId: parsed.data.patientId,
      tumorLotId: contexto.tumorLotId ?? null, encounterId: contexto.encounterId,
      reviewDecisionId: operationId, sessao, em,
      registros: revisao.registros.map((registro) => ({
        draftId: revisao.draftId, expectedRevision: 0,
        eventId: registro.eventId, tipo: registro.tipo, payload: registro.payload, fontes: [...registro.fontes],
        revisao: "CONFIRMADO" as const,
      })),
    });
    if (result.estado === "NEGADA") return reply(409, result.motivo ?? "REVISAO_NEGADA");
    const persisted = lerDraft(deps.db, revisao.draftId);
    return reply(200, result.estado === "REPLAY" ? "REVISAO_REPLAY" : "FATOS_REVISTOS", {
      codigo: result.estado, draftId: revisao.draftId, revision: persisted?.revision ?? 1,
      linkedPatientId: parsed.data.patientId, encounterId: contexto.encounterId,
      factIds: parsed.data.factIds, resultRef: result.resultRef, evolucaoRascunho: revisao.payload.resumo,
      revisaoMedica: { medicoId: sessao.medicoId, em },
    });
  }

  return null;
}
