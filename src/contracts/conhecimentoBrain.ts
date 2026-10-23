import { z } from "zod";
import { VersaoReferencia } from "./f1/correlacao.js";

/** Filtros de consulta declarados pelo médico; não se tornam fatos do paciente. */
export const FiltrosConhecimentoBrainSchema = z.object({
  tumor: z.string().trim().min(1).max(200).optional(),
  histologia: z.string().trim().min(1).max(200).optional(),
  estadio: z.string().trim().min(1).max(200).optional(),
  biomarcador: z.string().trim().min(1).max(200).optional(),
  linha: z.string().trim().min(1).max(200).optional(),
}).strict();

export const ConhecimentoBrainSchema = z.object({
  biblioteca: VersaoReferencia.nullable(),
  origem: z.enum(["GENSPARK_MANUAL", "CURADOR_LOCAL"]).nullable(),
  filtros: FiltrosConhecimentoBrainSchema,
  filtrosSaoFatosClinicos: z.literal(false),
  referencias: z.array(z.object({
    referenciaId: z.string(), versao: z.string(), titulo: z.string(),
    contentHash: z.string().regex(/^[a-f0-9]{64}$/),
    fonte: z.string().url(), publicadoEm: z.string().date(), recuperadoEm: z.string().datetime(),
    trecho: z.string().max(4000), estado: z.enum(["RASCUNHO", "CONSULTAVEL", "ALERTA", "OBSOLETO"]),
  }).strict()),
}).strict();
export type ConhecimentoBrain = z.infer<typeof ConhecimentoBrainSchema>;
