import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { carregarGrafoEstrito, GrafoErro, nivelDoStatus, type NoGrafo } from "../../rules/conhecimento/index.js";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const NOS_PATH = "docs/referencias/ragGRAFO-oncologia/dados/nos.jsonl";
const ARESTAS_PATH = "docs/referencias/ragGRAFO-oncologia/dados/arestas.jsonl";
const TOP_K_PADRAO = 5;
const TOP_K_MAXIMO = 20;
const QUERY_MAXIMA = 240;

export interface ConsultaGrafoLocal {
  query: string;
  tipos?: readonly string[];
  status?: readonly string[];
  proveniencia?: { modulo?: string; aula?: string };
  topK?: number;
}

export interface ReferenciaGrafo {
  id: string;
  tipo: string;
  nome: string;
  status: string;
  proveniencia: { fonte: unknown; fontes: unknown; arquivo: string | null; paginas: unknown };
  trecho: string;
  nivel: "REFERENCIA_NAO_VERIFICADA" | "DIRETRIZ_FINAL";
  classificacao: "REFERENCIA";
  usavelComoRegra: false;
  usavelComoFicha: false;
  doseSomenteReferencia: boolean;
}

export interface ArquivoGrafoInfo { caminho: string; sha256: string; linhas: number; }
export interface ConsultaGrafoOk {
  status: "OK";
  modo: "LEXICAL";
  algoritmo: "TOKEN_EXATO_NORMALIZADO";
  corpus: { versao: string; arquivos: readonly ArquivoGrafoInfo[] };
  vetorial: { status: "NOT_IMPLEMENTED" };
  resultados: Array<{ referencia: ReferenciaGrafo; scoreLexical: number }>;
  topKAplicado: number;
  aviso: string;
}
export interface ConsultaGrafoRecusada {
  status: "RECUSADA";
  codigo: "CONSULTA_INVALIDA" | "GRAFO_INVALIDO" | "CORPUS_INDISPONIVEL";
  diagnosticos?: Array<{ codigo: string; arquivo: string; linha: number }>;
}
export type ResultadoConsultaGrafo = ConsultaGrafoOk | ConsultaGrafoRecusada;

interface CorpusTexto {
  nosJsonl: string;
  arestasJsonl: string;
  arquivos: readonly ArquivoGrafoInfo[];
}

/** API local explícita para o servidor. Não chama rede, LLM, nem grava o conteúdo consultado. */
export async function consultarGrafoLocal(input: ConsultaGrafoLocal): Promise<ResultadoConsultaGrafo> {
  let nos: Buffer;
  let arestas: Buffer;
  try {
    [nos, arestas] = await Promise.all([
      readFile(resolve(ROOT, NOS_PATH)),
      readFile(resolve(ROOT, ARESTAS_PATH)),
    ]);
  } catch {
    return { status: "RECUSADA", codigo: "CORPUS_INDISPONIVEL" };
  }
  const nosJsonl = nos.toString("utf8");
  const arestasJsonl = arestas.toString("utf8");
  const arquivos: ArquivoGrafoInfo[] = [
    { caminho: NOS_PATH, sha256: sha256(nos), linhas: linhasJsonl(nosJsonl) },
    { caminho: ARESTAS_PATH, sha256: sha256(arestas), linhas: linhasJsonl(arestasJsonl) },
  ];
  return consultarGrafoDeTextos(input, { nosJsonl, arestasJsonl, arquivos });
}

/** Núcleo testável e também estrito: qualquer registro rejeitado invalida a consulta inteira. */
export function consultarGrafoDeTextos(input: ConsultaGrafoLocal, corpus: CorpusTexto): ResultadoConsultaGrafo {
  const invalid = validarConsulta(input);
  if (invalid) return { status: "RECUSADA", codigo: "CONSULTA_INVALIDA" };

  let grafo;
  try {
    grafo = carregarGrafoEstrito(corpus.nosJsonl, corpus.arestasJsonl);
  } catch (error) {
    if (!(error instanceof GrafoErro)) return { status: "RECUSADA", codigo: "GRAFO_INVALIDO" };
    return {
      status: "RECUSADA",
      codigo: "GRAFO_INVALIDO",
      diagnosticos: error.erros.map((e) => ({ codigo: e.codigo, arquivo: e.arquivo, linha: e.linha })),
    };
  }

  const tokens = tokenizar(input.query);
  if (!tokens.length) return { status: "RECUSADA", codigo: "CONSULTA_INVALIDA" };
  const tipos = input.tipos ? new Set(input.tipos) : null;
  const status = input.status ? new Set(input.status) : null;
  const candidatos = grafo.nos.flatMap((no) => {
    if (tipos && !tipos.has(no.tipo)) return [];
    if (status && !status.has(no.status)) return [];
    if (!correspondeProveniencia(no, input.proveniencia)) return [];
    const score = pontuar(no, tokens);
    return score > 0 ? [{ no, score }] : [];
  });
  candidatos.sort((a, b) => b.score - a.score || a.no.id.localeCompare(b.no.id));

  const topKAplicado = Math.min(TOP_K_MAXIMO, Math.max(1, Math.trunc(input.topK ?? TOP_K_PADRAO)));
  const arquivos = [...corpus.arquivos];
  const versao = `sha256:${sha256(Buffer.from(arquivos.map((a) => `${a.caminho}:${a.sha256}`).join("\n"), "utf8"))}`;
  return {
    status: "OK",
    modo: "LEXICAL",
    algoritmo: "TOKEN_EXATO_NORMALIZADO",
    corpus: { versao, arquivos },
    vetorial: { status: "NOT_IMPLEMENTED" },
    resultados: candidatos.slice(0, topKAplicado).map(({ no, score }) => ({
      referencia: comoReferencia(no), scoreLexical: score,
    })),
    topKAplicado,
    aviso: "Busca lexical local em texto de referência; não é recomendação, regra clínica, ficha ou avaliação de elegibilidade.",
  };
}

function validarConsulta(input: ConsultaGrafoLocal): boolean {
  if (!input || typeof input.query !== "string" || input.query.trim().length === 0 || input.query.length > QUERY_MAXIMA) return true;
  if (input.topK !== undefined && (!Number.isFinite(input.topK) || input.topK <= 0)) return true;
  if (input.tipos?.some((tipo) => typeof tipo !== "string" || !tipo.trim())) return true;
  if (input.status?.some((value) => typeof value !== "string" || nivelDoStatus(value) === null)) return true;
  if (input.proveniencia && [input.proveniencia.modulo, input.proveniencia.aula].some((value) => value !== undefined && (typeof value !== "string" || !value.trim()))) return true;
  return false;
}

function correspondeProveniencia(no: NoGrafo, filtro?: ConsultaGrafoLocal["proveniencia"]): boolean {
  if (!filtro) return true;
  const fontes = [no["fonte"], no["fontes"]].flatMap((v) => Array.isArray(v) ? v : [v]);
  return fontes.some((fonte) => {
    if (typeof fonte !== "object" || fonte === null || Array.isArray(fonte)) return false;
    const registro = fonte as Record<string, unknown>;
    return (filtro.modulo === undefined || registro["modulo"] === filtro.modulo)
      && (filtro.aula === undefined || registro["aula"] === filtro.aula);
  });
}

function pontuar(no: NoGrafo, tokens: readonly string[]): number {
  const nome = tokenizar(no.nome);
  const texto = tokenizar(typeof no["embedding_text"] === "string" ? no["embedding_text"] : "");
  const id = tokenizar(no.id);
  return tokens.reduce((sum, token) => sum + (nome.includes(token) ? 5 : 0) + (texto.includes(token) ? 1 : 0) + (id.includes(token) ? 1 : 0), 0);
}

function tokenizar(texto: string): string[] {
  return texto.normalize("NFD").replace(/[\u0300-\u036f]/gu, "").toLocaleLowerCase("pt-BR").match(/[\p{L}\p{N}]+/gu) ?? [];
}

function comoReferencia(no: NoGrafo): ReferenciaGrafo {
  const nivel = nivelDoStatus(no.status);
  if (nivel === null) throw new Error("nó sem status reconhecido após validação estrita");
  return {
    id: no.id, tipo: no.tipo, nome: no.nome, status: no.status,
    proveniencia: {
      fonte: no["fonte"] ?? null, fontes: no["fontes"] ?? null,
      arquivo: typeof no["arquivo"] === "string" ? no["arquivo"] : null,
      paginas: no["paginas"] ?? null,
    },
    trecho: trechoDe(no, 360), nivel, classificacao: "REFERENCIA",
    usavelComoRegra: false, usavelComoFicha: false,
    doseSomenteReferencia: no["dose_literal"] !== undefined || no["bracos"] !== undefined || /dose\s*\(/iu.test(String(no["embedding_text"] ?? "")),
  };
}

function trechoDe(no: NoGrafo, limite: number): string {
  const texto = typeof no["embedding_text"] === "string" ? no["embedding_text"].trim() : "";
  return texto.length <= limite ? texto : `${texto.slice(0, limite).trimEnd()}…`;
}

function linhasJsonl(texto: string): number { return texto.split(/\r?\n/u).filter((linha) => linha.trim() !== "").length; }
function sha256(valor: Buffer): string { return createHash("sha256").update(valor).digest("hex"); }
