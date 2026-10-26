import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

function listarCss(dir: string): string[] {
  const saida: string[] = [];
  for (const nome of readdirSync(dir)) {
    const p = join(dir, nome);
    if (statSync(p).isDirectory()) saida.push(...listarCss(p));
    else if (nome.endsWith(".css")) saida.push(p);
  }
  return saida;
}

describe("U-H9 · prefers-reduced-motion: animações e transições desligam", () => {
  it("toda folha CSS em src/ui com transition ou animation possui bloco @media (prefers-reduced-motion: reduce)", () => {
    const raiz = process.cwd();
    const arquivos = listarCss(join(raiz, "src/ui"));
    const semReducedMotion: string[] = [];

    for (const arq of arquivos) {
      const css = readFileSync(arq, "utf8");
      const temTransicaoOuAnimacao =
        /transition\s*:\s*(?!none\b)[^;]+;/i.test(css) || /animation\s*:\s*(?!none\b)[^;]+;/i.test(css);
      if (temTransicaoOuAnimacao && !/@media\s*\(\s*prefers-reduced-motion\s*:\s*reduce\s*\)/i.test(css)) {
        semReducedMotion.push(relative(raiz, arq).replace(/\\/g, "/"));
      }
    }

    expect(semReducedMotion).toEqual([]);
  });
});
