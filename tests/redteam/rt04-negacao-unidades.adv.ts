// RT-04 · Extração de texto (S1/S2) — FALHAS reais: linguagem de incerteza vira fato firme
// e unidade fora da lista some silenciosamente (deveria ser PENDENTE + confirmação).
// Dono provável: src/kernel/extracao/extrator.ts (Fugu).
import { describe, expect, it } from "vitest";
import { extratorDeterministico } from "../../src/kernel/extracao/extrator.js";
import { executarPipelineExtracao } from "../../src/orchestration/pipeline-extracao.js";
import { LAUDO_INCERTEZA } from "../fixtures/redteam/laudos.js";

const extrair = (rawTranscript: string, sourceType: "imaging_report" | "plaud" = "imaging_report") =>
  extratorDeterministico.extrair({
    id: "seg-rt04-adv:0", recordingId: "grav-rt04-adv", sourceId: "doc-adv", sourceType,
    startMs: null, endMs: null, speakers: [], candidateNames: [],
    rawTranscript, boundaryConfidence: null, boundaryReviewRequired: false, patientId: null,
  });

describe("RT-04 · regressões de incerteza e unidade", () => {
  it("preserva nódulo com 'não se pode excluir' como candidato incerto, sem resolução", () => {
    const texto = "não se pode excluir recidiva: nódulo em L4 medindo 8 mm.";
    const fatos = extrair(texto);
    const imagem = fatos.find((f) => f.domain === "imaging");
    expect(imagem).toMatchObject({
      evidence: "UNCERTAIN", requiresConfirmation: true,
      rawEvidence: texto,
      value: { siteRaw: "L4", measureRaw: "8", unit: "mm" },
    });
    const pipeline = executarPipelineExtracao({
      recordingId: "rt04-excluir", sourceId: "doc-adv", sourceType: "imaging_report", rawTranscript: texto,
    });
    expect(pipeline.fields["imaging:L4"]).toMatchObject({ resolvedFactId: null, conflict: false });
    expect(pipeline.fields["imaging:L4"]?.candidates).toHaveLength(1);
  });

  it("preserva 'sugestivo de' como candidato incerto, sem resolução no pipeline", () => {
    const fatos = extrair(LAUDO_INCERTEZA);
    const sugestivo = fatos.find((f) => f.domain === "imaging" &&
      /sugestivo/iu.test(f.rawEvidence));
    expect(sugestivo).toMatchObject({
      evidence: "UNCERTAIN", requiresConfirmation: true,
      rawEvidence: "Lesão em L2 medindo 12 mm sugestivo de metástase.",
      value: { siteRaw: "L2", measureRaw: "12", unit: "mm" },
    });
    const pipeline = executarPipelineExtracao({
      recordingId: "rt04-sugestivo", sourceId: "doc-adv", sourceType: "imaging_report",
      rawTranscript: LAUDO_INCERTEZA,
    });
    expect(pipeline.fields["imaging:L2"]).toMatchObject({ resolvedFactId: null, conflict: false });
    expect(pipeline.fields["imaging:L2"]?.candidates).toHaveLength(1);
  });

  it("PROVA DE FALHA (S1): 'compatível com' no rótulo diagnóstico vira fato EXPLICIT firme", () => {
    const fatos = extrair("diagnóstico: nódulo pulmonar compatível com metástase.");
    const diagnostico = fatos.find((f) => f.domain === "diagnosis");
    expect(diagnostico?.evidence).toBe("UNCERTAIN");
    expect(diagnostico?.requiresConfirmation).toBe(true);
  });

  it("PROVA DE FALHA (S2): creatinina em µmol/L some silenciosamente (deveria ser PENDENTE + confirmação)", () => {
    const fatos = extrair("creatinina 88 µmol/L");
    const lab = fatos.find((f) => f.domain === "lab");
    expect(lab,
      "Unidade µmol/L fora da whitelist g/dL|mg/dL|ng/mL|U/mL: o valor desaparece sem exceção nem " +
      "PENDENTE. RT-04: unidade ambígua/trocada = PENDENTE + confirmação, nunca silêncio.")
      .toBeDefined();
  });

  it("preserva literalmente PSA 1.400, sem interpretar como milhar ou decimal", () => {
    const fatos = extrair("PSA: 1.400 ng/mL");
    const lab = fatos.find((f) => f.domain === "lab");
    expect(lab).toMatchObject({
      evidence: "UNCERTAIN", requiresConfirmation: true,
      rawEvidence: "PSA: 1.400 ng/mL",
      value: { value: null, raw: "1.400 ng/mL", unit: "ng/mL" },
    });
  });
});
