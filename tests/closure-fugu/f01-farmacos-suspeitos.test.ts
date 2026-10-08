import { describe, expect, it } from "vitest";
import { normalizarFarmaco } from "../../src/kernel/extracao/normalizacao.js";
import { extratorDeterministico } from "../../src/kernel/extracao/extrator.js";
import { executarPipelineExtracao } from "../../src/orchestration/pipeline-extracao.js";
import type { EncounterSegment } from "../../src/kernel/extracao/tipos.js";

const trecho = (rawTranscript: string): EncounterSegment => ({
  id: "grav-f01:0", recordingId: "grav-f01", sourceId: "prescricao-sintetica",
  sourceType: "prescription", page: 2, startMs: null, endMs: null, speakers: [],
  candidateNames: [], rawTranscript, boundaryConfidence: null,
  boundaryReviewRequired: true, patientId: null,
});

describe("F01 · fármaco visualmente suspeito mantém fonte e pede confirmação", () => {
  it("homóglifo e caractere invisível só produzem candidato, não EXPLICIT", () => {
    expect(normalizarFarmaco("cisplatina")).toMatchObject({
      normalizado: "CISPLATINA", incerto: false, confidence: 1,
    });
    for (const literal of ["сisplatina", "cis\u200bplatina", "CIS\u2060PLATINA"]) {
      expect(normalizarFarmaco(literal)).toMatchObject({
        raw: literal, normalizado: "CISPLATINA", incerto: true,
        confidence: 0.5, suspeito: true,
      });
    }
    // Uma palavra desconhecida com formatador não vira fármaco por distância.
    expect(normalizarFarmaco("ou\u200btro").normalizado).toBeNull();
  });

  it.each(["сisplatina 75 mg/m² D1", "cis\u200bplatina AUC 5"])(
    "extrator e pipeline conservam o literal, página e exceção: %s", (linha) => {
      const fatosBrutos = extratorDeterministico.extrair(trecho(`protocolo: GC\n${linha}\nciclo 1`));
      const bruto = fatosBrutos.find((f) => f.domain === "drug");
      expect(bruto).toMatchObject({
        value: linha.split(" ")[0], evidence: "UNCERTAIN", requiresConfirmation: true,
        sourceId: "prescricao-sintetica", page: 2, rawEvidence: linha,
      });
      const resultado = executarPipelineExtracao({
        recordingId: "grav-f01", sourceId: "prescricao-sintetica", sourceType: "prescription",
        page: 2, rawTranscript: `protocolo: GC\n${linha}\nciclo 1`,
      });
      const farmaco = resultado.facts.find((f) => f.domain === "drug");
      expect(farmaco).toMatchObject({
        evidence: "UNCERTAIN", requiresConfirmation: true, confidence: 0.5,
        raw: linha.split(" ")[0], value: { normalizado: "CISPLATINA", suspeito: true },
        page: 2, sourceId: "prescricao-sintetica", rawEvidence: linha,
      });
      expect(resultado.exceptions).toContainEqual(expect.objectContaining({
        kind: "UNCERTAIN_DRUG", factIds: [farmaco!.id],
        sourceIds: ["prescricao-sintetica"],
      }));
      expect(resultado.timeline).toBeNull();
    },
  );

  it("outro fármaco limpo na mesma linha não esconde o suspeito", () => {
    const fatos = extratorDeterministico.extrair(trecho("carboplatina + сisplatina D1"));
    expect(fatos.filter((f) => f.domain === "drug").map((f) => [f.value, f.evidence]))
      .toEqual([["carboplatina", "EXPLICIT"], ["сisplatina", "UNCERTAIN"]]);
  });
});
