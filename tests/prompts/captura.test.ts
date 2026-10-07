// W8/GLM-14 · CAPTURA@1.0.0: confiança e legibilidade por campo; QR nunca seguido; trecho riscado sem valor (caso real 01, C1/C2/R1).
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const prompt = readFileSync(fileURLToPath(new URL("../../corpus/prompts/CAPTURA@1.0.0.md", import.meta.url)), "utf8");

describe("CAPTURA@1.0.0 (W8/GLM-14)", () => {
  it("cada campo carrega confianca entre 0 e 1, legivel e artifacts[]", () => {
    expect(prompt).toContain("qualidadePorCampo[] { campo, confianca, legivel, artifacts[] }");
    expect(prompt).toContain("número entre 0 e 1");
    expect(prompt).toContain("dígito a dígito");
  });

  it("sombra, inclinação, dobra e carimbo sobre texto rebaixam a confiança (C1)", () => {
    for (const artefato of ["sombra", "inclinacao", "dobra", "carimbo"])
      expect(prompt).toContain(artefato);
    expect(prompt).toContain("sobre o texto");
    expect(prompt).toContain("baixa confiança");
  });

  it("QR code nunca é seguido; é link externo, não conteúdo (C2)", () => {
    expect(prompt).toContain("QR code nunca é seguido");
    expect(prompt).toContain("link externo");
    expect(prompt).toContain("não decodifica, não sugere seguir");
  });

  it("trecho riscado à mão: marcado, sem valor, revisão do médico (R1)", () => {
    expect(prompt).toContain("riscado_a_mao");
    expect(prompt).toContain("`riscado: true`");
    expect(prompt).toContain("sem valor");
    expect(prompt).toContain("nunca extrair valor de trecho riscado como fato");
  });

  it("semáforo é do código/médico; universal BASE §47 presente", () => {
    expect(prompt).toContain("nunca estado de semáforo");
    for (const frase of ["não inventar", "null quando ausente", "desidentificada", "Saída só JSON"])
      expect(prompt).toContain(frase);
  });
});
