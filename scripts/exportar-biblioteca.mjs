import { readFileSync, writeFileSync, readdirSync, mkdirSync, existsSync, lstatSync, realpathSync } from "node:fs";
import { resolve, relative, dirname, sep, isAbsolute } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import { scanText, sha256 } from "./phi-repo.mjs";
import { detectarPhiEstrutural } from "../src/kernel/llm/phiEstrutural.ts";

const RAIZES = ["1-exames", "2-receitas", "3-laudos", "4-interacoes-contraindicacoes", "5-ctcae-acao", "6-pack-tumor", "7-orientacoes", "8-encaminhamentos",
  "rulesets", "templates", "prompts", "glossario", "f0c"];
const hash = bytes => createHash("sha256").update(bytes).digest("hex");
const relativoSeguro = p => typeof p === "string" && !p.includes("\\") && !p.split("/").some(x => !x || x === "." || x === "..")
  && /^corpus\/[a-zA-Z0-9_-]+\//.test(p) && RAIZES.includes(p.split("/")[1]) && !p.includes(":");
function dentro(root, path) {
  const r = relative(root, path);
  if (isAbsolute(r) || r === ".." || r.startsWith(`..${sep}`) || resolve(root, r) !== path) throw new Error("CAMINHO_FORA_DA_RAIZ");
}
function stringsClinicas(value) {
  if (!value || typeof value !== "object") return [];
  return Object.entries(value).flatMap(([key, item]) => typeof item === "string"
    ? /^(texto|trecho|observacao|orientacao|conteudo)$/i.test(key) ? [item] : [] : stringsClinicas(item));
}
function conferirTexto(bytes, caminho, triagem) {
  const texto = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  const pin = triagem.files?.find(f => f.path === caminho);
  const scan = scanText(texto, caminho, { manifest: triagem, sha256: sha256(bytes, pin?.hashMode ?? "raw", caminho) });
  if (scan.findings.length || scan.pending.length) throw new Error(`PHI_PENDENTE:${caminho}`);
  const json = caminho.endsWith(".json") ? JSON.parse(texto) : null;
  const textos = json ? stringsClinicas(json) : [texto];
  // Referências públicas podem conter links. Demais categorias exigem revisão antes de exportar.
  if (textos.some(t => detectarPhiEstrutural(t).some(c => c !== "URL_OU_IP"))) throw new Error(`PHI_ESTRUTURAL:${caminho}`);
  return { texto, json };
}
function novoDestino(root, destino) {
  const out = resolve(destino); const rel = relative(root, out);
  if (!rel || (!rel.startsWith(`..${sep}`) && rel !== ".." && !/^[A-Za-z]:/.test(rel))) throw new Error("DESTINO_DEVE_FICAR_FORA_DO_REPOSITORIO");
  if (existsSync(out)) throw new Error("DESTINO_JA_EXISTE");
  let pai = dirname(out);
  while (!existsSync(pai)) pai = dirname(pai);
  const destinoReal = resolve(realpathSync(pai), relative(pai, out));
  const realRel = relative(root, destinoReal);
  if (!realRel || (!isAbsolute(realRel) && realRel !== ".." && !realRel.startsWith(`..${sep}`))) throw new Error("DESTINO_DEVE_FICAR_FORA_DO_REPOSITORIO");
  return out;
}

/** Snapshot para consulta/curadoria manual. Nenhum item exportado recebe autorização de alerta. */
export function exportarBiblioteca(rootDir, destino) {
  const root = realpathSync(rootDir), out = novoDestino(root, destino);
  const triagemPath = resolve(root, "docs/f0-fecha/PHI-TRIAGEM.json");
  const triagem = existsSync(triagemPath) ? JSON.parse(readFileSync(triagemPath, "utf8")) : { files: [] };
  const arquivos = [];
  function visitar(dir) {
    if (lstatSync(dir).isSymbolicLink()) throw new Error("LINK_NAO_PERMITIDO");
    for (const entry of readdirSync(dir, { withFileTypes: true }).sort((a,b) => a.name.localeCompare(b.name))) {
      const path = resolve(dir, entry.name); dentro(root, realpathSync(path));
      if (lstatSync(path).isSymbolicLink()) throw new Error("LINK_NAO_PERMITIDO");
      if (entry.isDirectory()) { visitar(path); continue; }
      const caminho = relative(root, path).split(sep).join("/");
      if (!relativoSeguro(caminho) || !/\.(json|md|txt)$/.test(caminho)) throw new Error(`FORMATO_NAO_VERIFICADO:${caminho}`);
      const bytes = readFileSync(path), { texto, json } = conferirTexto(bytes, caminho, triagem);
      arquivos.push({ caminho, bytes, metadados: { caminho, id: json?.id ?? json?.header?.id ?? null,
        versao: json?.versao ?? json?.version ?? json?.header?.versao ?? null, sha256: hash(bytes),
        estado: "RASCUNHO", consultavel: true, alerta: false,
        curadoriaOriginal: json?.status ?? json?.header?.aprovadoEm ?? null,
        fontes: json?.fontes ?? json?.fonte ?? json?.header?.fonte ?? null,
        verificar: (texto.match(/\[VERIFICAR\]|SEM_FONTE/g) ?? []).length } });
    }
  }
  for (const p of RAIZES) { const dir = resolve(root, "corpus", p); if (existsSync(dir)) visitar(dir); }
  if (!arquivos.length) throw new Error("CORPUS_VAZIO");
  const manifesto = { schema: "ExportacaoConsultaCorpus@1", somenteConsulta: true, arquivos: arquivos.map(a => a.metadados) };
  // A validação termina antes de criar o destino. Não deixa pacote parcialmente validado.
  for (const a of arquivos) { const path = resolve(out, a.caminho); dentro(out, path); mkdirSync(dirname(path), { recursive: true }); writeFileSync(path, a.bytes); }
  writeFileSync(resolve(out, "manifesto.json"), JSON.stringify(manifesto, null, 2) + "\n");
  writeFileSync(resolve(out, "pendencias.json"), JSON.stringify({ itens: manifesto.arquivos.filter(a => a.verificar || !a.fontes).map(a =>
    ({ caminho: a.caminho, semFonteNaRaiz: !a.fontes, verificar: a.verificar })),
    externas: ["F1-B2 aguarda planilha SISAC", "Conflitos de decisão exigem revisão médica", "Genspark sem sincronização por API"] }, null, 2) + "\n");
  writeFileSync(resolve(out, "LEIA-ME.md"), "# Biblioteca para consulta e curadoria manual\n\nSnapshot de arquivos, sem ativação e sem transmissão de rede. Todos entram como RASCUNHO, alerta=false. Campos sem fonte/versão permanecem nulos. A fonte interna de um item pode existir mesmo quando a raiz do arquivo não possui fonte.\n\nA volta deve usar validarPacoteConsulta antes de staging local. Este formato preserva os schemas originais; não é PacoteBiblioteca@1 e não pode ser enviado diretamente à rota /biblioteca/importar. Conversão em item executável exige contrato, fonte e aprovação médica individual.\n");
  return { destino: out, arquivos: arquivos.length };
}

/** Verifica bytes e estado antes de qualquer revisão/importação; não toca o ledger nem ativa regras. */
export function validarPacoteConsulta(diretorio) {
  const root = realpathSync(diretorio), m = JSON.parse(readFileSync(resolve(root, "manifesto.json"), "utf8"));
  if (m.schema !== "ExportacaoConsultaCorpus@1" || m.somenteConsulta !== true || !Array.isArray(m.arquivos) || !m.arquivos.length) throw new Error("MANIFESTO_INVALIDO");
  const vistos = new Set();
  for (const a of m.arquivos) {
    if (!relativoSeguro(a.caminho) || vistos.has(a.caminho)) throw new Error("CAMINHO_INVALIDO_OU_DUPLICADO");
    vistos.add(a.caminho);
    if (a.estado !== "RASCUNHO" || a.alerta !== false || a.consultavel !== true) throw new Error("ATIVACAO_NAO_PERMITIDA");
    const path = resolve(root, a.caminho); dentro(root, realpathSync(path));
    if (lstatSync(path).isSymbolicLink()) throw new Error("LINK_NAO_PERMITIDO");
    const bytes = readFileSync(path);
    if (hash(bytes) !== a.sha256) throw new Error("HASH_DIVERGENTE");
    conferirTexto(bytes, a.caminho, { files: [] });
  }
  return { arquivos: vistos.size, estado: "RASCUNHO", alerta: false };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const destino = process.argv[2]; if (!destino) throw new Error("DESTINO_OBRIGATORIO");
    console.log(JSON.stringify(exportarBiblioteca(resolve(dirname(fileURLToPath(import.meta.url)), ".."), destino)));
  } catch (e) { console.error(e instanceof Error ? e.message : "EXPORTACAO_RECUSADA"); process.exitCode = 1; }
}
