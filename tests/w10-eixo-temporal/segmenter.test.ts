import { describe, expect, it } from "vitest";
import { segmentarTranscricao } from "../../src/kernel/extracao/segmenter.js";

function segmentos(...textos: string[]) {
  return segmentarTranscricao({ recordingId: "gravacao-homonimos-sinteticos",
    sourceId: "fonte-sintetica", sourceType: "plaud",
    turns: textos.map((text, i) => ({ text, startMs: i * 30_000, endMs: i * 30_000 + 25_000 })) });
}

describe("F01 — homônimo com vocativo e contexto tumoral discordante", () => {
  it.each(["Maria", "Maria Alves de Souza", "João D'Ávila"])(
    "separa %s sem chamada e preserva revisão, fonte e trechos", (nome) => {
      const primeiro = `Bom dia, ${nome}. 54 anos, tumor de mama direita.`;
      const segundo = `Bom dia, ${nome}. Tumor de mama esquerda hoje, vamos revisar o exame.`;
      const result = segmentos(primeiro, "Resultado revisado sem novos dados demográficos.", segundo);
      expect(result).toHaveLength(2);
      expect(result[0]?.rawTranscript).toBe(`${primeiro}\nResultado revisado sem novos dados demográficos.`);
      expect(result[1]?.rawTranscript).toBe(segundo);
      expect(result.map((s) => s.candidateNames)).toEqual([[nome], [nome]]);
      expect(result.every((s) => s.patientId === null && s.boundaryReviewRequired && s.sourceId === "fonte-sintetica")).toBe(true);
      expect(result[1]).toMatchObject({ boundaryConfidence: 0.5, startMs: 60_000, endMs: 85_000 });
    },
  );

  it("mantém consulta quando somente a lateralidade muda sem nova saudação nominal", () => {
    const result = segmentos("Bom dia, Maria. Tumor de mama direita.",
      "Tumor de mama esquerda também foi mencionado no exame anterior.");
    expect(result).toHaveLength(1);
    expect(result[0]?.rawTranscript).toContain("esquerda também");
  });

  it("mantém consulta com saudação nominal repetida e contexto concordante", () => {
    expect(segmentos("Bom dia, Maria. Tumor de mama direita.",
      "Boa tarde, Maria. Tumor de mama direita, vamos revisar o exame.")).toHaveLength(1);
  });

  it("nome citado dentro de narrativa e lateralidade isolada não viram vocativo", () => {
    const result = segmentos("Bom dia, Maria. Tumor de mama direita.",
      "A acompanhante disse bom dia, Maria. Tumor de mama esquerda consta em outro papel.");
    expect(result).toHaveLength(1);
  });

  it("lateralidade de sintoma distante do tumor não cria fronteira", () => {
    expect(segmentos("Bom dia, Maria. Tumor de mama direita.",
      "Bom dia, Maria. Tumor de mama. Refere dor à esquerda no braço.")).toHaveLength(1);
  });

  it("saudação genérica sem vocativo pontuado não cria candidato de nome", () => {
    const result = segmentos("Bom dia vamos revisar o exame. Tumor de mama direita.",
      "Boa tarde vamos revisar o exame. Tumor de mama esquerda.");
    expect(result).toHaveLength(1);
    expect(result[0]?.candidateNames).toEqual([]);
  });
});
