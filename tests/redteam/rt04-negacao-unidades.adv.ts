// RT-04 · Extração de texto (S1/S2) — FALHAS reais: linguagem de incerteza vira fato firme
// e unidade fora da lista some silenciosamente (deveria ser PENDENTE + confirmação).
// Dono provável: src/kernel/extracao/extrator.ts (Fugu).
import { describe, expect, it } from "vitest";
import { extratorDeterministico } from "../../src/kernel/extracao/extrator.js";
import { LAUDO_INCERTEZA } from "../fixtures/redteam/laudos.js";

const extrair = (rawTranscript: string, sourceType: "imaging_report" | "plaud" = "imaging_report") =>
  extratorDeterministico.extrair({
    id: "seg-rt04-adv:0", recordingId: "grav-rt04-adv", sourceId: "doc-adv", sourceType,
    startMs: null, endMs: null, speakers: [], candidateNames: [],
    rawTranscript, boundaryConfidence: null, boundaryReviewRequired: false, patientId: null,
  });

describe("RT-04 · incerteza vira fato; unidade fora da lista some", () => {
  it("PROVA DE FALHA (S1): 'não se pode excluir' não é negação reconhecida — achado sai como positivo", () => {
    const fatos = extrair("não se pode excluir recidiva: nódulo em L4 medindo 8 mm.");
    const imagem = fatos.find((f) => f.domain === "imaging");
    expect(imagem,
      "'não se pode excluir' não está na lista de negação do extrator: o nódulo entra como " +
      "achado EXPLICIT de confiança 1, sem requiresConfirmation. Especificação RT-04: negação/" +
      "incerteza nunca vira achado positivo sem alerta.")
      .toBeUndefined();
  });

  it("PROVA DE FALHA (S1): 'sugestivo de'/'compatível com'/'provável' não marcam UNCERTAIN nem confirmação", () => {
    const fatos = extrair(LAUDO_INCERTEZA);
    const sugestivo = fatos.find((f) => f.domain === "imaging" &&
      /sugestivo/iu.test(f.rawEvidence));
    expect(sugestivo,
      "'Lesão em L2 medindo 12 mm sugestivo de metástase' vira achado EXPLICIT requiresConfirmation=false; " +
      "a especificação exige incerteza propagada (UNCERTAIN/DERIVED com regra) — nunca fato firme.")
      .toBeUndefined();
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

  it("PROVA DE FALHA (S2): '1.400' (milhar × decimal) em documento nunca é sinalizado como ambíguo", () => {
    const fatos = extrair("PSA: 1.400 ng/mL");
    const lab = fatos.find((f) => f.domain === "lab");
    expect((lab?.value as { value?: string } | undefined)?.value).toBe("1.400");
    // O ponto de milhar brasileiro exige confirmação explícita (1.400 × 1,400 × 1,4):
    const ambiguidadeSinalizada = lab !== undefined &&
      (lab.requiresConfirmation === true || lab.evidence === "UNCERTAIN");
    expect(ambiguidadeSinalizada,
      "PSA '1.400 ng/mL' extraído como valor literal sem sinal de ambiguidade decimal/milhar " +
      "(fora do Plaud nem exige confirmação). RT-04 exige PENDENTE + confirmação.")
      .toBe(true);
  });
});
