import { z } from "zod";
import { Id } from "../base.js";
import { Semaforo } from "../estados.js";
import { Correlacao, VersaoReferencia } from "./correlacao.js";

export const SetorClinico = z.enum(["LABORATORIO", "IMAGEM", "PATOLOGIA", "COMORBIDADES", "INTERACOES", "TOXICIDADES", "TRATAMENTO"]);
export type SetorClinico = z.infer<typeof SetorClinico>;
export const ReferenciaFato = z.object({ eventId: Id, revisao: Id }).strict();
export const Achado = z.object({ id: Id, estado: Semaforo, texto: Id,
  fatos: z.array(ReferenciaFato), regras: z.array(VersaoReferencia), setores: z.array(SetorClinico).min(1),
}).strict();
export type Achado = z.infer<typeof Achado>;
export const Lacuna = z.object({ codigo: Id, texto: Id, setor: SetorClinico, fatos: z.array(ReferenciaFato) }).strict();
export type Lacuna = z.infer<typeof Lacuna>;
export const AchadosSetor = z.object({ schema: z.literal("AchadosSetor@1"), setor: SetorClinico,
  correlacao: Correlacao, entradas: z.array(ReferenciaFato),
  cobertura: z.object({ avaliados: z.number().int().nonnegative(), semRegraAprovada: z.number().int().nonnegative() }).strict(),
  achados: z.array(Achado), lacunas: z.array(Lacuna),
}).strict();
export type AchadosSetor = z.infer<typeof AchadosSetor>;
