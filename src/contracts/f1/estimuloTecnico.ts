import { z } from "zod";
import { Id, Instante } from "../base.js";
export const TipoEstimulo = z.enum(["FATO_CONFIRMADO", "PRESCRICAO_PROPOSTA", "MED_RECONCILIADO", "EXAME_CORRIGIDO", "BIBLIOTECA_ATIVADA", "FATO_VENCIDO", "ADMINISTRACAO_REGISTRADA"]);
export const EstimuloTecnico = z.object({ schema: z.literal("EstimuloTecnico@1"), id: Id, operationId: Id,
  tipo: TipoEstimulo, patientId: Id.nullable(), encounterId: Id.nullable(), tumorLotId: Id.nullable(),
  revisaoEntrada: Id, criadoEm: Instante, ator: z.literal("SISTEMA"),
}).strict().superRefine((e,ctx) => { if(e.tipo !== "BIBLIOTECA_ATIVADA" && (!e.patientId || !e.encounterId))
  ctx.addIssue({code:"custom",message:"Estímulo clínico exige contexto explícito"}); });
export type EstimuloTecnico = z.infer<typeof EstimuloTecnico>;
