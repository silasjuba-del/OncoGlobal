import { cpSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, sep } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const root = fileURLToPath(new URL("../../", import.meta.url));
function verificar(alterar: (dir: string) => void = () => {}, args: string[] = []) {
  const dir = mkdtempSync(join(tmpdir(), "oncoglobal-pre-f1-fronteiras-"));
  try {
    cpSync(join(root, "src"), join(dir, "src"), { recursive: true });
    mkdirSync(join(dir, "scripts"));
    cpSync(join(root, "scripts/check-boundaries.mjs"), join(dir, "scripts/check-boundaries.mjs"));
    alterar(dir);
    const run = spawnSync(process.execPath, [join(dir, "scripts/check-boundaries.mjs"), ...args],
      { cwd: dir, encoding: "utf8", timeout: 10_000 });
    if (run.error) throw run.error;
    return { status: run.status, output: run.stdout + run.stderr };
  } finally {
    const resolved = realpathSync(dir).toLowerCase();
    if (!resolved.startsWith(realpathSync(tmpdir()).toLowerCase() + sep)
      || !resolved.includes("oncoglobal-pre-f1-fronteiras-")) throw new Error("TEMP_FORA_DO_ESCOPO");
    rmSync(dir, { recursive: true });
  }
}

describe("pré-F1 · fronteiras com dívida explícita", () => {
  it("aceita a dívida aprovada (no máximo 54 exceções) e permite que ela encolha", () => {
    const result = verificar();
    expect(result.status, result.output).toBe(0);
    const n = Number(/(\d+) exceções datadas/.exec(result.output)?.[1]);
    expect(n).toBeGreaterThan(0);
    expect(n).toBeLessThanOrEqual(54);
  });

  it("remover uma exceção junto com a correção do import continua verde", () => {
    const result = verificar((dir) => {
      const script = join(dir, "scripts/check-boundaries.mjs");
      writeFileSync(script, readFileSync(script, "utf8")
        .split("\n").filter((l) => !(l.includes('arquivo: "src/server/http.ts"') && l.includes("src/config/settings.js"))).join("\n"));
      const http = join(dir, "src/server/http.ts");
      writeFileSync(http, readFileSync(http, "utf8")
        .split("\n").filter((l) => !(l.startsWith("import") && l.includes("config/settings.js"))).join("\n"));
    });
    expect(result.status, result.output).toBe(0);
    expect(Number(/(\d+) exceções datadas/.exec(result.output)?.[1])).toBeLessThan(54);
  });

  it("rejeita exceção nova acima do teto, mesmo cobrindo uma violação real", () => {
    const result = verificar((dir) => {
      writeFileSync(join(dir, "src/server/probe.ts"), "import '../kernel/ledger/ledger.js';\n");
      const script = join(dir, "scripts/check-boundaries.mjs");
      writeFileSync(script, readFileSync(script, "utf8").replace("const EXCECOES = [",
        'const EXCECOES = [\n  { arquivo: "src/server/probe.ts", import: "src/kernel/ledger/ledger.js", expira: "F1-S3", motivo: "probe" },'));
    });
    expect(result.status).toBe(1);
    expect(result.output).toContain("acima do teto aprovado");
  });

  it("no fechamento da F1-S3 nenhuma exceção com esse prazo pode sobrar", () => {
    const result = verificar(() => {}, ["--fechar-fase=F1-S3"]);
    expect(result.status).toBe(1);
    expect(result.output).toContain("exceção vencida no fechamento de F1-S3");
  });

  it.each([
    ["server", "src/server/probe.ts", "../kernel/ledger/ledger.js", "ledger só pelo kernel"],
    ["app", "src/app/probe.ts", "../kernel/projections/snapshot.js", "app segue a regra"],
    ["orchestration", "src/orchestration/probe.ts", "../kernel/projections/snapshot.js", "orquestração segue a regra"],
    ["apac", "src/apac/probe.ts", "../server/leituras.js", "apac segue a regra"],
    ["agents", "src/agents/primeiro/probe.ts", "../segundo/agente.js", "agente nunca importa outro agente"],
    ["harness", "src/kernel/harness/probe.ts", "../../agents/primeiro/agente.js", "harness não depende de agentes"],
  ])("rejeita nova violação em %s sem esconder a causa em exceções obsoletas", (_, path, ref, causa) => {
    const result = verificar((dir) => {
      const file = join(dir, path!); mkdirSync(dirname(file), { recursive: true });
      writeFileSync(file, `import '${ref}';\n`);
    });
    expect(result.status).toBe(1);
    expect(result.output).toContain(causa);
    expect(result.output).not.toContain("exceção não usada");
  });

  it.each(["sem prazo", "não usada"])("rejeita exceção %s", (caso) => {
    const result = verificar((dir) => {
      const script = join(dir, "scripts/check-boundaries.mjs");
      const code = readFileSync(script, "utf8");
      writeFileSync(script, caso === "sem prazo"
        ? code.replace('expira: "F1-S3"', 'expira: ""')
        : code.replace('arquivo: "src/app/estudio/servidor.ts"', 'arquivo: "src/app/nao-existe.ts"'));
    });
    expect(result.status).toBe(1);
    expect(result.output).toContain(`exceção ${caso}`);
  });
});
