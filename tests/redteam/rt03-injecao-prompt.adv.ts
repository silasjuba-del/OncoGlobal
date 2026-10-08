// RT-03 · Injeção de prompt e conteúdo hostil (S0/S1) — FALHAS reais.
// 1) Fármaco com homóglifo (С cirílica) some silenciosamente — a especificação exige
//    UNCERTAIN + confirmação (PIPELINE §5.5: medicamento foneticamente incerto guarda
//    raw + normalized + confidence).
// 2) Caractere zero-width no meio do fármaco: mesmo silêncio.
// Dono provável: src/kernel/extracao/extrator.ts (Fugu) — normalização NFKD + fuzz fármaco.
import { describe, expect, it } from "vitest";

interface NormalizadorFarmaco {
  normalizar(valor: string): { normalized: string; incerto: boolean } | null;
}

async function normalizadorFarmaco(): Promise<NormalizadorFarmaco | null> {
  const mod = (await import("../../src/kernel/extracao/extrator.js")) as Record<string, unknown>;
  const fn = mod["normalizarFarmaco"] ?? mod["similaridadeFarmaco"] ?? mod["detectarFarmaco"];
  return typeof fn === "function" ? { normalizar: fn as NormalizadorFarmaco["normalizar"] } : null;
}

const segmento = (rawTranscript: string) => ({
  id: "grav-rt03-adv:0", recordingId: "grav-rt03-adv", sourceId: "doc-adv", sourceType: "prescription" as const,
  startMs: null, endMs: null, speakers: [], candidateNames: [],
  rawTranscript, boundaryConfidence: null, boundaryReviewRequired: false, patientId: null,
});

describe("RT-03 · homóglifo e texto invisível em fármaco", () => {
  it("SEM_IMPLEMENTACAO: detector de fármaco foneticamente incerto/homóglifo existe", async () => {
    const fn = await normalizadorFarmaco();
    expect(fn?.normalizar,
      "extrator.ts casa fármacos por regex literal; 'сisplatina' (С cirílica U+0441) e " +
      "'cis\\u200Bplatina' (zero-width) não casam NEM sinalizam: a prescrição entra sem o fármaco " +
      "e sem exceção. PIPELINE §5.5 exige raw + normalized + INFERRED/UNCERTAIN + confidence. " +
      "Dono provável: src/kernel/extracao/extrator.ts (Fugu).")
      .toBeTypeOf("function");
  });

  it("fármaco com homóglifo vira UNCERTAIN com confirmação obrigatória (nunca silêncio)", async () => {
    const fn = await normalizadorFarmaco();
    if (!fn) return;
    const { extratorDeterministico } = await import("../../src/kernel/extracao/extrator.js");
    const fatos = extratorDeterministico.extrair(segmento("protocolo: GC\r\nсisplatina 75 mg/m² D1\r\nciclo 1"));
    const droga = fatos.find((f) => f.domain === "drug");
    expect(droga?.evidence).toBe("UNCERTAIN");
    expect(droga?.requiresConfirmation).toBe(true);
    expect(droga?.rawEvidence).toContain("сisplatina");
  });

  it("zero-width no meio do fármaco não elimina o fato nem engana a extração", async () => {
    const fn = await normalizadorFarmaco();
    if (!fn) return;
    const { extratorDeterministico } = await import("../../src/kernel/extracao/extrator.js");
    const fatos = extratorDeterministico.extrair(segmento("protocolo: GC\r\ncis\u{200B}platina AUC 5\r\nciclo 1"));
    const droga = fatos.find((f) => f.domain === "drug");
    expect(droga).toBeDefined();
    expect(droga?.requiresConfirmation).toBe(true);
  });
});
