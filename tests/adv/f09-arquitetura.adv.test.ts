import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, sep } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const scanner = fileURLToPath(new URL("../../scripts/check-boundaries.mjs", import.meta.url));

function verificarSnippet(snippet: string) {
  // Corpus sintético isolado no diretório temporário: nunca edita src/ do repo.
  const dir = mkdtempSync(join(tmpdir(), "oncoglobal-f09-"));
  try {
    mkdirSync(join(dir, "scripts"));
    mkdirSync(join(dir, "src", "rules"), { recursive: true });
    copyFileSync(scanner, join(dir, "scripts", "check-boundaries.mjs"));
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
  for (const [vetor, codigo] of [
    ["fetch por propriedade computada", 'void globalThis["fetch"]("https://example.invalid");'],
    ["cliente WebSocket", 'void new WebSocket("wss://example.invalid");'],
    ["import dinâmico", 'void import("node:https");'],
  ]) {
    it(`ADV-013 · check-boundaries rejeita ${vetor} fora de gateway/llm`, () => {
      const result = verificarSnippet(codigo!);
      expect(result.status).toBe(1);
      expect(result.output).toContain("FRONTEIRAS VIOLADAS");
    });
  }
});
