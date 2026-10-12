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
  // Pré-F1 (auditoria consolidada A2/A3): fronteiras para as camadas que antes só tinham vigilância de rede.
  { from: "src/server/", forbid: ["src/"], allow: ["src/kernel/", "src/contracts/", "src/modules/", "src/rules/", "src/server/"], why: "servidor: kernel, contratos, módulos e regras" },
  { from: "src/app/", forbid: ["src/"], allow: ["src/contracts/", "src/modules/", "src/rules/", "src/app/"], why: "app segue a regra de módulos" },
  { from: "src/orchestration/", forbid: ["src/"], allow: ["src/contracts/", "src/modules/", "src/rules/", "src/orchestration/"], why: "orquestração segue a regra de módulos" },
  { from: "src/apac/", forbid: ["src/"], allow: ["src/contracts/", "src/modules/", "src/rules/", "src/apac/"], why: "apac segue a regra de módulos" },
];
// Exceções geradas em 2026-10-12 a partir das violações existentes no início da F1 (auditoria consolidada pré-F1).
// Cada uma vence na fatia F1-S3; corrigir o import e remover a linha.
// Relação aprovada no pré-F1 (2026-10-12): controla o PERTENCIMENTO, não só a quantidade. A lista só encolhe.
const aprovadas = JSON.parse(readFileSync(new URL("./fronteiras-excecoes-aprovadas.json", import.meta.url), "utf8"));
const chaveAprovada = (x) => `${x.arquivo} → ${x.import}`;
const PARES_APROVADOS = new Set(aprovadas.pares.map(chaveAprovada));
const TETO_EXCECOES = aprovadas.pares.length;
// `--fechar-fase=F1-S3`: no fechamento da fatia, nenhuma exceção com esse prazo pode sobrar.
// Presença da opção e valor são checados em separado: `--fechar-fase=` vazio (variável não definida) não pode virar "sem fechamento".
const ARG_FECHAR = process.argv.find((a) => a.startsWith("--fechar-fase")) ?? null;
const FECHAR_FASE = ARG_FECHAR ? ARG_FECHAR.slice("--fechar-fase=".length) : null;
const EXCECOES = [
  { arquivo: "src/app/estudio/servidor.ts", import: "src/server/sessao.js", expira: "F1-S3", motivo: "app segue a regra de módulos" },
  { arquivo: "src/app/estudio/servidor.ts", import: "src/kernel/gateway/gateway.js", expira: "F1-S3", motivo: "app segue a regra de módulos" },
  { arquivo: "src/app/estudio/servidor.ts", import: "src/impressao/kit.js", expira: "F1-S3", motivo: "app segue a regra de módulos" },
  { arquivo: "src/app/estudio/servidor.ts", import: "src/impressao/apacLaudo.js", expira: "F1-S3", motivo: "app segue a regra de módulos" },
  { arquivo: "src/app/executores/desabilitados.ts", import: "src/kernel/gateway/gateway.js", expira: "F1-S3", motivo: "app segue a regra de módulos" },
  { arquivo: "src/app/executores/imprimir.ts", import: "src/kernel/gateway/gateway.js", expira: "F1-S3", motivo: "app segue a regra de módulos" },
  { arquivo: "src/app/executores/resolverDocumentoLedger.ts", import: "src/kernel/projections/snapshot.js", expira: "F1-S3", motivo: "app segue a regra de módulos" },
  { arquivo: "src/app/executores/resolverDocumentoLedger.ts", import: "src/server/sessao.js", expira: "F1-S3", motivo: "app segue a regra de módulos" },
  { arquivo: "src/app/oncoassist.ts", import: "src/kernel/llm/desidentificar.js", expira: "F1-S3", motivo: "app segue a regra de módulos" },
  { arquivo: "src/app/oncoassist.ts", import: "src/kernel/llm/jev/sdk.js", expira: "F1-S3", motivo: "app segue a regra de módulos" },
  { arquivo: "src/app/oncoassist.ts", import: "src/kernel/llm/jev/contrato.js", expira: "F1-S3", motivo: "app segue a regra de módulos" },
  { arquivo: "src/app/oncoassistLocal.ts", import: "src/kernel/ledger/db.js", expira: "F1-S3", motivo: "app segue a regra de módulos" },
  { arquivo: "src/app/oncoassistLocal.ts", import: "src/kernel/ledger/ledger.js", expira: "F1-S3", motivo: "app segue a regra de módulos" },
  { arquivo: "src/app/oncoassistLocal.ts", import: "src/kernel/ledger/idempotencia.js", expira: "F1-S3", motivo: "app segue a regra de módulos" },
  { arquivo: "src/app/oncoassistLocal.ts", import: "src/kernel/gateway/gateway.js", expira: "F1-S3", motivo: "app segue a regra de módulos" },
  { arquivo: "src/app/oncoassistLocal.ts", import: "src/server/sessao.js", expira: "F1-S3", motivo: "app segue a regra de módulos" },
  { arquivo: "src/app/oncoassistLocal.ts", import: "src/server/http.js", expira: "F1-S3", motivo: "app segue a regra de módulos" },
  { arquivo: "src/app/oncoboard/index.ts", import: "src/kernel/llm/desidentificar.js", expira: "F1-S3", motivo: "app segue a regra de módulos" },
  { arquivo: "src/app/revisaoExtracao.ts", import: "src/kernel/extracao/normalizacao.js", expira: "F1-S3", motivo: "app segue a regra de módulos" },
  { arquivo: "src/orchestration/pipeline-extracao.ts", import: "src/kernel/extracao/tipos.js", expira: "F1-S3", motivo: "orquestração segue a regra de módulos" },
  { arquivo: "src/orchestration/pipeline-extracao.ts", import: "src/kernel/extracao/segmenter.js", expira: "F1-S3", motivo: "orquestração segue a regra de módulos" },
  { arquivo: "src/orchestration/pipeline-extracao.ts", import: "src/kernel/extracao/patient-resolver.js", expira: "F1-S3", motivo: "orquestração segue a regra de módulos" },
  { arquivo: "src/orchestration/pipeline-extracao.ts", import: "src/kernel/extracao/extrator.js", expira: "F1-S3", motivo: "orquestração segue a regra de módulos" },
  { arquivo: "src/orchestration/pipeline-extracao.ts", import: "src/kernel/extracao/normalizacao.js", expira: "F1-S3", motivo: "orquestração segue a regra de módulos" },
  { arquivo: "src/orchestration/pipeline-extracao.ts", import: "src/kernel/extracao/reconciliacao.js", expira: "F1-S3", motivo: "orquestração segue a regra de módulos" },
  { arquivo: "src/orchestration/pipeline-extracao.ts", import: "src/kernel/extracao/deduplicacao.js", expira: "F1-S3", motivo: "orquestração segue a regra de módulos" },
  { arquivo: "src/orchestration/pipeline-extracao.ts", import: "src/kernel/extracao/eventoRevisao.js", expira: "F1-S3", motivo: "orquestração segue a regra de módulos" },
  { arquivo: "src/orchestration/pipeline-extracao.ts", import: "src/kernel/extracao/safety.js", expira: "F1-S3", motivo: "orquestração segue a regra de módulos" },
  { arquivo: "src/orchestration/pipeline-extracao.ts", import: "src/kernel/extracao/caixaRevisao.js", expira: "F1-S3", motivo: "orquestração segue a regra de módulos" },
  { arquivo: "src/orchestration/pipeline-extracao.ts", import: "src/kernel/extracao/biomarcadores.js", expira: "F1-S3", motivo: "orquestração segue a regra de módulos" },
  { arquivo: "src/orchestration/pipeline-extracao.ts", import: "src/kernel/projections/radiologia.js", expira: "F1-S3", motivo: "orquestração segue a regra de módulos" },
  { arquivo: "src/orchestration/pipeline-extracao.ts", import: "src/kernel/projections/timelinePaciente.js", expira: "F1-S3", motivo: "orquestração segue a regra de módulos" },
  { arquivo: "src/rules/f0c/tetosCumulativos.ts", import: "src/rules/cumulativoAlerta.js", expira: "F1-S3", motivo: "violação pré-existente em f1/integrado (commit dos tetos de dose acumulada); src/rules intocável neste PR" },
  { arquivo: "src/server/autorizacao.ts", import: "src/kernel/ledger/ledger.js", expira: "F1-S3", motivo: "ledger só pelo kernel" },
  { arquivo: "src/server/corpus.ts", import: "src/apac/sigtap.js", expira: "F1-S3", motivo: "servidor: kernel, contratos, módulos e regras" },
  { arquivo: "src/server/flash.ts", import: "src/ui/consulta/ConsultaFlash.js", expira: "F1-S3", motivo: "servidor: kernel, contratos, módulos e regras" },
  { arquivo: "src/server/flash.ts", import: "src/ui/api/porta.js", expira: "F1-S3", motivo: "servidor: kernel, contratos, módulos e regras" },
  { arquivo: "src/server/flash.ts", import: "src/config/flash.js", expira: "F1-S3", motivo: "servidor: kernel, contratos, módulos e regras" },
  { arquivo: "src/server/flash.ts", import: "src/kernel/ledger/drafts.js", expira: "F1-S3", motivo: "ledger só pelo kernel" },
  { arquivo: "src/server/http.ts", import: "src/config/settings.js", expira: "F1-S3", motivo: "servidor: kernel, contratos, módulos e regras" },
  { arquivo: "src/server/leituras.ts", import: "src/ui/api/porta.js", expira: "F1-S3", motivo: "servidor: kernel, contratos, módulos e regras" },
  { arquivo: "src/server/leituras.ts", import: "src/apac/antiglosa.js", expira: "F1-S3", motivo: "servidor: kernel, contratos, módulos e regras" },
  { arquivo: "src/server/leituras.ts", import: "src/apac/sigtap.js", expira: "F1-S3", motivo: "servidor: kernel, contratos, módulos e regras" },
  { arquivo: "src/server/leituras.ts", import: "src/kernel/ledger/drafts.js", expira: "F1-S3", motivo: "ledger só pelo kernel" },
  { arquivo: "src/server/rotas.ts", import: "src/orchestration/pipeline-extracao.js", expira: "F1-S3", motivo: "servidor: kernel, contratos, módulos e regras" },
  { arquivo: "src/server/rotas.ts", import: "src/config/settings.js", expira: "F1-S3", motivo: "servidor: kernel, contratos, módulos e regras" },
  { arquivo: "src/server/rotas.ts", import: "src/config/servico.js", expira: "F1-S3", motivo: "servidor: kernel, contratos, módulos e regras" },
  { arquivo: "src/server/rotas.ts", import: "src/estatistica/index.js", expira: "F1-S3", motivo: "servidor: kernel, contratos, módulos e regras" },
  { arquivo: "src/server/rotas.ts", import: "src/app/pesquisa/conhecimento.js", expira: "F1-S3", motivo: "servidor: kernel, contratos, módulos e regras" },
  { arquivo: "src/server/rotas.ts", import: "src/app/revisaoExtracao.js", expira: "F1-S3", motivo: "servidor: kernel, contratos, módulos e regras" },
  { arquivo: "src/server/rotas.ts", import: "src/app/oncoassist.js", expira: "F1-S3", motivo: "servidor: kernel, contratos, módulos e regras" },
  { arquivo: "src/server/rotas.ts", import: "src/config/flash.js", expira: "F1-S3", motivo: "servidor: kernel, contratos, módulos e regras" },
  { arquivo: "src/server/rotas.ts", import: "src/kernel/ledger/drafts.js", expira: "F1-S3", motivo: "ledger só pelo kernel" },
  { arquivo: "src/server/rotas.ts", import: "src/kernel/ledger/ledger.js", expira: "F1-S3", motivo: "ledger só pelo kernel" },
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
  // Pré-F1 (A3): só o kernel usa o ledger diretamente (ledger.js / drafts.js).
  if (!rel.startsWith("src/kernel/")) for (const imp of imports)
    if (/^src\/kernel\/ledger\/(ledger|drafts)\.js$/.test(imp)) erros.push(`${rel} → ${imp} (ledger só pelo kernel)`);
  // src/app/** é a raiz de composição: pode subir servidor de ENTRADA local, nunca rede de saída.
  const servidor = rel.startsWith("src/server/") || rel.startsWith("src/app/");
  const uiApi = rel.startsWith("src/ui/api/");
  if (uiApi) { if (UI_API_PROIBIDO.test(code)) erros.push(`${rel} cliente da UI fora da mesma origem (só caminho relativo "/...")`); }
  else if (servidor && NET_SAIDA.test(code)) erros.push(`${rel} faz rede de saída (servidor só de entrada local)`);
  else if (!servidor && !rel.startsWith("src/kernel/gateway/") && !rel.startsWith("src/kernel/llm/") && NET.test(code))
    erros.push(`${rel} usa rede fora do gateway/llm (INV-05)`);
}
// Exceções datadas (pré-F1): cada uma nomeada e com prazo. A lista só encolhe: exceção sem prazo, ou que não é
// mais necessária, falha a bateria (remova-a quando o import for corrigido).
const chave = (x) => `${x.arquivo} → ${x.import}`;
const usadas = new Set();
const restantes = [...new Set(erros)].filter((e) => {
  const ex = EXCECOES.find((x) => e.startsWith(`${chave(x)} (`));
  if (!ex) return true;
  usadas.add(chave(ex)); return false;
});
if (EXCECOES.length > TETO_EXCECOES) restantes.push(`exceções acima do teto aprovado (${EXCECOES.length} > ${TETO_EXCECOES}): a lista só encolhe`);
for (const ex of EXCECOES) {
  if (!PARES_APROVADOS.has(chave(ex))) restantes.push(`exceção fora da relação aprovada (scripts/fronteiras-excecoes-aprovadas.json): ${chave(ex)}`);
}
// Fechamento de fase: só a fase do manifesto é conhecida, e no fechamento NENHUMA exceção pode sobrar, qualquer que seja o prazo escrito.
if (ARG_FECHAR !== null && !FECHAR_FASE) restantes.push("--fechar-fase sem valor: informe a fase do manifesto (ex.: --fechar-fase=F1-S3)");
else if (FECHAR_FASE && FECHAR_FASE !== aprovadas.prazo) restantes.push(`fase de fechamento desconhecida: ${FECHAR_FASE} (manifesto: ${aprovadas.prazo})`);
for (const ex of EXCECOES) {
  if (FECHAR_FASE) restantes.push(`exceção vencida no fechamento de ${FECHAR_FASE}: ${chave(ex)}`);
  else if (!ex.expira) restantes.push(`exceção sem prazo: ${chave(ex)}`);
  else if (ex.expira !== aprovadas.prazo) restantes.push(`exceção com prazo fora do manifesto (${ex.expira} ≠ ${aprovadas.prazo}): ${chave(ex)}`);
  else if (!usadas.has(chave(ex))) restantes.push(`exceção não usada (remova da lista): ${chave(ex)}`);
}
if (restantes.length) { console.error("FRONTEIRAS VIOLADAS:\n" + restantes.join("\n")); process.exit(1); }
console.log(EXCECOES.length === 0
  ? `fronteiras ok (${files.length} arquivos; 0 exceções)`
  : `fronteiras ok (${files.length} arquivos; ${EXCECOES.length} exceções datadas, prazo ${[...new Set(EXCECOES.map((x) => x.expira))].join(", ")})`);
