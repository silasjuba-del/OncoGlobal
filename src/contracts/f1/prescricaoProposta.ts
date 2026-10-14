import { z } from "zod";
import { Id } from "../base.js";
import { PrescriptionItem } from "../w10/prescricao.js";
import { Correlacao } from "./correlacao.js";

export const PrescricaoProposta = z.object({ schema: z.literal("PrescricaoProposta@1"), id: Id, revisao: Id,
  correlacao: Correlacao, templateId: Id.nullable(), templateVersao: Id.nullable(),
  itens: z.array(PrescriptionItem).min(1), estado: z.literal("DRAFT"),
}).strict();
export type PrescricaoProposta = z.infer<typeof PrescricaoProposta>;
