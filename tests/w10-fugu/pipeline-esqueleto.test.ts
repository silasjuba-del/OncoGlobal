import { describe, expect, it } from "vitest";
import { mapearProveniencia, type ClinicalFact } from "../../src/kernel/extracao/tipos.js";
import { executarPipelineExtracao } from "../../src/orchestration/pipeline-extracao.js";

describe("FUGU-01 — pipeline puro", () => {
  const input = {
    recordingId: "gravacao-sintetica-01",
    sourceId: "fonte-sintetica-01",
    sourceType: "plaud" as const,
    rawTranscript: "",
  };

  it("roda as nove etapas com entrada mínima vazia sem inventar fatos ou paciente", () => {
    const result = executarPipelineExtracao(input);
    expect(result).toMatchObject({
      segments: [], patientCandidates: [], facts: [], fields: {},
      exceptions: [], timeline: null, confirmationRequired: [],
    });
    expect(executarPipelineExtracao(input)).toEqual(result);
    expect(input.rawTranscript).toBe("");
  });

  it("texto sintético não é ligado sozinho nem confirmado automaticamente", () => {
    const result = executarPipelineExtracao({
      ...input, rawTranscript: "Paciente Teste 07: consulta a revisar.",
    });
    expect(result.segments).toHaveLength(1);
    expect(result.segments[0]).toMatchObject({
      sourceId: input.sourceId, patientId: null, boundaryConfidence: null,
    });
    expect(result.facts).toEqual([]);
    expect(result.timeline).toBeNull();
    expect(result.confirmationRequired.map((e) => e.kind))
      .toEqual(["REVISAR_FRONTEIRA", "UNLINKED_PATIENT"]);
  });

  it("rejeita identificadores vazios em vez de criar fonte anônima", () => {
    expect(() => executarPipelineExtracao({ ...input, sourceId: "" }))
      .toThrow("sourceId");
  });
});

describe("FUGU-01 — mapa de proveniência", () => {
  const explicit: ClinicalFact = {
    id: "fato-sintetico-01", segmentId: "s1", patientCandidateId: null,
    domain: "symptom", value: "relato literal", sourceType: "medical_note",
    evidence: "EXPLICIT", sourceId: "fonte-sintetica-01",
    rawEvidence: "Paciente Teste 07 relata sintoma.", page: 1,
    confidence: 1, requiresConfirmation: false,
  };

  it("distingue ausente, literal, incerto e inferência nomeada", () => {
    expect(mapearProveniencia(null)).toEqual({ provenance: "NOT_FOUND" });
    expect(mapearProveniencia(explicit)).toEqual({ provenance: "EXTRACTED" });
    expect(mapearProveniencia({ ...explicit, evidence: "UNCERTAIN" }))
      .toEqual({ provenance: "UNCERTAIN" });
    expect(mapearProveniencia({ ...explicit, evidence: "DERIVED", regra: "REGRA-TESTE" }))
      .toEqual({ provenance: "INFERRED", regra: "REGRA-TESTE" });
    expect(mapearProveniencia({ ...explicit, evidence: "INFERRED", regra: "REGRA-TESTE" }))
      .toEqual({ provenance: "INFERRED", regra: "REGRA-TESTE" });
  });

  it("não promove inferência sem regra ou confirmação vazia", () => {
    expect(() => mapearProveniencia({ ...explicit, evidence: "INFERRED" }))
      .toThrow("regra nomeada");
    const confirmacao = {
      exceptionId: "exc:UNLINKED_PATIENT:gravacao-sintetica-01:0",
      acao: "CONFIRMAR" as const, medicoId: "medico-teste", em: "2026-10-07T09:00:00-03:00",
    };
    expect(() => mapearProveniencia(explicit, {
      acao: { ...confirmacao, medicoId: "" }, decisionEventId: "e1",
    }))
      .toThrow("Confirmação médica");
    expect(() => mapearProveniencia(explicit, {
      acao: { ...confirmacao, acao: "DESCARTAR", motivo: "duplicado" }, decisionEventId: "e1",
    }))
      .toThrow("CONFIRMAR");
    expect(mapearProveniencia(explicit, { acao: confirmacao, decisionEventId: "e1" }))
      .toEqual({ provenance: "DOCUMENT_CONFIRMED" });
  });
});
