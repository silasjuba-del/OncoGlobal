import { describe, expect, it } from "vitest";
import { PatientTimeline } from "../../src/contracts/w10/clinico-w10.js";
import { secoesDaTimeline } from "../../src/kernel/projections/timelineSecoes.js";

function timeline(over: Record<string, unknown> = {}) {
  return PatientTimeline.parse({
    patientId: "P07", stageHistory: [], historicalMetastaticDisease: false,
    treatments: [], recist: [], missingRequiredData: [], unresolvedConflicts: [], ...over,
  });
}

const estagio = { tipo: "CLINICO", valor: "cT2N0M0", sistema: "AJCC 8", data: "2029-02-01", sourceId: "fonte-1" };
const tratamento = {
  regimen: "CARBOPLATINA", templateId: null, intent: null, line: null, cycle: 4,
  status: "PRESCRITO", em: "2029-02-01", sourceIds: ["fonte-1"],
};

describe("FUGU-10 · timeline → seções da tela (sem tocar em src/modules)", () => {
  it("timeline vazia: nada vira VERDE por ausência", () => {
    const secoes = secoesDaTimeline(timeline());
    expect(secoes.estadiamento.estado).toBe("PENDENTE");
    expect(secoes.estadiamento.motivo).toContain("ausência nunca é M0");
    expect(secoes.tratamento.estado).toBe("PENDENTE");
    expect(secoes.recist.estado).toBe("PENDENTE");
    expect(secoes.recist.motivo).toContain("PROPOSTA");
    expect(secoes.estadiamento.itens).toEqual([]);
  });

  it("estadiamento e tratamento com fonte ficam VERDE com os itens", () => {
    const secoes = secoesDaTimeline(timeline({ stageHistory: [estagio], treatments: [tratamento] }));
    expect(secoes.estadiamento.estado).toBe("VERDE");
    expect(secoes.estadiamento.itens).toEqual([estagio]);
    expect(secoes.tratamento.estado).toBe("VERDE");
    expect(secoes.tratamento.itens[0]!.status).toBe("PRESCRITO");
  });

  it("pendência obrigatória é PENDENTE e conflito não resolvido é VERMELHO", () => {
    const secoes = secoesDaTimeline(timeline({
      missingRequiredData: ["HER2", "ESTADIAMENTO"], unresolvedConflicts: ["exc:CONFLICT:seg-1"],
    }));
    expect(secoes.pendencias).toMatchObject({ estado: "PENDENTE", itens: ["HER2", "ESTADIAMENTO"] });
    expect(secoes.pendencias.motivo).toContain("NÃO SEI");
    expect(secoes.conflitos).toMatchObject({ estado: "VERMELHO", itens: ["exc:CONFLICT:seg-1"] });
  });

  it("sem pendência e sem conflito o motivo é explícito sobre o escopo verificado", () => {
    const secoes = secoesDaTimeline(timeline({ stageHistory: [estagio] }));
    expect(secoes.pendencias.estado).toBe("VERDE");
    expect(secoes.conflitos.estado).toBe("VERDE");
    expect(secoes.conflitos.motivo).toContain("entre os fatos reconciliados");
    expect(Object.values(secoes).every((s) => ["VERDE", "VERMELHO", "PENDENTE"].includes(s.estado))).toBe(true);
  });
});