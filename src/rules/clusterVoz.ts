// W11-H25 · clusters por voz/texto (PLN-013, M-Q). Função pura: a frase já transcrita e o corpus entram por parâmetro.
// Regras: DESCRIÇÃO ("está com anemia") abre o cluster SEM marcar nada; ORDEM explícita ("vou pedir ferritina")
// marca SOMENTE os itens ditos, com status DRAFT; negação ("não tem anemia", "não vou pedir ferritina") não abre nem marca;
// pack ("pack/pacote/exames de anemia") em frase de ordem marca todos os itens do pack, também DRAFT;
// nada vira CONFIRMADO; nenhum fármaco ou dose é deduzido. Dado ausente vira pendência, nunca marcação.
// Não importa outras regras: o corpus (corpus/clusters/clusters-voz.v1.json) chega pronto.

export type IntencaoVoz = "DESCRICAO" | "ORDEM" | "NENHUMA";

export interface ItemClusterVoz {
  readonly id: string;
  readonly nome: string;
  readonly chaveMatriz: string | null;
  readonly termos: readonly string[];
}

export interface PendenciaClusterVoz {
  readonly texto: string;
  readonly coberturaItens: readonly string[];
}

/** Modo pack: frase de ordem citando o pacote marca todos os itens listados (DRAFT, desmarcáveis). */
export interface PackClusterVoz {
  readonly gatilhos: readonly string[];
  readonly itens: readonly string[];
}

export interface ClusterVoz {
  readonly id: string;
  readonly nome: string;
  readonly chavesMatriz: readonly string[];
  readonly gatilhosDescricao: readonly string[];
  readonly pack?: PackClusterVoz;
  readonly itens: readonly ItemClusterVoz[];
  readonly pendencias: readonly PendenciaClusterVoz[];
}

export interface CorpusClustersVoz {
  readonly schemaVersion: string;
  readonly status: string;
  readonly consumivel: boolean;
  readonly clusters: readonly ClusterVoz[];
}

export interface ContextoVoz {
  /** Clusters já abertos na consulta: desempata item que pertence a mais de um cluster. */
  readonly clustersAbertos?: readonly string[];
}

export interface ItemMarcadoVoz {
  readonly id: string;
  readonly nome: string;
  readonly chaveMatriz: string | null;
  readonly status: "DRAFT";
}

export interface ResultadoVoz {
  readonly intencao: IntencaoVoz;
  readonly cluster: string | null;
  readonly itensMarcados: readonly ItemMarcadoVoz[];
  readonly pendencias: readonly string[];
  readonly evidencia: string;
  readonly chavesMatriz: readonly string[];
}

// Palavras que negam o termo quando aparecem nas quatro palavras anteriores, no mesmo trecho.
const NEGACOES: readonly string[] = ["nao", "sem", "nega", "negou", "descarta", "descartado", "exclui", "excluido", "afasta", "ausencia"];
// Verbos de ordem explícita: sem um deles, um item citado não vira marcação.
const ORDEM_RE = /\b(vou|vamos|vai|pedir|pedimos|pedi|peco|solicit\w*|fazer|fazemos|colher|prescrev\w*|renov\w*|indicar|indico|marcar|marco|agendar)\b/;
const SEPARADOR_TRECHO = /[.;!?,:\n]|\s+(?:mas|porem|porém|entretanto)\s+/i;

const normalizar = (texto: string): string =>
  texto.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().replace(/\s+/g, " ").trim();

const escaparRegex = (texto: string): string => texto.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Posições (no texto normalizado) em que o termo aparece como palavra ou expressão inteira. */
const posicoes = (norm: string, termo: string): number[] => {
  const alvo = normalizar(termo);
  if (alvo.length === 0) return [];
  const re = new RegExp(`(^|[^a-z0-9])(${escaparRegex(alvo)})(?![a-z0-9])`, "g");
  const saida: number[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(norm)) !== null) {
    saida.push(m.index + (m[1] ?? "").length);
    re.lastIndex = m.index + m[0].length;
  }
  return saida;
};

const negadoAntes = (norm: string, pos: number): boolean => {
  const palavras = norm.slice(0, pos).split(/[^a-z0-9]+/).filter((p) => p.length > 0).slice(-4);
  return palavras.some((p) => NEGACOES.includes(p));
};

/** Ocorrência positiva (não negada) do termo no trecho. */
const ocorrenciaPositiva = (norm: string, termo: string): boolean =>
  posicoes(norm, termo).some((pos) => !negadoAntes(norm, pos));

/** O termo está contido num termo mais longo de outro item do cluster que também aparece (ex.: "transferrina" em "saturacao de transferrina")? */
const coberto = (norm: string, cl: ClusterVoz, itemId: string, termo: string): boolean => {
  const alvo = normalizar(termo);
  return cl.itens.some((outro) =>
    outro.id !== itemId &&
    outro.termos.some((t) => {
      const maior = normalizar(t);
      return maior.length > alvo.length && maior.includes(alvo) && ocorrenciaPositiva(norm, t);
    }));
};

interface Achado {
  readonly clusterId: string;
  readonly itemId: string | null; // null = gatilho de descrição
  readonly trecho: string;
}

/**
 * Interpreta uma frase transcrita contra o corpus de clusters.
 * Devolve um resultado por cluster tocado (ordem do corpus). Sem nenhum cluster, devolve um único NENHUMA.
 */
export function interpretarFrase(frase: string, corpus: CorpusClustersVoz, contexto: ContextoVoz = {}): ResultadoVoz[] {
  if (typeof frase !== "string") throw new TypeError("interpretarFrase: frase deve ser texto");

  // Quais clusters citam cada termo de item (para desempate por contexto).
  const donosDoTermo = new Map<string, Set<string>>();
  for (const cl of corpus.clusters)
    for (const it of cl.itens)
      for (const t of it.termos) {
        const chave = normalizar(t);
        const set = donosDoTermo.get(chave) ?? new Set<string>();
        set.add(cl.id);
        donosDoTermo.set(chave, set);
      }

  const abertos = new Set(contexto.clustersAbertos ?? []);
  const achados: Achado[] = [];
  const ambiguos: string[] = [];

  // A ordem vale para o trecho do verbo e para as enumerações seguintes ("vou pedir X, Y e Z"),
  // até um trecho de descrição ou um trecho com ordem negada.
  let ordemCorrente = false;
  for (const segmento of frase.split(SEPARADOR_TRECHO)) {
    const trecho = segmento.trim();
    const norm = normalizar(trecho);
    if (norm.length === 0) continue;

    const verbo = ORDEM_RE.exec(norm);
    const descreve = corpus.clusters.some((cl) => cl.gatilhosDescricao.some((g) => ocorrenciaPositiva(norm, g)));
    if (verbo !== null) ordemCorrente = !negadoAntes(norm, verbo.index);
    else if (descreve) ordemCorrente = false;

    for (const cl of corpus.clusters) {
      if (cl.gatilhosDescricao.some((g) => ocorrenciaPositiva(norm, g)))
        achados.push({ clusterId: cl.id, itemId: null, trecho });

      if (!ordemCorrente) continue;
      for (const it of cl.itens) {
        for (const t of it.termos) {
          const chave = normalizar(t);
          if (!ocorrenciaPositiva(norm, t)) continue;
          if (coberto(norm, cl, it.id, t)) continue;
          const donos = [...(donosDoTermo.get(chave) ?? [])];
          if (donos.length > 1) {
            const filtrados = donos.filter((d) => abertos.has(d));
            if (filtrados.length !== 1 || filtrados[0] !== cl.id) {
              if (filtrados.length !== 1) ambiguos.push(t);
              continue;
            }
          }
          achados.push({ clusterId: cl.id, itemId: it.id, trecho });
          break;
        }
      }
      if (cl.pack !== undefined && cl.pack.gatilhos.some((g) => ocorrenciaPositiva(norm, g)))
        for (const id of cl.pack.itens) achados.push({ clusterId: cl.id, itemId: id, trecho });
    }
  }

  const saida: ResultadoVoz[] = [];
  for (const cl of corpus.clusters) {
    const mine = achados.filter((a) => a.clusterId === cl.id);
    if (mine.length === 0) continue;
    const idsMarcados = new Set(mine.filter((a) => a.itemId !== null).map((a) => a.itemId as string));
    const itensMarcados: ItemMarcadoVoz[] = cl.itens
      .filter((it) => idsMarcados.has(it.id))
      .map((it) => ({ id: it.id, nome: it.nome, chaveMatriz: it.chaveMatriz, status: "DRAFT" as const }));
    const pendencias = cl.pendencias
      .filter((p) => !p.coberturaItens.some((id) => idsMarcados.has(id)))
      .map((p) => p.texto);
    saida.push({
      intencao: itensMarcados.length > 0 ? "ORDEM" : "DESCRICAO",
      cluster: cl.id,
      itensMarcados,
      pendencias,
      evidencia: mine[0]?.trecho ?? "",
      chavesMatriz: cl.chavesMatriz,
    });
  }

  if (saida.length === 0)
    return [{
      intencao: "NENHUMA",
      cluster: null,
      itensMarcados: [],
      pendencias: ambiguos.length > 0 ? [`item ambíguo sem cluster definido: ${[...new Set(ambiguos)].join(", ")}`] : [],
      evidencia: "",
      chavesMatriz: [],
    }];
  return saida;
}
