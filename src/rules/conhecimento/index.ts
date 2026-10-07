// W10-INT-PRESC-04 · loader PURO do ragGRAFO/oncologia (JSONL entra como texto; nenhum I/O aqui) — RT-11a/c/d.
// Regras (D-W9-22c/22i/48): o grafo é REFERÊNCIA, nunca regra nem ficha. Todo nó carrega status explícito
// (NAO_VERIFICADO = resumo de aula · DIRETRIZ_FINAL_* = diretriz publicada); trial só POSSIBLE_MATCH e nunca
// "elegível"; resultado negativo/NS nunca é apresentado como ganho; dose de braço de estudo é só texto de referência;
// fontes divergentes aparecem LADO A LADO e nenhuma "vence" nem preenche a outra.
// src/rules só importa src/contracts (R-08): arquivo autossuficiente.

export const STATUS_NAO_VERIFICADO = "NAO_VERIFICADO";
const STATUS_DIRETRIZ = /^DIRETRIZ_FINAL_[A-Z0-9_]+$/u;

export type NivelFonte = "REFERENCIA_NAO_VERIFICADA" | "DIRETRIZ_FINAL";

export interface NoGrafo {
  id: string;
  tipo: string;
  nome: string;
  status: string;
  [campo: string]: unknown;
}
export interface ArestaGrafo { de: string; rel: string; para: string; [campo: string]: unknown }

export type CodigoErroGrafo =
  | "JSON_INVALIDO" | "NO_SEM_CAMPO" | "STATUS_AUSENTE" | "STATUS_DESCONHECIDO" | "ID_DUPLICADO"
  | "ARESTA_SEM_CAMPO" | "ARESTA_ORFA";
export interface ErroGrafo { codigo: CodigoErroGrafo; arquivo: "nos" | "arestas"; linha: number; texto: string }

export interface Grafo {
  /** só nós válidos (status explícito e conhecido, id único) */
  nos: readonly NoGrafo[];
  /** só arestas cujos dois extremos existem */
  arestas: readonly ArestaGrafo[];
  porId: ReadonlyMap<string, NoGrafo>;
  orfas: readonly ArestaGrafo[];
  erros: readonly ErroGrafo[];
  /** true só se nada foi rejeitado (nó inválido, aresta órfã…) */
  ok: boolean;
}

export class GrafoErro extends Error {
  constructor(readonly erros: readonly ErroGrafo[]) {
    super(`GRAFO_INVALIDO: ${erros.length} problema(s); primeiro: ${erros[0]?.codigo ?? "?"} ${erros[0]?.texto ?? ""}`);
    this.name = "GrafoErro";
  }
}

const ehObjeto = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const ehTextoNaoVazio = (v: unknown): v is string => typeof v === "string" && v.trim() !== "";

function linhasJsonl(texto: string): Array<{ n: number; bruto: string }> {
  return texto.split(/\r?\n/u).map((bruto, i) => ({ n: i + 1, bruto })).filter((l) => l.bruto.trim() !== "");
}

export function nivelDoStatus(status: string): NivelFonte | null {
  if (status === STATUS_NAO_VERIFICADO) return "REFERENCIA_NAO_VERIFICADA";
  return STATUS_DIRETRIZ.test(status) ? "DIRETRIZ_FINAL" : null;
}

/** RT-11c · arestas cujo extremo não existe (nó removido). Pura; usada por carregarGrafo. */
export function verificarArestas(nos: Iterable<{ id: string }>, arestas: readonly ArestaGrafo[]): ArestaGrafo[] {
  const ids = new Set<string>();
  for (const n of nos) ids.add(n.id);
  return arestas.filter((a) => !ids.has(a.de) || !ids.has(a.para));
}

/** Carrega nos.jsonl + arestas.jsonl. Nunca lança: o que for inválido é rejeitado e relatado em `erros`/`orfas`. */
export function carregarGrafo(nosJsonl: string, arestasJsonl: string): Grafo {
  const erros: ErroGrafo[] = [];
  const nos: NoGrafo[] = [];
  const porId = new Map<string, NoGrafo>();

  for (const { n, bruto } of linhasJsonl(nosJsonl)) {
    let v: unknown;
    try { v = JSON.parse(bruto); } catch { erros.push({ codigo: "JSON_INVALIDO", arquivo: "nos", linha: n, texto: "linha não é JSON" }); continue; }
    if (!ehObjeto(v) || !ehTextoNaoVazio(v["id"]) || !ehTextoNaoVazio(v["tipo"]) || !ehTextoNaoVazio(v["nome"])) {
      erros.push({ codigo: "NO_SEM_CAMPO", arquivo: "nos", linha: n, texto: "nó sem id/tipo/nome" }); continue;
    }
    const id = v["id"];
    if (!ehTextoNaoVazio(v["status"])) {
      erros.push({ codigo: "STATUS_AUSENTE", arquivo: "nos", linha: n, texto: `nó ${id} sem status explícito` }); continue;
    }
    if (nivelDoStatus(v["status"]) === null) {
      erros.push({ codigo: "STATUS_DESCONHECIDO", arquivo: "nos", linha: n, texto: `nó ${id} com status ${v["status"]}` }); continue;
    }
    if (porId.has(id)) {
      erros.push({ codigo: "ID_DUPLICADO", arquivo: "nos", linha: n, texto: `id ${id} repetido; mantido o primeiro` }); continue;
    }
    const no = v as NoGrafo;
    nos.push(no);
    porId.set(id, no);
  }

  const candidatas: Array<{ n: number; a: ArestaGrafo }> = [];
  for (const { n, bruto } of linhasJsonl(arestasJsonl)) {
    let v: unknown;
    try { v = JSON.parse(bruto); } catch { erros.push({ codigo: "JSON_INVALIDO", arquivo: "arestas", linha: n, texto: "linha não é JSON" }); continue; }
    if (!ehObjeto(v) || !ehTextoNaoVazio(v["de"]) || !ehTextoNaoVazio(v["rel"]) || !ehTextoNaoVazio(v["para"])) {
      erros.push({ codigo: "ARESTA_SEM_CAMPO", arquivo: "arestas", linha: n, texto: "aresta sem de/rel/para" }); continue;
    }
    candidatas.push({ n, a: v as ArestaGrafo });
  }
  const orfas = verificarArestas(nos, candidatas.map((c) => c.a));
  const setOrfas = new Set(orfas);
  const arestas: ArestaGrafo[] = [];
  for (const c of candidatas) {
    if (setOrfas.has(c.a)) {
      erros.push({ codigo: "ARESTA_ORFA", arquivo: "arestas", linha: c.n, texto: `${c.a.de} -${c.a.rel}-> ${c.a.para}: extremo inexistente` });
    } else arestas.push(c.a);
  }
  return { nos, arestas, porId, orfas, erros, ok: erros.length === 0 };
}

/** Versão estrita: lança GrafoErro se qualquer nó/aresta foi rejeitado. */
export function carregarGrafoEstrito(nosJsonl: string, arestasJsonl: string): Grafo {
  const g = carregarGrafo(nosJsonl, arestasJsonl);
  if (!g.ok) throw new GrafoErro(g.erros);
  return g;
}

/* ───────────── visão segura do nó: referência, nunca regra/ficha ───────────── */

export interface VisaoNo {
  id: string;
  tipo: string;
  nome: string;
  status: string;
  nivel: NivelFonte;
  fonte: unknown;
  /** invariantes: o grafo nunca vira regra clínica nem ficha de prescrição */
  usavelComoRegra: false;
  usavelComoFicha: false;
  /** true se o nó carrega dose/braço de estudo (só texto de referência, D-W9-22i) */
  doseSomenteReferencia: boolean;
  aviso: string | null;
}

export function visaoDoNo(no: NoGrafo): VisaoNo {
  const nivel = nivelDoStatus(no.status);
  if (nivel === null) throw new GrafoErro([{ codigo: "STATUS_DESCONHECIDO", arquivo: "nos", linha: 0, texto: `nó ${no.id} com status ${no.status}` }]);
  const temDose = no["dose_literal"] !== undefined || no["bracos"] !== undefined || /dose \(/iu.test(String(no["embedding_text"] ?? ""));
  return {
    id: no.id, tipo: no.tipo, nome: no.nome, status: no.status, nivel, fonte: no["fonte"],
    usavelComoRegra: false, usavelComoFicha: false,
    doseSomenteReferencia: temDose,
    aviso: nivel === "REFERENCIA_NAO_VERIFICADA" ? "resumo de aula, não evidência primária: NAO_VERIFICADO" : null,
  };
}

/* ───────────── RT-11a · trial: POSSIBLE_MATCH, negativo nunca é ganho ───────────── */

export type ResultadoTrial = "POSITIVO" | "NEGATIVO" | "MISTO" | "SEM_COMPARACAO" | "INDEFINIDO";

export interface AvaliacaoTrial {
  ok: true;
  id: string;
  nome: string;
  classificacao: "POSSIBLE_MATCH";
  /** nunca true: trial é referência + oportunidade, não elegibilidade (D-W9-48) */
  elegivel: false;
  resultado: ResultadoTrial;
  statusResultadoLiteral: string | null;
  /** só POSITIVO "limpo" pode ser apresentado como ganho */
  apresentavelComoGanho: boolean;
  resumo: string;
  aviso: string | null;
}
export type AvaliacaoTrialRecusada = { ok: false; motivo: string };

const norm = (t: string): string => t.normalize("NFD").replace(/[̀-ͯ]/gu, "").toLowerCase();

export function classificarResultadoTrial(statusResultado: unknown): ResultadoTrial {
  if (typeof statusResultado !== "string" || statusResultado.trim() === "") return "INDEFINIDO";
  // "não inferior" é desfecho de não-inferioridade positivo, não ausência de benefício
  const n = norm(statusResultado).replace(/nao[- ]inferior(idade)?/gu, "ni_ok");
  const positivo = /\bpositiv/u.test(n);
  const negativo = /\bnegativ|\bns\b|nao sustentado|sem ganho|experimental inferior|prejuizo|nao confirmada|limitado/u.test(n);
  if (positivo && negativo) return "MISTO";
  if (positivo) return "POSITIVO";
  if (negativo) return "NEGATIVO";
  if (/atividade|observacional|nao comparativo|dados de congresso/u.test(n)) return "SEM_COMPARACAO";
  return "INDEFINIDO";
}

const FRASE: Record<ResultadoTrial, string> = {
  POSITIVO: "resultado positivo no desfecho informado",
  NEGATIVO: "estudo NEGATIVO: não demonstrou benefício, não apresentar como ganho",
  MISTO: "resultado MISTO (parte positiva, parte negativa/NS): não apresentar como ganho sem ler o literal",
  SEM_COMPARACAO: "sem comparação formal (atividade/observacional): não é ganho demonstrado",
  INDEFINIDO: "resultado não classificado no grafo: não apresentar como ganho",
};

export function avaliarTrial(no: NoGrafo): AvaliacaoTrial | AvaliacaoTrialRecusada {
  if (no.tipo !== "trial") return { ok: false, motivo: `nó ${no.id} é ${no.tipo}, não trial` };
  const nivel = nivelDoStatus(no.status);
  if (nivel === null) return { ok: false, motivo: `nó ${no.id} sem status válido: não avaliável` };
  const literal = typeof no["status_resultado"] === "string" ? (no["status_resultado"] as string) : null;
  const resultado = classificarResultadoTrial(literal);
  const desfecho = typeof no["desfecho_primario"] === "string" ? `desfecho primário ${no["desfecho_primario"]}` : "desfecho primário não informado";
  const ano = typeof no["ano"] === "number" ? ` (${no["ano"]})` : "";
  const resumo = `${no.nome}${ano}: ${desfecho}; ${FRASE[resultado]}. POSSIBLE_MATCH: referência e oportunidade, nunca elegibilidade.`;
  return {
    ok: true, id: no.id, nome: no.nome, classificacao: "POSSIBLE_MATCH", elegivel: false, resultado,
    statusResultadoLiteral: literal, apresentavelComoGanho: resultado === "POSITIVO", resumo,
    aviso: nivel === "REFERENCIA_NAO_VERIFICADA" ? "resumo de aula NAO_VERIFICADO: conferir na fonte primária" : null,
  };
}

/** Resumo de uma frase (modelo 02). */
export function resumirTrial(no: NoGrafo): string {
  const a = avaliarTrial(no);
  return a.ok ? a.resumo : a.motivo;
}

/* ───────────── RT-11d · fontes divergentes lado a lado (D-W9-22c) ───────────── */

const NAO_INFORMADO = "NAO_INFORMADO" as const;
const IGNORADOS = new Set(["id", "tipo", "nome", "embedding_text", "fonte", "fontes", "status", "arquivo", "paginas", "pasta", "pagina"]);

export interface FonteLadoALado {
  id: string;
  status: string;
  nivel: NivelFonte;
  fonte: unknown;
  valores: Record<string, unknown>;
}
export interface CampoConfronto { campo: string; diverge: boolean; valores: Array<{ id: string; valor: unknown }> }
export interface Confronto {
  /** nunca há "vencedora": a diretriz FINAL aparece primeiro só por ordem de exibição */
  fontes: FonteLadoALado[];
  campos: CampoConfronto[];
  divergente: boolean;
  /** invariante: valor ausente numa fonte nunca é preenchido pela outra */
  preenchimentoEntreFontes: false;
}

const canon = (v: unknown): string => JSON.stringify(v, (_k, x: unknown) =>
  ehObjeto(x) ? Object.fromEntries(Object.entries(x).sort(([a], [b]) => a.localeCompare(b))) : x);

/** Mostra TODAS as fontes e cada campo comparável; ausência numa fonte vira NAO_INFORMADO (nunca copiada da outra). */
export function confrontarFontes(nos: readonly NoGrafo[], opcoes?: { campos?: readonly string[] }): Confronto {
  const fontes: FonteLadoALado[] = nos.map((no) => {
    const nivel = nivelDoStatus(no.status);
    if (nivel === null) throw new GrafoErro([{ codigo: "STATUS_DESCONHECIDO", arquivo: "nos", linha: 0, texto: `nó ${no.id} com status ${no.status}` }]);
    const valores: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(no)) if (!IGNORADOS.has(k)) valores[k] = v;
    return { id: no.id, status: no.status, nivel, fonte: no["fonte"], valores };
  }).sort((a, b) => Number(a.nivel !== "DIRETRIZ_FINAL") - Number(b.nivel !== "DIRETRIZ_FINAL")); // ordenação estável

  const nomes = opcoes?.campos ? [...opcoes.campos] : [...new Set(fontes.flatMap((f) => Object.keys(f.valores)))].sort();
  const campos: CampoConfronto[] = nomes.map((campo) => {
    const valores = fontes.map((f) => ({ id: f.id, valor: campo in f.valores ? f.valores[campo] : NAO_INFORMADO }));
    return { campo, valores, diverge: new Set(valores.map((x) => canon(x.valor))).size > 1 };
  });
  return { fontes, campos, divergente: campos.some((c) => c.diverge), preenchimentoEntreFontes: false };
}
export const fontesDivergentes = confrontarFontes;

/** Agrupa nós do mesmo tema (tipo + nome normalizado) com ao menos duas fontes e devolve só os que divergem. */
export function divergenciasDoGrafo(g: Grafo): Confronto[] {
  const grupos = new Map<string, NoGrafo[]>();
  for (const no of g.nos) {
    const k = `${no.tipo}|${norm(no.nome).replace(/\s+/gu, " ").trim()}`;
    const l = grupos.get(k);
    if (l) l.push(no); else grupos.set(k, [no]);
  }
  return [...grupos.values()].filter((l) => l.length > 1).map((l) => confrontarFontes(l)).filter((c) => c.divergente);
}
