// W5 · P1 · varredura automática de referências a IDs normativos (ponto de partida da MATRIZ).
// "Sem referência por ID" ≠ "sem teste": a classificação final exige leitura do código (§4-P1).
// Uso: node docs/w5/ferramentas/varredura-ids.mjs [raiz]   → imprime tabela markdown.
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";

const ROOT = process.argv[2] ?? process.cwd();
const familias = [
  { pre: "G-", n: 28, re: (k) => `\\bG-?0?${k}(?!\\d)` },
  { pre: "INV-", n: 24, re: (k) => `\\bINV-?0?${k}(?!\\d)` },
  { pre: "K-", n: 30, re: (k) => `\\bK-?0?${k}(?!\\d)` },
  { pre: "FN-", n: 26, re: (k) => `\\bFN-?0?${k}(?!\\d)` },
  { pre: "N", n: 26, re: (k) => `\\bN0?${k}(?!\\d)` },
  { pre: "T-", n: 61, re: (k) => `\\bT-?0?${k}(?!\\d)` },
];
const walk = (d, out = []) => {
  for (const f of readdirSync(d)) {
    const p = join(d, f);
    if (statSync(p).isDirectory()) { if (f !== "node_modules" && f !== ".git") walk(p, out); }
    else if (/\.(ts|tsx|mjs|json)$/.test(f)) out.push(p);
  }
  return out;
};
const arquivos = [...walk(join(ROOT, "src")), ...walk(join(ROOT, "tests")), ...walk(join(ROOT, "scripts")), ...walk(join(ROOT, "corpus"))]
  .map((p) => ({ rel: relative(ROOT, p).split(sep).join("/"), txt: readFileSync(p, "utf8") }));
const linhas = ["| ID | refs em src/scripts/corpus | refs em tests |", "|---|---|---|"];
let semRef = 0;
for (const f of familias) {
  for (let k = 1; k <= f.n; k++) {
    const id = `${f.pre}${String(k).padStart(2, "0")}`;
    const re = new RegExp(f.re(k), "g");
    const emSrc = [], emTests = [];
    for (const a of arquivos) if (re.test(a.txt)) (a.rel.startsWith("tests/") ? emTests : emSrc).push(a.rel), (re.lastIndex = 0);
    if (!emSrc.length && !emTests.length) semRef++;
    linhas.push(`| ${id} | ${emSrc.join(", ") || "—"} | ${emTests.join(", ") || "—"} |`);
  }
}
console.log(linhas.join("\n"));
console.log(`\nIDs sem nenhuma referência: ${semRef}`);
