import { describe, expect, it } from "vitest";
import { ClinicalFact } from "../../src/contracts/w10/extracao.js";
import { prepararRevisaoExtracao } from "../../src/kernel/extracao/prepararRevisao.js";

// proveniência: dados sintéticos; contrato de proposta documental, sem validação clínica.
const legado = {
  id: "fact-synthetic", segmentId: "segment-synthetic", patientCandidateId: null,
  domain: "imaging", value: { siteRaw: "L5", measureRaw: "12 mm" }, sourceType: "imaging_report",
  evidence: "EXPLICIT", sourceId: "source-synthetic", rawEvidence: "Lesão em L5 medindo 12 mm.",
  confidence: 1, requiresConfirmation: false,
};

describe("qualificadores documentais de ClinicalFact", () => {
  it("mantém contratos legados sem inventar sujeito ou tempo", () => {
    const parsed = ClinicalFact.parse(legado);
    expect(parsed).not.toHaveProperty("qualificadores");
  });

  it("aceita qualificadores completos e estritos", () => {
    expect(ClinicalFact.safeParse({ ...legado, qualificadores: {
      polaridade: "AFIRMADA", sujeito: "TERCEIRO", temporalidade: "HISTORICA",
    } }).success).toBe(true);
  });

  it.each([
    { polaridade: "POSITIVA", sujeito: "PACIENTE", temporalidade: "ATUAL" },
    { polaridade: "AFIRMADA", sujeito: "PACIENTE", temporalidade: "ATUAL", extra: true },
    { polaridade: "AFIRMADA", sujeito: "PACIENTE" },
  ])("rejeita qualificadores inválidos: %j", (qualificadores) => {
    expect(ClinicalFact.safeParse({ ...legado, qualificadores }).success).toBe(false);
  });

  it("preserva qualificadores na revisão e não cria FATO para terceiro ou passado", () => {
    const fact = ClinicalFact.parse({ ...legado, requiresConfirmation: true, qualificadores: {
      polaridade: "AFIRMADA", sujeito: "TERCEIRO", temporalidade: "HISTORICA",
    } });
    const revisao = prepararRevisaoExtracao({
      draftId: "draft-synthetic", sourceId: "source-synthetic", rawTranscript: fact.rawEvidence,
      sourceType: "imaging_report", facts: [fact], exceptions: [], patientId: "patient-synthetic",
      encounterId: "encounter-synthetic", tumorLotId: null, factIds: [fact.id],
      operationId: "operation-synthetic", medicoId: "doctor-synthetic", em: "2026-10-20T12:00:00Z",
    });
    expect(ClinicalFact.array().parse(revisao.payload.facts)[0]?.qualificadores).toEqual(fact.qualificadores);
    expect(revisao.payload.resumo).toContain("qualificadores: polaridade AFIRMADA, sujeito TERCEIRO, temporalidade HISTORICA");
    expect(revisao.registros[0]?.tipo).toBe("ReviewDecision");
    expect(revisao.registros[0]?.payload).toMatchObject({ qualificadores: fact.qualificadores });
    expect(revisao.registros.some((registro) => registro.tipo === "FATO")).toBe(false);
  });
});
