// FN-04 calcularDose — T-18…T-21 (K-06, Q29–Q32). Base = dose EFETIVAMENTE administrada no ciclo anterior.
import { describe, expect, it } from "vitest";
import type { EntradaDose, ReducaoPct } from "../../src/contracts/index.js";
import { calcularDose } from "../../src/rules/index.js";
import { RULESET_VERSAO, doseRuleset } from "../fixtures/rulesets.js";

const entradaDose = (over: Partial<EntradaDose> = {}): EntradaDose => ({
  doseAdministradaAnteriorMg: 100,
  reducaoPct: 0,
  pesoKg: 70,
  origemPeso: "MEDIDO",
  ciclosSemPesoAnteriores: 0,
  ...over,
});

describe("FN-04 reduções e arredondamento", () => {
  it("base 100 com reduções 0/20/30/40 → 100/80/70/60", () => {
    for (const [reducaoPct, esperado] of [[0, 100], [20, 80], [30, 70], [40, 60]] as const) {
      const r = calcularDose(entradaDose({ reducaoPct }), doseRuleset);
      expect(r.doseMg).toBe(esperado);
      expect(r.rulesetVersao).toBe(RULESET_VERSAO);
    }
  });
  it("base 125 com redução 30 → 88 (87,5 arredonda para cima, uma vez, após a redução)", () => {
    expect(calcularDose(entradaDose({ doseAdministradaAnteriorMg: 125, reducaoPct: 30 }), doseRuleset).doseMg).toBe(88);
  });
  it("base null → doseMg null e PENDENTE (nunca inventa)", () => {
    const r = calcularDose(entradaDose({ doseAdministradaAnteriorMg: null }), doseRuleset);
    expect(r.doseMg).toBeNull();
    expect(r.estado).toBe("PENDENTE");
  });
  it("redução fora de {0,20,30,40} (25) → VERMELHO", () => {
    const r = calcularDose(entradaDose({ reducaoPct: 25 as unknown as ReducaoPct }), doseRuleset);
    expect(r.estado).toBe("VERMELHO");
  });
});

describe("FN-04 ciclos sem peso (Q30/Q31)", () => {
  it("sem peso e sem anteriores → consecutivos 1 e PENDENTE", () => {
    const r = calcularDose(entradaDose({ pesoKg: null, origemPeso: null, ciclosSemPesoAnteriores: 0 }), doseRuleset);
    expect(r.ciclosSemPesoConsecutivos).toBe(1);
    expect(r.estado).toBe("PENDENTE");
    expect(r.doseMg).toBe(100); // dose anterior com sinal
  });
  it("sem peso com 1 ciclo anterior sem peso → consecutivos 2 e VERMELHO", () => {
    const r = calcularDose(entradaDose({ pesoKg: null, origemPeso: null, ciclosSemPesoAnteriores: 1 }), doseRuleset);
    expect(r.ciclosSemPesoConsecutivos).toBe(2);
    expect(r.estado).toBe("VERMELHO");
  });
  it("com peso → consecutivos 0 e VERDE", () => {
    const r = calcularDose(entradaDose({ pesoKg: 70, origemPeso: "MEDIDO", ciclosSemPesoAnteriores: 3 }), doseRuleset);
    expect(r.ciclosSemPesoConsecutivos).toBe(0);
    expect(r.estado).toBe("VERDE");
  });
  it("saída carrega rulesetVersao 1.0.0", () =>
    expect(calcularDose(entradaDose(), doseRuleset).rulesetVersao).toBe(RULESET_VERSAO));
});
