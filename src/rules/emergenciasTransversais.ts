// W11-H26 · biblioteca transversal de emergências (PLN-003 §5–§9, PLN-020 Camada 1, PLN-030 §8).
// Função pura: o corpus entra por parâmetro. Emergência gera PADRÃO + EVIDÊNCIAS + PENDÊNCIAS + KIT de categorias de ação.
// Nunca porcentagem, nunca dose, nunca conduta fixa. A PRIORIDADE fica vazia (null) até o médico marcar.

export interface AchadoEmergencia {
  readonly id: string;
  readonly rotulo: string;
}

export interface EmergenciaTransversal {
  readonly id: string;
  readonly nome: string;
  readonly origem: readonly string[];
  readonly minimoPresentes: number;
  readonly achados: readonly AchadoEmergencia[];
  readonly pendencias: readonly AchadoEmergencia[];
  readonly kit: readonly string[];
}

export interface CategoriaKit {
  readonly id: string;
  readonly nome: string;
  readonly outros?: boolean;
}

export interface CorpusEmergencias {
  readonly header?: unknown;
  readonly schemaVersion: string;
  readonly status: string;
  readonly consumivel: boolean;
  readonly kitCategorias: readonly CategoriaKit[];
  readonly emergencias: readonly EmergenciaTransversal[];
}

export interface EntradaEmergencias {
  /** Ids de achados confirmados como presentes no registro (já extraídos e revisados). */
  readonly achadosPresentes: readonly string[];
}

export interface PadraoEmergencia {
  readonly id: string;
  readonly nome: string;
  readonly origem: readonly string[];
  readonly padraoCompativel: boolean;
  readonly evidenciasPresentes: readonly AchadoEmergencia[];
  /** Achados esperados não presentes e pendências a checar. Ausente = PENDENTE, nunca negativo. */
  readonly evidenciasAusentes: readonly AchadoEmergencia[];
  readonly kit: readonly CategoriaKit[];
  readonly prioridade: null;
  readonly prioridadeDecididaPor: "MEDICO";
}

export interface ResultadoEmergencias {
  readonly padroes: readonly PadraoEmergencia[];
  /** Ids recebidos que não existem no corpus. Não são ignorados em silêncio. */
  readonly desconhecidos: readonly string[];
  readonly schemaVersion: string;
  readonly status: string;
}

const OUTROS_ID = "OUTROS";

export function avaliarEmergenciasTransversais(
  corpus: CorpusEmergencias,
  entrada: EntradaEmergencias,
): ResultadoEmergencias {
  if (!Array.isArray(entrada.achadosPresentes) || entrada.achadosPresentes.some((a) => typeof a !== "string")) {
    throw new TypeError("achadosPresentes deve ser lista de ids (texto)");
  }

  const presentes = new Set(entrada.achadosPresentes);
  const conhecidos = new Set<string>();
  for (const e of corpus.emergencias) {
    for (const a of e.achados) conhecidos.add(a.id);
  }
  const desconhecidos = [...presentes].filter((id) => !conhecidos.has(id)).sort();

  const categoriaPorId = new Map(corpus.kitCategorias.map((c) => [c.id, c] as const));

  const padroes: PadraoEmergencia[] = [];
  for (const e of corpus.emergencias) {
    const evidenciasPresentes = e.achados.filter((a) => presentes.has(a.id));
    if (evidenciasPresentes.length === 0) continue;

    const evidenciasAusentes = [
      ...e.achados.filter((a) => !presentes.has(a.id)),
      ...e.pendencias,
    ];

    const idsKit = e.kit.filter((id) => id !== OUTROS_ID);
    const kit: CategoriaKit[] = idsKit
      .map((id) => categoriaPorId.get(id))
      .filter((c): c is CategoriaKit => c !== undefined);
    const outros = categoriaPorId.get(OUTROS_ID);
    if (outros) kit.push(outros);

    padroes.push({
      id: e.id,
      nome: e.nome,
      origem: e.origem,
      padraoCompativel: evidenciasPresentes.length >= e.minimoPresentes,
      evidenciasPresentes,
      evidenciasAusentes,
      kit,
      prioridade: null,
      prioridadeDecididaPor: "MEDICO",
    });
  }

  return {
    padroes,
    desconhecidos,
    schemaVersion: corpus.schemaVersion,
    status: corpus.status,
  };
}
