import { describe, expect, it } from "vitest";
import { rankearPacientes } from "../../../src/kernel/extracao/patient-resolver.js";
import { executarPipelineExtracao } from "../../../src/orchestration/pipeline-extracao.js";

describe("FUGU-04 · ranking não vincula", () => {
  const patients = [
    { patientId: "P08", name: "Maria Teste", age: 55, sex: "F", tumor: "mama",
      mother: "Mãe Dois", birthDate: "1971-03-01" },
    { patientId: "P07", name: "Maria Teste", age: 55, sex: "F", tumor: "mama",
      mother: "Mãe Um", birthDate: "1971-03-02" },
  ] as const;

  it("homônimas e mães diferentes continuam candidatas distintas sem merge", () => {
    const ranked = rankearPacientes("segmento-1", {
      name: "Maria Teste", age: 55, sex: "F", tumor: "mama", mother: "Mãe Um",
    }, patients, { desidentified: false });
    expect(ranked.map((p) => p.patientId)).toEqual(["P07", "P08"]);
    expect(ranked.map((p) => p.requiresReview)).toEqual([true, true]);
    expect(ranked[0]?.score).toBe(0.65);
    expect(ranked[1]?.score).toBe(0.65);
    expect(ranked[1]?.reasons.mother).toBe("diverge no cadastro");
  });

  it("Plaud desidentificado zera o peso do nome e não renormaliza", () => {
    const ranked = rankearPacientes("segmento-1", {
      name: "Maria Teste", age: 55, tumor: "mama",
    }, patients, { desidentified: true, openedPatientId: "P07" });
    expect(ranked[0]?.score).toBe(0.25);
    expect(ranked[0]?.reasons.name).toBe("desidentificado: peso zero");
    expect(ranked.every((p) => p.requiresReview)).toBe(true);
  });

  it("campos ausentes não pontuam; consulta aberta não força identidade", () => {
    const ranked = rankearPacientes("s", {}, patients, {
      desidentified: false, openedPatientId: "P08",
    });
    expect(ranked[0]?.patientId).toBe("P08");
    expect(ranked[0]?.score).toBe(0);
    expect(ranked[1]?.score).toBe(0);
  });

  it("pipeline usa pistas por segmento sem escrever patientId", () => {
    const input = {
      recordingId: "gravacao", sourceId: "fonte", sourceType: "medical_note" as const,
      rawTranscript: "Chamo Paciente Teste 07.",
      registeredPatients: patients,
      identityHintsBySegment: { "gravacao:0": { name: "Maria Teste" } },
    };
    const result = executarPipelineExtracao(input);
    expect(result.patientCandidates).toHaveLength(2);
    expect(result.patientCandidates[0]?.score).toBe(0.35);
    expect(result.segments[0]?.patientId).toBeNull();
    expect(result.confirmationRequired.some((e) => e.kind === "UNLINKED_PATIENT")).toBe(true);
  });
});
