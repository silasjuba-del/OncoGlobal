import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { avaliarLabAlerts } from "../../src/rules/labAlerts.js";
import { avaliarCumulativoAlerta } from "../../src/rules/cumulativoAlerta.js";
import { labRuleset, limiteCumulativo, administracaoCompleta } from "./fixtures.js";

const arquivos = ["tipos-w3", "labAlerts", "radAlerts", "redFlagsCanal", "cumulativoAlerta", "ctcaeGrau", "recist", "escores", "intervaloQt"];
describe("W3 propriedades de pureza", () => {
  it.each(arquivos)("%s nao acessa relogio, rede, I/O ou codigo dinamico", (nome) => {
    const texto = readFileSync(new URL(`../../src/rules/${nome}.ts`, import.meta.url), "utf8");
    expect(texto).not.toMatch(/\bDate\.now\s*\(|\bnew\s+Date\s*\(\s*\)|\bDate\s*\(\s*\)|\bMath\.random\s*\(|\bperformance\.now\s*\(/);
    expect(texto).not.toMatch(/\b(?:fetch|eval|require|setTimeout|setInterval)\s*\(|\bnew\s+(?:Function|WebSocket|XMLHttpRequest)\b|\bprocess\./);
    for (const m of texto.matchAll(/\bfrom\s*["']([^"']+)["']/g)) expect(m[1]).toMatch(/^\.\.\/contracts\//);
    // import("...") e permitido apenas em aliases type, sem import dinamico executavel.
    for (const linha of texto.split(/\r?\n/)) {
      if (/\bimport\s*\(/.test(linha)) expect(linha).toMatch(/^\s*type\s+\w+\s*=\s*import\(["']\.\/tipos-w3\.js["']\)\.\w+;/);
    }
    expect(texto).not.toMatch(/\bimport\s*["']|\b(?:node:fs|node:http|node:net|axios|undici)\b/);
  });
  it("LAB preserva entradas congeladas e repete o mesmo resultado", () => {
    const entradas = Object.freeze([Object.freeze({ codigo: "HB", valor: 80, unidade: "dg/dL" })]);
    const antes = JSON.stringify(labRuleset);
    expect(avaliarLabAlerts(entradas, labRuleset)).toEqual(avaliarLabAlerts(entradas, labRuleset));
    expect(JSON.stringify(labRuleset)).toBe(antes);
    expect(entradas[0]?.valor).toBe(80);
  });
  it("cumulativo e invariante por ordem e replay identico", () => {
    const a = administracaoCompleta("a", 20), b = administracaoCompleta("b", 30);
    const input = { patientId: a.patientId, episodioId: a.episodioId, droga: a.droga, administracoes: [a, b] };
    expect(avaliarCumulativoAlerta(input, limiteCumulativo).total).toBe(50);
    expect(avaliarCumulativoAlerta({ ...input, administracoes: [b, a, a] }, limiteCumulativo).total).toBe(50);
  });
});
