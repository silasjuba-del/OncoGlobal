import { expect, it } from "vitest";
import { calcularDose } from "../../src/rules/dose.js";
import { doseRuleset } from "../fixtures/rulesets.js";

const base = { doseAdministradaAnteriorMg: 100, pesoKg: 70, origemPeso: "MEDIDO" as const, ciclosSemPesoAnteriores: 0 };

it("com peso, o rótulo não chama de dose calculada o que só aplica percentual à dose anterior", () => {
  const mantida = calcularDose({ ...base, reducaoPct: 0 }, doseRuleset);
  const reduzida = calcularDose({ ...base, reducaoPct: 20 }, doseRuleset);
  expect(mantida).toMatchObject({ estado: "VERDE", doseMg: 100 });
  expect(reduzida).toMatchObject({ estado: "VERDE", doseMg: 80 });
  expect(mantida.motivo).toBe("dose anterior mantida — SC não recalculada");
  expect(reduzida.motivo).toBe("percentual aplicado à dose anterior — SC não recalculada");
});
