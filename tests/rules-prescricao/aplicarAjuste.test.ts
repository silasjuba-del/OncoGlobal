import { describe, expect, it } from "vitest";
import { aplicarAjuste } from "../../src/rules/prescricao/aplicarAjuste.js";
import { calcularDose } from "../../src/rules/dose.js";
import type { DoseRuleset } from "../../src/contracts/regras.js";
import { PrescriptionItem } from "../../src/contracts/w10/prescricao.js";
import { item } from "./_fixtures.js";

const rs: DoseRuleset = { header: { id: "dose", versao: "teste" }, reducoesPct: [0, 20, 30, 40], semPesoConsecutivosVermelho: 2, AC: { ciclosComMedico: [] } };
const base = item({ drug: "Docetaxel", doseBasis: "MG_M2", standardDose: 75, calculatedDose: 135, prescribedDose: 135 });

describe("W10-INT-PRESC-03 · aplicarAjuste", () => {
  it("−20/−30/−40 sobre a dose anterior, igual a FN-04", () => {
    for (const [p, r] of [[-20, 20], [-30, 30], [-40, 40]] as const) {
      for (const b of [1, 7, 135, 129, 1001]) {
        const it = item({ drug: "X", prescribedDose: b, calculatedDose: b });
        const res = aplicarAjuste(it, p, "neutropenia");
        const fn04 = calcularDose({ doseAdministradaAnteriorMg: b, reducaoPct: r, pesoKg: 70, origemPeso: "MEDIDO", ciclosSemPesoAnteriores: 0 }, rs);
        expect(res.ok && res.item.prescribedDose).toBe(fn04.doseMg);
      }
    }
  });
  it("resultado conhecido e item continua válido no contrato", () => {
    const r = aplicarAjuste(base, -20, "mucosite G3");
    if (!r.ok) throw new Error("esperado ok");
    expect(r.item).toMatchObject({ prescribedDose: 108, adjustmentPercent: -20, adjustmentReason: "mucosite G3", calculatedDose: 135 });
    expect(PrescriptionItem.safeParse(r.item).success).toBe(true);
    expect(base.prescribedDose).toBe(135); // sem mutação
  });
  it("qualquer outro valor é recusado", () => {
    for (const v of [0, -10, -25, -50, 20, 30, 40, -19.9, NaN, Infinity, "-20", null, undefined, {}]) {
      const r = aplicarAjuste(base, v, "motivo");
      expect(r).toMatchObject({ ok: false, recusa: { codigo: "PERCENTUAL_INVALIDO" } });
    }
  });
  it("motivo obrigatório", () => {
    expect(aplicarAjuste(base, -20, "")).toMatchObject({ ok: false, recusa: { codigo: "MOTIVO_AUSENTE" } });
    expect(aplicarAjuste(base, -20, "   ")).toMatchObject({ ok: false, recusa: { codigo: "MOTIVO_AUSENTE" } });
  });
  it("sem dose anterior ⇒ recusa (PENDENTE)", () => {
    const sem = item({ drug: "X", prescribedDose: null });
    expect(aplicarAjuste(sem, -30, "m")).toMatchObject({ ok: false, recusa: { codigo: "DOSE_ANTERIOR_AUSENTE" } });
    expect(aplicarAjuste(base, -30, "m", { doseBase: null })).toMatchObject({ ok: false, recusa: { codigo: "DOSE_ANTERIOR_AUSENTE" } });
  });
  it("não compõe ajuste sobre ajuste; reajuste usa doseBase explícita", () => {
    const r1 = aplicarAjuste(base, -20, "m");
    if (!r1.ok) throw new Error("esperado ok");
    expect(aplicarAjuste(r1.item, -20, "m")).toMatchObject({ ok: false, recusa: { codigo: "AJUSTE_JA_APLICADO" } });
    const r2 = aplicarAjuste(r1.item, -40, "troca", { doseBase: 135 });
    expect(r2.ok && r2.item.prescribedDose).toBe(81);
  });
  it("dose que arredonda a zero é recusada", () => {
    const pequena = item({ drug: "X", prescribedDose: 0.5 });
    expect(aplicarAjuste(pequena, -40, "m")).toMatchObject({ ok: false, recusa: { codigo: "DOSE_RESULTANTE_INVALIDA" } });
  });
});
