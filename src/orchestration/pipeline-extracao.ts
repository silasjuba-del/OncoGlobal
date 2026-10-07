import type {
  ClinicalFact, EncounterSegment, Exception, FactSourceType, PatientCandidate,
  ReconciledField,
} from "../kernel/extracao/tipos.js";
import { segmentarTranscricao } from "../kernel/extracao/segmenter.js";
import { rankearPacientes, type IdentityHints, type RegistryPatient } from "../kernel/extracao/patient-resolver.js";

// PROVISORIO-W10: alinhar com src/contracts/w10/... após publicação pelo tech lead.
export interface ExtractionInput {
  readonly recordingId: string;
  readonly sourceId: string;
  readonly sourceType: FactSourceType;
  /** Texto já convertido localmente; nenhum documento ou áudio sai deste módulo. */
  readonly rawTranscript: string;
  /** Cadastro e pistas vêm do chamador local; texto livre sozinho não prova identidade. */
  readonly registeredPatients?: readonly RegistryPatient[];
  readonly identityHintsBySegment?: Readonly<Record<string, IdentityHints>>;
  readonly openedPatientId?: string;
}

export interface ExtractionState {
  readonly input: ExtractionInput;
  readonly segments: readonly EncounterSegment[];
  readonly patientCandidates: readonly PatientCandidate[];
  readonly facts: readonly ClinicalFact[];
  readonly fields: Readonly<Record<string, ReconciledField<unknown>>>;
  readonly exceptions: readonly Exception[];
  /** Só pode ser produzido com confirmação persistida; jamais inferir aqui. */
  readonly timeline: null;
  readonly confirmationRequired: readonly Exception[];
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
      turns: input.rawTranscript.split(/\r?\n/).map((text) =>
        ({ text, startMs: null, endMs: null })),
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

/** 3 — porta do extrator será introduzida em FUGU-05; vazio não gera fato. */
export function extrairFatos(state: ExtractionState): ExtractionState {
  return { ...state, facts: [] };
}

/** 4 — sem valores extraídos, não há normalização a adivinhar. */
export function normalizarFatos(state: ExtractionState): ExtractionState {
  return { ...state, facts: [...state.facts] };
}

/** 5 — nenhum campo ausente vira negativo nem valor resolvido. */
export function reconciliarFontes(state: ExtractionState): ExtractionState {
  return { ...state, fields: {} };
}

/** 6 — SafetyValidator será implementado em FUGU-08. */
export function validarSeguranca(state: ExtractionState): ExtractionState {
  return { ...state };
}

/** 7 — toda entrada textual aguarda fronteira e vínculo humano (D-W9-34a). */
export function classificarExcecoes(state: ExtractionState): ExtractionState {
  return {
    ...state,
    exceptions: state.segments.flatMap((segment): Exception[] => [
      ...(segment.boundaryReviewRequired ? [{
        kind: "REVISAR_FRONTEIRA" as const,
        segmentId: segment.id,
        factIds: [],
        reason: "Fronteira ou continuidade da gravação exige revisão",
        sourceIds: [segment.sourceId],
      }] : []),
      {
        kind: "UNLINKED_PATIENT",
        segmentId: segment.id,
        factIds: [],
        reason: "Vínculo com paciente exige confirmação médica",
        sourceIds: [segment.sourceId],
      },
    ]),
  };
}

/** 8 — sem eventos confirmados, a timeline permanece ausente. */
export function projetarTimeline(state: ExtractionState): ExtractionState {
  return { ...state, timeline: null };
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
  const inicial: ExtractionState = {
    input, segments: [], patientCandidates: [], facts: [], fields: {},
    exceptions: [], timeline: null, confirmationRequired: [],
  };
  return prepararConfirmacaoMedica(
    projetarTimeline(
      classificarExcecoes(
        validarSeguranca(
          reconciliarFontes(
            normalizarFatos(
              extrairFatos(
                identificarPaciente(segmentar(inicial)),
              ),
            ),
          ),
        ),
      ),
    ),
  );
}
