import { expect, it } from "vitest";
import { calcularDose } from "../../src/rules/dose.js";
import { doseRuleset } from "../fixtures/rulesets.js";

const base = {
  doseAdministradaAnteriorMg: 160, reducaoPct: 0 as const, pesoKg: 72, alturaCm: 180,
  origemPeso: "MEDIDO" as const, ciclosSemPesoAnteriores: 0, referenciaMgM2: 100,
};

it("com referência em mg/m² a dose usa a SC atual e mostra a dose anterior ao lado", () => {
  const nivelZero = calcularDose({ ...base, nivelDose: 0 }, doseRuleset);
  const nivelMenosUm = calcularDose({ ...base, nivelDose: -1, percentualDoNivel: 20, scAnteriorM2: 1.7 }, doseRuleset);
  expect(nivelZero).toMatchObject({ estado: "VERDE", doseMg: 190 });
  expect(nivelZero.motivo).toContain("dose anterior 160 mg ao lado");
  expect(nivelMenosUm).toMatchObject({ estado: "VERDE", doseMg: 152 });
  expect(nivelMenosUm.motivo).toContain("SC variou ≥ 10%");
  expect(calcularDose({ ...base, nivelDose: -2, percentualDoNivel: null }, doseRuleset).estado).toBe("PENDENTE");
});
