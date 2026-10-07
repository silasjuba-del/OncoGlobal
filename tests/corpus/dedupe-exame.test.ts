// W8/GLM-17 · ruleset dedupe-exame: chave por tipo de exame; data impressa/extração nunca entra; concordância ≠ duplicata (D1–D3).
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { validarRuleset } from "../../src/kernel/corpus/loader.js";

interface Chave { id: string; tiposExame: string[]; campos: string[]; nuncaUsar: string[]; casoReal: string; fonte: { tipo: string }; ativo: boolean }
interface Regra { id: string; regra: string; casoReal: string; fonte: { tipo: string }; ativo: boolean }
const json = JSON.parse(readFileSync(fileURLToPath(new URL("../../corpus/rulesets/dedupe-exame.v1.json", import.meta.url)), "utf8")) as {
  principio: string;
  chaves: Chave[];
  regras: Regra[];
};

function* objetos(valor: unknown): Generator<Record<string, unknown>> {
  if (Array.isArray(valor)) { for (const v of valor) yield* objetos(v); return; }
  if (typeof valor === "object" && valor !== null) {
    yield valor as Record<string, unknown>;
    for (const v of Object.values(valor)) yield* objetos(v);
  }
}

describe("dedupe-exame.v1.json (W8/GLM-17)", () => {
  it("header válido (G-17) e id correto", () => {
    const r = validarRuleset(json);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.header.id).toBe("dedupe-exame");
  });

  it("chave patologia/IHQ = laboratório + número do exame + data de entrada (D2 descrito)", () => {
    const pat = json.chaves.find((c) => c.id === "patologia-ihq");
    expect(pat).toBeDefined();
    expect(pat!.campos).toEqual(["laboratorio", "numeroExame", "dataEntrada"]);
    expect(pat!.nuncaUsar).toContain("dataImpressa");
    expect(pat!.nuncaUsar).toContain("dataExtracaoSistema");
    expect(pat!.casoReal).toContain("reimpressão extraída do SISREG");
    expect(pat!.casoReal).toContain("um exame");
  });

  it("chave imagem = serviço + registro + data do exame; páginas idênticas => um exame (D1)", () => {
    const img = json.chaves.find((c) => c.id === "imagem");
    expect(img).toBeDefined();
    expect(img!.campos).toEqual(["servico", "registro", "dataExame"]);
    expect(img!.casoReal).toContain("duas páginas idênticas");
  });

  it("concordância entre exames distintos não é duplicata (D3)", () => {
    const r = json.regras.find((x) => x.id === "concordancia-nao-e-duplicata");
    expect(r).toBeDefined();
    expect(r!.regra).toContain("NÃO são duplicata");
    expect(r!.casoReal).toContain("AP de RTU");
    expect(json.principio).toContain("concordância entre exames distintos não é duplicata");
  });

  it("fonte é DECISAO_TECNICA do tech lead (caso real 01); nada ativo", () => {
    for (const item of [...json.chaves, ...json.regras]) {
      expect(item.fonte.tipo, item.id).toBe("DECISAO_TECNICA");
      expect(item.ativo, item.id).toBe(false);
    }
    for (const o of objetos(json)) expect(o.ativo).not.toBe(true);
  });
});
