import { z } from "zod";
import { Id } from "../base.js";
import { Destino } from "../estados.js";
import { FolhaContingenciaSalao } from "../f3/salaoOperacional.js";

export const ContextoContingenciaSalao = z.object({ patientId: Id, encounterId: Id }).strict();
export const GerarContingenciaSalao = ContextoContingenciaSalao.extend({
  operationId: Id,
  destino: Destino,
  emergenciaAtiva: z.boolean(),
  alertasOperacionaisE1: z.array(z.string().trim().min(1).max(500)).max(10),
  resumoTriagem: z.record(z.string().trim().min(1).max(80), z.string().trim().min(1).max(500))
    .refine(v => Object.keys(v).length > 0 && Object.keys(v).length <= 20),
}).strict();
export type GerarContingenciaSalao = z.infer<typeof GerarContingenciaSalao>;
export const ContingenciaSalaoResposta = z.object({ folha: FolhaContingenciaSalao }).strict();
export const HistoricoContingenciaSalaoResposta = z.object({ folhas: z.array(FolhaContingenciaSalao) }).strict();
