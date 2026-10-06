/** Tipos locais de pesquisa; não são contratos canônicos nem fatos clínicos. */

export type StudySourceKind = "TXT" | "MD" | "JSON" | "BINARY_REFERENCE";
export interface StudySource {
  sourceId: string;
  sourceRef: string;
  originalName: string;
  mimeType: string;
  kind: StudySourceKind;
  contentHash: string;
  /** Bytes/texto original integral quando textual; anexos binários ficam referenciados. */
  originalContent: string | null;
  attachmentRef: string | null;
  locator: string | null;
}
export interface EvidenceRef {
  sourceId: string;
  sourceRef: string;
  locator: string;
  exactText: string;
  contentHash: string;
}
export interface EvidencedText { text: string; evidence: EvidenceRef[]; }
export interface StudyCriterionDraft {
  criterionId: string;
  polarity: "INCLUSAO" | "EXCLUSAO";
  groupId: string | null;
  /** Grupo e operador só são preenchidos na revisão médica explícita. */
  groupOperator: "AND" | "OR" | null;
  expression: CriterionExpression | null;
  rawText: string;
  status: "PENDENTE";
  evidence: EvidenceRef[];
}
export type CriterionExpression =
  | { kind: "EQUALS"; factKey: string; value: string | number | boolean }
  | { kind: "NUMBER"; factKey: string; operator: "EQ" | "GT" | "GTE" | "LT" | "LTE"; value: number; unit: string }
  | { kind: "DATE"; factKey: string; operator: "ON_OR_AFTER" | "ON_OR_BEFORE"; value: string };
export interface StudyArmDraft { armId: string; name: EvidencedText; description: EvidencedText | null; }
export interface StudyCandidateDraft {
  candidateId: string;
  sourceId: string;
  sourceHash: string;
  reviewStatus: "PENDENTE_REVISAO_MEDICA";
  studyId: string | null;
  title: EvidencedText | null;
  description: EvidencedText | null;
  arms: StudyArmDraft[];
  inclusionCriteria: StudyCriterionDraft[];
  exclusionCriteria: StudyCriterionDraft[];
  outcomes: EvidencedText[];
  warnings: string[];
}
export interface ExtractiveSummaryDraft {
  text: string;
  method: "DETERMINISTIC_EXTRACTIVE";
  isAiGenerated: false;
  reviewStatus: "PENDENTE_REVISAO_MEDICA";
  evidence: EvidenceRef[];
}
export interface StudyReview {
  candidateId: string;
  decisionId: string;
  reviewerId: string;
  reviewedAt: string;
  decision: "CONFIRMAR" | "REJEITAR";
  version: number;
  candidateHash: string;
  reviewHash: string;
  studyId: string;
  title: EvidencedText;
  reviewedCriteria: ReviewedCriterion[];
  reviewedArmIds: string[];
}
export interface ReviewedCriterion {
  criterionId: string;
  polarity: "INCLUSAO" | "EXCLUSAO";
  groupId: string | null;
  groupOperator: "AND" | "OR" | null;
  expression: CriterionExpression | null;
  applicability: "APLICAVEL" | "NAO_APLICAVEL" | "PENDENTE";
  notApplicableReason: string | null;
  rawText: string;
  evidence: EvidenceRef[];
}
export interface ConfirmedPatientFact {
  patientId: string;
  factKey: string;
  value: string | number | boolean;
  unit?: string;
  status: "CONFIRMADO";
  source: EvidenceRef;
  validFrom?: string;
  validTo?: string;
}
export interface ConflictedPatientFact { patientId: string; factKey: string; status: "CONFLITO"; sources: EvidenceRef[]; }
export type PatientFact = ConfirmedPatientFact | ConflictedPatientFact;
export type CriterionStatus = "ATENDIDO" | "NAO_ATENDIDO" | "PENDENTE" | "NAO_APLICAVEL";
export interface CriterionEvaluation { criterionId: string; status: CriterionStatus; reason: string; sources: EvidenceRef[]; }
export interface MatchResult {
  status: "POSSIBLE_MATCH" | "PENDENTE" | "SEM_MATCH";
  criteria: CriterionEvaluation[];
  reviewedStudyVersion: number;
}
export interface StudyFollowUp {
  followUpId: string;
  studyId: string;
  studyVersion: number;
  patientId: string;
  armId: string;
  kind: "CLINICAL_EVENT" | "TOXICITY" | "IMAGING" | "RESPONSE";
  occurredAt: string;
  source: EvidenceRef;
  clinicalEvent?: { code: string; description: string };
  toxicity?: { term: string; grade: number; ctcaeVersion: "6"; confirmedBy: string };
  imaging?: { description: string; modality: string };
  response?: { value: "PROGRESSAO" | "ESTABILIDADE" | "RESPOSTA" | "PENDENTE"; informedBy: string };
}
