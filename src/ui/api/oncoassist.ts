import { z } from "zod";

export const EstadoOncoassist = z.object({
  status: z.enum(["DISPONIVEL", "PENDENTE"]), motivo: z.string().optional(),
});
export const FontesOncoassist = z.object({ fontes: z.array(z.object({
  draftId: z.string(), rotulo: z.string(), criadoEm: z.string(),
})), fontesSemVinculo: z.array(z.object({ draftId: z.string(), sourceId: z.string(),
  segmentId: z.string().nullable(), exceptionId: z.string().nullable(), rotulo: z.string(), criadoEm: z.string(), revision: z.number().int().nonnegative(),
  textoOriginal: z.string() })).default([]) });
export const RespostaOncoassist = z.discriminatedUnion("status", [
  z.object({ status: z.literal("PROPOSTA"), revisaoObrigatoria: z.literal(true),
    fonte: z.object({ id: z.string(), sha256: z.string() }),
    categoria: z.enum(["LAB", "RADS", "PATH", "NOTA", "OUTRO", "INDETERMINADO"]),
  }),
  z.object({ status: z.enum(["PENDENTE", "ERRO"]), codigo: z.string() }),
]);
export type EstadoOncoassist = z.infer<typeof EstadoOncoassist>;
export type FontesOncoassist = z.infer<typeof FontesOncoassist>;
export type RespostaOncoassist = z.infer<typeof RespostaOncoassist>;
