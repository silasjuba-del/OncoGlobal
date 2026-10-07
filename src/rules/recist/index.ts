import type { RecistAvaliacao } from "../../contracts/w10/clinico-w10.js";

export type RecistTipoAlvo = "NAO_NODAL" | "LINFONODO";
export type RecistEixo = "MAIOR" | "CURTO";
export type EstadoNaoAlvo = "AUSENTE_DOCUMENTADO" | "PERSISTENTE_SEM_PROGRESSAO" | "PROGRESSAO_INEQUIVOCA" | "NAO_AVALIADO";

export interface RecistAlvoDefinido {
  codigo: string;
  tipo: RecistTipoAlvo;
  eixo: RecistEixo;
}

export interface RecistLesaoMedida {
  codigo: string;
  diametroMm: number;
  fonteIds: readonly string[];
}

export interface RecistPontoSerie {
  eventId: string;
  patientId: string;
  tumorLotId: string | null;
  episodioId: string;
  data: string;
  lesoes: readonly RecistLesaoMedida[];
  novasLesoes: boolean | null;
  naoAlvos: EstadoNaoAlvo;
  fonteIds: readonly string[];
}

export interface RecistSerieInput {
  patientId: string;
  tumorLotId: string | null;
  episodioId: string;
  baselineEventId: string;
  alvos: readonly RecistAlvoDefinido[];
  pontos: readonly RecistPontoSerie[];
}

export type RecistPendencia =
  | "SERIE_VAZIA"
  | "IDENTIDADE_OU_EPISODIO_DIVERGENTE"
  | "BASELINE_AUSENTE_OU_DUPLICADO"
  | "BASELINE_INVALIDO"
  | "DATA_INVALIDA"
  | "CONFLITO_TEMPORAL"
  | "EVENTO_DUPLICADO"
  | "ALVOS_INVALIDOS"
  | "ALVOS_DUPLICADOS"
  | "ALVO_AUSENTE"
  | "ALVO_DUPLICADO"
  | "ALVO_NAO_DECLARADO"
  | "MEDIDA_INVALIDA"
  | "PROVENIENCIA_AUSENTE"
  | "BASELINE_ZERO_SEM_PERCENTUAL"
  | "NADIR_ZERO_SEM_PERCENTUAL"
  | "BASELINE_SEM_COMPARACAO"
  | "NOVAS_LESOES_NAO_AVALIADAS"
  | "NAO_ALVOS_NAO_AVALIADOS"
  | "CATEGORIA_GLOBAL_INCOMPLETA";

export interface RecistCalculoPonto {
  data: string;
  eventId: string;
  somaMm: number;
  baselineMm: number;
  nadirMm: number;
  deltaBaselineMm: number;
  deltaBaselinePct: number | null;
  deltaNadirMm: number;
  deltaNadirPct: number | null;
  /** Lowest sum through this point; deltaNadir compares against nadirMm before this point. */
  novoNadirMm: number;
  novoNadirEventId: string;
  nadirEventId: string;
  /** Target-lesion progression candidate only; it is not the global RECIST category. */
  progressaoAlvos: "PROPOSTO_PD" | null;
  revisao: "PROPOSTO";
  lesoes: readonly (RecistLesaoMedida & { tipo: RecistTipoAlvo; eixo: RecistEixo })[];
  fonteIds: readonly string[];
}

export interface RecistPontoResultado {
  eventId: string;
  data: string;
  estado: "CALCULADO" | "PENDENTE";
  estadoCalculo: "CALCULADO" | "PENDENTE";
  estadoInterpretacao: "PROPOSTO" | "PENDENTE";
  calculo: RecistCalculoPonto | null;
  avaliacao: RecistAvaliacao | null;
  categoriaGlobal: RecistAvaliacao["categoria"];
  pendencias: readonly RecistPendencia[];
}

export interface RecistSerieResultado {
  estado: "CALCULADO" | "PENDENTE";
  estadoCalculo: "CALCULADO" | "PENDENTE";
  estadoInterpretacao: "PROPOSTO" | "PENDENTE";
  baselineEventId: string;
  pontos: readonly RecistPontoResultado[];
  pendencias: readonly RecistPendencia[];
}

function dataValida(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year!, month! - 1, day!));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month! - 1 && date.getUTCDate() === day;
}

function unicaOrdenada<T extends string>(values: readonly T[]): T[] {
  return [...new Set(values)].sort();
}

function pendente(eventId: string, data: string, pendencias: readonly RecistPendencia[]): RecistPontoResultado {
  return { eventId, data, estado: "PENDENTE", estadoCalculo: "PENDENTE", estadoInterpretacao: "PENDENTE", calculo: null, avaliacao: null, categoriaGlobal: null,
    pendencias: unicaOrdenada(pendencias) };
}

/**
 * Longitudinal target-lesion calculation with proposed RECIST categories when
 * target, non-target, and new-lesion inputs are complete. Every category remains
 * PROPOSTO for physician review.
 */
export function avaliarSerieRecist(input: RecistSerieInput): RecistSerieResultado {
  const seriePendencias = new Set<RecistPendencia>();
  if (!input.pontos.length) seriePendencias.add("SERIE_VAZIA");
  if (!input.alvos.length || input.alvos.some((a) => !a.codigo
    || (a.tipo === "LINFONODO" && a.eixo !== "CURTO")
    || (a.tipo === "NAO_NODAL" && a.eixo !== "MAIOR")
    || !["LINFONODO", "NAO_NODAL"].includes(a.tipo)
    || !["CURTO", "MAIOR"].includes(a.eixo))) seriePendencias.add("ALVOS_INVALIDOS");
  const codigosAlvo = input.alvos.map((a) => a.codigo);
  if (new Set(codigosAlvo).size !== codigosAlvo.length) seriePendencias.add("ALVOS_DUPLICADOS");

  const pontosOrdenados = [...input.pontos].sort((a, b) =>
    a.data.localeCompare(b.data) || a.eventId.localeCompare(b.eventId));
  if (new Set(pontosOrdenados.map((p) => p.eventId)).size !== pontosOrdenados.length)
    seriePendencias.add("EVENTO_DUPLICADO");
  if (pontosOrdenados.some((p) => !dataValida(p.data))) seriePendencias.add("DATA_INVALIDA");
  if (pontosOrdenados.some((p, i) => i > 0 && p.data === pontosOrdenados[i - 1]!.data))
    seriePendencias.add("CONFLITO_TEMPORAL");
  if (pontosOrdenados.some((p) => p.patientId !== input.patientId
    || p.tumorLotId !== input.tumorLotId || p.episodioId !== input.episodioId))
    seriePendencias.add("IDENTIDADE_OU_EPISODIO_DIVERGENTE");
  const baselines = pontosOrdenados.filter((p) => p.eventId === input.baselineEventId);
  if (baselines.length !== 1) seriePendencias.add("BASELINE_AUSENTE_OU_DUPLICADO");
  else if (pontosOrdenados[0]?.eventId !== input.baselineEventId) seriePendencias.add("BASELINE_AUSENTE_OU_DUPLICADO");

  if (seriePendencias.size) {
    const perPoint = pontosOrdenados.map((p) => pendente(p.eventId, p.data, [...seriePendencias]));
    return { estado: "PENDENTE", estadoCalculo: "PENDENTE", estadoInterpretacao: "PENDENTE",
      baselineEventId: input.baselineEventId,
      pontos: perPoint, pendencias: unicaOrdenada([...seriePendencias]) };
  }

  const alvoPorCodigo = new Map(input.alvos.map((a) => [a.codigo, a]));
  const validos: Array<{ ponto: RecistPontoSerie; soma: number; lesoes: RecistCalculoPonto["lesoes"] }> = [];
  const resultados: RecistPontoResultado[] = [];
  let baselineInvalido = false;
  let motivosBaseline: RecistPendencia[] = [];

  for (const ponto of pontosOrdenados) {
    const faltas: RecistPendencia[] = [];
    if (ponto.novasLesoes !== null && typeof ponto.novasLesoes !== "boolean")
      faltas.push("NOVAS_LESOES_NAO_AVALIADAS");
    if (!["AUSENTE_DOCUMENTADO", "PERSISTENTE_SEM_PROGRESSAO", "PROGRESSAO_INEQUIVOCA", "NAO_AVALIADO"]
      .includes(ponto.naoAlvos)) faltas.push("NAO_ALVOS_NAO_AVALIADOS");
    if (!ponto.eventId || ponto.lesoes.some((l) => !l.codigo)) faltas.push("ALVOS_INVALIDOS");
    if (!ponto.fonteIds.length || ponto.fonteIds.some((id) => !id)
      || ponto.lesoes.some((l) => !l.fonteIds.length || l.fonteIds.some((id) => !id)))
      faltas.push("PROVENIENCIA_AUSENTE");
    const codigos = ponto.lesoes.map((l) => l.codigo);
    if (new Set(codigos).size !== codigos.length) faltas.push("ALVO_DUPLICADO");
    if (codigos.some((codigo) => !alvoPorCodigo.has(codigo))) faltas.push("ALVO_NAO_DECLARADO");
    if (codigosAlvo.some((codigo) => !codigos.includes(codigo))) faltas.push("ALVO_AUSENTE");
    if (ponto.lesoes.some((l) => !Number.isFinite(l.diametroMm) || l.diametroMm < 0))
      faltas.push("MEDIDA_INVALIDA");
    if (faltas.length) {
      if (ponto.eventId === input.baselineEventId) { baselineInvalido = true; motivosBaseline = [...faltas]; }
      resultados.push(pendente(ponto.eventId, ponto.data, faltas));
      continue;
    }
    if (baselineInvalido) {
      resultados.push(pendente(ponto.eventId, ponto.data, ["BASELINE_INVALIDO", ...motivosBaseline]));
      continue;
    }

    const lesoes = [...ponto.lesoes].sort((a, b) => a.codigo.localeCompare(b.codigo)).map((l) => ({
      ...l,
      fonteIds: unicaOrdenada(l.fonteIds),
      tipo: alvoPorCodigo.get(l.codigo)!.tipo,
      eixo: alvoPorCodigo.get(l.codigo)!.eixo,
    }));
    const soma = lesoes.reduce((total, lesao) => total + lesao.diametroMm, 0);
    if (!Number.isFinite(soma)) {
      resultados.push(pendente(ponto.eventId, ponto.data, ["MEDIDA_INVALIDA"]));
      continue;
    }
    validos.push({ ponto, soma, lesoes });

      const baseline = validos.find((v) => v.ponto.eventId === input.baselineEventId)!;
    const anteriores = validos.filter((v) => v.ponto.data < ponto.data);
    const nadirReferencia = ponto.eventId === input.baselineEventId
      ? baseline
      : anteriores.reduce((min, atual) => atual.soma < min.soma ? atual : min);
    const novoNadir = soma < nadirReferencia.soma
      ? { ponto, soma, lesoes } : nadirReferencia;
    const deltaBaselineMm = soma - baseline.soma;
    const deltaNadirMm = soma - nadirReferencia.soma;
    const pctBaselineCalculado = baseline.soma === 0 ? null : (deltaBaselineMm / baseline.soma) * 100;
    const pctNadirCalculado = nadirReferencia.soma === 0 ? null : (deltaNadirMm / nadirReferencia.soma) * 100;
    const deltaBaselinePct = pctBaselineCalculado !== null && Number.isFinite(pctBaselineCalculado)
      ? pctBaselineCalculado : null;
    const deltaNadirPct = pctNadirCalculado !== null && Number.isFinite(pctNadirCalculado)
      ? pctNadirCalculado : null;
    const pendencias: RecistPendencia[] = [];
    if (deltaBaselinePct === null) pendencias.push("BASELINE_ZERO_SEM_PERCENTUAL");
    if (deltaNadirPct === null) pendencias.push("NADIR_ZERO_SEM_PERCENTUAL");
    if (ponto.novasLesoes === null) pendencias.push("NOVAS_LESOES_NAO_AVALIADAS");
    if (ponto.naoAlvos === "NAO_AVALIADO") pendencias.push("NAO_ALVOS_NAO_AVALIADOS");
    const isBaseline = ponto.eventId === input.baselineEventId;
    if (isBaseline) pendencias.push("BASELINE_SEM_COMPARACAO");

    const progressaoAlvos = deltaNadirPct !== null && deltaNadirMm >= 5 && deltaNadirPct >= 20
      ? "PROPOSTO_PD" as const : null;
    let categoriaGlobal: RecistAvaliacao["categoria"] = null;
    let avaliacao: RecistAvaliacao | null = null;
    if (!isBaseline && deltaBaselinePct !== null && deltaNadirPct !== null
      && ponto.novasLesoes !== null && ponto.naoAlvos !== "NAO_AVALIADO") {
      if (progressaoAlvos || ponto.novasLesoes || ponto.naoAlvos === "PROGRESSAO_INEQUIVOCA") {
        categoriaGlobal = "PD";
      } else {
        const respostaCompleta = lesoes.every((l) => l.tipo === "LINFONODO"
          ? l.diametroMm < 10 : l.diametroMm === 0)
          && ponto.naoAlvos === "AUSENTE_DOCUMENTADO";
        if (respostaCompleta) categoriaGlobal = "RC";
        else if (deltaBaselinePct <= -30) categoriaGlobal = "RP";
        else categoriaGlobal = "DE";
      }
      avaliacao = {
        data: ponto.data,
        somaMm: soma,
        baselineMm: baseline.soma,
        nadirMm: nadirReferencia.soma,
        deltaBaselinePct,
        deltaNadirPct,
        deltaNadirMm,
        novasLesoes: ponto.novasLesoes,
        categoria: categoriaGlobal,
        revisao: "PROPOSTO",
      };
    } else if (!isBaseline) {
      pendencias.push("CATEGORIA_GLOBAL_INCOMPLETA");
    }
    const calculo: RecistCalculoPonto = {
      data: ponto.data,
      eventId: ponto.eventId,
      somaMm: soma,
      baselineMm: baseline.soma,
      nadirMm: nadirReferencia.soma,
      novoNadirMm: novoNadir.soma,
      novoNadirEventId: novoNadir.ponto.eventId,
      deltaBaselineMm,
      deltaBaselinePct,
      deltaNadirMm,
      deltaNadirPct,
      nadirEventId: nadirReferencia.ponto.eventId,
      progressaoAlvos,
      revisao: "PROPOSTO",
      lesoes,
      fonteIds: unicaOrdenada(ponto.fonteIds),
    };
    const estadoCalculo = deltaBaselinePct === null || deltaNadirPct === null ? "PENDENTE" : "CALCULADO";
    resultados.push({ eventId: ponto.eventId, data: ponto.data,
      estado: estadoCalculo,
      estadoCalculo,
      estadoInterpretacao: categoriaGlobal ? "PROPOSTO" : "PENDENTE", calculo, avaliacao,
      categoriaGlobal, pendencias: unicaOrdenada(pendencias) });
  }

  const pendenciasSerie = unicaOrdenada(resultados.flatMap((p) => p.pendencias));
  const seguimentos = resultados.filter((p) => p.eventId !== input.baselineEventId);
  const estadoCalculo = resultados.every((p) => p.estadoCalculo === "CALCULADO") ? "CALCULADO" : "PENDENTE";
  return {
    estado: estadoCalculo,
    estadoCalculo,
    estadoInterpretacao: seguimentos.length > 0 && seguimentos.every((p) => p.estadoInterpretacao === "PROPOSTO")
      ? "PROPOSTO" : "PENDENTE",
    baselineEventId: input.baselineEventId,
    pontos: resultados,
    pendencias: pendenciasSerie,
  };
}
