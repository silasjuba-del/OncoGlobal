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
  { from: "src/leitura/", forbid: ["src/"], allow: ["src/contracts/", "src/rules/", "src/modules/", "src/kernel/projections/", "src/leitura/"], why: "leitura pura: eventos/projeções entram por parâmetro" },
  { from: "src/impressao/", forbid: ["src/"], allow: ["src/contracts/", "src/modules/", "src/impressao/"], why: "impressão pura: documento entra, HTML sai" },
  { from: "src/modules/", forbid: ["src/"], allow: ["src/contracts/", "src/modules/", "src/rules/"], why: "módulos de domínio puros: só contratos, regras e módulos" },
];
const NET = /from\s+["'](node:https?|node:net|undici|axios|node-fetch)["']|\bfetch\b|\[\s*[\"'`]fetch[\"'`]\s*\]|new\s+WebSocket|\bWebSocket\b|XMLHttpRequest|EventSource|sendBeacon|\bimport\s*\((?!\s*[\"'`][^\"'`]*[\"'`]\s*\)\s*\.[A-Z])|\brequire\s*\(|[\"'`]node:(dgram|tls|http2)[\"'`]/;  // CP-002: inclui acesso computado, WebSocket, import()/require dinâmicos
// src/server/** é servidor de ENTRADA em 127.0.0.1: pode node:http; nunca cliente de saída.
const NET_SAIDA = /from\s+["'](node:https|node:net|undici|axios|node-fetch)["']|http\.request\(|http\.get\(|\bfetch\b|\[\s*[\"'`]fetch[\"'`]\s*\]|new\s+WebSocket|\bWebSocket\b|XMLHttpRequest|EventSource|sendBeacon|\bimport\s*\((?!\s*[\"'`][^\"'`]*[\"'`]\s*\)\s*\.[A-Z])|\brequire\s*\(|[\"'`]node:(dgram|tls|http2)[\"'`]/;

// src/ui/api/** é o ÚNICO cliente HTTP da UI: só caminho relativo ao servidor local (mesma origem).
const UI_API_PROIBIDO = /["'`](https?:|wss?:)?\/\/|new\s+WebSocket|XMLHttpRequest|sendBeacon|EventSource|import\(/;

const files = [];
const walk = (d) => { for (const f of readdirSync(d)) { const p = join(d, f); statSync(p).isDirectory() ? walk(p) : /\.(ts|tsx|mjs)$/.test(f) && files.push(p); } };
try { walk(SRC); } catch { /* src vazio */ }

const erros = [];
for (const file of files) {
  const rel = relative(ROOT, file).split(sep).join("/");
  const code = readFileSync(file, "utf8");
  const referencias = [...code.matchAll(/(?:from\s*|import\s*)["']([^"']+)["']/g)].map((m) => m[1]);
  for (const ref of referencias) {
    if (/^(?:@\/|~\/|src\/)/.test(ref)) erros.push(`${rel} usa alias de workspace não autorizado: ${ref}`);
  }
  const imports = referencias.filter((ref) => /^\.{1,2}\//.test(ref)).map((ref) =>
    relative(ROOT, join(file, "..", ref)).split(sep).join("/"));
  for (const r of RULES) {
    if (!rel.startsWith(r.from)) continue;
    for (const imp of imports) {
      const proibido = r.forbid.some((p) => imp.startsWith(p)) && !r.allow.some((a) => imp.startsWith(a));
      const mesmoAgente = r.sameDirOk && imp.split("/").slice(0, 3).join("/") === rel.split("/").slice(0, 3).join("/");
      // R-08 (tech lead W10): só o barrel src/rules/index.ts pode reexportar arquivos de src/rules/.
      const barrelRegras = ["src/rules/index.ts", "src/rules/w8/index.ts"].includes(rel) && imp.startsWith("src/rules/");
      // Explicit pure shared leaves; do not permit arbitrary rule-to-rule imports.
      const folhaCompartilhada = r.from === "src/rules/" && ["src/rules/cns.js", "src/rules/datas.js", "src/rules/medidas.js", "src/rules/destino.js", "src/rules/w8/identificadores.js"].includes(imp);
      if (proibido && !mesmoAgente && !barrelRegras && !folhaCompartilhada && !(r.from === "src/contracts/" && imp.startsWith("src/contracts/")))
        erros.push(`${rel} → ${imp} (${r.why})`);
    }
  }
  // src/app/** é a raiz de composição: pode subir servidor de ENTRADA local, nunca rede de saída.
  const servidor = rel.startsWith("src/server/") || rel.startsWith("src/app/");
  const uiApi = rel.startsWith("src/ui/api/");
  if (uiApi) { if (UI_API_PROIBIDO.test(code)) erros.push(`${rel} cliente da UI fora da mesma origem (só caminho relativo "/...")`); }
  else if (servidor && NET_SAIDA.test(code)) erros.push(`${rel} faz rede de saída (servidor só de entrada local)`);
  else if (!servidor && !rel.startsWith("src/kernel/gateway/") && !rel.startsWith("src/kernel/llm/") && NET.test(code))
    erros.push(`${rel} usa rede fora do gateway/llm (INV-05)`);
}
if (erros.length) { console.error("FRONTEIRAS VIOLADAS:\n" + erros.join("\n")); process.exit(1); }
console.log(`fronteiras ok (${files.length} arquivos)`);
