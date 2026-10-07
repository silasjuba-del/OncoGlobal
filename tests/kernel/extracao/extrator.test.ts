import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { extratorDeterministico } from "../../../src/kernel/extracao/extrator.js";
import { segmentarTranscricao } from "../../../src/kernel/extracao/segmenter.js";
import { executarPipelineExtracao } from "../../../src/orchestration/pipeline-extracao.js";
import type { FactSourceType } from "../../../src/kernel/extracao/tipos.js";

function segment(text: string, sourceType: FactSourceType, page?: number) {
  return segmentarTranscricao({
    recordingId: "doc-teste", sourceId: "fonte-teste", sourceType,
    ...(page === undefined ? {} : { page }),
    turns: [{ text, startMs: null, endMs: null }],
  })[0]!;
}

describe("FUGU-05 · extrator determinístico, proposta literal", () => {
  it("TNM literal, IHQ e laboratório preservam trecho/página; sem TNM inferido de dimensão", () => {
    const facts = extratorDeterministico.extrair(segment(
      "cT2N0M0 documentado\nIHQ: HER2 2+; RE 90%; RP 80%; Ki-67 30%\nHb: 11,2 g/dL\nLinfonodo 24 mm.",
      "pathology", 2,
    ));
    expect(facts.find((f) => f.domain === "stage")?.value).toBe("cT2N0M0");
    expect(facts.filter((f) => f.domain === "biomarker")).toHaveLength(4);
    expect(facts.find((f) => f.domain === "lab")?.value).toMatchObject({ marker: "Hb", unit: "g/dL" });
    expect(facts.every((f) => f.sourceId === "fonte-teste" && f.page === 2 && !!f.rawEvidence))
      .toBe(true);
    expect(facts.filter((f) => f.domain === "stage")).toHaveLength(1);
  });

  it("PD-L1 sem anticorpo é incerto; negado não vira achado positivo", () => {
    const facts = extratorDeterministico.extrair(segment(
      "PD-L1 TPS 30%\nNão há lesão em L5 medindo 24 mm.\nPD-L1 TPS 20%, anticorpo 22C3",
      "pathology",
    ));
    expect(facts.filter((f) => f.domain === "imaging")).toHaveLength(0);
    const biomarkers = facts.filter((f) => f.domain === "biomarker");
    expect(biomarkers[0]).toMatchObject({ evidence: "UNCERTAIN", requiresConfirmation: true });
    expect(biomarkers[1]).toMatchObject({ evidence: "EXPLICIT", requiresConfirmation: false });
  });

  it("Plaud 'creatinina quatorze' não vira 14 nem 1,4 e pede confirmação", () => {
    const facts = extratorDeterministico.extrair(segment("Creatinina quatorze.", "plaud"));
    expect(facts).toHaveLength(1);
    expect(facts[0]).toMatchObject({
      domain: "lab", evidence: "UNCERTAIN", confidence: 0.6,
      requiresConfirmation: true, value: { value: null },
    });
  });

  it("fixtures PT07 e PT08 não inferem TNM ou M1 de laudo", () => {
    const pt07 = readFileSync(new URL("../../fixtures/caso07/06-rm-prostata.txt", import.meta.url), "utf8");
    const pt08 = readFileSync(new URL("../../../docs/referencias/modelos/laudos-sinteticos/PT08-tc-abdome-pelve.txt", import.meta.url), "utf8");
    for (const rawTranscript of [pt07, pt08]) {
      const result = executarPipelineExtracao({
        recordingId: "fixture", sourceId: "fonte-sintetica", sourceType: "imaging_report", rawTranscript,
      });
      expect(result.facts.some((f) => f.domain === "stage" || f.domain === "metastasis")).toBe(false);
      expect(result.segments.every((s) => s.patientId === null)).toBe(true);
    }
  });

  it("prescrição transcrita propõe fármaco/ciclo, não dose calculada nem ordem assinada", () => {
    const facts = extratorDeterministico.extrair(segment(
      "Ciclo 4: carboplatina.\nProtocolo: teste sintético.", "prescription"));
    expect(facts.map((f) => f.domain)).toEqual(["drug", "cycle", "regimen"]);
    expect(facts.every((f) => f.evidence === "EXPLICIT")).toBe(true);
  });

  it("texto do PT10 só propõe foco L5 como imagem, nunca M1 ou estádio", () => {
    const model = readFileSync(new URL("../../../docs/referencias/modelos/10-seguimento-radiologico.md", import.meta.url), "utf8");
    const facts = extratorDeterministico.extrair(segment(model, "imaging_report"));
    expect(facts.some((f) => f.domain === "imaging" && (f.value as { siteRaw?: string }).siteRaw === "L5"))
      .toBe(true);
    expect(facts.some((f) => f.domain === "metastasis" || f.domain === "stage")).toBe(false);
  });

  it("PT09: TNM sem prefixo não ganha c/p; apenas cT cN cM literal é proposto", () => {
    const model = readFileSync(new URL("../../../docs/referencias/modelos/03-resumo-alta-radioterapia.md", import.meta.url), "utf8");
    const facts = extratorDeterministico.extrair(segment(model, "medical_note"));
    const stages = facts.filter((f) => f.domain === "stage");
    expect(stages.map((f) => f.value)).toContain("cT3a cN0 cM0");
    expect(stages.map((f) => f.value)).not.toContain("T3a N0 M0");
  });
});
