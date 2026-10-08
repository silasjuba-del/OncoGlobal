import { describe, expect, it } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { avaliarLabAlerts } from "../../src/rules/labAlerts.js";
import { avaliarCumulativoAlerta } from "../../src/rules/cumulativoAlerta.js";
import { labRuleset, limiteCumulativo, administracaoCompleta } from "./fixtures.js";

const raizRegras = fileURLToPath(new URL("../../src/rules/", import.meta.url));
const arquivos = ["tipos-w3", "labAlerts", "radAlerts", "redFlagsCanal", "cumulativoAlerta", "ctcaeGrau", "recist", "escores", "intervaloQt"];

/** Verifica pureza de um arquivo e, recursivamente, de cada import relativo interno que nao seja contracts. */
function verificarPureza(caminho: string, visitados: Set<string>): void {
  if (visitados.has(caminho)) return;
  visitados.add(caminho);
  const texto = readFileSync(caminho, "utf8");
  const rel = caminho.slice(raizRegras.length);
  expect(texto, rel).not.toMatch(/\bDate\.now\s*\(|\bnew\s+Date\s*\(\s*\)|\bDate\s*\(\s*\)|\bMath\.random\s*\(|\bperformance\.now\s*\(/);
  expect(texto, rel).not.toMatch(/\b(?:fetch|eval|require|setTimeout|setInterval)\s*\(|\bnew\s+(?:Function|WebSocket|XMLHttpRequest)\b|\bprocess\./);
  for (const m of texto.matchAll(/\bfrom\s*["']([^"']+)["']/g)) {
    const alvo = m[1]!;
    if (alvo.startsWith("../contracts/")) continue;
    // Import relativo interno: precisa ser irmao ou ancestral dentro de src/rules e tambem puro.
    expect(alvo, rel).toMatch(/^\.\.?\//);
    const arquivoAlvo = resolve(dirname(caminho), alvo.replace(/\.js$/, ".ts"));
    expect(arquivoAlvo.startsWith(raizRegras), rel).toBe(true);
    expect(existsSync(arquivoAlvo), rel).toBe(true);
    verificarPureza(arquivoAlvo, visitados);
  }
  // import("...") e permitido apenas em aliases type, sem import dinamico executavel.
  for (const linha of texto.split(/\r?\n/)) {
    if (/\bimport\s*\(/.test(linha)) expect(linha, rel).toMatch(/^\s*type\s+\w+\s*=\s*import\(["']\.\/tipos-w3\.js["']\)\.\w+;/);
  }
  expect(texto, rel).not.toMatch(/\bimport\s*["']|\b(?:node:fs|node:http|node:net|axios|undici)\b/);
}

describe("W3 propriedades de pureza", () => {
  it.each(arquivos)("%s nao acessa relogio, rede, I/O ou codigo dinamico", (nome) => {
    verificarPureza(`${raizRegras}${nome}.ts`, new Set());
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
