// GLM-08 · Valida o corpus inteiro: headers (G-17, validação equivalente em JS ao RulesetHeader de src/contracts),
// contagem de [VERIFICAR] e itens ativos por arquivo, e a invariante K-27: ativo sem fonte com trecho (ou DECISAO_MEDICA) => exit 1.
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const CORPUS = join(ROOT, "corpus");
const TIPOS = ["DECISAO_MEDICA", "DIRETRIZ", "NORMA", "LITERATURA"];
const SEMVER = /^\d+\.\d+\.\d+$/;
const DATA = /^\d{4}-\d{2}-\d{2}$/;

const walk = (d) => {
  const saida = [];
  for (const f of readdirSync(d).sort()) {
    const p = join(d, f);
    statSync(p).isDirectory() ? saida.push(...walk(p)) : f.endsWith(".json") && saida.push(p);
  }
  return saida;
};

/** Equivalente JS do RulesetHeader (src/contracts/agentes.ts) — mantido em paralelo até existir build TS importável. */
const validarHeader = (h) => {
  if (typeof h !== "object" || h === null) return ["header não é objeto"];
  const erros = [];
  if (typeof h.id !== "string" || h.id.length === 0) erros.push("header.id vazio");
  if (typeof h.versao !== "string" || !SEMVER.test(h.versao)) erros.push("header.versao fora do semver");
  for (const c of ["vigenteDesde", "aprovadoEm"]) if (typeof h[c] !== "string" || !DATA.test(h[c])) erros.push(`header.${c} não é data YYYY-MM-DD`);
  if (typeof h.curador !== "string" || h.curador.length === 0) erros.push("header.curador vazio");
  const f = h.fonte;
  if (typeof f !== "object" || f === null || Array.isArray(f)) return [...erros, "header.fonte ausente ou inválida"];
  if (!TIPOS.includes(f.tipo)) erros.push("header.fonte.tipo fora do enum");
  if (typeof f.referencia !== "string" || f.referencia.length === 0) erros.push("header.fonte.referencia vazia");
  if (f.trecho !== null && typeof f.trecho !== "string") erros.push("header.fonte.trecho inválido");
  if (f.edicao !== null && typeof f.edicao !== "string") erros.push("header.fonte.edicao inválida");
  if (TIPOS.includes(f.tipo) && f.tipo !== "DECISAO_MEDICA" && !f.trecho)
    erros.push("fonte externa exige trecho que sustente a regra (K-27)");
  return erros;
};

function* objetos(valor) {
  if (Array.isArray(valor)) { for (const v of valor) yield* objetos(v); return; }
  if (typeof valor === "object" && valor !== null) {
    yield valor;
    for (const v of Object.values(valor)) yield* objetos(v);
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
  const errosHeader = json.header !== undefined ? validarHeader(json.header) : [];
  errosHeader.forEach((e) => problemas.push(`${rel}: ${e}`));

  let ativos = 0;
  for (const o of objetos(json)) {
    if (o.ativo !== true) continue;
    ativos++;
    const f = o.fonte;
    const fonteOk = typeof f === "object" && f !== null && !Array.isArray(f) &&
      ((typeof f.trecho === "string" && f.trecho !== "[VERIFICAR]") || f.tipo === "DECISAO_MEDICA");
    if (!fonteOk) problemas.push(`${rel}: item ativo sem fonte com trecho (ou DECISAO_MEDICA) — K-27`);
  }
  linhas.push([rel, json.header === undefined ? "—" : errosHeader.length ? "INVÁLIDO" : "ok", contarVerificar(json), ativos]);
}

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
