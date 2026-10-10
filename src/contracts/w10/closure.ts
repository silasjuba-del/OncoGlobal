import { z } from "zod";
import { DataCivil, Fonte, Id } from "../base.js";
import { ReviewAction } from "./extracao.js";

/** READ body carries no session, patient, source metadata or arbitrary URL. */
export const ReadIntent = z.object({
  requestId: z.string().regex(/^[A-Za-z0-9._:-]{8,160}$/),
  purpose: z.enum(["RESEARCH", "WORKSPACE_LOOKUP"]),
  destination: z.enum(["PUBMED", "WORKSPACE"]),
  payload: z.object({ query: z.string().trim().min(1).max(500).optional(),
    refs: z.array(z.string().trim().min(1).max(160)).min(1).max(20).optional() }).strict(),
  timeoutMs: z.number().int().min(1).max(10000).optional(),
}).strict().superRefine((r, ctx) => {
  if (!r.payload.query && !r.payload.refs?.length) ctx.addIssue({ code: "custom", message: "READ exige query ou refs" });
  if ((r.destination === "PUBMED" && r.purpose !== "RESEARCH")
    || (r.destination === "WORKSPACE" && r.purpose !== "WORKSPACE_LOOKUP"))
    ctx.addIssue({ code: "custom", message: "finalidade e destino READ divergentes" });
});
export type ReadIntent = z.infer<typeof ReadIntent>;
export const ReadContext = z.object({ territory: z.enum(["WORK", "STUDY"]) }).strict();
export type ReadContext = z.infer<typeof ReadContext>;
export const ReadProvenance = z.object({ sourceId: z.string().trim().min(1).max(160),
  version: z.string().trim().min(1).max(80) }).strict();
export type ReadProvenance = z.infer<typeof ReadProvenance>;

/** Source units establish technical concordance, never physiological plausibility bounds. */
export const ProvenienciaLaboratorial = z.object({ valorOriginal: z.number().finite().nullable(),
  unidadeOriginal: z.enum(["g/dL", "dg/dL", "g/L"]).nullable(), fonte: Fonte.nullable(),
  dataClinica: DataCivil.nullable() }).strict();
export type ProvenienciaLaboratorial = z.infer<typeof ProvenienciaLaboratorial>;

/** Identity decision recorded as the existing ReviewDecision event. Original Contato is immutable. */
export const ClosureVinculoContato = z.object({ kind: z.literal("VinculoContato"), contatoId: Id,
  sourceEventId: Id, patientId: Id, encounterId: Id, tumorLotId: Id.nullable() }).strict();
export type ClosureVinculoContato = z.infer<typeof ClosureVinculoContato>;

/** HTTP command excludes medicoId/em: actor and time are resolved on the server. */
export const AcaoRevisaoPedido = z.object({ exceptionId: Id, acao: ReviewAction.shape.acao,
  patientId: Id.optional(), valorCorrigido: z.unknown().optional(), motivo: z.string().trim().min(1).optional(),
  sourceId: Id, draftId: Id, expectedRevision: z.number().int().nonnegative(), encounterId: Id,
  tumorLotId: Id.nullable(), idempotencyKey: z.string().min(8) }).strict().superRefine((r, ctx) => {
    if (r.acao === "LIGAR_PACIENTE" && !r.patientId) ctx.addIssue({ code: "custom", message: "ligar exige patientId" });
    if (r.acao === "DESCARTAR" && !r.motivo) ctx.addIssue({ code: "custom", message: "descartar exige motivo" });
  });
export type AcaoRevisaoPedido = z.infer<typeof AcaoRevisaoPedido>;
