import { readFileSync, writeFileSync, readdirSync, mkdirSync, existsSync, lstatSync, realpathSync } from "node:fs";
import { resolve, relative, dirname, sep, isAbsolute } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import { scanText, sha256 } from "./phi-repo.mjs";
import { detectarPhiEstrutural } from "../src/kernel/llm/phiEstrutural.ts";

const hash = bytes => createHash("sha256").update(bytes).digest("hex");
// Revisão técnica do trecho exato em laudo-transporte, baseLegal[2].trecho:
// "domicílio feita por médico" é prosa normativa genérica, sem endereço pessoal.
// O hash cobre TODO o texto. Qualquer acréscimo perde a exceção; não altera o detector de egresso.
const ENDERECO_TRECHO_PUBLICO = new Set([
  "4127c5b7ea08602af2539aa6472d93b7b073d6812b5b709f5551a9bb17c39c26",
  // pack-penis: "pacientes aptos a seguimento" casa com a abreviação de apartamento.
  "a81e44bb0f787979da32fc83a8117e265ee2aa5a99581a4c4a278347b8736c87",
]);
const relativoSeguro = p => typeof p === "string" && !p.includes("\\") && !p.split("/").some(x => !x || x === "." || x === "..")
  && p.startsWith("corpus/") && !p.includes(":") && /\.(json|md|txt)$/.test(p);
function dentro(root, path) {
  const r = relative(root, path);
  if (isAbsolute(r) || r === ".." || r.startsWith(`..${sep}`) || resolve(root, r) !== path) throw new Error("CAMINHO_FORA_DA_RAIZ");
}
function stringsClinicas(value, contexto = "") {
  if (!value || typeof value !== "object") return [];
  return Object.entries(value).flatMap(([key, item]) => {
    const k = key.normalize("NFD").replace(/[\u0300-\u036f\W_]/g, "").toLowerCase();
    if (item === null || item === undefined) return [];
    if (typeof item === "object") return stringsClinicas(item, `${contexto}.${k}`);
    const s = String(item);
    const vazioDeModelo = /^(?:\s*|[_\s-]+|\{\{[^{}]+\}\}|\[[^\]]+\]|FATO_CONFIRMADO|CONFIG|DECISAO_MEDICA)$/.test(s);
    if (!vazioDeModelo && (/^(nomepaciente|patientname|patientid|pacienteid|nascimento|datanascimento|birthdate|dateofbirth|cpf|cns|prontuario)$/.test(k)
      || (/paciente|patient/.test(contexto) && /^(nome|name|id)$/.test(k)))) throw new Error("PHI_ESTRUTURAL_JSON");
    if (k === "sha256" && /^[a-f0-9]{64}$/.test(s)) return [];
    const rotulo = /^(endereco|address)$/.test(k) ? "Endereço" : /^(telefone|phone)$/.test(k) ? "Telefone" : null;
    return [s, ...(rotulo ? [`${rotulo}: ${s}`] : [])];
  });
}
function conferirTexto(bytes, caminho, triagem) {
  const texto = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  const pin = triagem.files?.find(f => f.path === caminho);
  const scan = scanText(texto, caminho, { manifest: triagem, sha256: sha256(bytes, pin?.hashMode ?? "raw", caminho) });
  if (scan.findings.length || scan.pending.length) throw new Error(`PHI_PENDENTE:${caminho}`);
  let json = null;
  if (caminho.endsWith(".json")) { try { json = JSON.parse(texto); } catch { throw new Error(`JSON_INVALIDO:${caminho}`); } }
  const textos = json ? stringsClinicas(json) : [texto];
  // Referências públicas podem conter links. Demais categorias exigem revisão antes de exportar.
  // Somente a categoria numérica distingue identificadores públicos de sequências pessoais.
  // Rótulos como CPF/prontuário continuam avaliados no texto ORIGINAL, mesmo usando esses dígitos.
  const semIdsPublicos = t => t.replace(/\b(?:NCT\d{8}|ISRCTN\d{8}|ACTRN\d{14}|PMID\s*\d{6,9}|PMC\d{6,9}|UMIN\d{9}|LY\d{7}|0[1-8]\d{8})\b/g, "ID_PUBLICO");
  if (textos.some(t => detectarPhiEstrutural(t).some(c => c !== "URL_OU_IP"
    && !(c === "SEQUENCIA_NUMERICA_LONGA" && !detectarPhiEstrutural(semIdsPublicos(t)).includes(c))
    && !(c === "ENDERECO" && ENDERECO_TRECHO_PUBLICO.has(hash(t)))))) throw new Error(`PHI_ESTRUTURAL:${caminho}`);
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
      if (lstatSync(path).isSymbolicLink()) throw new Error("LINK_NAO_PERMITIDO");
      if (entry.isDirectory()) { visitar(path); continue; }
      const caminho = relative(root, path).split(sep).join("/");
      if (!/\.(json|md|txt)$/.test(caminho)) {
        naoExportados.push({ caminho, motivo: "BINARIO_OU_SCRIPT_FORA_DO_ESCOPO" }); continue;
      }
      if (!relativoSeguro(caminho)) throw new Error(`CAMINHO_INVALIDO:${caminho}`);
      const bytes = readFileSync(path), { texto, json } = conferirTexto(bytes, caminho, triagem);
      arquivos.push({ caminho, bytes, metadados: { caminho, id: json?.id ?? json?.header?.id ?? null,
        versao: json?.versao ?? json?.version ?? json?.header?.versao ?? null, sha256: hash(bytes),
        estado: "RASCUNHO", consultavel: true, alerta: false,
        curadoriaOriginal: json?.status ?? json?.header?.aprovadoEm ?? null,
        fontes: json?.fontes ?? json?.fonte ?? json?.header?.fonte ?? null,
        verificar: (texto.match(/\[VERIFICAR\]|SEM_FONTE/g) ?? []).length } });
    }
  }
  visitar(resolve(root, "corpus"));
  if (!arquivos.length) throw new Error("CORPUS_VAZIO");
  const manifesto = { schema: "ExportacaoConsultaCorpus@1", escopo: "CORPUS_TEXTUAL_COMPLETO", somenteConsulta: true,
    arquivos: arquivos.map(a => a.metadados), naoExportados };
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
  const metadados = new Set(["manifesto.json", "pendencias.json", "LEIA-ME.md"]);
  for (const a of m.arquivos) {
    if (!relativoSeguro(a.caminho) || vistos.has(a.caminho)) throw new Error("CAMINHO_INVALIDO_OU_DUPLICADO");
    vistos.add(a.caminho);
    if (a.estado !== "RASCUNHO" || a.alerta !== false || a.consultavel !== true) throw new Error("ATIVACAO_NAO_PERMITIDA");
    const path = resolve(root, a.caminho); dentro(root, realpathSync(path));
    if (lstatSync(path).isSymbolicLink()) throw new Error("LINK_NAO_PERMITIDO");
    const bytes = readFileSync(path);
    if (hash(bytes) !== a.sha256) throw new Error("HASH_DIVERGENTE");
    const triagemPath = resolve(dirname(fileURLToPath(import.meta.url)), "../docs/f0-fecha/PHI-TRIAGEM.json");
    const triagemLocal = existsSync(triagemPath) ? JSON.parse(readFileSync(triagemPath, "utf8")) : { files: [] };
    conferirTexto(bytes, a.caminho, triagemLocal);
  }
  function inventariar(dir) {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const path = resolve(dir, e.name); dentro(root, realpathSync(path));
      if (lstatSync(path).isSymbolicLink()) throw new Error("LINK_NAO_PERMITIDO");
      if (e.isDirectory()) { inventariar(path); continue; }
      const rel = relative(root, path).split(sep).join("/");
      if (!vistos.has(rel) && !metadados.has(rel)) throw new Error("ARQUIVO_NAO_INVENTARIADO");
      if (metadados.has(rel)) {
        const bytes = readFileSync(path);
        // Hashes são metadados tipados; não podem introduzir texto arbitrário nesta validação.
        const texto = bytes.toString("utf8").replace(/("sha256"\s*:\s*")[a-f0-9]{64}(")/g, "$1HASH_VERIFICADO$2");
        conferirTexto(Buffer.from(texto), rel, { files: [] });
      }
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
