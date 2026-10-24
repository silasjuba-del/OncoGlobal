import { z } from "zod";
import { Id, type Sessao } from "../../../contracts/base.js";
import { listarDrafts, listarDraftsSemVinculo } from "../../../kernel/comandos/portas.js";
import type { ServidorDeps } from "../../rotas.js";
import type { RespostaRota } from "../salaoCanal.js";

/** Fontes locais do OncoAssist para a consulta selecionada. */
export function listarFontesOncoassist(deps: ServidorDeps, token: string, sessao: Sessao, raw: unknown): RespostaRota | null {
  const reply = (status: number, codigo: string, body: unknown = { codigo }): RespostaRota => ({ status, codigo, body });
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
  return null;
}
