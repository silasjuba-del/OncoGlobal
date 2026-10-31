import rulesetIntervalo from "../../../corpus/rulesets/rads-interval.v1.json" with { type: "json" };
import { intervalProgression, lerIntervalo } from "../../rules/intervalProgression.js";
// FUGU-11a · Radiologia longitudinal + porta INTERVAL_PROGRESSION (D-W9-43; modelo 10).
// Regras de projeção puras. A regra clínica em si é do Grok (`src/rules`, GROK-06):
// a porta usa a implementação canônica com o corpus versionado local.
import type { ClinicalFact, ReviewException } from "../extracao/tipos.js";
import { normalizarDataCivil, normalizarMedidaMm, normalizarSitioAnatomico } from "../extracao/normalizacao.js";

export type EvolucaoImagem =
  | "APARECIMENTO" | "CRESCIMENTO" | "REDUCAO" | "ESTABILIDADE" | "DESAPARECIMENTO" | "INDETERMINADO";

export type TipoComparacao = "AUMENTO" | "REDUCAO" | "ESTAVEL";

export interface ComparacaoDeclarada {
  readonly tipo: TipoComparacao;
  /** Data do exame de referência citado pela própria fonte (civil). */
  readonly refData: string | null;
}

export interface PontoImagem {
  readonly data: string | null;
  readonly metodo: string | null;
  readonly sitio: string;
  readonly lateralidade: string | null;
  readonly medidaMm: number | null;
  readonly comparacao: ComparacaoDeclarada | null;
  readonly segmentId: string;
  readonly factId: string;
  readonly sourceId: string;
  readonly rawEvidence: string;
}

export interface SerieImagem {
  readonly sitio: string;
  /** Lateralidade conhecida do sítio (a primeira informada na série). */
  readonly lateralidade: string | null;
  readonly pontos: readonly PontoImagem[];
  readonly evolucao: EvolucaoImagem;
}

const AUSENCIA = /\b(?:sem lesao|sem lesão|desaparec\w*|resolvid\w*)\b/iu;
const NOVIDADE = /\b(?:nov[oa]\s+lesao|nov[oa]\s+lesão|surgimento|aparecimento)\b/iu;

function valorImagem(fact: ClinicalFact): Record<string, unknown> {
  return typeof fact.value === "object" && fact.value !== null
    ? fact.value as Record<string, unknown> : {};
}

/** Sítio do ponto: canônico quando reconhecido, senão o rótulo literal da fonte (ex.: "L5"). */
export function sitioDoFato(fact: ClinicalFact): string | null {
  const v = valorImagem(fact);
  const canonico = typeof v.sitioCanonico === "string" ? v.sitioCanonico : normalizarSitioAnatomico(
    typeof v.siteRaw === "string" ? v.siteRaw : null);
  if (canonico) return canonico;
  return typeof v.siteRaw === "string" && v.siteRaw.trim()
    ? v.siteRaw.trim().toLocaleUpperCase("pt-BR") : null;
}

function comparacaoDe(v: Record<string, unknown>): ComparacaoDeclarada | null {
  const bruto = v.comparacao;
  if (typeof bruto !== "object" || bruto === null) return null;
  const c = bruto as Record<string, unknown>;
  const tipo = c.tipo === "AUMENTO" || c.tipo === "REDUCAO" || c.tipo === "ESTAVEL" ? c.tipo : null;
  if (!tipo) return null;
  return { tipo, refData: normalizarDataCivil(typeof c.refData === "string" ? c.refData : null) };
}

function evolucaoDe(pontos: readonly PontoImagem[]): EvolucaoImagem {
  if (pontos.length < 2) return "INDETERMINADO";
  const ultimo = pontos.at(-1)!;
  if (AUSENCIA.test(ultimo.rawEvidence)) return "DESAPARECIMENTO";
  if (pontos.some((p) => NOVIDADE.test(p.rawEvidence))) return "APARECIMENTO";
  const primeiro = pontos[0]!;
  if (primeiro.medidaMm === null || ultimo.medidaMm === null) return "INDETERMINADO";
  if (ultimo.medidaMm > primeiro.medidaMm) return "CRESCIMENTO";
  if (ultimo.medidaMm < primeiro.medidaMm) return "REDUCAO";
  return "ESTABILIDADE";
}

/**
 * Agrupa fatos de imagem do MESMO sítio anatômico em séries seriadas (ordem cronológica).
 * Sítio sem tabela canônica (ex.: "L5") mantém o rótulo literal da fonte.
 */
export function seriesDeImagem(fatos: readonly ClinicalFact[]): readonly SerieImagem[] {
  const grupos = new Map<string, PontoImagem[]>();
  for (const fact of fatos) {
    if (fact.domain !== "imaging") continue;
    const sitio = sitioDoFato(fact);
    if (!sitio) continue;
    const v = valorImagem(fact);
    const pontos = grupos.get(sitio) ?? [];
    pontos.push({
      data: normalizarDataCivil(fact.date ?? null),
      metodo: typeof v.metodo === "string" ? v.metodo : null,
      sitio,
      lateralidade: typeof v.lateralidade === "string" ? v.lateralidade : null,
      medidaMm: typeof v.measureMm === "number" ? v.measureMm
        : normalizarMedidaMm(v.measureRaw, v.unit),
      comparacao: comparacaoDe(v),
      segmentId: fact.segmentId,
      factId: fact.id,
      sourceId: fact.sourceId,
      rawEvidence: fact.rawEvidence,
    });
    grupos.set(sitio, pontos);
  }
  return [...grupos.entries()].map(([sitio, pontos]) => {
    const ordenados = [...pontos].sort((a, b) =>
      (a.data ?? "9999").localeCompare(b.data ?? "9999") || a.factId.localeCompare(b.factId));
    return {
      sitio,
      lateralidade: ordenados.find((p) => p.lateralidade !== null)?.lateralidade ?? null,
      pontos: ordenados,
      evolucao: evolucaoDe(ordenados),
    };
  }).sort((a, b) => a.sitio.localeCompare(b.sitio));
}

// ── Porta da regra clínica (implementação canônica: Grok `src/rules`) ────────
export interface EntradaProgressao {
  readonly sitio: string;
  readonly metodoAnterior: string | null;
  readonly metodoAtual: string | null;
  readonly anteriorMm: number | null;
  readonly atualMm: number | null;
  /** A própria fonte declara aumento seriado no mesmo sítio (ex.: cintilografia × cintilografia). */
  readonly aumentoDeclarado: boolean;
  readonly comparacaoAtual?: TipoComparacao | null;
}

export interface VereditoProgressao {
  readonly decisao: "ALERTA" | "PENDENTE" | "PASSA";
  readonly motivo: string;
  readonly regra: string;
}

export interface RegraProgressao {
  avaliar(entrada: EntradaProgressao): VereditoProgressao;
}

/** D-W9-43: regra canônica, sem classificação automática de metástase. */
const intervalo = lerIntervalo(rulesetIntervalo);
export const regraProgressaoIntervalar: RegraProgressao = {
  avaliar(e) {
    const r = intervalProgression(
      { data: null, sitio: e.sitio, metodo: e.metodoAnterior, lateralidade: null, medidaMm: e.anteriorMm, descricao: null, exameDirigido: null },
      { data: null, sitio: e.sitio, metodo: e.metodoAtual, lateralidade: null, medidaMm: e.atualMm,
        descricao: e.comparacaoAtual === "ESTAVEL" ? "estável" : e.comparacaoAtual === "REDUCAO" ? "reduzido" : e.aumentoDeclarado ? "aumento" : null,
        exameDirigido: null }, intervalo);
    return { decisao: r.estado === "ALERTA" ? "ALERTA" : r.estado === "PENDENTE" ? "PENDENTE" : "PASSA",
      motivo: [...r.motivos, ...r.pendencias].map(m => m.texto).join("; ") || "sem aumento no mesmo sítio e método",
      regra: r.decisao };
  },
};

/** Exceções de progressão intervalar suspeita (alerta, nunca metástase). */
export function excecoesProgressao(
  series: readonly SerieImagem[],
  regra: RegraProgressao = regraProgressaoIntervalar,
): readonly ReviewException[] {
  const excecoes: ReviewException[] = [];
  for (const serie of series) {
    // Notas sem data, inclusive pedidos de RM, não substituem o exame datado mais recente.
    const datados = serie.pontos.filter(p => p.data !== null);
    const atual = datados.at(-1);
    if (!atual) continue;
    const anterior = atual.comparacao?.refData
      ? datados.find(p => p !== atual && p.data === atual.comparacao!.refData) ?? null
      : datados.at(-2) ?? null;
    const texto = atual.rawEvidence.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
    const metodoReferido = /(?:em relacao (?:a|ao)|comparad[oa] (?:com|a|ao))\s+(?:a\s+|o\s+)?(co|tc|rm|cintilografia(?: ossea)?|tomografia|ressonancia|mamografia|ultrassonografia)\b/.exec(texto)?.[1] ?? null;
    const aumentoDeclarado = atual.comparacao?.tipo === "AUMENTO";
    if (!anterior && !aumentoDeclarado) continue;
    const veredito = regra.avaliar({
      sitio: serie.sitio,
      metodoAnterior: anterior?.metodo ?? metodoReferido,
      metodoAtual: atual.metodo,
      anteriorMm: anterior?.medidaMm ?? null,
      atualMm: atual.medidaMm,
      aumentoDeclarado, comparacaoAtual: atual.comparacao?.tipo ?? null,
    });
    if (veredito.decisao !== "ALERTA") continue;
    excecoes.push({
      id: `exc:INTERVAL_PROGRESSION:${serie.sitio}:${atual.factId}`,
      kind: "INTERVAL_PROGRESSION",
      // O alerta pertence ao segmento do exame mais recente: rastreável, não órfão.
      segmentId: atual.segmentId,
      factIds: serie.pontos.map((p) => p.factId),
      reason: `${veredito.motivo} (regra ${veredito.regra})`,
      sourceIds: [...new Set(serie.pontos.map((p) => p.sourceId))],
    });
  }
  return excecoes;
}

// ── M1 visceral: escopo explícito, nunca M0 ──────────────────────────────────
export interface MetastaseVisceral {
  readonly estado: "SEM_M1_VISIVEL" | "SUSPEITO" | "INDETERMINADO";
  readonly escopo: string;
  readonly motivo: string;
}

/**
 * "Sem M1 visceral identificável nos exames apresentados" ≠ M0.
 * O escopo é sempre declarado; M0 é ato médico e nunca é produzido aqui.
 */
export function classificarMetastaseVisceral(series: readonly SerieImagem[]): MetastaseVisceral {
  const suspeitos = series.filter((s) => s.evolucao === "CRESCIMENTO" || s.evolucao === "APARECIMENTO");
  if (suspeitos.length) {
    return { estado: "SUSPEITO", escopo: "exames apresentados",
      motivo: `achado indeterminado/suspeito em ${suspeitos.map((s) => s.sitio).join(", ")}; `
        + "não classificar como metástase neste momento" };
  }
  if (!series.length) {
    return { estado: "INDETERMINADO", escopo: "exames apresentados",
      motivo: "nenhum exame de imagem com sítio reconhecido: nada a afirmar" };
  }
  return { estado: "SEM_M1_VISIVEL", escopo: "exames apresentados",
    motivo: "sem M1 visceral identificável nos exames apresentados (≠ M0)" };
}
