// RT-03 · instrução hostil e homóglifos são dados de origem, nunca ordens.
import { describe, expect, it } from "vitest";
import { normalizarFarmaco } from "../../src/kernel/extracao/normalizacao.js";
import { extratorDeterministico } from "../../src/kernel/extracao/extrator.js";
import { executarPipelineExtracao } from "../../src/orchestration/pipeline-extracao.js";
import type { EncounterSegment } from "../../src/kernel/extracao/tipos.js";
import { LAUDO_INJECAO } from "../fixtures/redteam/laudos.js";

const segmento = (rawTranscript: string): EncounterSegment => ({
  id: "grav-rt03-adv:0", recordingId: "grav-rt03-adv", sourceId: "prescricao-rt03-sintetica",
  sourceType: "prescription", page: 2, startMs: null, endMs: null, speakers: [], candidateNames: [],
  rawTranscript, boundaryConfidence: null, boundaryReviewRequired: true, patientId: null,
});

describe("RT-03 · conteúdo hostil e adulteração visual em fármaco", () => {
  it.each(["сisplatina", "cis\u200Bplatina", "CIS\u2060PLATINA"])(
    "normalização conserva o literal suspeito como candidato incerto: %s", (literal) => {
      expect(normalizarFarmaco(literal)).toMatchObject({ raw: literal, normalizado: "CISPLATINA",
        incerto: true, confidence: 0.5, suspeito: true });
    });

  it.each(["сisplatina 75 mg/m² D1", "cis\u200Bplatina AUC 5"])(
    "pipeline mantém fonte e exige revisão para candidato com caracteres suspeitos: %s", (linha) => {
      const texto = `protocolo: GC\n${linha}\nciclo 1`;
      const bruto = extratorDeterministico.extrair(segmento(texto)).find((fact) => fact.domain === "drug");
      expect(bruto).toMatchObject({ value: linha.split(" ")[0], evidence: "UNCERTAIN",
        requiresConfirmation: true, sourceId: "prescricao-rt03-sintetica", page: 2 });

      const resultado = executarPipelineExtracao({ recordingId: "grav-rt03-adv", sourceId: "prescricao-rt03-sintetica",
        sourceType: "prescription", page: 2, rawTranscript: texto });
      const farmaco = resultado.facts.find((fact) => fact.domain === "drug");
      expect(farmaco).toMatchObject({ evidence: "UNCERTAIN", requiresConfirmation: true,
        confidence: 0.5, raw: linha.split(" ")[0], sourceId: "prescricao-rt03-sintetica", page: 2,
        value: { normalizado: "CISPLATINA", suspeito: true } });
      expect(resultado.exceptions).toContainEqual(expect.objectContaining({ kind: "UNCERTAIN_DRUG",
        factIds: [farmaco!.id], sourceIds: ["prescricao-rt03-sintetica"] }));
      expect(resultado.timeline).toBeNull();
    },
  );

  it("instrução dentro do laudo não confirma diagnóstico nem cria paciente ligado", () => {
    const result = executarPipelineExtracao({ recordingId: "grav-rt03-injection", sourceId: "laudo-hostil-sintetico",
      sourceType: "medical_note", rawTranscript: LAUDO_INJECAO,
      registeredPatients: [{ patientId: "Paciente Teste 08", name: "Paciente Teste 08", age: 77, tumor: "pulmao" }] });
    expect(result.segments.every((segment) => segment.patientId === null)).toBe(true);
    expect(result.facts.every((fact) => fact.patientCandidateId === null)).toBe(true);
    expect(result.timeline).toBeNull();
    expect(result.exceptions.some((exception) => exception.kind === "UNLINKED_PATIENT")).toBe(true);
    expect(result.facts.some((fact) => /IGNORE TODAS AS REGRAS|paciente liberado para QT|dose 10x/i.test(
      `${fact.domain}:${JSON.stringify(fact.value)}`))).toBe(false);
  });
});
