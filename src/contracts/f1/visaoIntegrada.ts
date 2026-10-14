import { z } from "zod";
import { Correlacao } from "./correlacao.js";
import { Achado, Lacuna, SetorClinico } from "./achadosSetor.js";

export const VisaoIntegrada = z.object({ schema: z.literal("VisaoIntegrada@1"), correlacao: Correlacao,
  achados: z.array(Achado), lacunas: z.array(Lacuna),
  cobertura: z.object({ setoresEsperados: z.array(SetorClinico), setoresAvaliados: z.array(SetorClinico),
    avaliados: z.number().int().nonnegative(), semRegraAprovada: z.number().int().nonnegative() }).strict(),
}).strict();
export type VisaoIntegrada = z.infer<typeof VisaoIntegrada>;
