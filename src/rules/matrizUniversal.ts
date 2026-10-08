// W11-H17 · matriz universal canônica (PLN-012). Hierarquia fixa: CATEGORIA › CLASSE › SEÇÃO › TÓPICO › OUTROS [+].
// OUTROS existe em todos os níveis e só estende o canônico. Funções puras: o corpus entra por parâmetro.

export type Eixo = "X" | "Y" | "Z";
export type VerboZ = "INVESTIGAR" | "TRATAR" | "ASSISTIR" | "ENCAMINHAR" | "SEGUIR";

export const VERBOS_Z: readonly VerboZ[] = ["INVESTIGAR", "TRATAR", "ASSISTIR", "ENCAMINHAR", "SEGUIR"];
export const PRIORIDADES: readonly string[] = ["Eletiva", "Prioritária", "Urgente", "Emergência"];
export const NUMERO_PRIORIDADE = 2;
export const TOTAL_CATEGORIAS = 8;

export interface ItemManual {
  readonly nome: string;
  readonly origem: "MANUAL";
}

interface NoBase {
  readonly id: string;
  readonly nome: string;
  readonly outros: boolean;
  readonly manuais?: readonly ItemManual[];
}

export interface Topico extends NoBase {}
export interface Secao extends NoBase { readonly topicos: readonly Topico[]; }
export interface Classe extends NoBase { readonly verbo?: VerboZ | null; readonly secoes: readonly Secao[]; }
export interface Categoria extends NoBase {
  readonly numero: number;
  readonly eixo: Eixo;
  readonly verbo: VerboZ | null;
  readonly natureza?: "ARTEFATO";
  readonly classes: readonly Classe[];
}

export interface MatrizUniversal {
  readonly schemaVersion: string;
  readonly status: string;
  readonly consumivel: boolean;
  readonly categorias: readonly Categoria[];
  readonly header?: unknown;
}

export type ResultadoValidacao =
  | { readonly ok: true; readonly matriz: MatrizUniversal }
  | { readonly ok: false; readonly erros: readonly string[] };

type Obj = Record<string, unknown>;
const ehObjeto = (v: unknown): v is Obj => typeof v === "object" && v !== null && !Array.isArray(v);
const ehTexto = (v: unknown): v is string => typeof v === "string" && v.trim().length > 0;

const validarNo = (no: unknown, caminho: string, erros: string[]): no is Obj => {
  if (!ehObjeto(no)) { erros.push(`${caminho}: nó inválido`); return false; }
  if (!ehTexto(no.id)) erros.push(`${caminho}: id ausente`);
  if (!ehTexto(no.nome)) erros.push(`${caminho}: nome ausente`);
  if (no.outros !== true) erros.push(`${caminho}: nível sem outros (OUTROS [+] obrigatório em todos os níveis)`);
  return true;
};

const validarLista = (valor: unknown, caminho: string, erros: string[]): valor is Obj[] => {
  if (!Array.isArray(valor) || valor.length === 0) { erros.push(`${caminho}: lista vazia ou ausente`); return false; }
  const ids = new Set<string>();
  for (const [i, item] of valor.entries()) {
    if (ehObjeto(item) && ehTexto(item.id)) {
      if (ids.has(item.id)) erros.push(`${caminho}[${i}]: id duplicado (${item.id})`);
      ids.add(item.id);
    }
  }
  return true;
};

const validarVerbo = (verbo: unknown, caminho: string, erros: string[]): void => {
  if (verbo === undefined || verbo === null) return;
  if (!VERBOS_Z.includes(verbo as VerboZ)) erros.push(`${caminho}: verbo inválido (${String(verbo)})`);
};

/** Valida a matriz inteira: 8 categorias, 4 níveis fixos com OUTROS em todos, eixo/verbo coerentes, prioridade com 4 níveis. */
export function validarMatrizUniversal(valor: unknown): ResultadoValidacao {
  const erros: string[] = [];
  if (!ehObjeto(valor)) return { ok: false, erros: ["matriz: não é objeto"] };
  if (!validarLista(valor.categorias, "categorias", erros)) return { ok: false, erros };
  const cats = valor.categorias as Obj[];
  if (cats.length !== TOTAL_CATEGORIAS) erros.push(`categorias: esperadas ${TOTAL_CATEGORIAS}, há ${cats.length}`);

  cats.forEach((cat, ci) => {
    const cp = `categorias[${ci}]`;
    if (!validarNo(cat, cp, erros)) return;
    if (!Number.isInteger(cat.numero)) erros.push(`${cp}: numero ausente`);
    if (cat.eixo !== "X" && cat.eixo !== "Y" && cat.eixo !== "Z") erros.push(`${cp}: eixo deve ser X, Y ou Z`);
    validarVerbo(cat.verbo, `${cp}.verbo`, erros);
    if ((cat.eixo === "X" || cat.eixo === "Y") && cat.verbo !== null) erros.push(`${cp}: eixo ${String(cat.eixo)} não tem verbo`);
    if (!validarLista(cat.classes, `${cp}.classes`, erros)) return;

    if (cat.numero === NUMERO_PRIORIDADE) {
      const nomes = (cat.classes as Obj[]).map((c) => c.nome);
      const ok = nomes.length === PRIORIDADES.length && PRIORIDADES.every((p, i) => nomes[i] === p);
      if (!ok) erros.push(`${cp}: prioridade deve ter exatamente ${PRIORIDADES.join(" · ")}`);
    }

    (cat.classes as Obj[]).forEach((cl, cli) => {
      const clp = `${cp}.classes[${cli}]`;
      if (!validarNo(cl, clp, erros)) return;
      validarVerbo(cl.verbo, `${clp}.verbo`, erros);
      if (!validarLista(cl.secoes, `${clp}.secoes`, erros)) return;
      (cl.secoes as Obj[]).forEach((sec, si) => {
        const sp = `${clp}.secoes[${si}]`;
        if (!validarNo(sec, sp, erros)) return;
        if (!validarLista(sec.topicos, `${sp}.topicos`, erros)) return;
        (sec.topicos as Obj[]).forEach((top, ti) => {
          validarNo(top, `${sp}.topicos[${ti}]`, erros);
        });
      });
    });
  });

  if (erros.length > 0) return { ok: false, erros };
  return { ok: true, matriz: valor as unknown as MatrizUniversal };
}

/** Versão que lança em caso de erro: usada pelo carregamento do corpus. */
export function lerMatrizUniversal(valor: unknown): MatrizUniversal {
  const r = validarMatrizUniversal(valor);
  if (!r.ok) throw new Error(`matriz universal inválida: ${r.erros.join("; ")}`);
  return r.matriz;
}

const clonar = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

type Filhos = "classes" | "secoes" | "topicos" | null;
const FILHOS: Record<"categorias" | "classes" | "secoes" | "topicos", Filhos> = {
  categorias: "classes", classes: "secoes", secoes: "topicos", topicos: null,
};

/**
 * Seleção do cluster: mantém apenas os caminhos pertinentes (chaves "cat/classe/secao/topico").
 * Uma chave que aponta um nó traz a subárvore inteira; ancestrais ficam para preservar a hierarquia.
 * Não muta a matriz de entrada.
 */
export function subconjunto(matriz: MatrizUniversal, chaves: readonly string[]): MatrizUniversal {
  const copia = clonar(matriz);
  const cobre = (chave: string): boolean => chaves.some((c) => chave === c || chave.startsWith(`${c}/`));
  const ancestral = (chave: string): boolean => chaves.some((c) => c.startsWith(`${chave}/`));

  const filtra = <T extends { id: string }>(nos: readonly T[], nivel: keyof typeof FILHOS, prefixo: string | null): T[] => {
    const saida: T[] = [];
    for (const no of nos) {
      const chave = prefixo === null ? no.id : `${prefixo}/${no.id}`;
      if (cobre(chave)) { saida.push(no); continue; }
      if (!ancestral(chave)) continue;
      const filho = FILHOS[nivel];
      if (filho === null) continue;
      const alvo = no as unknown as Record<string, unknown>;
      alvo[filho] = filtra((alvo[filho] as { id: string }[]), filho, chave);
      saida.push(no);
    }
    return saida;
  };

  return { ...copia, categorias: filtra(copia.categorias as unknown as { id: string }[], "categorias", null) as unknown as Categoria[] };
}

/**
 * Item manual do médico: anexa `{ nome, origem: "MANUAL" }` ao nó indicado pelo caminho de ids.
 * O canônico (nome, classes, seções, tópicos) nunca é alterado. Não muta a matriz de entrada.
 */
export function adicionarOutro(matriz: MatrizUniversal, caminho: readonly string[], texto: string): MatrizUniversal {
  const nome = texto.trim();
  if (nome.length === 0) throw new Error("adicionarOutro: texto vazio");
  if (caminho.length === 0) throw new Error("adicionarOutro: caminho vazio");
  const copia = clonar(matriz);

  type NoAlvo = { id: string; outros: boolean; manuais?: ItemManual[] } & Record<string, unknown>;
  let nivel: keyof typeof FILHOS = "categorias";
  let nos = copia.categorias as unknown as NoAlvo[];
  let alvo: NoAlvo | undefined;
  for (const [i, id] of caminho.entries()) {
    alvo = nos.find((n) => n.id === id);
    if (!alvo) throw new Error(`adicionarOutro: caminho inexistente (${caminho.join("/")})`);
    const filho: Filhos = FILHOS[nivel];
    if (filho === null) {
      if (i !== caminho.length - 1) throw new Error(`adicionarOutro: caminho além do tópico (${caminho.join("/")})`);
      break;
    }
    nos = (alvo[filho] as NoAlvo[] | undefined) ?? [];
    nivel = filho;
  }
  if (!alvo || alvo.outros !== true) throw new Error("adicionarOutro: nível sem OUTROS");
  alvo.manuais = [...(alvo.manuais ?? []), { nome, origem: "MANUAL" }];
  return copia;
}
