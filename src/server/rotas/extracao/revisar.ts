import { z } from "zod";
import { Id, type Sessao } from "../../../contracts/base.js";
import { MetodoCapturaTranscricao } from "../../../contracts/capturaTranscricao.js";
import { AcaoRevisaoPedido } from "../../../contracts/w10/closure.js";
import { ClinicalFact as ClinicalFactContract, EncounterSegment, ReviewAction } from "../../../contracts/w10/extracao.js";
import { executarConfirmacao as confirmar } from "../../../kernel/comandos/index.js";
import { auditar, depoisDoCommit, lerDraft, salvarDraft, transacao } from "../../../kernel/comandos/portas.js";
import { prepararRevisaoExtracao } from "../../../kernel/extracao/prepararRevisao.js";
import { g25EscopoAssinatura } from "../../../kernel/harness/gates.js";
import { rascunhoJevNaoPromovivel } from "../../../kernel/ledger/writeRouter.js";
import { confrontarNomeIdentificador } from "../../../rules/w8/vinculoDocumento.js";
import { lerConsulta, lerPaciente } from "../../leituras.js";
import type { ServidorDeps } from "../../rotas.js";
import { hashConteudoExibido } from "../../sessao.js";
import { sha } from "../confirmacao.js";
import type { RespostaRota } from "../salaoCanal.js";

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

/** Revisão médica do rascunho: vínculo de paciente, preparação do documento exibido e confirmação. */
export function revisarOuPrepararRascunho(
  deps: ServidorDeps, token: string, sessao: Sessao, rota: "revisarRascunho" | "prepararRevisao", raw: unknown,
): RespostaRota | null {
  const reply = (status: number, codigo: string, body: unknown = { codigo }): RespostaRota => ({ status, codigo, body });
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
    const fonte = {
      sourceId: extractionInput.sourceId, classe: "DOCUMENT" as const,
      localizador: identidade.trecho, dataClinica: null, dataCaptura: em,
      versao: `draft-r${draft.revision}`, contentHash: sourceHash,
    };
    // Decisão, rascunho da decisão e rascunho revisado formam uma unidade: qualquer recusa
    // desfaz as três escritas, e nenhum 409 sai depois de um ReviewDecision gravado.
    const rascunhoFonte = draft, fonteVinculoId = extractionInput.sourceId;
    const vinculo = transacao(deps.db, () => {
    if (!reviewDraft) salvarDraft(deps.db, {
      draftId: reviewDraftId, patientId: parsed.data.patientId,
      sourceId: fonteVinculoId, rawRef: `review-link:${rascunhoFonte.draftId}`, payload: reviewPayload,
      diagnostics: ["DECISAO_DE_VINCULO_MEDICO"], revision: 0, criadoEm: em,
    });
    const resultadoVinculo = confirmar(deps.db, { autorizadoEm: deps.agora(), 
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
    if (resultadoVinculo.estado === "NEGADA")
      return { falha: resultadoVinculo.motivo ?? "VINCULO_NEGADO", negadaPeloKernel: true } as const;
    const atual = lerDraft(deps.db, rascunhoFonte.draftId);
    if (!atual || atual.revision !== parsed.data.expectedRevision || atual.patientId !== null)
      return { falha: "REVISAO_RASCUNHO_CONFLITANTE", negadaPeloKernel: false } as const;
    const reviewed = salvarDraft(deps.db, {
      ...atual, patientId: parsed.data.patientId,
      revision: rascunhoFonte.revision + 1,
      payload: {
        ...payloadOriginal, patientLinkReview: {
          patientId: parsed.data.patientId,
          encounterId: consultaVinculo.encounterId, tumorLotId: identityOnly ? null : consultaVinculo.tumorLotId ?? null,
          medicoId: sessao.medicoId, em, reviewDecisionId: operationId,
          exceptionId: action.data.exceptionId, segmentId, identityOnly,
          sourceId: fonteVinculoId, sourceHash,
        },
      },
      diagnostics: [...rascunhoFonte.diagnostics, "VINCULO_PACIENTE_CONFIRMADO_POR_MEDICO"],
    });
    if (reviewed.diagnostics.includes("EXPECTED_REVISION_CONFLICT"))
      return { falha: "REVISAO_RASCUNHO_CONFLITANTE", negadaPeloKernel: false } as const;
    return { reviewed } as const;
    }, (resultado) => "falha" in resultado);
    if ("falha" in vinculo) {
      // O rollback também desfaz a auditoria gravada pelo kernel; a recusa é auditada de novo fora dela.
      if (vinculo.negadaPeloKernel) auditar(deps.db, { ator: { tipo: "SESSAO", id: sessao.medicoId },
        acaoPedida: "CONFIRMAR", decisao: "NEGADA", motivoCodigo: vinculo.falha, politicaVersao: "W2-01", em: deps.agora() });
      return reply(409, vinculo.falha);
    }
    draft = vinculo.reviewed;
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
      ...(MetodoCapturaTranscricao.safeParse(extractionInput.captureMethod).success
        ? { captureMethod: MetodoCapturaTranscricao.parse(extractionInput.captureMethod) } : {}),
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
    return reply(409, ["FACT_IDS_INVALIDOS", "PROVENIENCIA_DIVERGENTE", "FATO_NAO_ENCONTRADO", "TEXTO_ORIGINAL_INVALIDO", "REPROCESSAMENTO_VOZ_NECESSARIO"].includes(code)
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
    depoisDoCommit(deps.db, () => deps.sessoes.registrarBundleExibido(token, escopo, [documento]));
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
  const result = confirmar(deps.db, { autorizadoEm: deps.agora(), 
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
  return null;
}
