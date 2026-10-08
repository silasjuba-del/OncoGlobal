import { describe, expect, it } from "vitest";
import { ClinicalFact } from "../../src/contracts/w10/extracao.js";
import { segmentarTranscricao } from "../../src/kernel/extracao/segmenter.js";
import { executarPipelineExtracao, validarFatosContraContrato } from "../../src/orchestration/pipeline-extracao.js";

const fatoValido = {
  id: "fact-1", segmentId: "segment-1", patientCandidateId: null, domain: "diagnosis", value: "sintético",
  sourceType: "medical_note", evidence: "EXPLICIT", sourceId: "source-1", rawEvidence: "diagnóstico sintético",
  confidence: 1, requiresConfirmation: false,
};

describe("W10 entrega · contrato runtime e fronteira de segmento", () => {
  it("valida fatos antes de normalizar e mantém candidato inválido com diagnóstico, sem lançar", () => {
    const invalido = { ...fatoValido, campoInventado: true };
    let resultado: ReturnType<typeof validarFatosContraContrato> | undefined;

    expect(() => { resultado = validarFatosContraContrato([fatoValido, invalido]); }).not.toThrow();
    expect(resultado?.facts).toEqual([fatoValido]);
    expect(resultado?.rejected).toHaveLength(1);
    expect(resultado?.rejected[0]?.rawFact).toBe(invalido);
    expect(resultado?.rejected[0]?.diagnostics.join(" ")).toMatch(/campoInventado/);
  });

  it("usa a validação no pipeline e preserva a transcrição original do rascunho", () => {
    const rawTranscript = "Adenocarcinoma de colo uterino.";
    const estado = executarPipelineExtracao({
      recordingId: "recording-1", sourceId: "source-1", sourceType: "medical_note", rawTranscript,
    });

    expect(estado.input.rawTranscript).toBe(rawTranscript);
    expect(estado.factContractRejections).toEqual([]);
    expect(estado.facts.every((fact) => ClinicalFact.safeParse(fact).success)).toBe(true);
  });

  it("separa consultas com homônimo e sinais demográficos discordantes após linha sem sinais", () => {
    const segmentos = segmentarTranscricao({
      recordingId: "recording-homonimos", sourceId: "source-plaud", sourceType: "plaud",
      turns: [
        "Chamo Maria. 54 anos, tumor de mama.",
        "Resultado do exame revisado.",
        "Chamo Maria. 62 anos, tumor de pulmão.",
      ].map((text) => ({ text, startMs: null, endMs: null })),
    });

    expect(segmentos).toHaveLength(2);
    expect(segmentos.map((segmento) => segmento.rawTranscript)).toEqual([
      "Chamo Maria. 54 anos, tumor de mama.\nResultado do exame revisado.",
      "Chamo Maria. 62 anos, tumor de pulmão.",
    ]);
    expect(segmentos.every((segmento) => segmento.boundaryReviewRequired && segmento.patientId === null)).toBe(true);
  });

  it("não trata 'Tumor sem identidade' como sítio; neoplasia mamária não abre outro paciente", () => {
    const segmentos = segmentarTranscricao({
      recordingId: "recording-model-context", sourceId: "source-plaud", sourceType: "plaud",
      turns: [
        "Chamo Maria. 50 anos.",
        "Tumor sem identidade. Orientações gerais para preencher o modelo.",
        "Neoplasia mamária.",
      ].map((text) => ({ text, startMs: null, endMs: null })),
    });

    expect(segmentos).toHaveLength(1);
    expect(segmentos[0]?.rawTranscript).toContain("Neoplasia mamária.");
    expect(segmentos[0]?.patientId).toBeNull();
  });

  it("continua separando mesmo nome com idade discordante após linha sem sinais", () => {
    const segmentos = segmentarTranscricao({
      recordingId: "recording-age-shift", sourceId: "source-plaud", sourceType: "plaud",
      turns: [
        "Chamo Maria. 50 anos, tumor de mama.",
        "Resultado do exame revisado.",
        "Chamo Maria. 70 anos, tumor de mama.",
      ].map((text) => ({ text, startMs: null, endMs: null })),
    });

    expect(segmentos).toHaveLength(2);
    expect(segmentos.every((segmento) => segmento.boundaryReviewRequired && segmento.patientId === null)).toBe(true);
  });

  it("mantém um segmento quando sinais demográficos permanecem concordantes apesar de linha intermediária", () => {
    const segmentos = segmentarTranscricao({
      recordingId: "recording-continuity", sourceId: "source-plaud", sourceType: "plaud",
      turns: [
        "Chamo Maria. 54 anos, tumor de mama.",
        "Resultado do exame revisado.",
        "Chamo Maria. 54 anos, tumor de mama.",
      ].map((text) => ({ text, startMs: null, endMs: null })),
    });

    expect(segmentos).toHaveLength(1);
    expect(segmentos[0]?.patientId).toBeNull();
  });
});
