// Carrega os rulesets CONGELADOS do corpus e faz parse com os schemas de src/contracts.
import { readFileSync } from "node:fs";
import { DoseRuleset, PrazosRuleset, SalaoRuleset } from "../../src/contracts/index.js";

const dir = new URL("../../corpus/rulesets/", import.meta.url);
const carregar = (nome: string): unknown => JSON.parse(readFileSync(new URL(nome, dir), "utf8"));

export const salaoRuleset = SalaoRuleset.parse(carregar("salao-triagem.v1.json"));
export const doseRuleset = DoseRuleset.parse(carregar("dose.v1.json"));
export const prazosRuleset = PrazosRuleset.parse(carregar("prazos.v1.json"));

/** Todos os rulesets da onda F0 estão na versão 1.0.0. */
export const RULESET_VERSAO = "1.0.0";
