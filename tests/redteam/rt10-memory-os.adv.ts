// RT-10 · MEMORY_OS — reataque de cronologia, monotonicidade e projeção de stageHistory.
import { describe, expect, it } from "vitest";
import { PatientTimeline, validarMonotonicidade } from "../../src/contracts/w10/clinico-w10.js";
import { eventosVigentes, projetarSnapshot } from "../../src/kernel/projections/snapshot.js";
import type { ClinicalEvent } from "../../src/contracts/operacao.js";
import type { ClinicalFact, FactDomain, FactSourceType } from "../../src/kernel/extracao/tipos.js";
import { conflitoCronologia } from "../../src/kernel/extracao/reconciliacao.js";

const em = "2030-01-01T12:00:00Z";
function evento(id: string, campo: string, valor: unknown, criadoEm = em,
  supersedesEventId: string | null = null, options: {
    patientId?: string; tumorLotId?: string | null; encounterId?: string; revisao?: ClinicalEvent["revisao"];
    dataClinica?: string; sourceIds?: string[];
  } = {}): ClinicalEvent {
  const { patientId = "Paciente Teste 07", tumorLotId = "tumor-07", encounterId = "enc-07",
    revisao = "CONFIRMADO", dataClinica, sourceIds = [] } = options;
  return {
    eventId: id, operationId: `op-${id}`, eventIndex: 0, patientId,
    tumorLotId, encounterId, criadoEm, tipo: "FATO", revisao,
    criadoPor: { tipo: "SESSAO", id: "medico-teste" },
    fontes: sourceIds.map((sourceId) => ({ sourceId, classe: "DOCUMENT", localizador: null,
      dataClinica: dataClinica ?? null, dataCaptura: criadoEm, versao: "1", contentHash: `hash-${sourceId}` })),
    supersedesEventId,
    payload: { reviewDecisionId: `rd-${id}`, data: { campo, valor, ...(dataClinica ? { dataClinica } : {}) } },
  };
}
const projetar = (eventos: readonly ClinicalEvent[]) =>
  projetarSnapshot(eventos, "Paciente Teste 07", "tumor-07", "enc-07", "v1");

function fatoTemporal(id: string, domain: FactDomain, sourceType: FactSourceType, date: string): ClinicalFact {
  return { id, segmentId: "seg-rt10", patientCandidateId: null, domain, value: { synthetic: true }, sourceType,
    evidence: "EXPLICIT", sourceId: `source-${id}`, rawEvidence: "trecho sintético", date,
    confidence: 1, requiresConfirmation: false };
}

describe("RT-10 · ordem temporal e monotonicidade", () => {
  it("reconcilia PET anterior ao diagnóstico como TEMPORAL_CONFLICT pelo contrato de ClinicalFact", () => {
    const conflito = conflitoCronologia([
      fatoTemporal("diagnostico-2030", "diagnosis", "medical_note", "2030-11-10"),
      fatoTemporal("pet-2030", "imaging", "imaging_report", "2030-02-15"),
    ]);
    expect(conflito).toMatchObject({ kind: "TEMPORAL_CONFLICT", factIds: ["pet-2030", "diagnostico-2030"] });
    expect(conflito?.sourceIds).toEqual(["source-pet-2030", "source-diagnostico-2030"]);
    expect(conflitoCronologia([
      fatoTemporal("diagnostico-2030b", "diagnosis", "medical_note", "2030-02-10"),
      fatoTemporal("pet-depois", "imaging", "imaging_report", "2030-02-15"),
    ])).toBeNull();
  });

  it("PROVA DE FALHA (S0): historicalMetastaticDisease true→false é aceito pelo schema sem bloqueio", () => {
    const base = {
      patientId: "Paciente Teste 07",
      historicalMetastaticDisease: true,
      stageHistory: [{ tipo: "CLINICO" as const, valor: "cT2N0M0", sistema: "TNM8", data: "2030-01-01", sourceId: "d1" }],
      treatments: [], recist: [], missingRequiredData: [], unresolvedConflicts: [],
    };
    expect(PatientTimeline.safeParse(base).success).toBe(true);
    // Tech lead (2026-10-07): schema sem memória não distingue "false legítimo" de "rebaixado"; a regra
    // vira (1) monotonicidade entre versões e (2) M1 no stageHistory obriga true. Expectativa reescrita pelo tech lead.
    expect(validarMonotonicidade(PatientTimeline.parse(base), { ...PatientTimeline.parse(base), historicalMetastaticDisease: false })).toBe(false);
    const rebaixado = PatientTimeline.safeParse({ ...base, historicalMetastaticDisease: false,
      stageHistory: [...base.stageHistory, { tipo: "CLINICO" as const, valor: "cT2N0M1", sistema: "TNM8", data: "2030-02-01", sourceId: "d2" }] });
    expect(rebaixado.success,
      "D-W9-33 §5.7: 'historicalMetastaticDisease = true nunca volta a false' — o contrato " +
      "PatientTimeline (clinico-w10.ts) apenas comenta a regra; o superRefine não existe e o " +
      "parse aceita o rebaixamento. Nenhum dado clinicamente confirmado pode ser rebaixado em silêncio.")
      .toBe(false);
  });

  it("snapshot preserva exatamente os TNM do horizonte, incluindo supersedido, com fontes e revisão", () => {
    const velho = evento("e1", "TNM", "cT2N0M0", em, null,
      { dataClinica: "2030-01-01", sourceIds: ["doc-e1"] });
    const novo = evento("e2", "TNM", "cT3N1M0", "2030-02-01T12:00:00Z", "e1",
      { dataClinica: "2030-02-01", sourceIds: ["doc-e2"] });
    const raw = evento("e-raw", "TNM", "cT4N2M1", "2030-01-20T12:00:00Z", null,
      { revisao: "RAW", dataClinica: "2030-01-20", sourceIds: ["doc-raw"] });
    const otherPatient = evento("e-other-patient", "TNM", "pT4N2M1", "2030-01-25T12:00:00Z", null,
      { patientId: "Paciente Teste 99", dataClinica: "2030-01-25", sourceIds: ["doc-other-patient"] });
    const otherLot = evento("e-other-lot", "TNM", "pT4N2M1", "2030-01-26T12:00:00Z", null,
      { tumorLotId: "tumor-99", dataClinica: "2030-01-26", sourceIds: ["doc-other-lot"] });
    const afterHorizon = evento("e-future", "TNM", "pT4N2M1", "2030-03-01T12:00:00Z", null,
      { encounterId: "enc-08", dataClinica: "2030-03-01", sourceIds: ["doc-future"] });
    expect(eventosVigentes([velho, novo]).map((e) => e.eventId)).toEqual(["e2"]);
    const saida = projetar([velho, novo, raw, otherPatient, otherLot, afterHorizon]);
    expect(saida.stageHistory).toEqual([
      { valor: "cT2N0M0", eventId: "e1", data: "2030-01-01", sourceIds: ["doc-e1"], revisaoOriginal: "CONFIRMADO", superseded: true },
      { valor: "cT3N1M0", eventId: "e2", data: "2030-02-01", sourceIds: ["doc-e2"], revisaoOriginal: "CONFIRMADO", superseded: false },
    ]);
    expect(saida.stageHistory).toHaveLength(2);
  });
});
