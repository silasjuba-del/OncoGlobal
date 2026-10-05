// GLM-04 · canal-redflags (FN-21): estrutura válida, nada ativo, nenhum texto de resposta inventado.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { validarRuleset } from "../../src/kernel/corpus/loader.js";

interface RedFlag {
  id: string; termo: string; sinonimosPt: string[];
  respostaFixaTemplateId: string | null; ativo: boolean; fonte: string;
}
const arquivo = fileURLToPath(new URL("../../corpus/rulesets/canal-redflags.v1.json", import.meta.url));
const json = JSON.parse(readFileSync(arquivo, "utf8")) as { redflags: RedFlag[] };

describe("canal-redflags.v1.json", () => {
  it("header passa na validação G-17", () => {
    expect(validarRuleset(json).ok).toBe(true);
  });

  it("os 6 candidatos do plano estão presentes", () => {
    expect(json.redflags.map((r) => r.id).sort()).toEqual(
      ["confusao", "dispneia", "dor-toracica", "febre-em-quimioterapia", "sangramento", "vomito-incoercivel"],
    );
  });

  it("nada ativo, fonte [VERIFICAR] e nenhuma resposta fixa vinculada (decisão é do Dr. Silas)", () => {
    for (const r of json.redflags) {
      expect(r.ativo).toBe(false);
      expect(r.fonte).toBe("[VERIFICAR]");
      expect(r.respostaFixaTemplateId).toBeNull();
      expect(Array.isArray(r.sinonimosPt)).toBe(true);
    }
  });
});
