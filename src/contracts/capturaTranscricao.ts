import { z } from "zod";

export const MetodoCapturaTranscricao = z.enum(["LOCAL_DICTATION", "DEEPGRAM_CLOUD", "PASTED_TEXT"]);
export type MetodoCapturaTranscricao = z.infer<typeof MetodoCapturaTranscricao>;
export const ProvenienciaCapturaSchema = z.object({
  metodo: MetodoCapturaTranscricao,
  transcricaoOriginalHash: z.string().regex(/^[a-f0-9]{64}$/).nullable(),
  transcricaoRevisadaHash: z.string().regex(/^[a-f0-9]{64}$/),
  transcricaoEditada: z.boolean().nullable(),
  audioConferido: z.literal(false),
}).strict();

/** Classe documental e modalidade de captura são dimensões independentes. */
export function fonteDeVoz(fonte: { sourceType?: unknown; captureMethod?: unknown }): boolean {
  return fonte.sourceType === "plaud" || fonte.captureMethod === "LOCAL_DICTATION" || fonte.captureMethod === "DEEPGRAM_CLOUD";
}
