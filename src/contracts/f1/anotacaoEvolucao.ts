import { z } from "zod";
import { Id, Instante } from "../base.js";

export const AnotacaoEvolucao=z.object({
 texto:z.string().trim().min(1).max(12000),mensagemId:Id,atorId:Id,aceitaEm:Instante,
 contexto:z.object({patientId:Id,encounterId:Id,tumorLotId:Id.nullable()}).strict(),
 origemMensagem:z.object({eventId:Id,contentHash:z.string().regex(/^[a-f0-9]{64}$/)}).strict(),
}).strict();
