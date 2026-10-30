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
    expect(tratamentos.every((t) => t.cycle === null)).toBe(true); // ciclo de outra fonte não pertence a estes tratamentos
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
it("não inventa tipo/sistema e mantém prefixos e edição explícitos", () => {
 const r = historicoDeEstagios([fato({ domain: "stage", value: { literal: "T2N0M0" } }), fato({ domain: "stage", value: { literal: "ypT2N0M0", sistema: "AJCC 9" } })]);
 expect(r).toEqual(expect.arrayContaining([expect.objectContaining({ valor: "T2N0M0", tipo: null, sistema: null }), expect.objectContaining({ valor: "ypT2N0M0", tipo: "POS_TRATAMENTO", sistema: "AJCC 9" })]));
});
it("data/ciclo/fonte ficam ligados ao trecho e estado de cada tratamento", () => {
 const p = fato({ domain: "drug", sourceType: "prescription", sourceId: "rx-a", rawEvidence: "A", date: "01/02/2026", value: { normalizado: "CARBOPLATINA" } });
 const q = fato({ domain: "drug", sourceType: "administration", sourceId: "adm-b", rawEvidence: "B", date: "02/03/2026", value: { normalizado: "CISPLATINA" } });
 const r = tratamentoLongitudinal([p, q, fato({ ...p, id: "c-a", domain: "cycle", value: "2" }), fato({ ...q, id: "c-b", domain: "cycle", value: "8" })]);
 expect(r).toEqual([expect.objectContaining({ regimen: "CARBOPLATINA", cycle: 2, em: "2026-02-01", sourceIds: ["rx-a"], status: "PRESCRITO" }), expect.objectContaining({ regimen: "CISPLATINA", cycle: 8, em: "2026-03-02", sourceIds: ["adm-b"], status: "ADMINISTRADO" })]);
});
it("ciclo contraditório ou de outro trecho permanece desconhecido", () => {
 const p = fato({ domain: "drug", sourceType: "prescription", sourceId: "rx", rawEvidence: "A", value: { normalizado: "CARBOPLATINA" } });
 const c = fato({ ...p, domain: "cycle", value: "2" });
 expect(tratamentoLongitudinal([p, c, fato({ ...c, value: "5" })])[0]?.cycle).toBeNull();
 expect(tratamentoLongitudinal([p, fato({ ...c, rawEvidence: "outro trecho" })])[0]?.cycle).toBeNull();
 expect(tratamentoLongitudinal([p, fato({ ...c, segmentId: "outro-paciente" })])[0]?.cycle).toBeNull();
});
it("mesmo fármaco em dias distintos conserva observações, sem ciclo global", () => {
 const p = fato({ domain: "drug", sourceType: "prescription", sourceId: "rx", value: { normalizado: "CARBOPLATINA" }, date: "01/02/2026" });
 expect(tratamentoLongitudinal([p, fato({ ...p, date: "02/02/2026" })]).map(e => e.em)).toEqual(["2026-02-01", "2026-02-02"]);
});
it("esquema nominal explícito preserva sua observação e ciclo local", () => {
 const p = fato({ domain: "regimen", sourceType: "prescription", sourceId: "rx", value: "Esquema sintético A" });
 expect(tratamentoLongitudinal([p, fato({ ...p, domain: "cycle", value: "3" })])[0]).toMatchObject({ regimen: "Esquema sintético A", cycle: 3, sourceIds: ["rx"], em: null });
});

it("ciclos de outra página e trecho com múltiplos tratamentos não são arbitrados", () => {
 const p = fato({ domain: "drug", sourceType: "prescription", sourceId: "rx", page: 1, value: { normalizado: "CARBOPLATINA" } });
 const c = fato({ ...p, domain: "cycle", value: "3", page: 2 });
 expect(tratamentoLongitudinal([p, c])[0]?.cycle).toBeNull();
 const q = fato({ ...p, id: "outra-droga", value: { normalizado: "CISPLATINA" } });
 expect(tratamentoLongitudinal([p, q, { ...c, page: 1 }]).every(t => t.cycle === null)).toBe(true);
});
it("mesmo nome/data/fonte em segmentos distintos não é fundido", () => {
 const p = fato({ domain: "drug", sourceType: "prescription", sourceId: "rx", value: { normalizado: "CARBOPLATINA" } });
 expect(tratamentoLongitudinal([p, fato({ ...p, segmentId: "outro-episodio" })])).toHaveLength(2);
});
