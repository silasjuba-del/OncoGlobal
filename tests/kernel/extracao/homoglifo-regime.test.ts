import { describe, expect, it } from "vitest";
import type { ClinicalFact } from "../../../src/kernel/extracao/tipos.js";
import { detectarFarmaco, extratorDeterministico } from "../../../src/kernel/extracao/extrator.js";
import { detectarConflitos } from "../../../src/kernel/extracao/reconciliacao.js";

const SIRIL_C = "с";

function segmento(rawTranscript: string, sourceType: "prescription" | "medical_note" = "prescription") {
  return {
    id: "seg-h4", recordingId: "grav-h4", sourceId: "doc-h4", sourceType,
    startMs: null, endMs: null, speakers: [], candidateNames: [],
    rawTranscript, boundaryConfidence: null, boundaryReviewRequired: false, patientId: null,
  };
}

function fato(parcial: Partial<ClinicalFact> & Pick<ClinicalFact, "domain" | "sourceType">): ClinicalFact {
  return {
    id: `f-${parcial.domain}-${parcial.sourceType}`, segmentId: "seg-h4", patientCandidateId: null,
    value: null, sourceId: `src-${parcial.sourceType}`, evidence: "EXPLICIT", rawEvidence: "linha",
    confidence: 1, requiresConfirmation: false, ...parcial,
  } as ClinicalFact;
}

describe("H4 · detector de fármaco com grafia suspeita", () => {
  it("homóglifo cirílico é sinalizado, preserva o raw e só sugere o canônico", () => {
    const d = detectarFarmaco(`${SIRIL_C}isplatina`);
    expect(d?.incerto).toBe(true);
    expect(d?.raw).toBe(`${SIRIL_C}isplatina`);
    expect(d?.sugestao).toBe("CISPLATINA");
    expect(d?.motivo).toContain("alfabetos misturados");
  });

  it("zero-width é removido na normalização mas sinalizado como incerto", () => {
    const d = detectarFarmaco("cis​platina");
    expect(d?.normalized).toBe("cisplatina");
    expect(d?.incerto).toBe(true);
    expect(d?.motivo).toContain("largura zero");
  });

  it("texto latino comum e não-fármaco não geram alerta", () => {
    expect(detectarFarmaco("cisplatina")).toBeNull();
    expect(detectarFarmaco("mesa")).toBeNull();
  });
});

describe("H4 · extrator emite fármaco UNCERTAIN para grafia anômala em prescrição", () => {
  it("homóglifo na prescrição vira drug UNCERTAIN com confirmação e raw preservado", () => {
    const fatos = extratorDeterministico.extrair(segmento(`protocolo: GC\r\n${SIRIL_C}isplatina 75 mg/m² D1\r\nciclo 1`));
    const droga = fatos.find((f) => f.domain === "drug");
    expect(droga?.evidence).toBe("UNCERTAIN");
    expect(droga?.requiresConfirmation).toBe(true);
    expect(droga?.rawEvidence).toContain(`${SIRIL_C}isplatina`);
    expect((droga?.value as Record<string, unknown>).normalizado).toBe("CISPLATINA");
  });

  it("prescrição com grafia latina comum continua sem alerta", () => {
    const fatos = extratorDeterministico.extrair(segmento("cisplatina 75 mg/m² D1"));
    const droga = fatos.find((f) => f.domain === "drug");
    expect(droga?.evidence).toBe("EXPLICIT");
    expect(droga?.requiresConfirmation).toBe(false);
  });
});

describe("H4 · regime planejado × prescrito gera CONFLICT com as duas versões", () => {
  it("plano com fármaco diferente do prescrito vira conflito que preserva ambos", () => {
    const plano = fato({ domain: "plan", sourceType: "medical_note", value: "plano: seguir cisplatina" });
    const prescricao = fato({ id: "f-rx", domain: "drug", sourceType: "prescription", value: "carboplatina" });
    const conflito = detectarConflitos([plano, prescricao]).find((c) => /planned_regimen/.test(c.reason));
    expect(conflito?.kind).toBe("CONFLICT");
    expect(conflito?.reason).toContain("CISPLATINA");
    expect(conflito?.reason).toContain("CARBOPLATINA");
    expect(conflito?.factIds).toEqual([plano.id, prescricao.id]);
  });

  it("planejado igual ao prescrito não gera conflito de regime", () => {
    const plano = fato({ domain: "plan", sourceType: "medical_note", value: "plano: seguir carboplatina" });
    const prescricao = fato({ domain: "drug", sourceType: "prescription", value: "carboplatina" });
    expect(detectarConflitos([plano, prescricao]).some((c) => /planned_regimen/.test(c.reason))).toBe(false);
  });
});
