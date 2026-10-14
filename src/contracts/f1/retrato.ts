import { z } from "zod";
import { Fonte, Id, Instante } from "../base.js";
import { ReferenciaFato } from "./achadosSetor.js";
import { VersaoReferencia } from "./correlacao.js";

export const FatoRetrato = z.object({ ref: ReferenciaFato, tipo: Id, campo: Id.nullable(),
  patientId: Id, encounterId: Id, tumorLotId: Id.nullable(), escopo: z.enum(["PACIENTE", "TUMOR"]),
  tempoClinico: z.string().nullable(), tempoRegistro: Instante, fontes: z.array(Fonte),
  dados: z.record(z.string(), z.unknown()),
}).strict();
export type FatoRetrato = z.infer<typeof FatoRetrato>;
export const Retrato = z.object({ schema: z.literal("Retrato@1"), patientId: Id, encounterId: Id,
  tumorLotId: Id.nullable(), revisao: Id, versaoProjecao: Id, geradoEm: Instante,
  regras: z.array(VersaoReferencia), biblioteca: VersaoReferencia,
  fatos: z.array(FatoRetrato),
  integridade: z.array(z.object({ eventoId: Id, tipo: z.string().nullable(), motivo: Id }).strict()),
  delta: z.object({ encounterAnteriorId: Id.nullable(), novos: z.array(ReferenciaFato),
    substituidos: z.array(ReferenciaFato) }).strict(),
  resumo: z.array(z.object({ texto: Id, fatos: z.array(ReferenciaFato).min(1) }).strict()),
}).strict();
export type Retrato = z.infer<typeof Retrato>;
