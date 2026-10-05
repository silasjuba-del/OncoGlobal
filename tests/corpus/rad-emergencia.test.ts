// GLM-03 · rad-emergencia: header válido, nada ativo, negações genéricas presentes.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { validarRuleset } from "../../src/kernel/corpus/loader.js";

interface Termo {
  id: string; termo: string; sinonimosPt: string[];
  naturezaAlerta: "AMEACA_IMEDIATA" | "REVISAO_URGENTE"; ativo: boolean; fonte: string;
}
const arquivo = fileURLToPath(new URL("../../corpus/rulesets/rad-emergencia.v1.json", import.meta.url));
const json = JSON.parse(readFileSync(arquivo, "utf8")) as { termos: Termo[]; negacoes: string[] };

describe("rad-emergencia.v1.json", () => {
  it("header passa na validação G-17", () => {
    expect(validarRuleset(json).ok).toBe(true);
  });

  it("catálogo cobre os 22 termos do PLANO BASE §18 / FN-20", () => {
    expect(json.termos.length).toBe(22);
    const ids = json.termos.map((t) => t.id);
    expect(new Set(ids).size).toBe(22);
    for (const esperado of ["compressao-medular", "cauda-equina", "tep", "tamponamento-derrame-pericardico", "enterocolite-neutropenica", "comprometimento-epidural"])
      expect(ids).toContain(esperado);
  });

  it("nenhum termo ativo e todo termo com fonte [VERIFICAR] (nada dispara sem curadoria)", () => {
    for (const t of json.termos) {
      expect(t.ativo).toBe(false);
      expect(t.fonte).toBe("[VERIFICAR]");
      expect(["AMEACA_IMEDIATA", "REVISAO_URGENTE"]).toContain(t.naturezaAlerta);
      expect(Array.isArray(t.sinonimosPt)).toBe(true);
    }
  });

  it("negações genéricas cobrem 'sem TEP' (extrator não dispara com negação)", () => {
    expect(json.negacoes).toContain("sem");
    expect(json.negacoes).toContain("ausência de");
    expect(json.negacoes).toContain("não há");
  });
});
