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
    cpSync(join(root, "scripts/fronteiras-excecoes-aprovadas.json"), join(dir, "scripts/fronteiras-excecoes-aprovadas.json"));
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

type Par = { arquivo: string; import: string };
type Excecao = Par & { expira: string; motivo: string };
function verificarSintetico(o: { arquivos: Record<string, string>; excecoes: Excecao[]; aprovadas: Par[]; args?: string[] }) {
  const dir = mkdtempSync(join(tmpdir(), "oncoglobal-pre-f1-fronteiras-"));
  try {
    for (const [rel, conteudo] of Object.entries(o.arquivos)) {
      const f = join(dir, rel); mkdirSync(dirname(f), { recursive: true }); writeFileSync(f, conteudo);
    }
    mkdirSync(join(dir, "scripts"), { recursive: true });
    const script = join(dir, "scripts/check-boundaries.mjs");
    const codigo = readFileSync(join(root, "scripts/check-boundaries.mjs"), "utf8");
    const ini = codigo.indexOf("const EXCECOES = [");
    const fim = codigo.indexOf("\n];", ini);
    if (ini < 0 || fim < 0) throw new Error("MARCADOR_EXCECOES_AUSENTE");
    writeFileSync(script, codigo.slice(0, ini) + "const EXCECOES = " + JSON.stringify(o.excecoes) + ";" + codigo.slice(fim + 3));
    writeFileSync(join(dir, "scripts/fronteiras-excecoes-aprovadas.json"),
      JSON.stringify({ aprovadoEm: "2026-10-12", origem: "sintético", prazo: "F1-S3", pares: o.aprovadas }));
    const run = spawnSync(process.execPath, [script, ...(o.args ?? [])], { cwd: dir, encoding: "utf8", timeout: 10_000 });
    if (run.error) throw run.error;
    return { status: run.status, output: run.stdout + run.stderr };
  } finally {
    const resolved = realpathSync(dir).toLowerCase();
    if (!resolved.startsWith(realpathSync(tmpdir()).toLowerCase() + sep)
      || !resolved.includes("oncoglobal-pre-f1-fronteiras-")) throw new Error("TEMP_FORA_DO_ESCOPO");
    rmSync(dir, { recursive: true });
  }
}
const exc = (p: Par): Excecao => ({ ...p, expira: "F1-S3", motivo: "sintético" });
const A: Par = { arquivo: "src/server/probe.ts", import: "src/kernel/ledger/ledger.js" };
const B: Par = { arquivo: "src/app/probe.ts", import: "src/kernel/projections/snapshot.js" };
const C: Par = { arquivo: "src/orchestration/probe.ts", import: "src/kernel/projections/snapshot.js" };
const violaA = { "src/server/probe.ts": "import '../kernel/ledger/ledger.js';\n", "src/kernel/ledger/ledger.ts": "export {};\n" };
const violaB = { "src/app/probe.ts": "import '../kernel/projections/snapshot.js';\n", "src/kernel/projections/snapshot.ts": "export {};\n" };
const violaC = { "src/orchestration/probe.ts": "import '../kernel/projections/snapshot.js';\n", "src/kernel/projections/snapshot.ts": "export {};\n" };

describe("pré-F1 · fronteiras com dívida explícita", () => {
  it("fixture sintética: zero exceções e zero violações passa", () => {
    const r = verificarSintetico({ arquivos: { "src/modules/x/a.ts": "import '../../contracts/base.js';\n", "src/contracts/base.ts": "export {};\n" }, excecoes: [], aprovadas: [] });
    expect(r.status, r.output).toBe(0);
    expect(r.output).toContain("0 exceções");
  });

  it("fixture sintética: subconjunto da relação aprovada passa", () => {
    const r = verificarSintetico({ arquivos: violaA, excecoes: [exc(A)], aprovadas: [A, B] });
    expect(r.status, r.output).toBe(0);
    expect(r.output).toContain("1 exceções datadas");
  });

  it("fixture sintética: troca de exceção com contagem constante falha", () => {
    const r = verificarSintetico({ arquivos: violaB, excecoes: [exc(B)], aprovadas: [A] });
    expect(r.status).toBe(1);
    expect(r.output).toContain("exceção fora da relação aprovada");
  });

  it("fixture sintética: inclusão nova após redução falha sem acusar o teto", () => {
    const r = verificarSintetico({ arquivos: { ...violaA, ...violaC }, excecoes: [exc(A), exc(C)], aprovadas: [A, B] });
    expect(r.status).toBe(1);
    expect(r.output).toContain("exceção fora da relação aprovada");
    expect(r.output).not.toContain("acima do teto");
  });

  it("fixture sintética: fechamento com resto falha", () => {
    const r = verificarSintetico({ arquivos: violaA, excecoes: [exc(A)], aprovadas: [A], args: ["--fechar-fase=F1-S3"] });
    expect(r.status).toBe(1);
    expect(r.output).toContain("exceção vencida no fechamento de F1-S3");
  });

  it("fixture sintética: fechamento limpo passa", () => {
    const r = verificarSintetico({ arquivos: { "src/contracts/base.ts": "export {};\n" }, excecoes: [], aprovadas: [A], args: ["--fechar-fase=F1-S3"] });
    expect(r.status, r.output).toBe(0);
    expect(r.output).toContain("0 exceções");
  });

  it("aceita a dívida aprovada (no máximo 54 exceções) e permite que ela encolha", () => {
    const result = verificar();
    expect(result.status, result.output).toBe(0);
    const n = Number(/(\d+) exceções/.exec(result.output)?.[1]);
    expect(n).toBeGreaterThanOrEqual(0);
    expect(n).toBeLessThanOrEqual(54);
  });

  it("fixture sintética: no fechamento, exceção com prazo diferente do manifesto também vence", () => {
    const r = verificarSintetico({ arquivos: violaA, excecoes: [{ ...A, expira: "F1-S4", motivo: "sintético" }], aprovadas: [A], args: ["--fechar-fase=F1-S3"] });
    expect(r.status).toBe(1);
    expect(r.output).toContain("exceção vencida no fechamento de F1-S3");
  });

  it("fixture sintética: prazo fora do manifesto falha mesmo sem fechamento", () => {
    const r = verificarSintetico({ arquivos: violaA, excecoes: [{ ...A, expira: "F1-S4", motivo: "sintético" }], aprovadas: [A] });
    expect(r.status).toBe(1);
    expect(r.output).toContain("exceção com prazo fora do manifesto (F1-S4 ≠ F1-S3)");
  });

  it("fixture sintética: fase de fechamento desconhecida falha", () => {
    const r = verificarSintetico({ arquivos: { "src/contracts/base.ts": "export {};\n" }, excecoes: [], aprovadas: [A], args: ["--fechar-fase=F1-S9"] });
    expect(r.status).toBe(1);
    expect(r.output).toContain("fase de fechamento desconhecida: F1-S9 (manifesto: F1-S3)");
  });

  // Redução, inclusão após redução e fechamento são provados só nas fixtures sintéticas acima:
  // os testes contra a árvore real não podem depender do tamanho da dívida, que só encolhe até zero.

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
