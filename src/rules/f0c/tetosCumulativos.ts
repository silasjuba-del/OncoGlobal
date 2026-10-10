import { z } from "zod";
import { RulesetHeader } from "../../contracts/rulesetHeader.mjs";
import type { LimiteExposicaoCumulativa } from "../cumulativoAlerta.js";

const Fonte = z.object({
  tipo: z.literal("DECISAO_MEDICA"),
  referencia: z.string().trim().min(1),
  trecho: z.string().trim().min(1),
}).strict();

const Teto = z.object({
  ativo: z.literal(true),
  regraId: z.string().trim().min(1),
  versao: z.string().trim().min(1),
  droga: z.string().trim().min(1),
  unidade: z.enum(["mg/m2", "U", "U/m2"]),
  maximo: z.number().positive().finite(),
  comparador: z.literal("GTE"),
  classe: z.literal("regraLocal"),
  fonte: Fonte,
}).strict();

const Envelope = z.object({
  header: RulesetHeader,
  decisao: z.literal("D-F0C-08"),
  limites: z.array(Teto).length(7),
}).strict();

/** Tetos locais confirmados. Não converte uma droga na outra. */
export function lerTetosCumulativos(input: unknown): LimiteExposicaoCumulativa[] {
  const parsed = Envelope.parse(input);
  return parsed.limites.map((limite) => ({
    ativo: limite.ativo,
    regraId: limite.regraId,
    versao: limite.versao,
    droga: limite.droga,
    unidade: limite.unidade,
    maximo: limite.maximo,
    comparador: limite.comparador,
    fonte: limite.fonte.trecho,
  }));
}
