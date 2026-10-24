import { z } from "zod";
import { PropostaBrainOsSchema } from "./brainOs.js";
import { VereditoHarnessRuntimeSchema } from "./harnessRuntime.js";
import { ConhecimentoBrainSchema } from "./conhecimentoBrain.js";
import { ProvenienciaCapturaSchema } from "./capturaTranscricao.js";

export const POLITICA_COGNITIVA_EXTRACAO = "brain-harness-extracao@1";
export const RelatorioCognitivoExtracaoSchema = z.discriminatedUnion("estado", [
  z.object({
    schema: z.literal("CognitivoExtracao@1"), politicaVersao: z.literal(POLITICA_COGNITIVA_EXTRACAO),
    estado: z.literal("AVALIADO"), proposta: PropostaBrainOsSchema, harness: VereditoHarnessRuntimeSchema,
    criaEventoClinico: z.literal(false),
    conhecimento: ConhecimentoBrainSchema.optional(),
    captura: ProvenienciaCapturaSchema.optional(),
  }).strict(),
  z.object({
    schema: z.literal("CognitivoExtracao@1"), politicaVersao: z.literal(POLITICA_COGNITIVA_EXTRACAO),
    estado: z.literal("NAO_VERIFICADO"), codigo: z.enum([
      "SEM_ALEGACOES", "CITACAO_NAO_LITERAL_NA_FONTE_ORIGINAL", "CONTRATO_COGNITIVO_INCOMPATIVEL",
    ]), criaEventoClinico: z.literal(false), conhecimento: ConhecimentoBrainSchema.optional(), captura: ProvenienciaCapturaSchema.optional(),
  }).strict(),
]);
export type RelatorioCognitivoExtracao = z.infer<typeof RelatorioCognitivoExtracaoSchema>;
