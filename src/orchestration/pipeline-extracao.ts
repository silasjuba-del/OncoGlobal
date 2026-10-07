// Pipeline de extração multimodal — 9 etapas puras encadeadas (D-W9-33; spec §1).
// Sem I/O, sem relógio, sem rede: cada etapa recebe e devolve dados.
// "IA EXTRAI TUDO. CÓDIGO RECONCILIA. MÉDICO SÓ RESOLVE EXCEÇÕES."
import type {
  ClinicalFact, EncounterSegment, FactSourceType, PatientCandidate, ReconciledField,
  ReviewAction, ReviewException,
} from "../kernel/extracao/tipos.js";
import type { PatientTimeline } from "../contracts/w10/clinico-w10.js";
import { segmentarTranscricao } from "../kernel/extracao/segmenter.js";
import { rankearPacientes, type IdentityHints, type RegistryPatient } from "../kernel/extracao/patient-resolver.js";
import { extratorDeterministico } from "../kernel/extracao/extrator.js";
import { normalizarFatos as normalizar } from "../kernel/extracao/normalizacao.js";
import { detectarConflitos, reconciliarCampos } from "../kernel/extracao/reconciliacao.js";
import { validarSegurancaAntiAlucinacao, type ViolacaoInvariante } from "../kernel/extracao/safety.js";
import {
  excecaoDeFarmacoIncerto, excecaoDeNumeroFalado, excecoesDeVinculo, montarCaixaRevisao,
  type CaixaRevisao,
} from "../kernel/extracao/caixaRevisao.js";
import { faltantesObrigatorios, requiredBiomarkers } from "../kernel/extracao/biomarcadores.js";
import { excecoesProgressao, seriesDeImagem, type SerieImagem } from "../kernel/projections/radiologia.js";
import { projetarTimelinePaciente } from "../kernel/projections/timelinePaciente.js";

export interface ExtractionInput {
  readonly recordingId: string;
  readonly sourceId: string;
  readonly sourceType: FactSourceType;
  readonly page?: number;
  /** Texto já convertido localmente; nenhum documento ou áudio sai deste módulo. */
  readonly rawTranscript: string;
  /** Cadastro e pistas vêm do chamador local; texto livre sozinho não prova identidade. */
  readonly registeredPatients?: readonly RegistryPatient[];
  readonly identityHintsBySegment?: Readonly<Record<string, IdentityHints>>;
  readonly openedPatientId?: string;
  /** Contexto local do tumor (cadastro/consulta aberta) para o Biomarker Requirement Engine. */
  readonly tumorContexto?: Readonly<{ tumor?: string; histologia?: string | null; estadio?: string | null }>;
  /** Ações médicas JÁ persistidas no ledger; entram por parâmetro, nunca nascem aqui (D-W9-34a). */
  readonly confirmacoes?: readonly ReviewAction[];
}

export interface ExtractionState {
  readonly input: ExtractionInput;
  readonly segments: readonly EncounterSegment[];
  readonly patientCandidates: readonly PatientCandidate[];
  readonly facts: readonly ClinicalFact[];
  readonly fields: Readonly<Record<string, ReconciledField>>;
  readonly conflitos: readonly ReviewException[];
  readonly exceptions: readonly ReviewException[];
  readonly rejeitados: readonly ClinicalFact[];
  readonly violacoes: readonly ViolacaoInvariante[];
  readonly caixaRevisao: CaixaRevisao;
  readonly series: readonly SerieImagem[];
  /** Projeção do primeiro paciente ligado; null enquanto não houver decisão persistida. */
  readonly timeline: PatientTimeline | null;
  readonly timelines: readonly PatientTimeline[];
  readonly confirmationRequired: readonly ReviewException[];
}

function base(input: ExtractionInput): ExtractionState {
  return {
    input, segments: [], patientCandidates: [], facts: [], fields: {}, conflitos: [],
    exceptions: [], rejeitados: [], violacoes: [],
    caixaRevisao: { itens: [], resumo: { reconciliadosAutomaticamente: 0, precisamConfirmacao: 0, texto: "", lista: [] } },
    series: [], timeline: null, timelines: [], confirmationRequired: [],
  };
}

/** 1 — Segmenter preliminar: uma entrada não é tomada como um paciente. */
export function segmentar(state: ExtractionState): ExtractionState {
  const { input } = state;
  if (!input.rawTranscript.trim()) return state;
  return {
    ...state,
    segments: segmentarTranscricao({
      recordingId: input.recordingId,
      sourceId: input.sourceId,
      sourceType: input.sourceType,
      ...(input.page === undefined ? {} : { page: input.page }),
      turns: input.rawTranscript.split(/\r?\n/).map((text) => ({ text, startMs: null, endMs: null })),
    }),
  };
}

/** 2 — PatientResolver: sem evidência de cadastro, zero candidato/vínculo. */
export function identificarPaciente(state: ExtractionState): ExtractionState {
  const { input } = state;
  return {
    ...state,
    patientCandidates: state.segments.flatMap((segment) =>
      rankearPacientes(
        segment.id,
        input.identityHintsBySegment?.[segment.id] ?? {},
        input.registeredPatients ?? [],
        { desidentified: segment.sourceType === "plaud", ...(input.openedPatientId
          ? { openedPatientId: input.openedPatientId } : {}) },
      )),
  };
}

/** 3 — porta do extrator (dublê determinístico dos sintéticos; LLM desligada). */
export function extrairFatos(state: ExtractionState): ExtractionState {
  return { ...state, facts: state.segments.flatMap((segment) =>
    extratorDeterministico.extrair(segment)) };
}

/** 4 — normalização: unidades, data civil −03:00, lateralidade, sítio, fármaco, TNM. */
export function normalizarFatos(state: ExtractionState): ExtractionState {
  return { ...state, facts: normalizar(state.facts) };
}

/** 5 — reconciliação multifonte: cada campo vira `ReconciledField` + conflitos explícitos. */
export function reconciliarFontes(state: ExtractionState): ExtractionState {
  return {
    ...state,
    fields: reconciliarCampos(state.facts),
    conflitos: detectarConflitos(state.facts),
  };
}

/** 6 — SafetyValidator: os 7 invariantes anti-alucinação (FUGU-08). */
export function validarSeguranca(state: ExtractionState): ExtractionState {
  const resultado = validarSegurancaAntiAlucinacao(state.facts, {
    conflitoTemporalDetectado: state.conflitos.some((c) => c.kind === "TEMPORAL_CONFLICT"),
  });
  return { ...state, facts: resultado.facts, rejeitados: resultado.rejeitados, violacoes: resultado.violacoes };
}

/** 7 — conflitos/pendências viram a caixa de revisão (o que vai ao médico). */
export function classificarExcecoes(state: ExtractionState): ExtractionState {
  const vinculos = state.segments.flatMap((segment) => excecoesDeVinculo({
    id: segment.id, sourceId: segment.sourceId,
    boundaryReviewRequired: segment.boundaryReviewRequired,
  }));
  const numerosFalados = state.facts
    .filter((f) => f.sourceType === "plaud" && f.requiresConfirmation
      && (f.domain === "lab" || f.domain === "cycle" || f.domain === "imaging"))
    .map(excecaoDeNumeroFalado);
  const farmacosIncertos = state.facts.filter((f) => f.domain === "drug" && f.evidence === "INFERRED")
    .map(excecaoDeFarmacoIncerto);
  const series = seriesDeImagem(state.facts);
  const progressoes = excecoesProgressao(series);
  const requisitos = requiredBiomarkers({
    tumor: state.input.tumorContexto?.tumor ?? tumorDosFatos(state.facts),
    histologia: state.input.tumorContexto?.histologia ?? histologiaDosFatos(state.facts),
    estadio: state.input.tumorContexto?.estadio ?? null,
  });
  const faltantes = faltantesObrigatorios(state.facts, requisitos, state.segments[0]?.id ?? null);
  const caixaRevisao = montarCaixaRevisao({
    fatos: state.facts,
    conflitos: state.conflitos, vinculos,
    faltantes: [...faltantes], progressoes: [...progressoes],
  });
  return {
    ...state,
    series,
    exceptions: [
      ...caixaRevisao.itens,
      ...numerosFalados.filter((e) => !caixaRevisao.itens.some((i) => i.factIds.some((f) => e.factIds.includes(f)))),
      ...farmacosIncertos.filter((e) => !caixaRevisao.itens.some((i) => i.kind === "UNCERTAIN_DRUG" && i.factIds.some((f) => e.factIds.includes(f)))),
    ],
    caixaRevisao,
  };
}

function tumorDosFatos(fatos: readonly ClinicalFact[]): string | null {
  for (const fact of fatos) {
    if (fact.domain !== "diagnosis") continue;
    const v = typeof fact.value === "object" && fact.value !== null
      ? fact.value as Record<string, unknown> : {};
    if (typeof v.sitioCanonico === "string" && v.sitioCanonico.trim()) return v.sitioCanonico;
  }
  return null;
}

function histologiaDosFatos(fatos: readonly ClinicalFact[]): string | null {
  for (const fact of fatos) {
    if (fact.domain !== "histology") continue;
    if (typeof fact.value === "string" && fact.value.trim()) return fact.value.trim();
    const v = typeof fact.value === "object" && fact.value !== null
      ? fact.value as Record<string, unknown> : {};
    if (typeof v.texto === "string" && v.texto.trim()) return v.texto.trim();
  }
  return null;
}

/** 8 — timeline longitudinal só para paciente ligado por decisão persistida. */
export function projetarTimeline(state: ExtractionState): ExtractionState {
  const porId = new Map(state.exceptions.map((e) => [e.id, e]));
  const conflitantes = new Set(["CONFLICT", "TEMPORAL_CONFLICT", "INTERVAL_PROGRESSION"]);
  const acoes = state.input.confirmacoes ?? [];
  const timelines: PatientTimeline[] = [];
  const vistos = new Set<string>();
  for (const acao of acoes) {
    if (acao.acao !== "LIGAR_PACIENTE" || !acao.patientId) continue;
    const segmentId = porId.get(acao.exceptionId)?.segmentId ?? null;
    const chave = `${acao.patientId}\u0000${segmentId ?? ""}`;
    if (vistos.has(chave)) continue;
    vistos.add(chave);
    const fatos = segmentId === null ? [] : state.facts.filter((f) => f.segmentId === segmentId);
    if (!fatos.length) continue;
    const conflitos = state.exceptions
      .filter((e) => conflitantes.has(e.kind) && e.segmentId === segmentId);
    const faltantes = state.exceptions
      .filter((e) => e.kind === "MISSING_REQUIRED" && e.segmentId === segmentId)
      .map((e) => e.reason.replace(/^campo obrigatório ausente para [^:]+: /, "").replace(/ \(NÃO SEI.*$/, ""));
    timelines.push(projetarTimelinePaciente({
      patientId: acao.patientId, fatos, conflitos, missingRequiredData: faltantes,
    }));
  }
  const ordenadas = timelines.sort((a, b) => a.patientId.localeCompare(b.patientId));
  return { ...state, timelines: ordenadas, timeline: ordenadas[0] ?? null };
}

/** 9 — apenas prepara exceções; nunca confirma, grava ou assina. */
export function prepararConfirmacaoMedica(state: ExtractionState): ExtractionState {
  return { ...state, confirmationRequired: [...state.exceptions] };
}

/** Nove transformações síncronas e puras, em ordem normativa; nenhuma faz I/O. */
export function executarPipelineExtracao(input: ExtractionInput): ExtractionState {
  if (!input.recordingId.trim() || !input.sourceId.trim()) {
    throw new Error("Entrada exige recordingId e sourceId");
  }
  return prepararConfirmacaoMedica(
    projetarTimeline(
      classificarExcecoes(
        validarSeguranca(
          reconciliarFontes(
            normalizarFatos(
              extrairFatos(
                identificarPaciente(segmentar(base(input))),
              ),
            ),
          ),
        ),
      ),
    ),
  );
}
