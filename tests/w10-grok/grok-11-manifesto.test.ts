// GROK-11 · N19. Executa o manifesto em um Git sintético: sem refs ou branch locais.
import { createHash } from "node:crypto";
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, isAbsolute, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";

const raizFonte = fileURLToPath(new URL("../..", import.meta.url));
const arquivosBase = [
  "scripts/verificar-manifesto.mjs",
  "docs/MANIFESTO-W1-F0.md",
  "docs/ondas/W10-COMUM.md",
  "docs/ondas/W10-GROK.md",
  "src/contracts/agentes.ts",
  "corpus/rulesets/salao-triagem.v1.json",
];

type RepositorioTemporario = { readonly raiz: string; readonly base: string };

function git(raiz: string, args: string[]): string {
  const r = spawnSync("git", ["-C", raiz, ...args], { encoding: "utf8" });
  if (r.status !== 0) throw new Error(`git ${args.join(" ")} falhou: ${r.stderr || r.stdout}`);
  return r.stdout.trim();
}

function gravar(raiz: string, caminho: string, conteudo: string): void {
  const destino = join(raiz, ...caminho.split("/"));
  mkdirSync(resolve(destino, ".."), { recursive: true });
  writeFileSync(destino, conteudo, "utf8");
}

function commitar(raiz: string, mensagem: string): string {
  git(raiz, ["add", "-A"]);
  git(raiz, ["commit", "-q", "-m", mensagem]);
  return git(raiz, ["rev-parse", "HEAD"]);
}

function removerRepositorioTemporario(raiz: string): void {
  const temp = resolve(tmpdir());
  const alvo = resolve(raiz);
  const rel = relative(temp, alvo);
  if (!rel || rel.startsWith("..") || isAbsolute(rel) || dirname(alvo) !== temp
    || !basename(alvo).startsWith("onco-w10-manifesto-")) {
    throw new Error("Recusa de limpeza fora do diretório temporário da fixture");
  }
  rmSync(alvo, { recursive: true, force: true });
}

function criarRepositorioTemporario(): RepositorioTemporario {
  const raiz = mkdtempSync(join(tmpdir(), "onco-w10-manifesto-"));
  try {
    for (const rel of arquivosBase) {
      const origem = join(raizFonte, ...rel.split("/"));
      if (!existsSync(origem)) throw new Error(`Fixture do manifesto ausente: ${rel}`);
      const destino = join(raiz, ...rel.split("/"));
      mkdirSync(resolve(destino, ".."), { recursive: true });
      copyFileSync(origem, destino);
    }
    const w8Preexistente = "src/rules/w8/existente-no-base.ts";
    gravar(raiz, w8Preexistente, "export const fixture = 'base';\n");

    git(raiz, ["init", "-q"]);
    git(raiz, ["config", "user.name", "Manifesto Test"]);
    git(raiz, ["config", "user.email", "manifesto-test@example.invalid"]);
    const base = commitar(raiz, "base sintética do manifesto");
    return { raiz, base };
  } catch (error) {
    removerRepositorioTemporario(raiz);
    throw error;
  }
}

function comRepositorio<T>(acao: (repo: RepositorioTemporario) => T): T {
  const repo = criarRepositorioTemporario();
  try {
    return acao(repo);
  } finally {
    removerRepositorioTemporario(repo.raiz);
  }
}

function rodar(raiz: string, args: string[]) {
  return spawnSync(process.execPath, ["scripts/verificar-manifesto.mjs", ...args], {
    cwd: raiz,
    encoding: "utf8",
  });
}

function sha(raiz: string, rel: string): string {
  return createHash("sha256").update(readFileSync(join(raiz, ...rel.split("/")))).digest("hex");
}

const argsBase = (base: string) => ["--executor", "GROK", "--base", base, "--head", "HEAD"];

describe("GROK-11 verificar-manifesto", () => {
  it("arquivo da faixa passa e o pin traz o hash do contrato e do ruleset", () => comRepositorio(({ raiz, base }) => {
    const r = rodar(raiz, [...argsBase(base), "--arquivos", "src/kernel/harness/ownership.ts"]);
    expect(r.status).toBe(0);
    expect(r.stdout).toContain("trilha ok");
    expect(r.stdout).toContain(`PIN src/contracts/agentes.ts ${sha(raiz, "src/contracts/agentes.ts")}`);
    expect(r.stdout).toContain(`PIN corpus/rulesets/salao-triagem.v1.json ${sha(raiz, "corpus/rulesets/salao-triagem.v1.json")}`);
  }));

  it("lista explícita de diff fora da trilha nomeia o arquivo e sai 1", () => comRepositorio(({ raiz, base }) => {
    const r = rodar(raiz, [
      ...argsBase(base), "--arquivos", "src/ui/App.tsx", "src/rules/suporteNaoOncologico.ts",
    ]);
    expect(r.status).toBe(1);
    expect(r.stdout).toContain("FORA_DA_TRILHA src/ui/App.tsx");
    expect(r.stdout).not.toContain("FORA_DA_TRILHA src/rules/suporteNaoOncologico.ts");
    expect(r.stdout).not.toContain("trilha ok");
  }));

  it("prescrição, recist, gates e arquivo w8 preexistente ficam fora", () => comRepositorio(({ raiz, base }) => {
    const r = rodar(raiz, [
      ...argsBase(base), "--arquivos",
      "src/rules/prescricao/index.ts",
      "src/rules/morfometria/index.ts",
      "src/rules/recist/porta.ts",
      "src/kernel/harness/gates.ts",
      "src/rules/w8/existente-no-base.ts",
    ]);
    expect(r.status).toBe(1);
    for (const arquivo of [
      "src/rules/prescricao/index.ts",
      "src/rules/morfometria/index.ts",
      "src/rules/recist/porta.ts",
      "src/kernel/harness/gates.ts",
      "src/rules/w8/existente-no-base.ts",
    ]) expect(r.stdout).toContain(`FORA_DA_TRILHA ${arquivo}`);
  }));

  it("aceita arquivo novo ao lado de w8 somente quando ausente da base", () => comRepositorio(({ raiz, base }) => {
    const novo = "src/rules/w8/novo-ao-lado.ts";
    gravar(raiz, novo, "export const fixture = 'novo';\n");
    commitar(raiz, "novo arquivo W8 em faixa Grok");

    const novoPassa = rodar(raiz, [...argsBase(base), "--arquivos", novo]);
    expect(novoPassa.status).toBe(0);
    expect(novoPassa.stdout).toMatch(new RegExp(`BASE ${base} ${base}`));
    expect(novoPassa.stdout).toContain("trilha ok");

    const existenteFalha = rodar(raiz, [...argsBase(base), "--arquivos", "src/rules/w8/existente-no-base.ts"]);
    expect(existenteFalha.status).toBe(1);
    expect(existenteFalha.stdout).toContain("FORA_DA_TRILHA src/rules/w8/existente-no-base.ts");
  }));

  it("avalia diff entre commits sintéticos sem depender do nome da branch", () => comRepositorio(({ raiz, base }) => {
    gravar(raiz, "src/rules/suporteNaoOncologico.ts", "export const fixture = true;\n");
    commitar(raiz, "mudança Grok sintética");
    const permitido = rodar(raiz, argsBase(base));
    expect(permitido.status, permitido.stdout).toBe(0);
    expect(permitido.stdout).toContain("trilha ok");

    gravar(raiz, "src/ui/App.tsx", "export const fixture = true;\n");
    commitar(raiz, "mudança fora da trilha sintética");
    const bloqueado = rodar(raiz, argsBase(base));
    expect(bloqueado.status).toBe(1);
    expect(bloqueado.stdout).toContain("FORA_DA_TRILHA src/ui/App.tsx");
    expect(bloqueado.stdout).not.toContain("trilha ok");
  }));
});
