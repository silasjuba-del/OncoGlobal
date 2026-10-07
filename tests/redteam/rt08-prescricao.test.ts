// RT-08 · Prescrição e dose (S0) — provas de DEFESA: −25% é recusado (só −20/−30/−40),
// ajuste sem motivo é recusado, arredondamento é meio-para-cima uma única vez, sem peso
// é PENDENTE (2º ciclo seguido = VERMELHO), peso informado é aceito com marca (Q31).
import { describe, expect, it } from "vitest";
import { calcularDose } from "../../src/rules/dose.js";
import type { ReducaoPct } from "../../src/contracts/regras.js";
import { AjustePercentual, PrescriptionItem, SafetyVerdict } from "../../src/contracts/w10/prescricao.js";
import { doseRuleset } from "../fixtures/rulesets.js";

describe("RT-08 · FN-04 dose: só as reduções do ruleset, nunca inventar mg", () => {
  it("ajuste −25% é recusado (VERMELHO, doseMg nulo) — só −20/−30/−40 existem (D-W9-26)", () => {
    const saida = calcularDose(
      { doseAdministradaAnteriorMg: 100, // -25% fora do tipo ReducaoPct: o RUNTIME precisa recusar também
        reducaoPct: 25 as ReducaoPct, pesoKg: 70, origemPeso: "MEDIDO", ciclosSemPesoAnteriores: 0 },
      doseRuleset);
    expect(saida.estado).toBe("VERMELHO");
    expect(saida.doseMg).toBeNull();
    expect(saida.motivo).toContain("redução não prevista");
  });

  it.each([
    [100, 20, 80],
    [100, 30, 70],
    [100, 40, 60],
    [49, 30, 34],   // floor((49×70+50)/100) = 34,8 → 34
    [51, 40, 31],   // floor((51×60+50)/100) = 31,1 → 31
  ])("base %i com −%i%% arredonda meio-para-cima UMA vez ⇒ %i mg", (base, reducao, esperado) => {
    const saida = calcularDose(
      { doseAdministradaAnteriorMg: base, reducaoPct: reducao as ReducaoPct, pesoKg: 70, origemPeso: "MEDIDO", ciclosSemPesoAnteriores: 0 },
      doseRuleset);
    expect(saida.estado).toBe("VERDE");
    expect(saida.doseMg).toBe(esperado);
  });

  it("sem dose administrada anterior ⇒ PENDENTE 'dose anterior ausente' (nunca inventa base)", () => {
    const saida = calcularDose(
      { doseAdministradaAnteriorMg: null, reducaoPct: 0, pesoKg: 70, origemPeso: "MEDIDO", ciclosSemPesoAnteriores: 0 },
      doseRuleset);
    expect(saida.estado).toBe("PENDENTE");
    expect(saida.doseMg).toBeNull();
    expect(saida.motivo).toContain("dose anterior ausente");
  });

  it("sem peso: 1º ciclo PENDENTE; 2º ciclo seguido VERMELHO (Q30) — dose anterior mantida", () => {
    const primeiro = calcularDose(
      { doseAdministradaAnteriorMg: 100, reducaoPct: 0, pesoKg: null, origemPeso: null, ciclosSemPesoAnteriores: 0 },
      doseRuleset);
    expect(primeiro.estado).toBe("PENDENTE");
    expect(primeiro.doseMg).toBe(100);
    const segundo = calcularDose(
      { doseAdministradaAnteriorMg: 100, reducaoPct: 0, pesoKg: null, origemPeso: null, ciclosSemPesoAnteriores: 1 },
      doseRuleset);
    expect(segundo.estado).toBe("VERMELHO");
  });

  it("peso INFORMADO_PELO PACIENTE: dose calculada com marca explícita no motivo (Q31/A2)", () => {
    const saida = calcularDose(
      { doseAdministradaAnteriorMg: 100, reducaoPct: 0, pesoKg: 70, origemPeso: "INFORMADO_PACIENTE", ciclosSemPesoAnteriores: 0 },
      doseRuleset);
    expect(saida.estado).toBe("VERDE");
    expect(saida.motivo).toContain("informado");
  });
});

describe("RT-08 · contratos W10 recusam o que o fluxo não pode fazer", () => {
  it("AjustePercentual: −25 falha no schema; −20/−30/−40 passam", () => {
    expect(AjustePercentual.safeParse(-25).success).toBe(false);
    expect(AjustePercentual.safeParse(-20).success).toBe(true);
    expect(AjustePercentual.safeParse(-30).success).toBe(true);
    expect(AjustePercentual.safeParse(-40).success).toBe(true);
  });

  it("ajuste de dose SEM motivo é recusado no contrato (superRefine)", () => {
    const item = {
      drug: "paclitaxel", classe: "QT", sequence: 1, standardDose: 175, doseBasis: "MG_M2",
      calculatedDose: 140, prescribedDose: 140, unit: "mg", adjustmentPercent: -20,
      adjustmentReason: null, route: "EV", diluent: "SF 0,9%", finalVolumeMl: 250,
      infusionTime: "3 h", days: ["d1"], observacao: null, source: "PROTOCOL", overrideMotivo: null,
    };
    expect(PrescriptionItem.safeParse(item).success).toBe(false);
    expect(PrescriptionItem.safeParse({ ...item, adjustmentReason: "neutropenia G3 ciclo 2" }).success).toBe(true);
  });

  it("antineoplásico MANUAL fora do protocolo exige motivo (override)", () => {
    const item = {
      drug: "cisplatina", classe: "QT", sequence: 2, standardDose: 75, doseBasis: "MG_M2",
      calculatedDose: 75, prescribedDose: 75, unit: "mg", adjustmentPercent: null,
      adjustmentReason: null, route: "EV", diluent: "SF 0,9%", finalVolumeMl: 500,
      infusionTime: "2 h", days: ["d1", "d8"], observacao: null, source: "MANUAL", overrideMotivo: null,
    };
    expect(PrescriptionItem.safeParse(item).success).toBe(false);
  });

  it("SafetyVerdict: BLOCK bloqueia o ARTEFATO (nunca o clínico) e motivo exige fonte", () => {
    expect(SafetyVerdict.safeParse({ resultado: "BLOCK_ARTEFATO", motivos: [] }).success).toBe(true);
    expect(SafetyVerdict.safeParse({
      resultado: "WARNING",
      motivos: [{ codigo: "X", texto: "sem fonte" }],
    }).success).toBe(false); // fonte é obrigatória em todo motivo
    expect(SafetyVerdict.safeParse({ resultado: "NOT_EVALUABLE", motivos: [] }).success).toBe(true);
  });
});
