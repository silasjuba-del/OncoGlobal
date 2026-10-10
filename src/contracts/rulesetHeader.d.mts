import type { z } from "zod";
export interface RulesetHeaderShape { id: string; versao: string; vigenteDesde: string; fonte: { tipo: "DECISAO_MEDICA" | "DIRETRIZ" | "NORMA" | "LITERATURA"; referencia: string; trecho: string | null; edicao: string | null }; curador: string; aprovadoEm: string }
export const RulesetHeader: z.ZodType<RulesetHeaderShape>;
