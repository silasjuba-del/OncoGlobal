// N19 · diff × trilha. Lê docs/MANIFESTO-W1-F0.md e as faixas da W10.
// npm script sugerido em docs/w10/PEDIDOS-GROK.md. Não edita package.json.
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");

const FRAGMENTOS = [
  "um dono por ARQUIVO",
  "src/contracts/",
  "src/rules/**",
  "src/rules/{prescricao,morfometria,recist}/**",
  "src/rules/w8/*",
  "src/modules/**",
  "src/kernel/harness/ownership.ts",
  "scripts/verificar-manifesto.mjs",
  "corpus/rulesets/{rads-*,salao-*,agenda-*,interacoes*}",
  "tests/{rules,rules-w8,modules}/**",
  "tests/w10-grok/**",
  "docs/progresso/W10-GROK.md",
  "docs/w10/PEDIDOS-GROK.md",
];

function ler(rel) {
  return readFileSync(join(ROOT, rel), "utf8");
}

function conferirDocumentos() {
  const texto = [
    ler("docs/MANIFESTO-W1-F0.md"),
    ler("docs/ondas/W10-COMUM.md"),
    ler("docs/ondas/W10-GROK.md"),
  ].join("\n");
  for (const fragmento of FRAGMENTOS) {
    if (!texto.includes(fragmento)) {
      console.error(`TRILHA_ILEGIVEL ${fragmento}`);
      process.exit(2);
    }
  }
}

function git(args) {
  return execFileSync("git", ["-C", ROOT, ...args], { encoding: "utf8" }).trim();
}

function existeNoRev(rev, caminho) {
  try {
    execFileSync("git", ["-C", ROOT, "cat-file", "-e", `${rev}:${caminho}`], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

function naTrilhaGrok(caminho, revBase) {
  const p = caminho.split(sep).join("/");
  if (p.startsWith("src/rules/prescricao/")) return false;
  if (p.startsWith("src/rules/morfometria/")) return false;
  if (p.startsWith("src/rules/recist/")) return false;
  if (p.startsWith("src/rules/w8/")) {
    if (revBase === null) return false;
    return !existeNoRev(revBase, p);
  }
  if (p.startsWith("src/rules/")) return true;
  if (p.startsWith("src/modules/")) return true;
  if (p === "src/kernel/harness/ownership.ts") return true;
  if (p === "scripts/verificar-manifesto.mjs") return true;
  if (/^corpus\/rulesets\/(rads-|salao-|agenda-|interacoes)/.test(p)) return true;
  if (p.startsWith("tests/rules/")) return true;
  if (p.startsWith("tests/rules-w8/")) return true;
  if (p.startsWith("tests/modules/")) return true;
  if (p.startsWith("tests/w10-grok/")) return true;
  if (p === "docs/progresso/W10-GROK.md") return true;
  if (p === "docs/w10/PEDIDOS-GROK.md") return true;
  return false;
}

function listar(dir) {
  const saida = [];
  const andar = (atual) => {
    for (const nome of readdirSync(atual)) {
      const abs = join(atual, nome);
      if (statSync(abs).isDirectory()) andar(abs);
      else saida.push(relative(ROOT, abs).split(sep).join("/"));
    }
  };
  andar(join(ROOT, dir));
  return saida.sort();
}

function sha256(rel) {
  return createHash("sha256").update(readFileSync(join(ROOT, rel))).digest("hex");
}

function valores(argv, nome) {
  const i = argv.indexOf(nome);
  if (i < 0) return null;
  const vals = [];
  for (let j = i + 1; j < argv.length && !argv[j].startsWith("--"); j += 1) vals.push(argv[j]);
  return vals;
}

function uso() {
  console.error("uso: node scripts/verificar-manifesto.mjs --executor GROK (--arquivos <path...> | --base <rev> [--head <rev>])");
  process.exit(2);
}

function arquivosDoDiff(base, head) {
  const texto = git(["diff", "--name-only", "--diff-filter=ACDMRTUXB", `${base}...${head}`]);
  return texto.length === 0 ? [] : texto.split(/\r?\n/).filter((l) => l.length > 0);
}

function main() {
  conferirDocumentos();
  const argv = process.argv.slice(2);
  const executor = valores(argv, "--executor");
  if (executor === null || executor.length !== 1) uso();
  if (executor[0] !== "GROK") {
    console.error(`EXECUTOR_SEM_TRILHA ${executor[0]}`);
    process.exit(2);
  }
  const baseVals = valores(argv, "--base");
  const headVals = valores(argv, "--head");
  const lista = valores(argv, "--arquivos");
  const revBase = baseVals === null ? null : baseVals[0] ?? null;
  if (revBase === null && (lista === null || lista.length === 0)) uso();
  if (baseVals !== null && baseVals.length !== 1) uso();
  if (headVals !== null && headVals.length !== 1) uso();

  const head = headVals?.[0] ?? "HEAD";
  const arquivos = lista !== null && lista.length > 0 ? lista : arquivosDoDiff(revBase, head);

  if (revBase !== null) {
    console.log(`BASE ${revBase} ${git(["rev-parse", revBase])}`);
  } else {
    console.log("BASE ausente");
  }
  const pinados = [
    "docs/MANIFESTO-W1-F0.md",
    "docs/ondas/W10-COMUM.md",
    ...listar("src/contracts").filter((p) => p.endsWith(".ts")),
    ...listar("corpus/rulesets").filter((p) => p.endsWith(".json")),
  ];
  for (const rel of pinados) console.log(`PIN ${rel} ${sha256(rel)}`);

  const fora = arquivos.filter((p) => !naTrilhaGrok(p, revBase));
  for (const rel of fora) console.log(`FORA_DA_TRILHA ${rel}`);
  if (fora.length > 0) process.exit(1);
  console.log("trilha ok");
}

main();
