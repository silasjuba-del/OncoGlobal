// Fronteiras de import (R-08) sem dependência nova: falha o CI se uma camada importar o que não pode.
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const SRC = join(ROOT, "src");
const RULES = [
  { from: "src/contracts/", forbid: ["src/"], allow: ["src/contracts/"], why: "contratos só dependem de si" },
  { from: "src/rules/", forbid: ["src/"], allow: ["src/contracts/"], why: "funções puras: só contratos (corpus injetado)" },
  { from: "src/agents/", forbid: ["src/agents/"], allow: [], why: "agente nunca importa outro agente", sameDirOk: true },
  { from: "src/kernel/harness/", forbid: ["src/agents/"], allow: [], why: "harness não depende de agentes" },
  { from: "src/ui/", forbid: ["src/kernel/ledger/"], allow: [], why: "UI não escreve no ledger direto" },
];
const NET = /\bfrom\s+["'](node:https?|node:net|undici|axios|node-fetch)["']|\bfetch\(/;
// src/server/** é servidor de ENTRADA em 127.0.0.1: pode node:http; nunca cliente de saída.
const NET_SAIDA = /\bfrom\s+["'](node:https|node:net|undici|axios|node-fetch)["']|\bfetch\(|\bhttp\.request\(|\bhttp\.get\(/;

const files = [];
const walk = (d) => { for (const f of readdirSync(d)) { const p = join(d, f); statSync(p).isDirectory() ? walk(p) : /\.(ts|tsx|mjs)$/.test(f) && files.push(p); } };
try { walk(SRC); } catch { /* src vazio */ }

const erros = [];
for (const file of files) {
  const rel = relative(ROOT, file).split(sep).join("/");
  const code = readFileSync(file, "utf8");
  const imports = [...code.matchAll(/from\s+["'](\.{1,2}\/[^"']+)["']/g)].map((m) =>
    relative(ROOT, join(file, "..", m[1])).split(sep).join("/"));
  for (const r of RULES) {
    if (!rel.startsWith(r.from)) continue;
    for (const imp of imports) {
      const proibido = r.forbid.some((p) => imp.startsWith(p)) && !r.allow.some((a) => imp.startsWith(a));
      const mesmoAgente = r.sameDirOk && imp.split("/").slice(0, 3).join("/") === rel.split("/").slice(0, 3).join("/");
      if (proibido && !mesmoAgente && !(r.from === "src/contracts/" && imp.startsWith("src/contracts/")))
        erros.push(`${rel} → ${imp} (${r.why})`);
    }
  }
  const servidor = rel.startsWith("src/server/");
  if (servidor && NET_SAIDA.test(code)) erros.push(`${rel} faz rede de saída (servidor só de entrada local)`);
  else if (!servidor && !rel.startsWith("src/kernel/gateway/") && !rel.startsWith("src/kernel/llm/") && NET.test(code))
    erros.push(`${rel} usa rede fora do gateway/llm (INV-05)`);
}
if (erros.length) { console.error("FRONTEIRAS VIOLADAS:\n" + erros.join("\n")); process.exit(1); }
console.log(`fronteiras ok (${files.length} arquivos)`);
