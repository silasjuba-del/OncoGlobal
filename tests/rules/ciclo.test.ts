// FN-09 cicloVaiAoMedico — T-26 (Q32). AC: 1, 2, 4 com médico; ciclo 3 salta só sem corte e sem pendência.
import { describe, expect, it } from "vitest";
import type { Motivo, ResultadoTriagem } from "../../src/contracts/index.js";
import { cicloVaiAoMedico } from "../../src/rules/index.js";
import { RULESET_VERSAO, doseRuleset } from "../fixtures/rulesets.js";

const motivo = (codigo: string): Motivo => ({
  codigo, texto: `motivo sintético ${codigo}`, regraId: "FN-01", rulesetVersao: RULESET_VERSAO,
});

const resultado = (over: Partial<ResultadoTriagem> = {}): ResultadoTriagem => ({
  destino: "SALAO",
  cortes: [],
  naoCortes: [],
  pendentes: [],
  emergencia: false,
  qtPodeIniciarSemMedico: true,
  rulesetVersao: RULESET_VERSAO,
  ...over,
});

describe("FN-09 ciclo vai ao médico (esquema AC)", () => {
  it("ciclos 1, 2 e 4 → true (sempre com médico)", () => {
    for (const n of [1, 2, 4])
      expect(cicloVaiAoMedico("AC", n, resultado(), doseRuleset)).toBe(true);
  });
  it("ciclo 3 sem corte e sem pendência → false (salta o médico)", () =>
    expect(cicloVaiAoMedico("AC", 3, resultado(), doseRuleset)).toBe(false));
  it("ciclo 3 com corte → true", () =>
    expect(cicloVaiAoMedico("AC", 3, resultado({ cortes: [motivo("corte.pas.alta")] }), doseRuleset)).toBe(true));
  it("ciclo 3 com pendência → true", () =>
    expect(cicloVaiAoMedico("AC", 3, resultado({ pendentes: [motivo("pendente.hemograma")] }), doseRuleset)).toBe(true));
});

describe("FN-09 outros esquemas", () => {
  it("F0C: AC ciclo 3 não ignora prescrição sem vigência", () => {
    expect(cicloVaiAoMedico("AC",3,resultado({qtPodeIniciarSemMedico:false}),doseRuleset)).toBe(true);
  });
  it("F0C: não trata qualquer token AC como o esquema AC", () => {
    expect(cicloVaiAoMedico("OUTRO-AC-EXPERIMENTAL",1,resultado(),doseRuleset)).toBe(false);
  });
  it("não-AC sem condições para iniciar sem médico → true", () =>
    expect(cicloVaiAoMedico("FOLFOX", 2, resultado({ qtPodeIniciarSemMedico: false }), doseRuleset)).toBe(true));
  it("não-AC apto a iniciar sem médico → false", () =>
    expect(cicloVaiAoMedico("FOLFOX", 2, resultado({ qtPodeIniciarSemMedico: true }), doseRuleset)).toBe(false));
});
