import { describe, expect, it } from "vitest";
import type { ClinicalFact, FactDomain, ReviewException } from "../../src/kernel/extracao/tipos.js";
import { historicoDeEstagios, projetarTimelinePaciente, tratamentoLongitudinal } from "../../src/kernel/projections/timelinePaciente.js";

let sequencia = 0;
function fato(over: Partial<ClinicalFact> & { domain: FactDomain }): ClinicalFact {
  sequencia += 1;
  return {
    id: `t-${sequencia}`, segmentId: "seg-1", patientCandidateId: null, value: null,
    sourceType: "medical_note", evidence: "EXPLICIT", sourceId: `fonte-${sequencia}`,
    rawEvidence: "linha sintética", confidence: 1, requiresConfirmation: false, ...over,
  };
}

describe("FUGU-10 · timeline longitudinal", () => {
  it("produz timeline válida no contrato W10 e ordena o histórico de estágios", () => {
    const clinico = fato({ domain: "stage", sourceType: "medical_note", date: "01/02/2029", value: { literal: "cT2N0M0", tipo: "CLINICO", sistema: "AJCC 8" } });
    const patologico = fato({ domain: "stage", sourceType: "pathology", date: "01/01/2029", value: { literal: "pT3N1M0", tipo: "PATOLOGICO", sistema: "AJCC 8" } });
    const timeline = projetarTimelinePaciente({
      patientId: "P07", fatos: [clinico, patologico], conflitos: [], missingRequiredData: [],
    });
    expect(timeline.patientId).toBe("P07");
    expect(timeline.stageHistory.map((e) => e.valor)).toEqual(["pT3N1M0", "cT2N0M0"]);
    expect(timeline.stageHistory.map((e) => e.tipo)).toEqual(["PATOLOGICO", "CLINICO"]);
    expect(timeline.recist).toEqual([]);
    expect(historicoDeEstagios([clinico, patologico])).toHaveLength(2);
  });

  it("historicalMetastaticDisease é monotônico: true persistido nunca volta a false", () => {
    const semM1 = fato({ domain: "stage", value: { literal: "cT2N0M0" } });
    expect(projetarTimelinePaciente({
      patientId: "P07", fatos: [semM1], conflitos: [], missingRequiredData: [],
      historicalMetastaticDiseaseAnterior: true,
    }).historicalMetastaticDisease).toBe(true);
    const comM1 = fato({ id: "com-m1", domain: "stage", value: { literal: "cT4N2M1" } });
    expect(projetarTimelinePaciente({
      patientId: "P07", fatos: [comM1], conflitos: [], missingRequiredData: [],
    }).historicalMetastaticDisease).toBe(true);
  });

  it("tratamento separa prescrito de administrado e nunca deduz intenção clínica (D-W9-12)", () => {
    const prescricao = fato({ domain: "drug", sourceType: "prescription", value: { normalizado: "CARBOPLATINA" } });
    const administracao = fato({ domain: "drug", sourceType: "administration", value: { normalizado: "CARBOPLATINA" } });
    const ciclo = fato({ domain: "cycle", sourceType: "prescription", value: { numero: 4 } });
    const tratamentos = tratamentoLongitudinal([prescricao, administracao, ciclo]);
    expect(tratamentos.map((t) => t.status).sort()).toEqual(["ADMINISTRADO", "PRESCRITO"]);
    expect(tratamentos.every((t) => t.intent === null && t.templateId === null)).toBe(true);
    expect(tratamentos.every((t) => t.cycle === 4)).toBe(true);
  });

  it("pendências e conflitos entram sem deduplicar o conflito", () => {
    const conflito: ReviewException = {
      id: "exc:CONFLICT:seg-1", kind: "CONFLICT", segmentId: "seg-1",
      factIds: [], reason: "M0 × metástase", sourceIds: ["fonte-1"],
    };
    const timeline = projetarTimelinePaciente({
      patientId: "P07", fatos: [], conflitos: [conflito],
      missingRequiredData: ["HER2", "HER2", "ESTADIAMENTO"],
    });
    expect(timeline.unresolvedConflicts).toEqual(["exc:CONFLICT:seg-1"]);
    expect(timeline.missingRequiredData).toEqual(["ESTADIAMENTO", "HER2"]);
  });

  it("timeline sem patientId é recusada em vez de criar paciente anônimo", () => {
    expect(() => projetarTimelinePaciente({
      patientId: "  ", fatos: [], conflitos: [], missingRequiredData: [],
    })).toThrow("patientId");
  });
});