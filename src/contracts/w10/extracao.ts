// W10 · Pipeline de extração multimodal (D-W9-33/34a; spec docs/specs/PIPELINE-EXTRACAO-MULTIMODAL.md).
// Fatos são PROPOSTAS com origem; só viram Dado<T> confirmado por regra documental ou decisão médica.
import { z } from "zod";
import { Id, Instante } from "../base.js";

export const FactDomain = z.enum([
  "diagnosis", "histology", "stage", "biomarker", "metastasis", "drug", "regimen",
  "cycle", "symptom", "toxicity", "lab", "imaging", "procedure", "plan",
]);
export type FactDomain = z.infer<typeof FactDomain>;

export const FactSourceType = z.enum([
  "pathology", "imaging_report", "prescription", "medical_note", "nursing", "plaud", "administration",
]);
export type FactSourceType = z.infer<typeof FactSourceType>;

/** Força da evidência do fato extraído (não é a revisão clínica). */
export const FactEvidence = z.enum(["EXPLICIT", "DERIVED", "INFERRED", "UNCERTAIN"]);
export type FactEvidence = z.infer<typeof FactEvidence>;

/** Vocabulário de proveniência do projeto (D-W9-33): EXPLICIT→EXTRACTED; médico→DOCUMENT_CONFIRMED. */
export const FactProvenance = z.enum(["EXTRACTED", "DOCUMENT_CONFIRMED", "INFERRED", "UNCERTAIN", "NOT_FOUND"]);
export type FactProvenance = z.infer<typeof FactProvenance>;

const Confianca = z.number().min(0).max(1);

/** Uma gravação/documento não é um paciente: é dividido em segmentos antes de qualquer vínculo. */
export const EncounterSegment = z.object({
  id: Id,
  recordingId: Id,
  sourceId: Id,
  sourceType: FactSourceType,
  page: z.number().int().min(1).optional(),
  startMs: z.number().int().min(0).nullable(),
  endMs: z.number().int().min(0).nullable(),
  speakers: z.array(z.string()),
  candidateNames: z.array(z.string()),
  rawTranscript: z.string(),
  boundaryConfidence: Confianca.nullable(),
  boundaryReviewRequired: z.boolean(),
  /** Vínculo só por decisão explícita do médico (D-W9-34a); null até lá. */
  patientId: Id.nullable(),
}).strict();
export type EncounterSegment = z.infer<typeof EncounterSegment>;

export const ClinicalFact = z.object({
  id: Id,
  segmentId: Id,
  patientCandidateId: Id.nullable(),
  domain: FactDomain,
  value: z.unknown(),
  /** Texto bruto antes da normalização (ex.: fármaco foneticamente incerto). */
  raw: z.string().optional(),
  sourceType: FactSourceType,
  evidence: FactEvidence,
  sourceId: Id,
  rawEvidence: z.string().min(1), // frase original obrigatória
  page: z.number().int().min(1).optional(),
  timestampMs: z.number().int().min(0).optional(),
  date: z.string().optional(), // data clínica com precisão variável
  confidence: Confianca,
  requiresConfirmation: z.boolean(),
  /** Obrigatória para DERIVED/INFERRED. */
  regra: z.string().min(1).optional(),
}).strict().superRefine((f, ctx) => {
  if ((f.evidence === "DERIVED" || f.evidence === "INFERRED") && !f.regra)
    ctx.addIssue({ code: "custom", message: "DERIVED/INFERRED exige regra nomeada" });
  if (f.sourceType === "plaud" && ["lab", "cycle"].includes(f.domain) && !f.requiresConfirmation)
    ctx.addIssue({ code: "custom", message: "número falado (Plaud) exige confirmação" });
});
export type ClinicalFact = z.infer<typeof ClinicalFact>;

/** Ranking de candidatos: nunca vincula sozinho, mesmo com score alto. */
export const PatientCandidate = z.object({
  segmentId: Id,
  patientId: Id,
  score: Confianca,
  reasons: z.record(z.string(), z.string()),
  requiresReview: z.literal(true),
}).strict();
export type PatientCandidate = z.infer<typeof PatientCandidate>;

export const ReconciledField = z.object({
  domain: FactDomain,
  candidates: z.array(ClinicalFact),
  /** null para ausência e para conflito não decidido (conflito nunca some). */
  resolvedFactId: Id.nullable(),
  conflict: z.boolean(),
  hierarquia: z.string().min(1), // ex.: "histologia: AP > IHQ > evolução > Plaud > enfermagem"
}).strict();
export type ReconciledField = z.infer<typeof ReconciledField>;

export const ExceptionKind = z.enum([
  "UNLINKED_PATIENT", "REVISAR_FRONTEIRA", "SPOKEN_NUMBER", "UNCERTAIN_DRUG",
  "CONFLICT", "TEMPORAL_CONFLICT", "MISSING_REQUIRED", "INTERVAL_PROGRESSION",
]);
export type ExceptionKind = z.infer<typeof ExceptionKind>;

/** Item da caixa de revisão: o que vai ao médico. */
export const ReviewException = z.object({
  id: Id,
  kind: ExceptionKind,
  segmentId: Id.nullable(),
  factIds: z.array(Id),
  reason: z.string().min(1),
  sourceIds: z.array(Id),
}).strict();
export type ReviewException = z.infer<typeof ReviewException>;

/** Ação do médico sobre a caixa de revisão; vira evento no ledger. Descartar exige motivo. */
export const ReviewAction = z.object({
  exceptionId: Id,
  acao: z.enum(["CONFIRMAR", "CORRIGIR", "DESCARTAR", "LIGAR_PACIENTE"]),
  medicoId: Id,
  em: Instante,
  patientId: Id.optional(),
  valorCorrigido: z.unknown().optional(),
  motivo: z.string().min(1).optional(),
}).strict().superRefine((a, ctx) => {
  if (a.acao === "DESCARTAR" && !a.motivo) ctx.addIssue({ code: "custom", message: "descartar exige motivo" });
  if (a.acao === "LIGAR_PACIENTE" && !a.patientId) ctx.addIssue({ code: "custom", message: "ligar exige patientId" });
});
export type ReviewAction = z.infer<typeof ReviewAction>;

/** Tipo canônico do evento de ledger que registra a decisão do médico na caixa de revisão (FUGU-09; tech lead W10). */
export const TIPO_EVENTO_REVISAO = "ReviewDecision" as const;
export type TipoEventoRevisao = typeof TIPO_EVENTO_REVISAO;
