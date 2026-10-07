import { describe, expect, it } from "vitest";
import { segmentarTranscricao } from "../../../src/kernel/extracao/segmenter.js";
import { executarPipelineExtracao } from "../../../src/orchestration/pipeline-extracao.js";

const base = { recordingId: "gravacao-teste", sourceId: "fonte-teste", sourceType: "plaud" as const };
const t = (text: string, startMs: number, endMs: number) => ({ text, startMs, endMs });

describe("FUGU-03 · segmentação conservadora", () => {
  it("separa maratona de três Pacientes Teste sem vincular prontuário", () => {
    const segments = segmentarTranscricao({
      ...base,
      turns: [
        t("Bom dia, chamo Paciente Teste 07.", 0, 2000),
        t("Tumor de mama. Exame apresentado.", 2001, 9000),
        t("Boa tarde, chamo Paciente Teste 08.", 10000, 12000),
        t("Tumor de pulmão.", 12001, 16000),
        t("Boa noite, chamo Paciente Teste 09.", 21000, 23000),
        t("Paciente relata sintoma.", 23001, 26000),
      ],
    });
    expect(segments).toHaveLength(3);
    expect(segments.map((s) => s.candidateNames[0]))
      .toEqual(["Paciente Teste 07", "Paciente Teste 08", "Paciente Teste 09"]);
    expect(segments.map((s) => s.patientId)).toEqual([null, null, null]);
    expect(segments[1]?.boundaryConfidence).toBe(0.95);
    expect(segments[2]?.startMs).toBe(21000);
  });

  it("chamada isolada é fronteira incerta; separa e exige revisão", () => {
    const segments = segmentarTranscricao({
      ...base, turns: [
        t("Chamo Paciente Teste 07.", 0, 1000),
        t("Chamo Paciente Teste 08.", 2000, 3000),
      ],
    });
    expect(segments).toHaveLength(2);
    expect(segments[1]).toMatchObject({ boundaryConfidence: 0.5, boundaryReviewRequired: true });
    const state = executarPipelineExtracao({ ...base, rawTranscript:
      "Chamo Paciente Teste 07.\nChamo Paciente Teste 08." });
    expect(state.segments).toHaveLength(2);
    expect(state.confirmationRequired.filter((e) => e.kind === "REVISAR_FRONTEIRA")).toHaveLength(2);
  });

  it("silêncio longo com nova saudação separa sem presumir a identidade", () => {
    const segments = segmentarTranscricao({
      ...base, turns: [
        t("Exame de controle.", 0, 1000),
        t("Bom dia, próxima paciente.", 120000, 121000),
      ],
    });
    expect(segments).toHaveLength(2);
    expect(segments[1]?.patientId).toBeNull();
  });

  it("mudança de acompanhante com saudação separa mas exige revisão da fronteira", () => {
    const segments = segmentarTranscricao({
      ...base, turns: [
        t("Acompanhante: Ana", 0, 1000),
        t("Bom dia. Acompanhante: Bia", 3000, 4000),
      ],
    });
    expect(segments).toHaveLength(2);
    expect(segments[1]?.boundaryReviewRequired).toBe(true);
  });
});
