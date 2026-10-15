import { RulesetHeader } from "../src/contracts/rulesetHeader.mjs";
import { CabecalhoRascunho } from "../src/contracts/cabecalhoRascunho.mjs";
import { verificarB1 } from "./corpus-b1.mjs";
import { verificarB2 } from "./corpus-b2.mjs";
// GLM-08 · Valida o corpus inteiro: headers (G-17, schema compartilhado RulesetHeader de src/contracts),
// contagem de [VERIFICAR] e itens ativos por arquivo, e a invariante K-27: ativo sem fonte com trecho (ou DECISAO_MEDICA) => exit 1.
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const CORPUS = join(ROOT, "corpus");

const walk = (d) => {
  const saida = [];
  for (const f of readdirSync(d).sort()) {
    const p = join(d, f);
    statSync(p).isDirectory() ? saida.push(...walk(p)) : f.endsWith(".json") && saida.push(p);
  }
  return saida;
};

const validarHeader = (h) => {
  const parsed = RulesetHeader.safeParse(h);
  return parsed.success ? [] : parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`);
};

function* objetos(valor) {
  if (Array.isArray(valor)) { for (const v of valor) yield* objetos(v); return; }
  if (typeof valor === "object" && valor !== null) {
    yield valor;
    for (const v of Object.values(valor)) yield* objetos(v);
  }
}

function fonteComTrecho(f) {
  return typeof f === "object" && f !== null && !Array.isArray(f) &&
    ((typeof f.trecho === "string" && f.trecho.trim().length > 0 && !f.trecho.includes("[VERIFICAR]")) || f.tipo === "DECISAO_MEDICA");
}

/** A evidência pode estar no próprio item ou na regra que o contém. Objeto ativo sem nenhuma das duas continua falha. */
function* objetosComFonte(valor, herdada = false) {
  if (Array.isArray(valor)) { for (const v of valor) yield* objetosComFonte(v, herdada); return; }
  if (typeof valor === "object" && valor !== null) {
    const propria = fonteComTrecho(valor.fonte);
    yield { valor, fonteCoberta: propria || herdada };
    for (const v of Object.values(valor)) yield* objetosComFonte(v, propria || herdada);
  }
}

const contarVerificar = (valor) => {
  let n = 0;
  for (const o of objetos(valor))
    for (const v of Object.values(o))
      if (typeof v === "string" && v.includes("[VERIFICAR]")) n++;
  return n;
};

const problemas = [];
const linhas = [];
for (const arquivo of walk(CORPUS)) {
  const rel = relative(ROOT, arquivo).split("\\").join("/");
  let json;
  try {
    json = JSON.parse(readFileSync(arquivo, "utf8"));
  } catch (e) {
    problemas.push(`${rel}: JSON inválido (${e.message})`);
    linhas.push([rel, "JSON INVÁLIDO", 0, 0]);
    continue;
  }
  const rascunho=json.status==='RASCUNHO'&&json.header?.schema==='CabecalhoRascunho@1';
  const draftHeader=rascunho?CabecalhoRascunho.safeParse(json.header):null;
  const errosHeader = rascunho ? draftHeader.success ? [] : draftHeader.error.issues.map(i=>`${i.path.join('.')}: ${i.message}`)
    : json.header !== undefined ? validarHeader(json.header)
    : rel.startsWith("corpus/rulesets/") ? ["ruleset sem header"] : [];
  if(rascunho&&(json.alerta!==false||json.curadoria?.aprovacaoClinica!==null||[...objetos(json)].some(o=>o.ativo===true)))
    errosHeader.push('rascunho não pode receber aprovação, alerta ou item ativo');
  errosHeader.forEach((e) => problemas.push(`${rel}: ${e}`));

  let ativos = 0;
  for (const { valor: o, fonteCoberta } of objetosComFonte(json)) {
    if (o.ativo !== true) continue;
    ativos++;
    if (!fonteCoberta) problemas.push(`${rel}: item ativo sem fonte com trecho (ou DECISAO_MEDICA) — K-27`);
  }
  linhas.push([rel, json.header === undefined ? "—" : errosHeader.length ? "INVÁLIDO" : "ok", contarVerificar(json), ativos]);
}

verificarB1(ROOT).forEach((p) => problemas.push("B1: " + p));
verificarB2(ROOT).forEach((p) => problemas.push("B2: " + p));

const w = [Math.max(8, ...linhas.map((l) => l[0].length)), 10, 11, 6];
console.log(["ARQUIVO", "HEADER", "[VERIFICAR]", "ATIVOS"].map((h, i) => h.padEnd(w[i])).join(" | "));
console.log("-".repeat(w.reduce((a, b) => a + b + 3, 0)));
for (const l of linhas) console.log(l.map((c, i) => String(c).padEnd(w[i])).join(" | "));

if (problemas.length) {
  console.error(`\n${problemas.length} problema(s):`);
  for (const p of problemas) console.error(`  ✗ ${p}`);
  process.exit(1);
}
console.log(`\ncorpus ok (${linhas.length} arquivos)`);
