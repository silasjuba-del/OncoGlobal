// PROVISORIO-W10: trocar por src/contracts/w10/... quando o tech lead publicar.
// Valores aqui são propostas com origem, NÃO Dado<T> confirmado nem eventos do ledger.
export type FactDomain =
  | "diagnosis" | "histology" | "stage" | "biomarker" | "metastasis"
  | "drug" | "regimen" | "cycle" | "symptom" | "toxicity"
  | "lab" | "imaging" | "procedure" | "plan";

export type FactSourceType =
  | "pathology" | "imaging_report" | "prescription" | "medical_note"
  | "nursing" | "plaud" | "administration";
export type FactEvidence = "EXPLICIT" | "DERIVED" | "INFERRED" | "UNCERTAIN";
export type FactProvenance =
  | "EXTRACTED" | "DOCUMENT_CONFIRMED" | "INFERRED" | "UNCERTAIN" | "NOT_FOUND";

export interface EncounterSegment {
  readonly id: string;
  readonly recordingId: string;
  readonly sourceId: string;
  readonly sourceType: FactSourceType;
  readonly startMs: number | null;
  readonly endMs: number | null;
  readonly speakers: readonly string[];
  readonly candidateNames: readonly string[];
  readonly rawTranscript: string;
  readonly boundaryConfidence: number | null;
  readonly boundaryReviewRequired: boolean;
  /** Vinculação com paciente só por decisão explícita do médico. */
  readonly patientId: string | null;
}

export interface ClinicalFact<T = unknown> {
  readonly id: string;
  readonly segmentId: string;
  readonly patientCandidateId: string | null;
  readonly domain: FactDomain;
  readonly value: T;
  readonly sourceType: FactSourceType;
  readonly evidence: FactEvidence;
  readonly sourceId: string;
  readonly rawEvidence: string;
  readonly page?: number;
  readonly timestampMs?: number;
  readonly date?: string;
  readonly confidence: number;
  readonly requiresConfirmation: boolean;
  /** Obrigatória para DERIVED/INFERRED; não transforma proposta em confirmação. */
  readonly regra?: string;
}

export interface PatientCandidate {
  readonly patientId: string;
  readonly score: number;
  readonly reasons: Readonly<Record<string, string>>;
  /** Mesmo score alto não vincula o segmento automaticamente (D-W9-34a). */
  readonly requiresReview: true;
}

export interface ReconciledField<T> {
  readonly candidates: readonly ClinicalFact<T>[];
  /** null tanto para ausência como para conflito não decidido. */
  readonly resolved: ClinicalFact<T> | null;
  readonly conflict: boolean;
}

export type ExceptionKind =
  | "UNLINKED_PATIENT" | "REVISAR_FRONTEIRA" | "SPOKEN_NUMBER"
  | "UNCERTAIN_DRUG" | "CONFLICT" | "TEMPORAL_CONFLICT" | "MISSING_REQUIRED";

export interface Exception {
  readonly kind: ExceptionKind;
  readonly segmentId: string;
  readonly factIds: readonly string[];
  readonly reason: string;
  readonly sourceIds: readonly string[];
}

/** Referência a decisão já validada fora deste pipeline; não é criada pelo extrator. */
export interface PhysicianConfirmation {
  readonly medicoId: string;
  readonly decisionEventId: string;
}

/**
 * Mapeamento para vocabulário de proveniência existente (D-W9-33).
 * Não confundir EXTRACTED (texto reconhecido) com DOCUMENT_CONFIRMED (decisão humana).
 */
export function mapearProveniencia(
  fact: ClinicalFact | null,
  confirmacao?: PhysicianConfirmation,
): { provenance: FactProvenance; regra?: string } {
  if (fact === null) return { provenance: "NOT_FOUND" };
  if (confirmacao) {
    if (!confirmacao.medicoId.trim() || !confirmacao.decisionEventId.trim()) {
      throw new Error("Confirmação médica exige identificador e evento de decisão");
    }
    return { provenance: "DOCUMENT_CONFIRMED" };
  }
  if (fact.evidence === "EXPLICIT") return { provenance: "EXTRACTED" };
  if (fact.evidence === "UNCERTAIN") return { provenance: "UNCERTAIN" };
  if (!fact.regra?.trim()) throw new Error("Inferência exige regra nomeada");
  return { provenance: "INFERRED", regra: fact.regra };
}
