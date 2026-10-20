import { describe, expect, it } from "vitest";
import { extratorDeterministico } from "../../../src/kernel/extracao/extrator.js";
import type { EncounterSegment } from "../../../src/kernel/extracao/tipos.js";

// Somente documentos sintéticos; nenhuma decisão ou aprovação clínica.
function extrair(rawTranscript: string) {
  const documento: EncounterSegment = {
    id: "escopo-sintetico", recordingId: "doc-sintetico", sourceId: "fonte-sintetica",
    sourceType: "medical_note", startMs: 1200, endMs: 1500, page: 3,
    speakers: [], candidateNames: [], rawTranscript, boundaryConfidence: null,
    boundaryReviewRequired: false, patientId: null,
  };
  return extratorDeterministico.extrair(documento);
}
function sintomas(texto: string) {
  return extrair(texto).filter(f => f.domain === "symptom");
}

describe("escopo linguístico: controles de contexto e proveniência", () => {
  it.each([
    "Paciente nega dor, náusea e formigamento.",
    "Paciente sem dor, náusea e dormência.",
    "Paciente não tem dor nem náusea.",
    "Paciente nega dor, mas não tem náusea.",
  ])("não afirma itens de lista negada: %s", texto => {
    expect(sintomas(texto)).toEqual([]);
  });

  it.each([
    ["Paciente tinha dor, mas sem náusea.", "HISTORICA"],
    ["Paciente terá dor, mas sem náusea.", "FUTURA"],
    ["Paciente tinha náusea, mas com dor.", "HISTORICA"],
    ["Paciente terá náusea, mas com dor.", "FUTURA"],
  ])("herda somente temporalidade declarada: %s", (texto, temporalidade) => {
    expect(sintomas(texto!).find(f => f.value === "dor")).toMatchObject({
      requiresConfirmation: true, qualificadores: { temporalidade },
    });
  });

  it("não inventa paciente nem tempo atual na coordenação sem sujeito", () => {
    expect(sintomas("Com dor, mas sem náusea.")).toMatchObject([{
      value: "dor", qualificadores: { sujeito: "NAO_DETERMINADO", temporalidade: "NAO_DETERMINADA" },
    }]);
  });

  it.each([
    "Mãe da paciente relata dor, mas não tem náusea.",
    "A mãe relata dor, mas não tem náusea.",
    "A avó relata dor, mas não tem náusea.",
    "Mãe da paciente veio acompanhada pela filha e relata dor.",
  ])("mantém o parente como sujeito: %s", texto => {
    expect(sintomas(texto)).toMatchObject([{
      requiresConfirmation: true, qualificadores: { sujeito: "TERCEIRO" },
    }]);
  });

  it("não transfere a negação da mãe para um sintoma da paciente", () => {
    expect(sintomas("A mãe nega dor, mas a paciente relata dor.")).toMatchObject([{
      value: "dor", evidence: "EXPLICIT",
      qualificadores: { sujeito: "PACIENTE", polaridade: "AFIRMADA" },
    }]);
  });

  it.each([
    "Paciente veio acompanhada da filha e ela relata dor.",
    "Paciente veio acompanhada da filha que relata dor.",
    "Paciente veio acompanhada da filha com dor.",
  ])("acompanhante com vínculo não resolvido permanece incerto: %s", texto => {
    expect(sintomas(texto)).toMatchObject([{
      evidence: "UNCERTAIN", requiresConfirmation: true, rawEvidence: texto,
      qualificadores: { polaridade: "NAO_DETERMINADA" },
    }]);
  });

  it("distingue conflito de queixa de outra queixa sem conflito", () => {
    expect(sintomas("Paciente relata dor e náusea, mas nega dor.")).toMatchObject([
      { value: "dor", evidence: "UNCERTAIN", requiresConfirmation: true },
      { value: "náusea", evidence: "EXPLICIT", requiresConfirmation: false },
    ]);
  });

  it("preserva a incerteza de relato de terceiro nos predicados subordinados coordenados", () => {
    const texto = "Paciente relata que a mãe não tem náusea, mas com dor.";
    expect(sintomas(texto)).toMatchObject([{
      value: "dor", evidence: "UNCERTAIN", requiresConfirmation: true, rawEvidence: texto,
      qualificadores: { sujeito: "TERCEIRO", polaridade: "NAO_DETERMINADA" },
    }]);
  });

  it("preserva metadados e linha integral na queixa retida", () => {
    const texto = "20/10/2026 Paciente veio acompanhada por sua filha e relata dor, mas não tem náusea.";
    expect(sintomas(texto)).toMatchObject([{
      value: "dor", date: "20/10/2026", rawEvidence: texto,
      sourceId: "fonte-sintetica", segmentId: "escopo-sintetico", sourceType: "medical_note",
      page: 3, timestampMs: 1200, evidence: "EXPLICIT",
    }]);
  });

  it("mantém aspas, decimal e abreviação na fonte sem contaminar a próxima sentença", () => {
    const texto = "Paciente relata dor há aprox. dois dias, mas não tem náusea. “Hemoglobina 8.2 g/dL.”";
    const facts = extrair(texto);
    expect(facts.filter(f => f.domain === "symptom")).toMatchObject([{
      value: "dor", evidence: "EXPLICIT", rawEvidence: texto,
    }]);
    expect(facts.find(f => f.domain === "lab")).toMatchObject({
      value: { marker: "Hemoglobina", value: "8.2" }, evidence: "EXPLICIT", rawEvidence: texto,
      qualificadores: { sujeito: "NAO_DETERMINADO", temporalidade: "NAO_DETERMINADA" },
    });
  });
});
