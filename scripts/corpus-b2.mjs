// F1-B2 · Validador do manifesto corpus/manifesto/b2-fichas.v1.json (D-F1-49).
// Confere: identidade, hash canônico (sem hash/status), RASCUNHO, citação da decisão, cobertura de
// TODOS os itens pelo manifesto (localizador estável = droga+dias), proveniência por campo
// (DOCUMENTADO exige sourceId existente com URL+sha256; NAO_LOCALIZADO exige valor null), marcador
// D-F1-49 presente nas alteradas e nenhuma ficha "solta" citando D-F1-49 fora do manifesto.
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";

const RAIZ = new URL("..", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");

function canonico(v) {
  if (Array.isArray(v)) return `[${v.map(canonico).join(",")}]`;
  if (v && typeof v === "object") return `{${Object.keys(v).sort().map((k) => `${JSON.stringify(k)}:${canonico(v[k])}`).join(",")}}`;
  return JSON.stringify(v);
}
const hashDe = (t) => { const { hash: _h, status: _s, ...resto } = t; return createHash("sha256").update(canonico(resto), "utf8").digest("hex"); };
const chaveDe = (i) => `itens[drug=${i.drug};classe=${i.classe};days=${i.days.join(",")}].standardDose`;
const listar = (d) => readdirSync(d).sort().flatMap((f) => { const p = join(d, f); return statSync(p).isDirectory() ? listar(p) : f.endsWith(".json") ? [p] : []; });

export function verificarB2(root = RAIZ) {
  const problemas = [];
  const m = JSON.parse(readFileSync(join(root, "corpus/manifesto/b2-fichas.v1.json"), "utf8"));
  if (m.decisao !== "D-F1-49" || !Array.isArray(m.fichasNovas) || !Array.isArray(m.fichasAlteradas) || typeof m.fontesExternas !== "object") {
    problemas.push("manifesto inválido (decisão/estrutura)"); return problemas;
  }
  const fontes = { ...(m.fontesExternas ?? {}), ...(m.materiaisLocais ?? {}) };
  for (const [id, f] of Object.entries(m.fontesExternas ?? {})) {
    if (!/^[a-f0-9]{64}$/.test(f.sha256 ?? "") || !/^https?:\/\//.test(f.url ?? "") || !f.instituicao || !f.titulo) problemas.push(`fonte externa incompleta: ${id}`);
  }
  for (const [id, f] of Object.entries(m.materiaisLocais ?? {})) {
    if (!/^[a-f0-9]{64}$/.test(f.sha256 ?? "") || !f.localizador || !f.instituicao || !f.titulo) problemas.push(`material local incompleto: ${id}`);
  }
  const vistos = new Set();
  for (const f of m.fichasNovas) {
    const path = join(root, f.arquivo);
    let json; try { json = JSON.parse(readFileSync(path, "utf8")); } catch { problemas.push(`arquivo ilegível: ${f.arquivo}`); continue; }
    if (json.templateId !== f.templateId || json.versao !== f.versao) problemas.push(`identidade divergente: ${f.arquivo}`);
    if (json.status !== "RASCUNHO") problemas.push(`ficha B2 não-RASCUNHO: ${f.arquivo}`);
    if (hashDe(json) !== json.hash || json.hash !== f.hash) problemas.push(`hash divergente: ${f.arquivo}`);
    if (!json.fonte.includes("D-F1-49")) problemas.push(`sem citação de D-F1-49 na fonte: ${f.arquivo}`);
    const chaves = new Set(f.campos.map((c) => c.campo));
    for (const i of json.itens) if (!chaves.has(chaveDe(i))) problemas.push(`item sem campo no manifesto: ${f.arquivo}: ${chaveDe(i)}`);
    if (chaves.size !== f.campos.length || new Set(json.itens.map(chaveDe)).size !== json.itens.length) problemas.push(`localizador duplicado: ${f.arquivo}`);
    for (const c of f.campos) {
      const alvos = json.itens.filter(i => chaveDe(i) === c.campo);
      if (alvos.length !== 1 || alvos[0].standardDose !== c.valor || alvos[0].unit !== c.unidade) problemas.push(`valor/localizador divergente do manifesto: ${f.arquivo}: ${c.campo}`);
      if (c.situacao === "NAO_LOCALIZADO") {
        if (c.valor !== null) problemas.push(`NAO_LOCALIZADO com dose: ${f.arquivo}: ${c.campo}`);
        continue;
      }
      if (c.situacao === "PADRAO_LOCAL") continue;
      const alvo = json.itens.find((i) => chaveDe(i) === c.campo);
      if (!alvo || alvo.standardDose !== c.valor || alvo.unit !== c.unidade) problemas.push(`valor divergente do manifesto: ${f.arquivo}: ${c.campo}`);
      if (c.situacao === "DOCUMENTADO") {
        if (!c.sourceIds?.length) problemas.push(`DOCUMENTADO sem fonte: ${f.arquivo}: ${c.campo}`);
        for (const s of c.sourceIds ?? []) if (!fontes[s]) problemas.push(`sourceId desconhecido: ${f.arquivo}: ${s}`);
      }
      if (c.situacao === "DOCUMENTADO_POR_DECISAO_LOCAL" && !c.decisaoLocal) problemas.push(`sem decisão local: ${f.arquivo}: ${c.campo}`);
    }
    vistos.add(f.arquivo);
  }
  const alteradas = new Set(m.fichasAlteradas.map((a) => a.caminho));
  for (const p of listar(join(root, "corpus/fichas"))) {
    const rel = relative(root, p).split(sep).join("/");
    if (vistos.has(rel) || alteradas.has(rel)) continue;
    if (readFileSync(p, "utf8").includes("D-F1-49")) problemas.push(`ficha cita D-F1-49 fora do manifesto B2: ${rel}`);
  }
  // fichaId dos 6 packs B2 deve resolver para uma ficha existente (tumor do pack = pasta da ficha)
  const conhecidos = new Set(vistos);
  const SLUG_FICHA = { ewing: "ewing", osteossarcoma: "osteossarcoma", "cec-pele": "cec-de-pele-cutaneo", ntg: "neoplasia-trofoblastica-gestacional", vulva: "vulva", cup: "primario-desconhecido-cup" };
  for (const slug of Object.keys(SLUG_FICHA)) {
    const pack = JSON.parse(readFileSync(join(root, `corpus/6-pack-tumor/${slug}/pack-${slug}.v2.RASCUNHO.json`), "utf8"));
    if (pack.status !== "RASCUNHO" || pack.consultavel !== true || pack.alerta !== false) problemas.push(`pack ${slug} fora do estado RASCUNHO/consultável/não-alerta`);
    if (pack.curadoria?.aprovacaoClinica !== null) problemas.push(`pack ${slug} com aprovacaoClinica não-nula`);
    if(pack.header?.schema!=='CabecalhoRascunho@1'||pack.header.curador!==null||pack.header.aprovadoEm!==null)problemas.push(`pack ${slug} atribui aprovação indevida ao rascunho`);
    for (const proto of pack.tratamento?.protocolos ?? []) {
      if (proto.fichaId === null || proto.fichaId === undefined) continue;
      const alvo = join(root, "corpus/fichas", SLUG_FICHA[slug]);
      const existe = listar(alvo).some((f) => JSON.parse(readFileSync(f, "utf8")).templateId === proto.fichaId);
      if (!existe) problemas.push(`pack ${slug}: fichaId não resolvido: ${proto.fichaId}`);
    }
  }
  for (const a of m.fichasAlteradas) {
    let json; try { json = JSON.parse(readFileSync(join(root, a.caminho), "utf8")); } catch { problemas.push(`alterada ilegível: ${a.caminho}`); continue; }
    if (json.templateId !== a.templateId || hashDe(json) !== json.hash) problemas.push(`alterada com hash/identidade divergente: ${a.caminho}`);
    if (!json.fonte.includes("D-F1-49")) problemas.push(`alterada sem marco F1-B2 na fonte: ${a.caminho}`);
  }
  return problemas;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const problemas = verificarB2(RAIZ);
  if (problemas.length) { for (const p of problemas) console.error(`B2 ✗ ${p}`); process.exit(1); }
  console.log("B2 ok");
}
