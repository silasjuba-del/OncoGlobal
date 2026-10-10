import { z } from "zod";
import type { ResultadoInstrumento } from "./instrumentos.js";
export const ResultadoInstrumentoSchema: z.ZodType<ResultadoInstrumento> = z.object({
  instrumento:z.enum(["KPS","CHILD_PUGH","ALBI","KHORANA","G8"]),
  estado:z.enum(["CALCULADO","PENDENTE","NAO_APLICAVEL"]),escore:z.number().finite().nullable(),
  classificacao:z.string().nullable(),parcelas:z.record(z.string(),z.number().finite()),pendencias:z.array(z.string()),
  regraVersao:z.string().nullable(),fonteRegra:z.string().nullable(),fonteDados:z.string().nullable(),
  condutaAutomatica:z.literal(false),consultaSegue:z.literal(true),
}).strict();
