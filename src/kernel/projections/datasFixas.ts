// W11-H14 · Datas fixas do cabeçalho clínico (decisão Dr. Silas): biópsia, C1D1 do tratamento vigente,
// último estadiamento/reestadiamento (com tipo) e última exposição, mais os "dias desde" calculados.
// Projeção pura sobre eventos JÁ CONFIRMADOS: fato não confirmado não conta; ausente = PENDENTE (null);
// conflito = PENDENTE com motivo CONFLITO (nunca escolhe); a referência temporal vem por parâmetro, nunca do relógio.
import type { ClinicalEvent } from "../../contracts/operacao.js";
import { TreatmentAdministration } from "../../contracts/clinico.js";
import { dadosDoEvento, eventosVigentes } from "./snapshot.js";

export type EstadoDataFixa = "PREENCHIDO" | "PENDENTE";
export type MotivoPendencia = "AUSENTE" | "CONFLITO";
export type TipoEstadiamento = "STAGING" | "RESTAGING";

export interface DataFixa {
  /** Data civil YYYY-MM-DD ou null quando PENDENTE. */
  readonly data: string | null;
  readonly estado: EstadoDataFixa;
  readonly motivo: MotivoPendencia | null;
  /** Id do evento-fato que sustenta a data (menor eventId entre os que a sustentam); null quando PENDENTE. */
  readonly fonte: string | null;
  /** Ids dos eventos em conflito; preenchido somente com motivo CONFLITO. */
  readonly fontesConflitantes: readonly string[];
}

export interface DataEstadiamento extends DataFixa {
  readonly tipo: TipoEstadiamento | null;
}

export interface DatasFixas {
  readonly dataReferencia: string;
  readonly biopsyDate: DataFixa;
  readonly c1d1Date: DataFixa;
  readonly lastStagingDate: DataEstadiamento;
  readonly lastRestagingDate: DataFixa;
  readonly lastTreatmentDate: DataFixa;
  /** Dias corridos entre cada data e dataReferencia (dataReferencia - data); null quando a data está PENDENTE. */
  readonly diasDesde: {
    readonly c1d1: number | null;
    readonly lastTreatment: number | null;
    readonly lastRestaging: number | null;
  };
}

interface Candidato { readonly eventId: string; readonly data: string }
interface CandidatoEstadiamento extends Candidato { readonly tipo: TipoEstadiamento }
interface CandidatoCiclo extends Candidato { readonly linha: number; readonly ciclo: number }
interface CandidatoExposicao extends Candidato { readonly adminId: string }

const DIA_MS = 86_400_000;

function ehDataCivil(valor: unknown): valor is string {
  if (typeof valor !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(valor)) return false;
  const t = Date.parse(`${valor}T00:00:00Z`);
  return Number.isFinite(t) && new Date(t).toISOString().slice(0, 10) === valor;
}

function inteiroPositivo(valor: unknown): valor is number {
  return typeof valor === "number" && Number.isInteger(valor) && valor >= 1;
}

function dataDoEvento(evento: ClinicalEvent): string | null {
  const d = dadosDoEvento(evento);
  return d && ehDataCivil(d.dataClinica) ? d.dataClinica : null;
}

function ausente(): DataFixa {
  return { data: null, estado: "PENDENTE", motivo: "AUSENTE", fonte: null, fontesConflitantes: [] };
}

function conflito(ids: readonly string[]): DataFixa {
  return { data: null, estado: "PENDENTE", motivo: "CONFLITO", fonte: null,
    fontesConflitantes: [...new Set(ids)].sort() };
}

function preenchido(data: string, ids: readonly string[]): DataFixa {
  return { data, estado: "PREENCHIDO", motivo: null, fonte: [...ids].sort()[0] ?? null, fontesConflitantes: [] };
}

/** Uma data única para um mesmo evento clínico: datas distintas = CONFLITO; nenhuma = AUSENTE. */
function fechar(candidatos: readonly Candidato[]): DataFixa {
  if (candidatos.length === 0) return ausente();
  const datas = new Set(candidatos.map((c) => c.data));
  if (datas.size > 1) return conflito(candidatos.map((c) => c.eventId));
  return preenchido(candidatos[0]!.data, candidatos.map((c) => c.eventId));
}

/** Candidatos na data mais recente (civil). Nunca escolhe entre datas diferentes de forma ambígua: a mais recente vence. */
function naDataMaisRecente<T extends Candidato>(candidatos: readonly T[]): T[] {
  if (candidatos.length === 0) return [];
  const maisRecente = candidatos.reduce((max, c) => (c.data > max ? c.data : max), candidatos[0]!.data);
  return candidatos.filter((c) => c.data === maisRecente);
}

function diasEntre(dataFato: string, dataReferencia: string): number {
  return Math.round((Date.parse(`${dataReferencia}T00:00:00Z`) - Date.parse(`${dataFato}T00:00:00Z`)) / DIA_MS);
}

function dias(data: DataFixa, dataReferencia: string): number | null {
  return data.data === null ? null : diasEntre(data.data, dataReferencia);
}

function candidatosDeEstadiamento(vigentes: readonly ClinicalEvent[]): CandidatoEstadiamento[] {
  return vigentes.filter((e) => e.tipo === "Staging").flatMap((e) => {
    const d = dadosDoEvento(e);
    const data = dataDoEvento(e);
    if (!d || data === null || (d.tipo !== "STAGING" && d.tipo !== "RESTAGING")) return [];
    return [{ eventId: e.eventId, data, tipo: d.tipo }];
  });
}

/**
 * Projeção das datas fixas do cabeçalho clínico.
 * Recebe os eventos do paciente (ou do lote); só CONFIRMADO/ASSINADO e não substituídos entram (eventosVigentes).
 * Tipos consumidos: "Biopsy" (data.dataClinica); "Staging" (data.tipo STAGING|RESTAGING, data.dataClinica);
 * "TreatmentCycle" (data.linha, data.ciclo, data.dataClinica); "TreatmentAdministration" (contrato clinico + data.dataClinica).
 */
export function projetarDatasFixas(eventos: readonly ClinicalEvent[], dataReferencia: string): DatasFixas {
  if (!ehDataCivil(dataReferencia)) {
    throw new Error(`dataReferencia civil inválida: ${String(dataReferencia)}`);
  }
  const vigentes = eventosVigentes(eventos);

  // Biópsia (diagnóstico): datas distintas para o mesmo evento = CONFLITO.
  const biopsias: Candidato[] = vigentes.filter((e) => e.tipo === "Biopsy").flatMap((e) => {
    const data = dataDoEvento(e);
    return data === null ? [] : [{ eventId: e.eventId, data }];
  });
  const biopsyDate = fechar(biopsias);

  // C1D1: ciclo 1 da linha VIGENTE (maior linha confirmada). Nova linha sem C1 = PENDENTE, nunca cai na anterior.
  const ciclos: CandidatoCiclo[] = vigentes.filter((e) => e.tipo === "TreatmentCycle").flatMap((e) => {
    const d = dadosDoEvento(e);
    const data = dataDoEvento(e);
    if (!d || data === null || !inteiroPositivo(d.linha) || !inteiroPositivo(d.ciclo)) return [];
    return [{ eventId: e.eventId, data, linha: d.linha, ciclo: d.ciclo }];
  });
  const linhaVigente = ciclos.length ? Math.max(...ciclos.map((c) => c.linha)) : null;
  const c1d1Date = fechar(ciclos.filter((c) => c.linha === linhaVigente && c.ciclo === 1));

  // Estadiamento e reestadiamento: a data mais recente vence; mesma data com tipos diferentes = CONFLITO.
  const estadiamentos = candidatosDeEstadiamento(vigentes);
  const ultimosEstadiamentos = naDataMaisRecente(estadiamentos);
  const tiposUltimos = new Set(ultimosEstadiamentos.map((c) => c.tipo));
  const lastStagingDate: DataEstadiamento =
    ultimosEstadiamentos.length === 0 ? { ...ausente(), tipo: null }
      : tiposUltimos.size > 1 ? { ...conflito(ultimosEstadiamentos.map((c) => c.eventId)), tipo: null }
        : { ...preenchido(ultimosEstadiamentos[0]!.data, ultimosEstadiamentos.map((c) => c.eventId)),
          tipo: ultimosEstadiamentos[0]!.tipo };

  const reestadiamentos: Candidato[] = estadiamentos.filter((c) => c.tipo === "RESTAGING");
  const lastRestagingDate = fechar(naDataMaisRecente(reestadiamentos));

  // Última exposição: maior data de administração confirmada que não foi omitida.
  // A mesma administração com datas diferentes = CONFLITO (nenhuma data é eleita).
  const exposicoes: CandidatoExposicao[] = vigentes.filter((e) => e.tipo === "TreatmentAdministration").flatMap((e) => {
    const data = dataDoEvento(e);
    const d = dadosDoEvento(e);
    if (!d || data === null) return [];
    const { dataClinica: _ignorada, ...administracao } = d;
    const parsed = TreatmentAdministration.safeParse(administracao);
    if (!parsed.success || parsed.data.status === "OMITIDA") return [];
    return [{ eventId: e.eventId, data, adminId: parsed.data.adminId }];
  });
  const datasPorAdmin = new Map<string, Set<string>>();
  for (const x of exposicoes) {
    datasPorAdmin.set(x.adminId, (datasPorAdmin.get(x.adminId) ?? new Set<string>()).add(x.data));
  }
  const adminsConflitantes = new Set([...datasPorAdmin].filter(([, ds]) => ds.size > 1).map(([id]) => id));
  const lastTreatmentDate: DataFixa = adminsConflitantes.size > 0
    ? conflito(exposicoes.filter((x) => adminsConflitantes.has(x.adminId)).map((x) => x.eventId))
    : fechar(naDataMaisRecente(exposicoes));

  const dias_ = {
    c1d1: dias(c1d1Date, dataReferencia),
    lastTreatment: dias(lastTreatmentDate, dataReferencia),
    lastRestaging: dias(lastRestagingDate, dataReferencia),
  };

  return {
    dataReferencia,
    biopsyDate,
    c1d1Date,
    lastStagingDate,
    lastRestagingDate,
    lastTreatmentDate,
    diasDesde: dias_,
  };
}
