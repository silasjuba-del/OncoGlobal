import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, sep } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const scanner = fileURLToPath(new URL("../../scripts/check-boundaries.mjs", import.meta.url));
// Pré-F1: o scanner lê a relação aprovada de exceções ao lado dele; a cópia isolada precisa levá-la junto.
const aprovadas = fileURLToPath(new URL("../../scripts/fronteiras-excecoes-aprovadas.json", import.meta.url));

function verificarSnippet(snippet: string) {
  // Corpus sintético isolado no diretório temporário: nunca edita src/ do repo.
  const dir = mkdtempSync(join(tmpdir(), "oncoglobal-f09-"));
  try {
    mkdirSync(join(dir, "scripts"));
    mkdirSync(join(dir, "src", "rules"), { recursive: true });
    // Cópia SEM dívida: EXCECOES vazia e relação aprovada vazia, para que a única violação possível seja o vetor testado
    // (com a dívida real copiada, "FRONTEIRAS VIOLADAS" sairia por "exceção não usada" e o teste não provaria nada).
    const codigo = readFileSync(scanner, "utf8");
    const inicio = codigo.indexOf("const EXCECOES = [");
    const fim = codigo.indexOf("\n];", inicio);
    if (inicio < 0 || fim < 0) throw new Error("EXCECOES_NAO_ENCONTRADA");
    writeFileSync(join(dir, "scripts", "check-boundaries.mjs"),
      codigo.slice(0, inicio) + "const EXCECOES = [" + codigo.slice(fim), "utf8");
    const manifesto = JSON.parse(readFileSync(aprovadas, "utf8")) as { prazo: string };
    writeFileSync(join(dir, "scripts", "fronteiras-excecoes-aprovadas.json"),
      JSON.stringify({ aprovadoEm: "fixture", origem: "ADV-013", prazo: manifesto.prazo, pares: [] }), "utf8");
    writeFileSync(join(dir, "src", "rules", "probe.ts"), snippet, "utf8");
    const result = spawnSync(process.execPath, [join(dir, "scripts", "check-boundaries.mjs")],
      { cwd: dir, encoding: "utf8", timeout: 10_000 });
    if (result.error) throw result.error;
    return { status: result.status, output: result.stdout + result.stderr };
  } finally {
    const canonicalTmp = realpathSync(tmpdir()).toLowerCase();
    const canonicalDir = realpathSync(dir).toLowerCase();
    if (!canonicalDir.startsWith(canonicalTmp + sep) || !canonicalDir.includes("oncoglobal-f09-"))
      throw new Error("TEMP_FORA_DO_ESCOPO_NAO_REMOVIDO");
    rmSync(dir, { recursive: true, force: false });
  }
}

describe("F9 · varredura estática bounded com fonte sintética inerte", () => {
  it("ADV-013 · controle limpo: sem rede e sem dívida, o scanner passa com 0 exceções", () => {
    const result = verificarSnippet("export {};\n");
    expect(result.status, result.output).toBe(0);
    expect(result.output).toContain("0 exceções");
  });

  for (const [vetor, codigo] of [
    ["fetch por propriedade computada", 'void globalThis["fetch"]("https://example.invalid");'],
    ["cliente WebSocket", 'void new WebSocket("wss://example.invalid");'],
    ["import dinâmico", 'void import("node:https");'],
  ]) {
    it(`ADV-013 · check-boundaries rejeita ${vetor} fora de gateway/llm`, () => {
      const result = verificarSnippet(codigo!);
      expect(result.status).toBe(1);
      expect(result.output).toContain("FRONTEIRAS VIOLADAS");
      // Poder de prova: a violação apontada é a do vetor, e não ruído de dívida copiada.
      expect(result.output).toContain("src/rules/probe.ts usa rede fora do gateway/llm (INV-05)");
      expect(result.output).not.toContain("exceção não usada");
      expect(result.output).not.toContain("fora da relação aprovada");
    });
  }
});
