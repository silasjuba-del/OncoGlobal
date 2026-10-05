import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const MODULOS = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "src", "modules");

const PROIBIDO: { nome: string; re: RegExp }[] = [
  { nome: "Date.now", re: /Date\.now\s*\(/ },
  { nome: "new Date()", re: /new\s+Date\s*\(\s*\)/ },
  { nome: "Math.random", re: /Math\.random\s*\(/ },
  { nome: "node:fs", re: /node:fs|from\s+["']fs["']/ },
  { nome: "rede", re: /node:https?|node:net|node:dns|from\s+["']undici["']|from\s+["']axios["']|\bfetch\s*\(/ },
];

function arquivosTs(dir: string): string[] {
  const saida: string[] = [];
  for (const nome of readdirSync(dir)) {
    const caminho = join(dir, nome);
    if (statSync(caminho).isDirectory()) saida.push(...arquivosTs(caminho));
    else if (nome.endsWith(".ts")) saida.push(caminho);
  }
  return saida;
}

describe("GRK-10 pureza de src/modules", () => {
  it("nenhum arquivo importa relógio, rede ou filesystem", () => {
    const arquivos = arquivosTs(MODULOS);
    expect(arquivos.length).toBeGreaterThan(0);
    const achados: string[] = [];
    for (const arquivo of arquivos) {
      const codigo = readFileSync(arquivo, "utf8");
      for (const regra of PROIBIDO) {
        if (regra.re.test(codigo)) achados.push(`${arquivo} contém ${regra.nome}`);
      }
    }
    expect(achados).toEqual([]);
  });
});
