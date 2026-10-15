import { readFileSync, writeFileSync, readdirSync, mkdirSync, existsSync, lstatSync, realpathSync } from "node:fs";
import { resolve, relative, dirname, sep, isAbsolute } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import { scanText, sha256 } from "./phi-repo.mjs";
import { detectarPhiEstrutural } from "../src/kernel/llm/phiEstrutural.ts";

const hash = bytes => createHash("sha256").update(bytes).digest("hex");
function parseJsonUnico(texto) {
  let valor;
  try { valor = JSON.parse(texto); } catch { throw new Error("JSON_INVALIDO"); }
  // JSON.parse aceita chaves repetidas e apaga o primeiro valor, que poderia conter identidade.
  const tokens = texto.match(/"(?:\\.|[^"\\])*"|[{}\[\]:,]|-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?|true|false|null/g) ?? [];
  const pilha = [];
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    if (t === "{") pilha.push(new Set());
    else if (t === "[") pilha.push(null);
    else if (t === "}" || t === "]") pilha.pop();
    else if (t.startsWith('"') && tokens[i + 1] === ":") {
      const chaves = pilha.at(-1), chave = JSON.parse(t);
      if (!chaves || chaves.has(chave)) throw new Error("JSON_CHAVE_DUPLICADA");
      chaves.add(chave);
    }
  }
  return valor;
}
const LEIA_ME = "# Biblioteca para consulta e curadoria manual\n\nSnapshot de arquivos, sem ativação e sem transmissão de rede. Todos entram como RASCUNHO, alerta=false. Campos sem fonte/versão permanecem nulos. A fonte interna de um item pode existir mesmo quando a raiz do arquivo não possui fonte.\n\nA volta deve usar validarPacoteConsulta antes de staging local. Este formato preserva os schemas originais; não é PacoteBiblioteca@1 e não pode ser enviado diretamente à rota /biblioteca/importar. Conversão em item executável exige contrato, fonte e aprovação médica individual.\n";
const canonico = value => JSON.stringify(value, (_key, v) => v && typeof v === "object" && !Array.isArray(v)
  ? Object.fromEntries(Object.keys(v).sort().map(k => [k, v[k]])) : v);
const metadadosArquivo = (caminho, bytes, texto, json) => ({ caminho, id: json?.id ?? json?.header?.id ?? null,
  versao: json?.versao ?? json?.version ?? json?.header?.versao ?? null, sha256: hash(bytes),
  estado: "RASCUNHO", consultavel: true, alerta: false, curadoriaOriginal: json?.curadoria?.estado ?? json?.status ?? null,
  fontes: json?.fontes ?? json?.fonte ?? json?.header?.fonte ?? null, verificar: (texto.match(/\[VERIFICAR\]|SEM_FONTE/g) ?? []).length });
const pendenciasDoManifesto = m => ({ itens: m.arquivos.filter(a => a.verificar || !a.fontes).map(a =>
  ({ caminho: a.caminho, semFonteNaRaiz: !a.fontes, verificar: a.verificar })),
  externas: ["F1-B2 aguarda planilha SISAC", "Conflitos de decisão exigem revisão médica", "Genspark sem sincronização por API"] });
// Revisão técnica de textos integrais, com localizador e motivo. Pacotes recebidos não fornecem exceções.
const triagemPublica = JSON.parse(readFileSync(new URL("./exportacao-publica-triagem.json", import.meta.url), "utf8"));
const categoriasPublicas = new Map(triagemPublica.itens.map(i => [`${i.arquivo}|${i.campo}|${i.sha256}`, new Set(i.categorias)]));
const relativoSeguro = p => typeof p === "string" && !p.includes("\\") && !p.split("/").some(x => !x || x === "." || x === "..")
  && p.startsWith("corpus/") && !p.includes(":") && /\.(json|md|txt)$/.test(p);
const normalizarChave = chave => chave.normalize("NFD").replace(/[\u0300-\u036f\W_]/g, "").toLowerCase();
function chaveDeIdentidade(chave) {
  const k = normalizarChave(chave);
  return /(?:prontuario|medicalrecord|patientrecord|cpf|cns|cartaosus|cartaonacional|nascimento|birthdate|dateofbirth|endereco|address|telefone|phone)/.test(k)
    || /^(?:(?:numero|num|nro|id)(?:do|da)?)?(?:rg|nis|pis)(?:(?:do|da)?(?:paciente|patient))?$/.test(k)
    || /^(?:(?:dados|data|cadastro|identificacao|identification|demografia|demographics)(?:do|da|of)?)?(?:pacientes?|patients?)$/.test(k)
    || /(?:(?:nome|name|identificador|identifier|numero|number|id).*(?:paciente|patient)|(?:paciente|patient).*(?:nome|name|identificador|identifier|numero|number|id))/.test(k);
}
function conferirCaminhoPublico(caminho) {
  for (const componente of caminho.split("/")) {
    const legivel = componente.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[_-]/g, " ");
    // Nome fixo do modelo público do serviço; conteúdo e hash continuam sob os demais filtros.
    const rotulo = componente === "resumo-prontuario-modelo-servico.v1.RASCUNHO.json" ? "MODELO_PUBLICO" : componente;
    if (chaveDeIdentidade(rotulo)
      || /\b(?:paciente|patient|nome\s*(?:completo\s*)?(?:do\s*)?paciente|(?:full\s*)?patient\s*(?:full\s*)?name)\s+/i.test(legivel)
      || /\b(?:prontuario|cpf|cns|patientid|pacienteid)\s*[: .]?\s*\d/i.test(legivel)
      || scanText(componente.replace(/^[A-Z0-9._-]+@\d+\.\d+\.\d+\.md$/, "PROMPT_VERSIONADO"), "caminho.txt", { manifest: {files:[]} }).findings.length)
      throw new Error("PHI_CAMINHO");
  }
}
function dentro(root, path) {
  const r = relative(root, path);
  if (isAbsolute(r) || r === ".." || r.startsWith(`..${sep}`) || resolve(root, r) !== path) throw new Error("CAMINHO_FORA_DA_RAIZ");
}
function stringsClinicas(value, contexto = "", caminho = "") {
  if (typeof value === "string") return [{ texto: value, campo: caminho || "$raiz" }];
  if (!value || typeof value !== "object") return [];
  const chaves = Array.isArray(value) ? [] : Object.keys(value).map(key => ({ texto: key, campo: `${caminho}.$chave:${key}` }));
  return chaves.concat(Object.entries(value).flatMap(([key, item]) => {
    const k = normalizarChave(key);
    if (item === null || item === undefined) return [];
    const identidade = chaveDeIdentidade(key)
      || (/(?:^|\.)(?:pacientes?|patients?)(?:\.|$)/.test(contexto) && /^(nome|name|id)$/.test(k));
    // O rótulo não pode desaparecer ao entrar em um objeto/array (ex.: patientId: [valor]).
    if (typeof item === "object") {
      if (identidade) throw new Error("PHI_ESTRUTURAL_JSON");
      return stringsClinicas(item, `${contexto}.${k}`, `${caminho}.${key}`);
    }
    const s = String(item);
    // Colchetes/chaves não provam placeholder: podem envolver um identificador real.
    const vazioDeModelo = /^[\s_-]*$/.test(s);
    if (!vazioDeModelo && identidade) throw new Error("PHI_ESTRUTURAL_JSON");
    // Medidas/contagens numéricas são dados tipados; IDs pessoais numéricos foram recusados acima.
    // O scanner bruto continua conferindo CPF/CNS/telefone no arquivo inteiro.
    if (typeof item !== "string") return [];
    if (/^(sha256|hash|contenthash)$/.test(k) && /^(?:[a-f0-9]{40}|[a-f0-9]{64})$/.test(s)) return [];
    if (k === "codigoibge" && /^\d{7}$/.test(s)) return []; // Identificador do município, não de pessoa.
    const rotulo = /^(endereco|address)$/.test(k) ? "Endereço" : /^(telefone|phone)$/.test(k) ? "Telefone" : null;
    return [{ texto: s, campo: `${caminho}.${key}` }, ...(rotulo ? [{ texto: `${rotulo}: ${s}`, campo: `${caminho}.${key}` }] : [])];
  }));
}
function conferirTexto(bytes, caminho, triagem) {
  const texto = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  const pin = triagem.files?.find(f => f.path === caminho);
  const scan = scanText(texto, caminho, { manifest: triagem, sha256: sha256(bytes, pin?.hashMode ?? "raw", caminho) });
  if (scan.findings.length || scan.pending.length) throw new Error(`PHI_PENDENTE:${caminho}`);
  let json = null;
  if (caminho.endsWith(".json")) json = parseJsonUnico(texto);
  let textos;
  try { textos = caminho.endsWith(".json") ? stringsClinicas(json) : [{ texto, campo: "$texto" }]; }
  catch { throw new Error(`PHI_ESTRUTURAL_JSON:${caminho}`); }
  // Referências públicas podem conter links. Demais categorias exigem revisão antes de exportar.
  // Somente a categoria numérica distingue identificadores públicos de sequências pessoais.
  // Rótulos como CPF/prontuário continuam avaliados no texto ORIGINAL, mesmo usando esses dígitos.
  const semIdsPublicos = t => t
    // Nome legado de campo de curadoria (data da revisão), conferido nos dez packs que o utilizam.
    .replace(/^reducaoPendencias20261011$/, "REVISAO_CORPUS")
    .replace(/\b(?:[0-9a-f]{64}|[0-9a-f]{40})\b/gi, "HASH_REFERENCIA")
    .replace(/\b(?:PMID|PubMed)\s*:?\s*\d{6,9}(?:,\s*\d{6,9})*/g, "REFERENCIAS_PUBMED")
    .replace(/\b(?:NCT\d{8}|ISRCTN\d{8}|ACTRN\d{14}|(?:PMID|PubMed)\s*:?\s*\d{6,9}|PMC\d{6,9}|UMIN\d{9}|LY\d{7}|CNES\s*\d{7}|0[1-8]\d{8})\b/g, "ID_PUBLICO")
    .replace(/\b[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}\b/gi, "UUID_REFERENCIA")
    .replace(/https:\/\/(?:pubmed\.ncbi\.nlm\.nih\.gov|dailymed\.nlm\.nih\.gov|api\.fda\.gov|www\.gov\.br|www\.in\.gov\.br|oncologypro\.esmo\.org|ninho\.inca\.gov\.br)\/[^\s<>]+/g, "REFERENCIA_PUBLICA")
    .replace(/\b10\.\d{4,9}\/[^\s<>]+/g, "DOI_REFERENCIA")
    .replace(/\b(?:TabelaUnificada_\d{6}_v\d{10}\.zip|20\d{2}-\d{2}\.v\d{10}\.f0c-\d+)\b/g, "VERSAO_SIGTAP");
  if (textos.some(({ texto: t, campo }) => detectarPhiEstrutural(t).some(c => c !== "URL_OU_IP"
    && !(c === "SEQUENCIA_NUMERICA_LONGA" && !detectarPhiEstrutural(semIdsPublicos(t)).includes(c))
    && !categoriasPublicas.get(`${caminho}|${campo}|${hash(t)}`)?.has(c)))) throw new Error(`PHI_ESTRUTURAL:${caminho}`);
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
  const arquivos = [], naoExportados = [];
  function visitar(dir) {
    if (lstatSync(dir).isSymbolicLink()) throw new Error("LINK_NAO_PERMITIDO");
    for (const entry of readdirSync(dir, { withFileTypes: true }).sort((a,b) => a.name.localeCompare(b.name))) {
      const path = resolve(dir, entry.name); dentro(root, realpathSync(path));
      conferirCaminhoPublico(relative(root, path).split(sep).join("/"));
      if (lstatSync(path).isSymbolicLink()) throw new Error("LINK_NAO_PERMITIDO");
      if (entry.isDirectory()) { visitar(path); continue; }
      const caminho = relative(root, path).split(sep).join("/");
      if (!/\.(json|md|txt)$/.test(caminho)) {
        naoExportados.push({ caminho, motivo: "BINARIO_OU_SCRIPT_FORA_DO_ESCOPO" }); continue;
      }
      if (!relativoSeguro(caminho)) throw new Error(`CAMINHO_INVALIDO:${caminho}`);
      const bytes = readFileSync(path), { texto, json } = conferirTexto(bytes, caminho, triagem);
      arquivos.push({ caminho, bytes, metadados: metadadosArquivo(caminho, bytes, texto, json) });
    }
  }
  visitar(resolve(root, "corpus"));
  if (!arquivos.length) throw new Error("CORPUS_VAZIO");
  const manifesto = { schema: "ExportacaoConsultaCorpus@1", escopo: "CORPUS_TEXTUAL_COMPLETO", somenteConsulta: true,
    arquivos: arquivos.map(a => a.metadados), naoExportados };
  // A validação termina antes de criar o destino. Não deixa pacote parcialmente validado.
  for (const a of arquivos) { const path = resolve(out, a.caminho); dentro(out, path); mkdirSync(dirname(path), { recursive: true }); writeFileSync(path, a.bytes); }
  writeFileSync(resolve(out, "manifesto.json"), JSON.stringify(manifesto, null, 2) + "\n");
  writeFileSync(resolve(out, "pendencias.json"), JSON.stringify(pendenciasDoManifesto(manifesto), null, 2) + "\n");
  writeFileSync(resolve(out, "LEIA-ME.md"), LEIA_ME);
  return { destino: out, arquivos: arquivos.length };
}

/** Verifica bytes e estado antes de qualquer revisão/importação; não toca o ledger nem ativa regras. */
export function validarPacoteConsulta(diretorio) {
  const root = realpathSync(diretorio), m = parseJsonUnico(readFileSync(resolve(root, "manifesto.json"), "utf8"));
  if (m.schema !== "ExportacaoConsultaCorpus@1" || m.escopo !== "CORPUS_TEXTUAL_COMPLETO" || m.somenteConsulta !== true
    || !Array.isArray(m.arquivos) || !m.arquivos.length || !Array.isArray(m.naoExportados)
    || Object.keys(m).sort().join() !== ["schema", "escopo", "somenteConsulta", "arquivos", "naoExportados"].sort().join()) throw new Error("MANIFESTO_INVALIDO");
  const vistos = new Set();
  const metadados = new Set(["manifesto.json", "pendencias.json", "LEIA-ME.md"]);
  for (const a of m.arquivos) {
    if (!relativoSeguro(a.caminho) || vistos.has(a.caminho)) throw new Error("CAMINHO_INVALIDO_OU_DUPLICADO");
    conferirCaminhoPublico(a.caminho);
    vistos.add(a.caminho);
    if (a.estado !== "RASCUNHO" || a.alerta !== false || a.consultavel !== true) throw new Error("ATIVACAO_NAO_PERMITIDA");
    const path = resolve(root, a.caminho); dentro(root, realpathSync(path));
    if (lstatSync(path).isSymbolicLink()) throw new Error("LINK_NAO_PERMITIDO");
    const bytes = readFileSync(path);
    if (hash(bytes) !== a.sha256) throw new Error("HASH_DIVERGENTE");
    const triagemPath = resolve(dirname(fileURLToPath(import.meta.url)), "../docs/f0-fecha/PHI-TRIAGEM.json");
    const triagemLocal = existsSync(triagemPath) ? JSON.parse(readFileSync(triagemPath, "utf8")) : { files: [] };
    const { texto, json } = conferirTexto(bytes, a.caminho, triagemLocal);
    // Metadados são derivados dos bytes já escaneados, nunca uma superfície de texto arbitrário.
    if (canonico(a) !== canonico(metadadosArquivo(a.caminho, bytes, texto, json))) throw new Error("METADADOS_DIVERGENTES");
  }
  for (const e of m.naoExportados) if (!e || Object.keys(e).sort().join() !== "caminho,motivo" || e.motivo !== "BINARIO_OU_SCRIPT_FORA_DO_ESCOPO"
    || typeof e.caminho !== "string" || !e.caminho.startsWith("corpus/") || e.caminho.includes("\\") || e.caminho.includes(":")
    || e.caminho.split("/").some(p => !p || p === "." || p === "..") || /\.(json|md|txt)$/.test(e.caminho)) throw new Error("EXCLUSOES_INVALIDAS");
  const exclusoes = JSON.stringify(m.naoExportados).replace(/TabelaUnificada_\d{6}_v\d{10}\.zip/g, "FONTE_SIGTAP.zip");
  for (const e of m.naoExportados) conferirCaminhoPublico(e.caminho);
  conferirTexto(Buffer.from(exclusoes), "exclusoes.json", { files: [] });
  if (canonico(parseJsonUnico(readFileSync(resolve(root, "pendencias.json"), "utf8"))) !== canonico(pendenciasDoManifesto(m))) throw new Error("PENDENCIAS_DIVERGENTES");
  if (readFileSync(resolve(root, "LEIA-ME.md"), "utf8") !== LEIA_ME) throw new Error("INSTRUCOES_DIVERGENTES");
  function inventariar(dir) {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const path = resolve(dir, e.name); dentro(root, realpathSync(path));
      if (lstatSync(path).isSymbolicLink()) throw new Error("LINK_NAO_PERMITIDO");
      if (e.isDirectory()) { inventariar(path); continue; }
      const rel = relative(root, path).split(sep).join("/");
      if (!vistos.has(rel) && !metadados.has(rel)) throw new Error("ARQUIVO_NAO_INVENTARIADO");
    }
  }
  inventariar(root);
  return { arquivos: vistos.size, estado: "RASCUNHO", alerta: false };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const destino = process.argv[2]; if (!destino) throw new Error("DESTINO_OBRIGATORIO");
    console.log(JSON.stringify(exportarBiblioteca(resolve(dirname(fileURLToPath(import.meta.url)), ".."), destino)));
  } catch (e) { console.error(e instanceof Error ? e.message : "EXPORTACAO_RECUSADA"); process.exitCode = 1; }
}
