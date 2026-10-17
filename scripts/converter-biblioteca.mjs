// F1-N · Ponte ExportacaoConsultaCorpus@1 → PacoteBiblioteca@1 (adendo ao eixo N, 2026-10-14).
// Uso: node scripts/converter-biblioteca.mjs <diretorio-snapshot> <destino> [--mapeamento arquivo.json] [--id-pacote id] [--versao x.y.z]
// Regras: unidade = arquivo; tipo = REFERENCIA (fixo); proveniência/URL/data só com evidência (verificada no mapeamento);
// aplicabilidade desconhecida NÃO vira lista vazia; staging isolado — o destino só nasce válido e completo.
// Importação nunca é ativação: o conversor apenas prova que o pacote passa pelo importador real (criarBiblioteca().importarPacote).
import { readFileSync, writeFileSync, mkdirSync, existsSync, rmSync, renameSync } from "node:fs";
import { resolve, dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import { validarPacoteConsulta } from "./exportar-biblioteca.mjs";

// Mesmo algoritmo de sha256Biblioteca (src/kernel/corpus/biblioteca.ts) — reimplementado aqui para não
// importar o módulo TS no topo do arquivo: biblioteca.ts importa './phiEstrutural.js', que só resolve
// sob vitest/esbuild. O import real de criarBiblioteca é dinâmico e, no CLI, precedido de registerHooks.
const sha256Biblioteca = (bytes) => createHash("sha256").update(bytes, "utf8").digest("hex");

const LIMITE_TEXTO_ITEM = 200_000; // ItemBiblioteca@1: texto max 200000
const LIMITE_BYTES_ITEM = 1_000_000; // importador interno: ITEM_EXCESSIVO
const LIMITE_BYTES_CONTEUDOS = 8_000_000; // importador HTTP: PACOTE_EXCESSIVO
const LIMITE_BODY_ROTEADOR = 1_000_000; // rotas.ts body(): unidades de string do corpo
const LICENCA_DECLARATIVA = "Uso interno do serviço OncoGlobal; sem licença de redistribuição verificada";
const PASTA = dirname(fileURLToPath(import.meta.url));
const LEIA_ME = [
  "# PacoteBiblioteca@1 convertido do snapshot de consulta",
  "",
  "Gerado por scripts/converter-biblioteca.mjs a partir de um snapshot ExportacaoConsultaCorpus@1 validado.",
  "Itens incluídos têm proveniência com URL verificada e escopo explícito. Arquivos com fontes distintas exigem seção mapeada; o inventário registra a conversão parcial e fontes não convertidas.",
  "",
  "Importação NÃO é ativação: todos os itens entram como RASCUNHO e a curadoria é item a item.",
  "Pela rota HTTP: POST /biblioteca/importar com o conteúdo de pacote-http.json ({manifesto, arquivos}).",
  "Pela API interna: criarBiblioteca(db, portas).importarPacote(manifesto, lerArquivo).",
  "Curar como CONSULTAVEL (ALERTA é recusado no HTTP, inclusive para REGRA) e então ativar.",
  "",
].join("\n");

const slug = (s) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const ehData = (s) => typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s);
const ehSemver = (s) => typeof s === "string" && /^\d+\.\d+\.\d+$/.test(s);

/** Primeira fonte interna (varredura em profundidade, ordem de inserção do JSON) com referencia E trecho não vazios. */
function primeiraFonteComTrecho(valor) {
  if (Array.isArray(valor)) { for (const v of valor) { const f = primeiraFonteComTrecho(v); if (f) return f; } return null; }
  if (!valor || typeof valor !== "object") return null;
  const f = valor.fonte;
  if (f && typeof f === "object" && typeof f.referencia === "string" && f.referencia.trim() && typeof f.trecho === "string" && f.trecho.trim()) return f;
  for (const v of Object.values(valor)) { const achada = primeiraFonteComTrecho(v); if (achada) return achada; }
  return null;
}

function fontesComTrecho(valor, caminho = "") {
  if (!valor || typeof valor !== "object") return [];
  const fontes = [];
  for (const [k, v] of Object.entries(valor)) {
    const localizador = `${caminho}/${k.replaceAll("~", "~0").replaceAll("/", "~1")}`;
    if (k === "fonte" && v && typeof v.referencia === "string" && v.referencia.trim()
      && typeof v.trecho === "string" && v.trecho.trim()) fontes.push({ localizador, fonte: v });
    else fontes.push(...fontesComTrecho(v, localizador));
  }
  return fontes;
}
function lerSecao(json, ponteiro) {
  if (typeof ponteiro !== "string" || !ponteiro.startsWith("/")) throw Error("LOCALIZADOR_INVALIDO");
  let valor = json;
  for (const parte of ponteiro.slice(1).split("/")) {
    const chave = parte.replaceAll("~1", "/").replaceAll("~0", "~");
    if (!valor || typeof valor !== "object" || !Object.hasOwn(valor, chave)) throw Error("LOCALIZADOR_INEXISTENTE");
    valor = valor[chave];
  }
  return valor;
}

function validarMapeamento(m) {
  if (m?.schema !== "ConversorBibliotecaMapeamento@1" || typeof m.itens !== "object" || !Array.isArray(m.verificacoes)) throw new Error("MAPEAMENTO_INVALIDO");
  const verificadas = new Set(m.verificacoes.map((v) => v?.url).filter((u) => typeof u === "string"));
  for (const [caminho, item] of Object.entries(m.itens)) {
    if (!caminho.startsWith("corpus/") || !item || typeof item.provenienciaUrl !== "string" || !/^https:\/\//.test(item.provenienciaUrl)) throw new Error(`MAPEAMENTO_INVALIDO:${caminho}`);
    if (!verificadas.has(item.provenienciaUrl)) throw new Error(`URL_NAO_VERIFICADA_NO_MAPEAMENTO:${caminho}`);
    if (item.publicadoEm !== undefined && (!ehData(item.publicadoEm) || !verificadas.has(item.fonteDataPublicacao)))
      throw new Error(`DATA_PUBLICACAO_NAO_VERIFICADA:${caminho}`);
    const ap = item.aplicabilidade;
    if (!ap || ["tumor", "histologia", "estadio", "biomarcador", "linha"].some((c) => !Array.isArray(ap[c]) || ap[c].length > 100 || ap[c].some((v) => typeof v !== "string" || !v.length || v.length > 200 || v === "*"))) throw new Error(`MAPEAMENTO_APLICABILIDADE_INVALIDA:${caminho}`);
    if (Object.values(ap).some(v => Array.isArray(v) && v.length === 0)
      && (typeof item.aplicabilidadeNota !== "string" || !/\bUNIVERSA(?:L|IS)\b/i.test(item.aplicabilidadeNota)))
      throw new Error(`APLICABILIDADE_UNIVERSAL_NAO_DECLARADA:${caminho}`);
  }
  return { mapeamento: m, verificadas };
}

/**
 * Converte um snapshot validado em PacoteBiblioteca@1. Publica o destino apenas com pacote íntegro:
 * valida o snapshot de volta (PHI incluído), monta em staging isolado, prova pelo importador real
 * (criarBiblioteca().importarPacote — API pública interna) e só então renomeia o staging para o destino.
 */
export async function converterBiblioteca(diretorioSnapshot, destino, opcoes = {}) {
  const agora = opcoes.agora ?? new Date().toISOString();
  const snap = resolve(diretorioSnapshot);
  validarPacoteConsulta(snap); // revalida bytes, metadados, exclusões e PHI — nada entra sem passar por aqui
  const { mapeamento, verificadas } = validarMapeamento(
    JSON.parse(readFileSync(opcoes.mapeamento ?? join(PASTA, "converter-biblioteca-mapeamento.json"), "utf8")),
  );
  const manifestoSnap = JSON.parse(readFileSync(join(snap, "manifesto.json"), "utf8"));
  const idPacote = opcoes.idPacote ?? "corpus-consulta-oncoglobal";
  const versaoPacote = opcoes.versao ?? "1.0.0";

  const incluidos = [], excluidos = [];
  const ids = new Map(), arquivos = new Map();
  for (const a of manifestoSnap.arquivos) {
    const pastaRaiz = a.caminho.split("/")[1] ?? "";
    const pilar = /^([1-8])-/.exec(pastaRaiz)?.[1];
    if (!pilar) { excluidos.push({ caminho: a.caminho, motivo: "RAIZ_TRANSVERSAL_SEM_PILAR", detalhe: `raiz ${pastaRaiz || "?"} fora dos oito pilares (D-F1-06); binding transversal exige mapeamento dedicado` }); continue; }
    const map = mapeamento.itens[a.caminho];
    if (!map) { excluidos.push({ caminho: a.caminho, motivo: "APLICABILIDADE_DESCONHECIDA", detalhe: "sem mapeamento curado; aplicabilidade desconhecida não pode virar lista vazia (universal)" }); continue; }
    const json = JSON.parse(readFileSync(join(snap, a.caminho), "utf8"));
    const secao = map.escopoFonte ? lerSecao(json, map.escopoFonte) : json;
    const fontes = fontesComTrecho(secao);
    if (new Set(fontes.map(f => JSON.stringify(f.fonte))).size > 1) {
      excluidos.push({ caminho: a.caminho, motivo: "PROVENIENCIA_MULTIPLA_SEM_ESCOPO", detalhe: "mapear seção com fonte própria; primeira fonte não sustenta o arquivo inteiro" }); continue;
    }
    const texto = map.escopoFonte ? JSON.stringify(secao, null, 2) : readFileSync(join(snap, a.caminho), "utf8");
    if (texto.length > LIMITE_TEXTO_ITEM || Buffer.byteLength(texto, "utf8") > LIMITE_BYTES_ITEM) { excluidos.push({ caminho: a.caminho, motivo: "TEXTO_EXCESSIVO", detalhe: `${texto.length} chars (limite ${LIMITE_TEXTO_ITEM})` }); continue; }
    const id = slug(a.caminho.replace(/^corpus\//, "").replace(/\.(json|md|txt)$/, ""));
    if (id.length > 100) { excluidos.push({ caminho: a.caminho, motivo: "ID_EXCESSIVO", detalhe: id }); continue; }
    if (ids.has(id)) throw new Error(`COLISAO_DE_ID:${id} (${ids.get(id)} × ${a.caminho})`);
    const arquivo = `${id}.json`;
    if (arquivos.has(arquivo)) throw new Error(`COLISAO_DE_ARQUIVO:${arquivo}`);
    const fonte = primeiraFonteComTrecho(secao);
    if (!fonte) { excluidos.push({ caminho: a.caminho, motivo: "PROVENIENCIA_SEM_TRECHO", detalhe: "nenhuma fonte interna com referencia E trecho" }); continue; }
    if (!verificadas.has(map.provenienciaUrl)) { excluidos.push({ caminho: a.caminho, motivo: "URL_NAO_VERIFICADA", detalhe: map.provenienciaUrl }); continue; }
    const publicadoEm = map.publicadoEm ?? (ehData(fonte.publicadoEm) ? fonte.publicadoEm : null);
    const publicadoEmOrigem = map.publicadoEm ? map.fonteDataPublicacao : "fonte.publicadoEm";
    if (!publicadoEm) { excluidos.push({ caminho: a.caminho, motivo: "SEM_DATA_PUBLICACAO", detalhe: "Data de publicação não declarada; edição, acesso e vigência local não substituem publicação." }); continue; }
    const tituloBase = json?.header?.id ?? json?.id ?? a.caminho.split("/").pop().replace(/\.json$/, "");
    const titulo = `${tituloBase} — ${a.caminho}${map.escopoFonte ? `#${map.escopoFonte}` : ""}`;
    if (titulo.length > 300) { excluidos.push({ caminho: a.caminho, motivo: "TITULO_EXCESSIVO", detalhe: `${titulo.length} chars` }); continue; }
    const versaoItem = ehSemver(a.versao) ? a.versao : "1.0.0";
    ids.set(id, a.caminho); arquivos.set(arquivo, a.caminho);
    incluidos.push({
      item: {
        schema: "ItemBiblioteca@1", id, versao: versaoItem, pilar: Number(pilar), tipo: "REFERENCIA", titulo, texto,
        aplicabilidade: map.aplicabilidade,
        proveniencia: { fonte: map.provenienciaUrl, trecho: fonte.trecho, publicadoEm, recuperadoEm: agora, licenca: LICENCA_DECLARATIVA },
        dependencias: [],
      },
      origem: { caminho: a.caminho, sha256Snapshot: a.sha256, versaoOriginal: a.versao ?? null, versaoAtribuida: !ehSemver(a.versao), publicadoEmOrigem, aplicabilidadeNota: map.aplicabilidadeNota ?? null, fonteReferencia: fonte.referencia,
        localizador: map.escopoFonte ?? "/", escopoParcial: Boolean(map.escopoFonte),
        outrasFontesNaoConvertidas: map.escopoFonte ? fontesComTrecho(json).filter(f => !f.localizador.startsWith(`${map.escopoFonte}/`)).map(f => f.localizador) : [] },
      arquivo,
    });
  }
  if (!incluidos.length) throw new Error("NENHUM_ITEM_CONVERGIDO");

  const out = resolve(destino);
  if (existsSync(out)) throw new Error("DESTINO_JA_EXISTE");
  const staging = join(dirname(out), `.${relative(dirname(out), out)}.staging-${process.pid}`);
  rmSync(staging, { recursive: true, force: true }); // resíduo de execução interrompida não contamina esta
  const limpar = () => rmSync(staging, { recursive: true, force: true });
  const { criarBiblioteca } = await import("../src/kernel/corpus/biblioteca.ts");
  /** Prova pelo importador REAL; IDENTIFICADOR_PESSOAL em massa vira diagnóstico por item (mesma validação, sem duplicar lógica). */
  const provarImportacao = async (man) => {
    const db = new DatabaseSync(":memory:");
    try {
      const biblioteca = criarBiblioteca(db, { autorizarCuradoria: () => ({ atorId: "conversor-validacao" }), emitir: () => {} });
      const idRetornado = biblioteca.importarPacote(man, (arquivo) => readFileSync(join(staging, "pacote", arquivo), "utf8"));
      if (idRetornado !== `${idPacote}@${versaoPacote}`) throw new Error("IDENTIDADE_DIVERGENTE");
      return [];
    } catch (e) {
      if (e.message !== "IDENTIFICADOR_PESSOAL") throw e;
      const ruins = [];
      for (const ref of man.itens) {
        const db2 = new DatabaseSync(":memory:");
        try {
          criarBiblioteca(db2, { autorizarCuradoria: () => ({ atorId: "conversor-validacao" }), emitir: () => {} })
            .importarPacote({ ...man, itens: [ref] }, (arquivo) => readFileSync(join(staging, "pacote", arquivo), "utf8"));
        } catch (e2) {
          if (e2.message === "IDENTIFICADOR_PESSOAL") ruins.push(ref.arquivo);
          else throw e2;
        } finally { db2.close(); }
      }
      return ruins;
    } finally { db.close(); }
  };
  const montarManifesto = () => ({ schema: "PacoteBiblioteca@1", id: idPacote, versao: versaoPacote, origem: "CURADOR_LOCAL", classificacao: "PUBLIC", criadoEm: agora,
    itens: incluidos.map(({ item, arquivo }) => ({ id: item.id, versao: item.versao, arquivo, sha256: sha256Biblioteca(JSON.stringify(item)) })) });
  try {
    // staging isolado: falha nenhuma deixa pacote parcialmente publicado.
    // Bytes do item = texto exato usado no sha256 do manifesto (sem newline extra).
    mkdirSync(join(staging, "pacote"), { recursive: true });
    for (const { item, arquivo } of incluidos) writeFileSync(join(staging, "pacote", arquivo), JSON.stringify(item));
    writeFileSync(join(staging, "pacote", "manifesto.json"), JSON.stringify(montarManifesto(), null, 2) + "\n");

    // Prova pelo importador REAL (API pública interna) — validarConteudo é privado e não é duplicado aqui.
    // Item recusado por PHI não é mascarado nem transferido: é excluído com motivo e o pacote é reprovado inteiro.
    const ruins = await provarImportacao(montarManifesto());
    if (ruins.length) {
      const recusados = new Set(ruins);
      for (const { origem, arquivo } of incluidos.filter((i) => recusados.has(i.arquivo)))
        excluidos.push({ caminho: origem.caminho, motivo: "PHI_ESTRUTURAL_RECUSADO_PELO_IMPORTADOR", detalhe: "o importador de PacoteBiblioteca@1 é mais estrito que o export (exceções do export NÃO se transferem — adendo eixo N item 4)" });
      for (let k = incluidos.length - 1; k >= 0; k--) if (recusados.has(incluidos[k].arquivo)) { rmSync(join(staging, "pacote", incluidos[k].arquivo)); incluidos.splice(k, 1); }
      if (!incluidos.length) throw new Error("NENHUM_ITEM_CONVERGIDO");
      writeFileSync(join(staging, "pacote", "manifesto.json"), JSON.stringify(montarManifesto(), null, 2) + "\n");
      const reprovados = await provarImportacao(montarManifesto());
      if (reprovados.length) throw new Error(`IMPORTADOR_REPROVOU_APOS_EXCLUSAO:${reprovados.join(",")}`);
    }

    const manifesto = montarManifesto();
    const httpPayload = { manifesto, arquivos: Object.fromEntries(incluidos.map(({ arquivo }) => [arquivo, { texto: readFileSync(join(staging, "pacote", arquivo), "utf8") }])) };
    const httpBytes = JSON.stringify(httpPayload).length;
    const conteudosBytes = incluidos.reduce((n, { item }) => n + Buffer.byteLength(JSON.stringify(item), "utf8"), 0);
    const httpDentro = httpBytes <= LIMITE_BODY_ROTEADOR && conteudosBytes <= LIMITE_BYTES_CONTEUDOS;
    if (httpDentro) writeFileSync(join(staging, "pacote-http.json"), JSON.stringify(httpPayload) + "\n");

    const porPilar = {};
    for (const { item } of incluidos) porPilar[item.pilar] = (porPilar[item.pilar] ?? 0) + 1;
    const raizesTransversais = [...new Set(manifestoSnap.arquivos.filter((a) => !/^[1-8]-/.test(a.caminho.split("/")[1] ?? "")).map((a) => a.caminho.split("/")[1]))].filter(Boolean);
    writeFileSync(join(staging, "inventario.json"), JSON.stringify({
      geradoEm: agora, snapshot: { diretorio: snap, validadoPor: "validarPacoteConsulta (scripts/exportar-biblioteca.mjs)" },
      pacote: { id: idPacote, versao: versaoPacote, itens: incluidos.length },
      unidade: "arquivo ou seção explicitamente mapeada",
      incluidos: incluidos.map(({ origem }) => origem),
      excluidos,
      pilares: { cobertos: porPilar, transversaisExcluidos: raizesTransversais },
      http: { emitido: httpDentro, bytesBody: httpBytes, limiteBodyRoteador: LIMITE_BODY_ROTEADOR, bytesConteudos: conteudosBytes, limiteConteudosImportadorHttp: LIMITE_BYTES_CONTEUDOS },
      limites: { textoPorItem: LIMITE_TEXTO_ITEM, bytesPorItemImportador: LIMITE_BYTES_ITEM },
      mapeamento: "scripts/converter-biblioteca-mapeamento.json",
      pendencias: mapeamento.pendencias ?? [],
      aviso: "primeiro lote (exames/painéis) — não declara biblioteca completa",
    }, null, 2) + "\n");
    writeFileSync(join(staging, "LEIA-ME.md"), LEIA_ME);

    if (existsSync(out)) throw new Error("DESTINO_JA_EXISTE");
    renameSync(staging, out);
    return { destino: out, itens: incluidos.length, excluidos: excluidos.length, http: httpDentro };
  } catch (e) { limpar(); throw e; }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    // biblioteca.ts importa './phiEstrutural.js' (padrão TS+esbuild); fora do vitest, resolve .js→.ts.
    const { registerHooks } = await import("node:module");
    registerHooks({ resolve(specifier, context, nextResolve) {
      try { return nextResolve(specifier, context); }
      catch (e) {
        if (typeof specifier === "string" && specifier.endsWith(".js")) { try { return nextResolve(specifier.slice(0, -3) + ".ts", context); } catch { /* deixa o erro original */ } }
        throw e;
      }
    } });
    const args = process.argv.slice(2);
    const val = (flag) => { const i = args.indexOf(flag); return i >= 0 ? args[i + 1] : undefined; };
    const snap = args[0], destino = args[1];
    if (!snap || !destino || destino.startsWith("--")) throw new Error("USO: node scripts/converter-biblioteca.mjs <snapshot> <destino> [--mapeamento f] [--id-pacote id] [--versao v]");
    console.log(JSON.stringify(await converterBiblioteca(snap, destino, { mapeamento: val("--mapeamento"), idPacote: val("--id-pacote"), versao: val("--versao") })));
  } catch (e) { console.error(e instanceof Error ? e.message : "CONVERSAO_RECUSADA"); process.exitCode = 1; }
}
