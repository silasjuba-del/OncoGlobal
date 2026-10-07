// W8/GLM-16 · ruleset patologia-agregacao: estrutura da agregação "grau do caso"; todo critério [VERIFICAR], nada ativo (P2).
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { validarRuleset } from "../../src/kernel/corpus/loader.js";

interface Agregacao { id: string; nome: string; criterio: string; ativo: boolean; fonte: string }
const json = JSON.parse(readFileSync(fileURLToPath(new URL("../../corpus/rulesets/patologia-agregacao.v1.json", import.meta.url)), "utf8")) as {
  principio: string;
  agregacoes: Agregacao[];
  proibicoes: string[];
};

function* objetos(valor: unknown): Generator<Record<string, unknown>> {
  if (Array.isArray(valor)) { for (const v of valor) yield* objetos(v); return; }
  if (typeof valor === "object" && valor !== null) {
    yield valor as Record<string, unknown>;
    for (const v of Object.values(valor)) yield* objetos(v);
  }
}

describe("patologia-agregacao.v1.json (W8/GLM-16)", () => {
  it("header válido (G-17) e id correto", () => {
    const r = validarRuleset(json);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.header.id).toBe("patologia-agregacao");
  });

  it("três agregações do caso real 01: maior grupo, cribriforme em qualquer sítio, % de fragmentos (P2)", () => {
    const ids = json.agregacoes.map((a) => a.id);
    expect(ids).toContain("grau-do-caso-maior-grupo");
    expect(ids).toContain("cribriforme-qualquer-sitio");
    expect(ids).toContain("percentual-fragmentos-comprometidos");
  });

  it("todo critério e fonte são [VERIFICAR]; nenhum item ativo", () => {
    for (const a of json.agregacoes) {
      expect(a.criterio, a.id).toBe("[VERIFICAR]");
      expect(a.fonte, a.id).toBe("[VERIFICAR]");
    }
    for (const o of objetos(json)) expect(o.ativo).not.toBe(true);
  });

  it("proibições: LLM nunca agrega; espécimes separados; negação por sítio preservada", () => {
    const texto = json.proibicoes.join(" | ");
    expect(texto).toContain("LLM nunca agrega o caso");
    expect(texto).toContain("nunca fundidos");
    expect(texto).toContain("negação por sítio é preservada");
    expect(json.principio).toContain("função pura");
  });
});
