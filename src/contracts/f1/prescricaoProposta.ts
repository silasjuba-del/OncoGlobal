import { z } from "zod";
import { Id } from "../base.js";
import { PrescriptionItem } from "../w10/prescricao.js";
import { Correlacao } from "./correlacao.js";

export const PrescricaoProposta = z.object({ schema: z.literal("PrescricaoProposta@1"), id: Id, revisao: Id,
  correlacao: Correlacao, templateId: Id.nullable(), templateVersao: Id.nullable(),
  templateHash: z.string().regex(/^[a-f0-9]{64}$/).optional(), rascunhoOrigemId: Id.optional(),
  itens: z.array(PrescriptionItem).min(1), estado: z.literal("DRAFT"),
}).strict().refine(p => (p.templateHash === undefined && p.rascunhoOrigemId === undefined)
  || (p.templateHash !== undefined && p.rascunhoOrigemId !== undefined && p.templateId !== null && p.templateVersao !== null),
  {message:"origem de template exige identidade, versão, hash e rascunho"});
export type PrescricaoProposta = z.infer<typeof PrescricaoProposta>;
