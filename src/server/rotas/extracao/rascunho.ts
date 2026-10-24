import { z } from "zod";
import { type Sessao } from "../../../contracts/base.js";
import { lerDraft } from "../../../kernel/comandos/portas.js";
import { rascunhoJevNaoPromovivel } from "../../../kernel/ledger/writeRouter.js";
import { avaliarRadsRascunho } from "../../radsRascunho.js";
import type { ServidorDeps } from "../../rotas.js";
import { sha } from "../confirmacao.js";
import type { RespostaRota } from "../salaoCanal.js";

/** Leitura de um rascunho de extração. */
export function lerRascunho(deps: ServidorDeps, token: string, sessao: Sessao, raw: unknown): RespostaRota | null {
  const reply = (status: number, codigo: string, body: unknown = { codigo }): RespostaRota => ({ status, codigo, body });
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
          ...(input.captureMethod ? { captureMethod: input.captureMethod } : {}),
          // O original completo continua no ledger; não expor outros segmentos por esta leitura vinculada.
          ...(typeof input.capturedTranscript === "string" ? {
            capturedTranscriptHash: sha(input.capturedTranscript),
            transcriptEdited: input.capturedTranscript !== input.rawTranscript,
          } : {}),
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
  return null;
}
