// RT-04 · Extração de texto: negação, incerteza, unidades (S1) — provas de DEFESA.
// Negação nunca vira achado positivo; número falado (Plaud) exige confirmação e nunca
// vira número calculado; decimal com vírgula fica como texto cru (nada recalcula em silêncio).
import { describe, expect, it } from "vitest";
import { extratorDeterministico } from "../../src/kernel/extracao/extrator.js";
import { ClinicalFact as ClinicalFactSchema } from "../../src/contracts/w10/extracao.js";
import { LABS_UNIDADES, LAUDO_NEGACAO } from "../fixtures/redteam/laudos.js";

const extrair = (rawTranscript: string, sourceType: "imaging_report" | "plaud" | "pathology" = "imaging_report") =>
  extratorDeterministico.extrair({
    id: "seg-rt04:0", recordingId: "grav-rt04", sourceId: "doc-rt04", sourceType,
    startMs: null, endMs: null, speakers: [], candidateNames: [],
    rawTranscript, boundaryConfidence: null, boundaryReviewRequired: false, patientId: null,
  });

describe("RT-04 · negação não vira achado positivo", () => {
  it.each([
    ["Não há sinais de metástase pulmonar."],
    ["Sem evidência de lesões expansivas."],
    ["nega dor torácica."],
    ["Não observamos coleções."],
    ["não há líquido livre."],
  ])("'%s' não produz nenhum fato", (linha) => {
    expect(extrair(linha)).toEqual([]);
  });

  it("laudo de negação completa: zero fatos (mesmo com 'metástase' no texto)", () => {
    expect(extrair(LAUDO_NEGACAO)).toEqual([]);
  });

  it("NÃO SEI suprime diagnóstico/estádio/biomarcador", () => {
    expect(extrair("diagnóstico: NÃO SEI o primário", "pathology")).toEqual([]);
    expect(extrair("cT2N0M0 — NÃO SEI data", "imaging_report")).toEqual([]);
  });
});

describe("RT-04 · número falado (Plaud) e decimais", () => {
  it("'creatinina quatorze' vira UNCERTAIN com valor nulo (nunca 14, nunca 1,4)", () => {
    const fatos = extrair("creatinina quatorze", "plaud");
    const lab = fatos.find((f) => f.domain === "lab");
    expect(lab?.evidence).toBe("UNCERTAIN");
    expect(lab?.value).toEqual({ raw: "creatinina quatorze", value: null, unit: null });
    expect(lab?.requiresConfirmation).toBe(true);
  });

  it("qualquer número falado em Plaud exige confirmação e reduz a confiança", () => {
    const fatos = extrair("Hb 9,8 g/dL hoje", "plaud");
    const lab = fatos.find((f) => f.domain === "lab");
    expect(lab?.requiresConfirmation).toBe(true);
    expect(lab?.confidence).toBeLessThan(0.7);
  });

  it("contrato Zod: fato plaud de lab/ciclo SEM requiresConfirmation é rejeitado", () => {
    const parse = () => ClinicalFactSchema.parse({
      id: "f1", segmentId: "s1", patientCandidateId: null, domain: "lab",
      value: { marker: "Hb", value: "9,8", unit: "g/dL" }, sourceType: "plaud",
      evidence: "EXPLICIT", sourceId: "doc", rawEvidence: "Hb 9,8 g/dL",
      confidence: 1, requiresConfirmation: false,
    });
    expect(parse).toThrow(/número falado \(Plaud\) exige confirmação/iu);
  });

  it("'1,4' fica como texto cru com unidade — nada converte nem arredonda em silêncio", () => {
    const fatos = extrair(LABS_UNIDADES);
    const creatinina = fatos.find((f) => f.domain === "lab" &&
      (f.value as { marker?: string }).marker?.toLowerCase() === "creatinina");
    expect((creatinina?.value as { value?: string }).value).toBe("1,4");
    expect((creatinina?.value as { unit?: string }).unit).toBe("mg/dL");
  });
});
