import type { RecistAvaliacao } from "../../contracts/w10/clinico-w10.js";

export type RecistTipoAlvo = "NAO_NODAL" | "LINFONODO";
export type RecistEixo = "MAIOR" | "CURTO";
export type EstadoNaoAlvo = "AUSENTE_DOCUMENTADO" | "PERSISTENTE_SEM_PROGRESSAO" | "PROGRESSAO_INEQUIVOCA" | "NAO_AVALIADO";
export type MetodoMedicao = "TC" | "CXR" | "CALIPER" | "RM" | "US" | "OUTRO";
export type QualidadeMedicao = "ADEQUADA" | "INADEQUADA" | "NAO_AVALIADA";

export interface RecistAlvoDefinido {
  codigo: string;
  tipo: RecistTipoAlvo;
  eixo: RecistEixo;
  orgaoId: string | null;
  elegibilidadeBasal: "ELEGIVEL" | "NAO_ELEGIVEL" | null;
  fonteElegibilidadeIds: readonly string[];
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
  metodo: MetodoMedicao;
  tecnicaId: string | null;
  espessuraCorteMm: number | null;
  qualidadeMedicao: QualidadeMedicao;
  lesoes: readonly RecistLesaoMedida[];
  /** true means unequivocal new malignant lesion; equivocal/unassessed maps to null. */
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
  | "ALVOS_MAXIMO_EXCEDIDO"
  | "ALVOS_ORGAO_MAXIMO_EXCEDIDO"
  | "ORGAO_ALVO_AUSENTE"
  | "ALVO_ELEGIBILIDADE_AUSENTE"
  | "ALVO_BASAL_NAO_ELEGIVEL"
  | "FONTE_ELEGIBILIDADE_AUSENTE"
  | "MEDIDA_BASAL_INELEGIVEL"
  | "METODO_NAO_SUPORTADO"
  | "METODO_TECNICA_DIVERGENTE"
  | "QUALIDADE_MEDICAO_PENDENTE"
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
  lesoes: readonly (RecistLesaoMedida & RecistAlvoDefinido)[];
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
  categoriaGlobalRevisao: "PROPOSTO" | "PENDENTE";
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

function textoPresente(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function pendente(eventId: string, data: string, pendencias: readonly RecistPendencia[]): RecistPontoResultado {
  return { eventId, data, estado: "PENDENTE", estadoCalculo: "PENDENTE", estadoInterpretacao: "PENDENTE", calculo: null, avaliacao: null, categoriaGlobal: null,
    categoriaGlobalRevisao: "PENDENTE", pendencias: unicaOrdenada(pendencias) };
}

/**
 * Longitudinal target-lesion calculation with proposed RECIST categories when
 * target, non-target, and new-lesion inputs are complete. Every category remains
 * PROPOSTO for physician review.
 */
export function avaliarSerieRecist(input: RecistSerieInput): RecistSerieResultado {
  const seriePendencias = new Set<RecistPendencia>();
  if (!input.pontos.length) seriePendencias.add("SERIE_VAZIA");
  if (!textoPresente(input.patientId) || !textoPresente(input.episodioId))
    seriePendencias.add("IDENTIDADE_OU_EPISODIO_DIVERGENTE");
  if (input.tumorLotId !== null && !textoPresente(input.tumorLotId))
    seriePendencias.add("IDENTIDADE_OU_EPISODIO_DIVERGENTE");
  if (!input.alvos.length || input.alvos.some((a) => !textoPresente(a.codigo)
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
  if (pontosOrdenados.some((p) => !textoPresente(p.patientId) || !textoPresente(p.episodioId)
    || p.patientId !== input.patientId
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

  const bloqueiosElegibilidade = new Set<RecistPendencia>();
  if (input.alvos.length > 5) bloqueiosElegibilidade.add("ALVOS_MAXIMO_EXCEDIDO");
  const porOrgao = new Map<string, number>();
  for (const alvo of input.alvos) {
    if (!textoPresente(alvo.orgaoId)) bloqueiosElegibilidade.add("ORGAO_ALVO_AUSENTE");
    else porOrgao.set(alvo.orgaoId, (porOrgao.get(alvo.orgaoId) ?? 0) + 1);
    if (alvo.elegibilidadeBasal == null) bloqueiosElegibilidade.add("ALVO_ELEGIBILIDADE_AUSENTE");
    else if (alvo.elegibilidadeBasal !== "ELEGIVEL") bloqueiosElegibilidade.add("ALVO_BASAL_NAO_ELEGIVEL");
    if (!Array.isArray(alvo.fonteElegibilidadeIds) || !alvo.fonteElegibilidadeIds.length
      || alvo.fonteElegibilidadeIds.some((id) => !textoPresente(id)))
      bloqueiosElegibilidade.add("FONTE_ELEGIBILIDADE_AUSENTE");
  }
  if ([...porOrgao.values()].some((total) => total > 2))
    bloqueiosElegibilidade.add("ALVOS_ORGAO_MAXIMO_EXCEDIDO");

  const baselineInput = baselines[0]!;
  const baselineLesoes = new Map(baselineInput.lesoes.map((l) => [l.codigo, l]));
  if (!textoPresente(baselineInput.tecnicaId)) bloqueiosElegibilidade.add("METODO_NAO_SUPORTADO");
  if (baselineInput.metodo === "TC") {
    if (!Number.isFinite(baselineInput.espessuraCorteMm) || baselineInput.espessuraCorteMm! <= 0)
      bloqueiosElegibilidade.add("METODO_NAO_SUPORTADO");
  } else if (["CXR", "CALIPER"].includes(baselineInput.metodo)) {
    if (baselineInput.espessuraCorteMm !== null) bloqueiosElegibilidade.add("METODO_NAO_SUPORTADO");
  } else {
    bloqueiosElegibilidade.add("METODO_NAO_SUPORTADO");
  }
  for (const alvo of input.alvos) {
    const medida = baselineLesoes.get(alvo.codigo);
    if (!medida || !Number.isFinite(medida.diametroMm) || medida.diametroMm < 0) continue;
    let minimo: number | null = null;
    if (baselineInput.metodo === "TC" && Number.isFinite(baselineInput.espessuraCorteMm)
      && baselineInput.espessuraCorteMm! > 0) {
      if (alvo.tipo === "LINFONODO" && baselineInput.espessuraCorteMm! <= 5) minimo = 15;
      else if (alvo.tipo === "NAO_NODAL")
        minimo = Math.max(10, baselineInput.espessuraCorteMm! > 5 ? 2 * baselineInput.espessuraCorteMm! : 10);
    } else if (baselineInput.metodo === "CALIPER" && alvo.tipo === "NAO_NODAL") minimo = 10;
    else if (baselineInput.metodo === "CXR" && alvo.tipo === "NAO_NODAL") minimo = 20;
    else bloqueiosElegibilidade.add("METODO_NAO_SUPORTADO");
    if (minimo === null || medida.diametroMm < minimo) bloqueiosElegibilidade.add("MEDIDA_BASAL_INELEGIVEL");
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
    if (!textoPresente(ponto.eventId) || ponto.lesoes.some((l) => !textoPresente(l.codigo))) faltas.push("ALVOS_INVALIDOS");
    if (ponto.metodo !== baselineInput.metodo || ponto.tecnicaId !== baselineInput.tecnicaId
      || ponto.espessuraCorteMm !== baselineInput.espessuraCorteMm)
      faltas.push("METODO_TECNICA_DIVERGENTE");
    if (ponto.qualidadeMedicao !== "ADEQUADA") faltas.push("QUALIDADE_MEDICAO_PENDENTE");
    if (!ponto.fonteIds.length || ponto.fonteIds.some((id) => !textoPresente(id))
      || ponto.lesoes.some((l) => !l.fonteIds.length || l.fonteIds.some((id) => !textoPresente(id))))
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

    const lesoes = [...ponto.lesoes].sort((a, b) => a.codigo.localeCompare(b.codigo)).map((l) => {
      const alvo = alvoPorCodigo.get(l.codigo)!;
      return {
        ...l,
        fonteIds: unicaOrdenada(l.fonteIds),
        ...alvo,
        fonteElegibilidadeIds: unicaOrdenada(alvo.fonteElegibilidadeIds),
      };
    });
    const soma = lesoes.reduce((total, lesao) => total + lesao.diametroMm, 0);
    if (!Number.isFinite(soma)) {
      if (ponto.eventId === input.baselineEventId) {
        baselineInvalido = true;
        motivosBaseline = ["MEDIDA_INVALIDA"];
      }
      resultados.push(pendente(ponto.eventId, ponto.data, ["MEDIDA_INVALIDA"]));
      continue;
    }
    validos.push({ ponto, soma, lesoes });

    const baseline = validos.find((v) => v.ponto.eventId === input.baselineEventId);
    if (!baseline) {
      resultados.push(pendente(ponto.eventId, ponto.data, ["BASELINE_INVALIDO", ...motivosBaseline]));
      continue;
    }
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
    const pendencias: RecistPendencia[] = [...bloqueiosElegibilidade];
    if (deltaBaselinePct === null) pendencias.push("BASELINE_ZERO_SEM_PERCENTUAL");
    if (deltaNadirPct === null) pendencias.push("NADIR_ZERO_SEM_PERCENTUAL");
    if (ponto.novasLesoes === null) pendencias.push("NOVAS_LESOES_NAO_AVALIADAS");
    if (ponto.naoAlvos === "NAO_AVALIADO") pendencias.push("NAO_ALVOS_NAO_AVALIADOS");
    const isBaseline = ponto.eventId === input.baselineEventId;
    if (isBaseline) pendencias.push("BASELINE_SEM_COMPARACAO");

    const progressaoAlvos = bloqueiosElegibilidade.size === 0
      && deltaNadirPct !== null && deltaNadirMm >= 5 && deltaNadirPct >= 20
      ? "PROPOSTO_PD" as const : null;
    let categoriaGlobal: RecistAvaliacao["categoria"] = null;
    let avaliacao: RecistAvaliacao | null = null;
    if (!isBaseline && bloqueiosElegibilidade.size === 0 && deltaBaselinePct !== null) {
      if (ponto.novasLesoes === true || ponto.naoAlvos === "PROGRESSAO_INEQUIVOCA" || progressaoAlvos) {
        categoriaGlobal = "PD";
      } else if (ponto.novasLesoes === false && ponto.naoAlvos !== "NAO_AVALIADO" && deltaBaselinePct !== null) {
        const respostaCompleta = lesoes.every((l) => l.tipo === "LINFONODO"
          ? l.diametroMm < 10 : l.diametroMm === 0)
          && ponto.naoAlvos === "AUSENTE_DOCUMENTADO";
        if (respostaCompleta) categoriaGlobal = "RC";
        else if (deltaBaselinePct <= -30) categoriaGlobal = "RP";
        else if (deltaNadirPct !== null) categoriaGlobal = "DE";
      }
    }
    if (categoriaGlobal !== null && deltaBaselinePct !== null && deltaNadirPct !== null
      && ponto.novasLesoes !== null && ponto.naoAlvos !== "NAO_AVALIADO") {
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
    }
    if (!isBaseline && categoriaGlobal === null) {
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
      categoriaGlobal, categoriaGlobalRevisao: categoriaGlobal ? "PROPOSTO" : "PENDENTE",
      pendencias: unicaOrdenada(pendencias) });
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
