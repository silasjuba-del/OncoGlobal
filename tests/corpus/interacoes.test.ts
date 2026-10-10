// GLM-05 · interacoes (Δ15): nenhuma interação ativa sem fonte com trecho (K-27).
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { validarRuleset } from "../../src/kernel/corpus/loader.js";

interface Interacao {
  drogaA: string; drogaBouClasse: string;
  mecanismo: string | null; severidade: string | null; monitorizacao: string | null; notaManejo: string | null;
  fonte: { tipo: string; referencia: string; trecho: string | null; edicao: string | null };
  fonteVersao: string | null; verificadoEm: string | null; ativo: boolean;
  regraId?: string; motivoInativo?: string;
}
const arquivo = fileURLToPath(new URL("../../corpus/rulesets/interacoes.v1.json", import.meta.url));
const json = JSON.parse(readFileSync(arquivo, "utf8")) as { interacoes: Interacao[] };

/** Invariante do Δ15: interação ativa exige fonte com trecho (não vale [VERIFICAR]). */
export const ativasSemFonteComTrecho = (itens: Interacao[]): Interacao[] =>
  itens.filter((i) => i.ativo && (i.fonte.trecho === null || i.fonte.trecho === "[VERIFICAR]"));

describe("interacoes.v1.json", () => {
  it("header passa na validação G-17", () => {
    expect(validarRuleset(json).ok).toBe(true);
  });

  it("as 4 sementes citadas no plano estão presentes (contrato Δ15 completo por item)", () => {
    const pares = json.interacoes.map((i) => `${i.drogaA}×${i.drogaBouClasse}`);
    expect(pares).toContain("capecitabina×varfarina");
    expect(pares.filter((p) => p.includes("TKI")).length).toBe(2);
    expect(pares).toContain("ribociclibe×antiemético 5-HT3");
    for (const i of json.interacoes.filter((item) => !item.ativo && !item.regraId)) {
      for (const campo of ["mecanismo", "severidade", "monitorizacao", "notaManejo", "fonteVersao", "verificadoEm"] as const)
        expect(i[campo]).toBeNull();
    }
  });

  it("nenhuma interação ativa sem referência, trecho e edição; temporalidade limita novos pares", () => {
    expect(ativasSemFonteComTrecho(json.interacoes)).toEqual([]);
    expect(json.interacoes.filter((i) => i.ativo)).toHaveLength(8);
    for (const item of json.interacoes.filter(i => i.ativo)) {
      expect(item.fonte.referencia).toMatch(/^https:\/\//); expect(item.fonte.edicao).toBeTruthy();
      expect(item.fonteVersao).toBeTruthy(); expect(item.verificadoEm).toBeTruthy();
    }
    for (const item of json.interacoes.filter(i => i.regraId && !i.ativo)) expect(item.motivoInativo).toBeTruthy();
    expect(json.interacoes.filter((i) => !i.ativo && !i.regraId).every((i) => i.fonte.referencia === "[VERIFICAR]")).toBe(true);
  });
});
