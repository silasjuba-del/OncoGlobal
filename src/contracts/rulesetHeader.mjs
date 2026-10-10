// Single runtime ruleset-header authority shared by TS consumers and the corpus CLI.
import { z } from "zod";
export const RulesetHeader = z.object({
  id: z.string().min(1),
  versao: z.string().regex(/^\d+\.\d+\.\d+$/),
  vigenteDesde: z.iso.date(),
  fonte: z.object({
    tipo: z.enum(["DECISAO_MEDICA", "DIRETRIZ", "NORMA", "LITERATURA"]),
    referencia: z.string().min(1),
    trecho: z.string().nullable(), // obrigatório para DIRETRIZ/NORMA/LITERATURA
    edicao: z.string().nullable(),
  }).strict(),
  curador: z.string().min(1),
  aprovadoEm: z.iso.date(),
}).strict().superRefine((h, ctx) => {
  if (h.fonte.tipo !== "DECISAO_MEDICA" && (!h.fonte.trecho?.trim() || h.fonte.trecho.includes("[VERIFICAR]")))
    ctx.addIssue({ code: "custom", message: "fonte externa exige trecho que sustente a regra (K-27)" });
});
