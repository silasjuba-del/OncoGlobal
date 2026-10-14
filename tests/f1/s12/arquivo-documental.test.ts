import { existsSync, readFileSync } from "node:fs";
import { resolve, sep } from "node:path";
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
