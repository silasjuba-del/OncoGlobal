import { z } from "zod";
import { Id } from "../base.js";

/** Critério observável; nunca autoriza ciclo ou substitui assinatura. Sem fonte/regra, null explícito. */
export const CriterioElegibilidade = z.object({
  schema: z.literal("CriterioElegibilidade@1"), id: Id,
  estado: z.enum(["ATENDE", "NAO_ATENDE", "AUSENTE", "CONFLITO"]), texto: z.string(),
  fontes: z.array(z.object({ eventId: Id, sourceId: Id, medidoEm: Id }).strict()),
  regra: z.object({ id: Id, versao: Id, fonte: Id }).strict().nullable(),
}).strict();
export type CriterioElegibilidade = z.infer<typeof CriterioElegibilidade>;
