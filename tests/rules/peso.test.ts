// FN-06 avaliarPeso — T-23 (Q24–Q25, A2). VERMELHO só com pesos MEDIDOS; informado ⇒ PENDENTE.
import { describe, expect, it } from "vitest";
import type { Pesagem } from "../../src/contracts/index.js";
import { avaliarPeso } from "../../src/rules/index.js";
import { salaoRuleset } from "../fixtures/rulesets.js";
import { HOJE } from "../fixtures/triagem.js";

const pesagem = (data: string, kg: number, origem: Pesagem["origem"] = "MEDIDO"): Pesagem => ({ data, kg, origem });

describe("FN-06 tendência de peso (igual passa; janela 60 dias; limiar >5 kg)", () => {
  it("dois MEDIDOS com perda de 5,0 kg em 60 dias → VERDE", () => {
    const r = avaliarPeso([pesagem("2026-08-10", 80), pesagem("2026-10-01", 75)], HOJE, salaoRuleset);
    expect(r.estado).toBe("VERDE");
    expect(r.perdaKg).toBeCloseTo(5.0, 5);
    expect(r.rulesetVersao).toBe(salaoRuleset.header.versao);
  });
  it("perda de 5,1 kg com dois MEDIDOS → VERMELHO + ação [NUTRICAO, QT_ADIADA, CONSULTA_MEDICA]", () => {
    const r = avaliarPeso([pesagem("2026-08-10", 80), pesagem("2026-10-01", 74.9)], HOJE, salaoRuleset);
    expect(r.estado).toBe("VERMELHO");
    expect(r.perdaKg).toBeCloseTo(5.1, 5);
    expect(r.acao).toEqual(["NUTRICAO", "QT_ADIADA", "CONSULTA_MEDICA"]);
  });
  it("perda de 9 kg envolvendo INFORMADO_PACIENTE → PENDENTE (incerta, A2)", () => {
    const r = avaliarPeso(
      [pesagem("2026-08-10", 80, "INFORMADO_PACIENTE"), pesagem("2026-10-01", 71)],
      HOJE, salaoRuleset,
    );
    expect(r.estado).toBe("PENDENTE");
  });
  it("pesagem fora da janela de 60 dias é ignorada (sobra 1 na janela) → PENDENTE", () => {
    const r = avaliarPeso([pesagem("2026-07-01", 80), pesagem("2026-10-01", 74)], HOJE, salaoRuleset);
    expect(r.estado).toBe("PENDENTE");
    expect(r.estado).not.toBe("VERMELHO"); // a perda de 6 kg não pode ser calculada sem a pesagem antiga
  });
  it("1 pesagem → PENDENTE", () => {
    expect(avaliarPeso([pesagem("2026-10-01", 74)], HOJE, salaoRuleset).estado).toBe("PENDENTE");
  });
  it("sem pesagem → PENDENTE", () => {
    expect(avaliarPeso([], HOJE, salaoRuleset).estado).toBe("PENDENTE");
  });
  it("saída carrega a versão do ruleset do salão (1.1.0 desde D-W9-58)", () =>
    expect(avaliarPeso([pesagem("2026-08-10", 80), pesagem("2026-10-01", 75)], HOJE, salaoRuleset).rulesetVersao).toBe(salaoRuleset.header.versao));
});
