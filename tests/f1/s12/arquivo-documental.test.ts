import { existsSync, readFileSync, readdirSync } from "node:fs";
import { resolve, sep, join, extname, dirname } from "node:path";
import { expect, it } from "vitest";

it("arquivo histórico preserva os destinos e os documentos ainda consumidos", () => {
  const mapa = JSON.parse(readFileSync("docs/_arquivo/MOVIMENTOS.json", "utf8")) as {
    movimentos: { origem: string; destino: string }[];
    mantidosPorConsumidor: { arquivo: string; consumidores: string[] }[];
  };
  const raiz = resolve("docs/_arquivo") + sep;
  expect(mapa.movimentos.length).toBe(403);
  expect(new Set(mapa.movimentos.map(m => m.destino)).size).toBe(mapa.movimentos.length);
  for (const m of mapa.movimentos) {
    expect(resolve(m.destino).startsWith(raiz), m.destino).toBe(true);
    expect(existsSync(m.destino), m.destino).toBe(true);
    expect(existsSync(m.origem), m.origem).toBe(false);
  }
  for (const m of mapa.mantidosPorConsumidor) {
    expect(existsSync(m.arquivo), m.arquivo).toBe(true);
    for (const consumidor of m.consumidores) expect(existsSync(consumidor), consumidor).toBe(true);
  }
  const readme = readFileSync("README.md", "utf8");
  expect(readme).not.toContain("Ramo de trabalho: `f0/w1-integrado`");
  expect(readme).toContain("docs/RELATORIO-F1.md");
  expect(readme).toContain("docs/_arquivo/INDICE.md");
});

it("consumidores retidos não apontam para origens arquivadas, inclusive caminhos Windows em PowerShell", () => {
  const mapa = JSON.parse(readFileSync("docs/_arquivo/MOVIMENTOS.json", "utf8")) as { movimentos: { origem: string }[] };
  const textuais = new Set([".ts", ".tsx", ".js", ".mjs", ".json", ".md", ".ps1", ".sh", ".yaml", ".yml", ".txt", ".toml"]);
  for (const raiz of ["src", "tests", "scripts"]) {
    for (const item of readdirSync(raiz, { recursive: true, withFileTypes: true })) {
      if (!item.isFile() || !textuais.has(extname(item.name))) continue;
      const arquivo = join(item.parentPath, item.name);
      const texto = readFileSync(arquivo, "utf8").replace(/\\/g, "/").replace(/\/{2,}/g, "/");
      expect(mapa.movimentos.filter(m => texto.includes(m.origem)).map(m => m.origem), arquivo).toEqual([]);
      if (extname(arquivo) === ".ps1") {
        for (const m of texto.matchAll(/Join-Path\s+\$PSScriptRoot\s+'([^']*docs\/[^']+)'/g)) {
          expect(existsSync(resolve(dirname(arquivo), m[1]!)), `${arquivo}: ${m[1]}`).toBe(true);
        }
      }
    }
  }
});
