import { describe, expect, it } from "vitest";
import { executarPipelineExtracao } from "../../../src/kernel/extracao/pipeline.js";
import { prepararRevisaoExtracao } from "../../../src/kernel/extracao/prepararRevisao.js";
import { ClinicalFact } from "../../../src/contracts/w10/extracao.js";

describe("Origem de voz independe da classe documental", () => {
  it.each(["LOCAL_DICTATION", "DEEPGRAM_CLOUD"] as const)("%s preserva medical_note e exige revisão de número", captureMethod => {
    const input = { recordingId: "r", sourceId: "s", sourceType: "medical_note" as const,
      rawTranscript: "21/10/2026 Creatinina 1,2 mg/dL.", captureMethod };
    const state = executarPipelineExtracao(input);
    const labs = state.facts.filter(f => f.domain === "lab");
    expect(labs.length).toBeGreaterThan(0);
    for (const fact of labs) {
      expect(fact.sourceType).toBe("medical_note");
      expect(fact.requiresConfirmation).toBe(true);
      expect(fact.confidence).toBeLessThan(0.7);
      expect(state.confirmationRequired.some(e => e.kind === "SPOKEN_NUMBER" && e.factIds.includes(fact.id))).toBe(true);
    }
  });
  it("texto colado não recebe origem de áudio por conter número", () => {
    const state = executarPipelineExtracao({ recordingId: "r", sourceId: "s", sourceType: "medical_note",
      rawTranscript: "21/10/2026 Creatinina 1,2 mg/dL." });
    expect(state.confirmationRequired.filter(e => e.kind === "SPOKEN_NUMBER")).toHaveLength(0);
  });

  it("fontes mistas preservam modalidade por fonte sem contaminar o documento", () => {
    const state = executarPipelineExtracao({ recordingId: "voz", sourceId: "voz", sourceType: "medical_note",
      captureMethod: "LOCAL_DICTATION", rawTranscript: "21/10/2026 Creatinina 1,2 mg/dL.", additionalSources: [{
        recordingId: "doc", sourceId: "doc", sourceType: "lab_feed", rawTranscript: "21/10/2026 Creatinina 1,3 mg/dL.",
      }] });
    const voz = state.facts.find(f => f.sourceId === "voz" && f.domain === "lab")!;
    const doc = state.facts.find(f => f.sourceId === "doc" && f.domain === "lab")!;
    expect(voz.captureMethod).toBe("LOCAL_DICTATION");
    expect(doc.captureMethod).toBeUndefined();
    expect(state.confirmationRequired.filter(e => e.kind === "SPOKEN_NUMBER").flatMap(e => e.factIds)).toContain(voz.id);
    expect(state.confirmationRequired.filter(e => e.kind === "SPOKEN_NUMBER").flatMap(e => e.factIds)).not.toContain(doc.id);
  });

  it("revisão conserva captura e não promove número ditado a FATO", () => {
    const input = { recordingId: "r", sourceId: "s", sourceType: "medical_note" as const,
      rawTranscript: "21/10/2026 Creatinina 1,2 mg/dL.", captureMethod: "DEEPGRAM_CLOUD" as const };
    const state = executarPipelineExtracao(input), lab = state.facts.find(f => f.domain === "lab")!;
    expect(ClinicalFact.safeParse({ ...lab, requiresConfirmation: false }).success).toBe(false);
    const revisao = prepararRevisaoExtracao({ ...input, draftId: "d", patientId: "p", encounterId: "e", tumorLotId: null,
      factIds: [lab.id], facts: state.facts, exceptions: state.confirmationRequired, operationId: "op", medicoId: "m", em: "2026-10-21T12:00:00Z" });
    expect(revisao.registros.some(r => r.tipo === "FATO")).toBe(false);
    expect(revisao.payload.facts[0]?.captureMethod).toBe("DEEPGRAM_CLOUD");
    expect(revisao.registros[0]?.payload).toMatchObject({ captureMethod: "DEEPGRAM_CLOUD", requiresConfirmation: true });
  });

  it("extração legada que perdeu origem de voz exige reprocessamento antes da revisão", () => {
    const input = { recordingId: "r", sourceId: "s", sourceType: "medical_note" as const, rawTranscript: "21/10/2026 Creatinina 1,2 mg/dL." };
    const state = executarPipelineExtracao(input), lab = state.facts.find(f => f.domain === "lab")!;
    expect(() => prepararRevisaoExtracao({ ...input, captureMethod: "LOCAL_DICTATION", draftId: "d", patientId: "p", encounterId: "e", tumorLotId: null,
      factIds: [lab.id], facts: state.facts, exceptions: state.confirmationRequired, operationId: "op", medicoId: "m", em: "2026-10-21T12:00:00Z" }))
      .toThrow("REPROCESSAMENTO_VOZ_NECESSARIO");
  });
});
