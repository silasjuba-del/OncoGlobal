import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { executarPipelineExtracao } from "../../src/orchestration/pipeline-extracao.js";

const modelo10 = readFileSync(
  new URL("../../docs/referencias/modelos/10-seguimento-radiologico.md", import.meta.url), "utf8");

describe("FUGU-12 · ponta a ponta com o Modelo 10 (PT10 sintético)", () => {
  const entrada = {
    recordingId: "pt10", sourceId: "fonte-pt10", sourceType: "imaging_report" as const,
    rawTranscript: modelo10,
  };

  it("extrai, reconcilia e leva só as exceções esperadas para a caixa de revisão", () => {
    const r = executarPipelineExtracao(entrada);
    expect(r.segments).toHaveLength(1);
    expect(r.rejeitados).toEqual([]);
    expect(r.violacoes).toEqual([]);
    // Nenhum TNM e nenhuma metástase nascem de laudo (D-W9-33 §5)
    expect(r.facts.some((f) => f.domain === "stage" || f.domain === "metastasis")).toBe(false);
    // Lateralidade "à esquerda" em L5 preservada (D-W9-05)
    expect(r.facts.some((f) => f.domain === "imaging"
      && (f.value as { lateralidade?: string }).lateralidade === "ESQUERDO")).toBe(true);
    expect(r.series.some((s) => s.sitio === "L5" && s.lateralidade === "ESQUERDO")).toBe(true);

    const kinds = r.caixaRevisao.itens.map((i) => i.kind);
    expect(kinds).toContain("INTERVAL_PROGRESSION");
    expect(kinds).toContain("REVISAR_FRONTEIRA");
    expect(kinds).toContain("UNLINKED_PATIENT");
    const progressao = r.caixaRevisao.itens.find((i) => i.kind === "INTERVAL_PROGRESSION")!;
    expect(progressao.reason).toContain("L5");
    expect(progressao.reason).toContain("nunca metástase automática");

    // NÃO SEI obrigatório: histologia, TNM (estadiamento) e RE/RP/HER2 da mama
    const faltantes = r.caixaRevisao.itens.filter((i) => i.kind === "MISSING_REQUIRED")
      .map((i) => i.reason);
    for (const campo of ["HISTOLOGIA", "ESTADIAMENTO", "RE", "RP", "HER2"]) {
      expect(faltantes.some((motivo) => motivo.endsWith(campo + " (NÃO SEI — nunca inferido)"))).toBe(true);
    }
    expect(r.caixaRevisao.resumo.texto).toMatch(/^✓ \d+ fatos reconciliados automaticamente · ⚠ \d+ precisam confirmação$/);
    expect(r.timeline).toBeNull();
  });

  it("só projeta a timeline com decisão persistida de ligação ao paciente (D-W9-34a)", () => {
    const semDecisao = executarPipelineExtracao(entrada);
    expect(semDecisao.timelines).toEqual([]);

    const vinculo = semDecisao.caixaRevisao.itens.find((i) => i.kind === "UNLINKED_PATIENT")!;
    const comDecisao = executarPipelineExtracao({
      ...entrada,
      confirmacoes: [{
        exceptionId: vinculo.id, acao: "LIGAR_PACIENTE", medicoId: "medico-teste",
        em: "2026-10-07T09:00:00-03:00", patientId: "P07",
      }],
    });
    const timeline = comDecisao.timeline!;
    expect(timeline.patientId).toBe("P07");
    expect(timeline.stageHistory).toEqual([]);
    expect(timeline.historicalMetastaticDisease).toBe(false);
    expect(timeline.missingRequiredData).toEqual(
      expect.arrayContaining(["ESTADIAMENTO", "HISTOLOGIA", "RE", "RP", "HER2"]),
    );
    expect(timeline.unresolvedConflicts).toEqual(expect.arrayContaining([expect.any(String)]));
    expect(comDecisao.timelines).toHaveLength(1);
  });

  it("é determinístico: a mesma entrada produz a mesma saída", () => {
    expect(executarPipelineExtracao(entrada)).toEqual(executarPipelineExtracao(entrada));
  });
});

describe("FUGU-12 · maratona de 3 pacientes com número falado", () => {
  it("separa três pacientes, não vincula ninguém e exige confirmação do número falado", () => {
    const r = executarPipelineExtracao({
      recordingId: "maratona", sourceId: "fonte-maratona", sourceType: "plaud",
      rawTranscript: [
        "Bom dia, chamo Paciente Teste 07.",
        "Tumor de mama. Creatinina quatorze.",
        "Boa tarde, chamo Paciente Teste 08.",
        "Tumor de pulmão.",
        "Boa noite, chamo Paciente Teste 09.",
        "Creatinina quatorze.",
      ].join("\n"),
    });
    expect(r.segments).toHaveLength(3);
    expect(r.segments.map((s) => s.candidateNames[0]))
      .toEqual(["Paciente Teste 07", "Paciente Teste 08", "Paciente Teste 09"]);
    expect(r.segments.every((s) => s.patientId === null)).toBe(true);
    expect(r.patientCandidates).toEqual([]);
    expect(r.timeline).toBeNull();

    const falados = r.facts.filter((f) => f.domain === "lab" && f.requiresConfirmation);
    expect(falados).toHaveLength(2);
    expect(falados.every((f) => f.confidence < 0.7 && f.sourceType === "plaud")).toBe(true);
    expect(falados.every((f) => (f.value as { value: null }).value === null)).toBe(true);
    expect(r.exceptions.filter((e) => e.kind === "SPOKEN_NUMBER")).toHaveLength(2);
    expect(r.confirmationRequired.some((e) => e.kind === "UNLINKED_PATIENT")).toBe(true);
  });
});