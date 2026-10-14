import { z } from "zod";
import { Id } from "../base.js";

export const VersaoReferencia = z.object({ id: Id, versao: Id, hash: Id }).strict();
export const Correlacao = z.object({
  patientId: Id, encounterId: Id, tumorLotId: Id.nullable(), operationId: Id,
  revisaoFatos: Id, regras: z.array(VersaoReferencia), biblioteca: VersaoReferencia,
  proposta: z.object({ id: Id, revisao: Id }).strict().nullable(),
}).strict();
export type Correlacao = z.infer<typeof Correlacao>;
