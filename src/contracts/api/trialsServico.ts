import { z } from "zod";
import { ContextoAcaoComposta } from "./acoesCompostas.js";
import { DataCivil, Id, Instante } from "../base.js";

const HashSha256Schema = z.string().regex(/^[a-f0-9]{64}$/);
const SafeRevisionSchema = z.number().int().nonnegative().refine(Number.isSafeInteger);
const PositiveSafeRevisionSchema = z.number().int().positive().refine(Number.isSafeInteger);
const NonEmptyTextSchema = z.string().trim().min(1);

/** Rejeita propriedades explicitamente undefined; campos opcionais só podem ser omitidos. */
function rejectOwnUndefined<T extends z.ZodTypeAny>(schema: T): T {
  return schema.superRefine((value, context) => {
    const visit = (current: unknown, path: (string | number)[]): void => {
      if (Array.isArray(current)) {
        current.forEach((item, index) => visit(item, [...path, index]));
        return;
      }
      if (!current || typeof current !== "object") return;
      for (const [key, nested] of Object.entries(current)) {
        if (nested === undefined) {
          context.addIssue({ code: "custom", path: [...path, key], message: "UNDEFINED_PROPERTY_NOT_ALLOWED" });
        } else visit(nested, [...path, key]);
      }
    };
    visit(value, []);
  }) as T;
}

function semDuplicados<T>(values: readonly T[]): boolean {
  return new Set(values).size === values.length;
}

function refinarGrupo(value: { groupId: string | null; groupOperator: "AND" | "OR" | null },
  context: z.RefinementCtx): void {
  if ((value.groupId === null) !== (value.groupOperator === null)) {
    context.addIssue({ code: "custom", path: [value.groupId === null ? "groupOperator" : "groupId"],
      message: "GROUP_ID_AND_OPERATOR_MUST_BE_PAIRED" });
  }
}

export const EvidenceRefSchema = rejectOwnUndefined(z.object({
  sourceId: Id,
  sourceRef: Id,
  locator: NonEmptyTextSchema,
  exactText: z.string().min(1),
  contentHash: HashSha256Schema,
}).strict());
export type EvidenceRef = z.infer<typeof EvidenceRefSchema>;

export const StudySourceSchema = rejectOwnUndefined(z.object({
  sourceId: Id,
  sourceRef: Id,
  originalName: NonEmptyTextSchema,
  mimeType: NonEmptyTextSchema,
  kind: z.enum(["TXT", "MD", "JSON", "BINARY_REFERENCE"]),
  contentHash: HashSha256Schema,
  originalContent: z.string().nullable(),
  attachmentRef: Id.nullable(),
  locator: z.string().nullable(),
}).strict().superRefine((source, context) => {
  const textualMime = { TXT: "text/plain", MD: "text/markdown", JSON: "application/json" } as const;
  if (source.kind === "BINARY_REFERENCE") {
    if (source.originalContent !== null || source.attachmentRef === null)
      context.addIssue({ code: "custom", path: ["attachmentRef"], message: "BINARY_SOURCE_REQUIRES_ATTACHMENT_REFERENCE" });
  } else {
    if (source.originalContent === null || source.attachmentRef !== null)
      context.addIssue({ code: "custom", path: ["originalContent"], message: "TEXT_SOURCE_REQUIRES_LITERAL_CONTENT" });
    if (source.mimeType !== textualMime[source.kind])
      context.addIssue({ code: "custom", path: ["mimeType"], message: "SOURCE_KIND_MIME_MISMATCH" });
  }
}));
export type StudySource = z.infer<typeof StudySourceSchema>;

const EqualsExpressionSchema = z.object({
  kind: z.literal("EQUALS"),
  factKey: Id,
  value: z.union([z.string(), z.number().finite(), z.boolean()]),
}).strict();
const NumberExpressionSchema = z.object({
  kind: z.literal("NUMBER"),
  factKey: Id,
  operator: z.enum(["EQ", "GT", "GTE", "LT", "LTE"]),
  value: z.number().finite(),
  unit: NonEmptyTextSchema,
}).strict();
const DateExpressionSchema = z.object({
  kind: z.literal("DATE"),
  factKey: Id,
  operator: z.enum(["ON_OR_AFTER", "ON_OR_BEFORE"]),
  value: DataCivil,
}).strict();
export const CriterionExpressionSchema = rejectOwnUndefined(z.discriminatedUnion("kind", [
  EqualsExpressionSchema, NumberExpressionSchema, DateExpressionSchema,
]));
export type CriterionExpression = z.infer<typeof CriterionExpressionSchema>;

const EvidencedTextSchema = rejectOwnUndefined(z.object({
  text: z.string().min(1),
  evidence: z.array(EvidenceRefSchema).min(1),
}).strict());
export type EvidencedText = z.infer<typeof EvidencedTextSchema>;

const GrupoSchema = z.object({ groupId: Id.nullable(), groupOperator: z.enum(["AND", "OR"]).nullable() }).strict();
const StudyCriterionDraftSchema = rejectOwnUndefined(z.object({
  criterionId: Id,
  polarity: z.enum(["INCLUSAO", "EXCLUSAO"]),
  groupId: Id.nullable(),
  groupOperator: z.enum(["AND", "OR"]).nullable(),
  expression: CriterionExpressionSchema.nullable(),
  rawText: NonEmptyTextSchema,
  status: z.literal("PENDENTE"),
  evidence: z.array(EvidenceRefSchema).min(1),
}).strict().superRefine((criterion, context) => {
  refinarGrupo(criterion, context);
}));
export type StudyCriterionDraft = z.infer<typeof StudyCriterionDraftSchema>;

const StudyArmDraftSchema = rejectOwnUndefined(z.object({
  armId: Id,
  name: EvidencedTextSchema,
  description: EvidencedTextSchema.nullable(),
}).strict());
export type StudyArmDraft = z.infer<typeof StudyArmDraftSchema>;

function evidenciasDoCandidato(candidate: z.infer<typeof StudyCandidateDraftBaseSchema>): EvidenceRef[] {
  return [
    ...(candidate.title?.evidence ?? []), ...(candidate.description?.evidence ?? []),
    ...candidate.arms.flatMap(arm => [...arm.name.evidence, ...(arm.description?.evidence ?? [])]),
    ...candidate.inclusionCriteria.flatMap(item => item.evidence),
    ...candidate.exclusionCriteria.flatMap(item => item.evidence),
    ...candidate.outcomes.flatMap(item => item.evidence),
  ];
}

const StudyCandidateDraftBaseSchema = z.object({
  candidateId: Id,
  sourceId: Id,
  sourceHash: HashSha256Schema,
  reviewStatus: z.literal("PENDENTE_REVISAO_MEDICA"),
  studyId: Id.nullable(),
  title: EvidencedTextSchema.nullable(),
  description: EvidencedTextSchema.nullable(),
  arms: z.array(StudyArmDraftSchema),
  inclusionCriteria: z.array(StudyCriterionDraftSchema),
  exclusionCriteria: z.array(StudyCriterionDraftSchema),
  outcomes: z.array(EvidencedTextSchema),
  warnings: z.array(z.string()),
}).strict();

export const StudyCandidateDraftSchema = rejectOwnUndefined(StudyCandidateDraftBaseSchema.superRefine((candidate, context) => {
  const criteria = [...candidate.inclusionCriteria, ...candidate.exclusionCriteria];
  if (!semDuplicados(criteria.map(item => item.criterionId)))
    context.addIssue({ code: "custom", path: ["inclusionCriteria"], message: "DUPLICATE_CRITERION_ID" });
  if (!semDuplicados(candidate.arms.map(item => item.armId)))
    context.addIssue({ code: "custom", path: ["arms"], message: "DUPLICATE_ARM_ID" });
  for (const [index, item] of evidenciasDoCandidato(candidate).entries()) {
    if (item.sourceId !== candidate.sourceId || item.contentHash !== candidate.sourceHash)
      context.addIssue({ code: "custom", path: ["evidence", index], message: "CANDIDATE_EVIDENCE_PROVENANCE_MISMATCH" });
  }
}));
export type StudyCandidateDraft = z.infer<typeof StudyCandidateDraftSchema>;

export const ReviewedCriterionSchema = rejectOwnUndefined(z.object({
  criterionId: Id,
  polarity: z.enum(["INCLUSAO", "EXCLUSAO"]),
  groupId: Id.nullable(),
  groupOperator: z.enum(["AND", "OR"]).nullable(),
  expression: CriterionExpressionSchema.nullable(),
  applicability: z.enum(["APLICAVEL", "NAO_APLICAVEL", "PENDENTE"]),
  notApplicableReason: z.string().nullable(),
  rawText: NonEmptyTextSchema,
  evidence: z.array(EvidenceRefSchema).min(1),
}).strict().superRefine((criterion, context) => {
  refinarGrupo(criterion, context);
  if (criterion.applicability === "NAO_APLICAVEL" && !criterion.notApplicableReason?.trim())
    context.addIssue({ code: "custom", path: ["notApplicableReason"], message: "NOT_APPLICABLE_REASON_REQUIRED" });
  if (criterion.applicability !== "NAO_APLICAVEL" && criterion.notApplicableReason !== null)
    context.addIssue({ code: "custom", path: ["notApplicableReason"], message: "NOT_APPLICABLE_REASON_ONLY_FOR_NA" });
}));
export type ReviewedCriterion = z.infer<typeof ReviewedCriterionSchema>;

export const StudyReviewSchema = rejectOwnUndefined(z.object({
  candidateId: Id,
  decisionId: Id,
  reviewerId: Id,
  reviewedAt: Instante,
  decision: z.enum(["CONFIRMAR", "REJEITAR"]),
  version: PositiveSafeRevisionSchema,
  candidateHash: HashSha256Schema,
  reviewHash: HashSha256Schema,
  studyId: Id,
  title: EvidencedTextSchema,
  reviewedCriteria: z.array(ReviewedCriterionSchema),
  reviewedArmIds: z.array(Id),
}).strict().superRefine((review, context) => {
  if (!semDuplicados(review.reviewedCriteria.map(item => item.criterionId)))
    context.addIssue({ code: "custom", path: ["reviewedCriteria"], message: "DUPLICATE_REVIEWED_CRITERION_ID" });
  if (!semDuplicados(review.reviewedArmIds))
    context.addIssue({ code: "custom", path: ["reviewedArmIds"], message: "DUPLICATE_REVIEWED_ARM_ID" });
}));
export type StudyReview = z.infer<typeof StudyReviewSchema>;

const ConfirmedPatientFactSchema = z.object({
  patientId: Id,
  factKey: Id,
  value: z.union([z.string(), z.number().finite(), z.boolean()]),
  unit: NonEmptyTextSchema.optional(),
  status: z.literal("CONFIRMADO"),
  source: EvidenceRefSchema,
  validFrom: DataCivil.optional(),
  validTo: DataCivil.optional(),
}).strict().superRefine((fact, context) => {
  if (fact.validFrom && fact.validTo && fact.validFrom > fact.validTo)
    context.addIssue({ code: "custom", path: ["validTo"], message: "FACT_VALIDITY_RANGE_INVALID" });
});
const ConflictedPatientFactSchema = z.object({
  patientId: Id,
  factKey: Id,
  status: z.literal("CONFLITO"),
  sources: z.array(EvidenceRefSchema).min(2),
}).strict();
type ExactOptionalProperties<T> = T extends object
  ? {
    [Key in keyof T as undefined extends T[Key] ? never : Key]: T[Key]
  } & {
    [Key in keyof T as undefined extends T[Key] ? Key : never]?: Exclude<T[Key], undefined>
  }
  : T;

export type ConfirmedPatientFact = ExactOptionalProperties<z.infer<typeof ConfirmedPatientFactSchema>>;
export type ConflictedPatientFact = z.infer<typeof ConflictedPatientFactSchema>;
const PatientFactUnionSchema = z.discriminatedUnion("status", [
  ConfirmedPatientFactSchema, ConflictedPatientFactSchema,
]);
type ParsedPatientFact = z.infer<typeof PatientFactUnionSchema>;
export type PatientFact = ExactOptionalProperties<ParsedPatientFact>;
function normalizarPatientFact(fact: ParsedPatientFact): PatientFact {
  if (fact.status === "CONFLITO") return fact;
  return {
    patientId: fact.patientId,
    factKey: fact.factKey,
    value: fact.value,
    ...(fact.unit === undefined ? {} : { unit: fact.unit }),
    status: fact.status,
    source: fact.source,
    ...(fact.validFrom === undefined ? {} : { validFrom: fact.validFrom }),
    ...(fact.validTo === undefined ? {} : { validTo: fact.validTo }),
  };
}
export const PatientFactSchema = rejectOwnUndefined(PatientFactUnionSchema)
  .transform((fact): PatientFact => normalizarPatientFact(fact));

const CriterionStatusSchema = z.enum(["ATENDIDO", "NAO_ATENDIDO", "PENDENTE", "NAO_APLICAVEL"]);
const CriterionEvaluationSchema = rejectOwnUndefined(z.object({
  criterionId: Id,
  status: CriterionStatusSchema,
  reason: NonEmptyTextSchema,
  sources: z.array(EvidenceRefSchema),
}).strict());
export type CriterionEvaluation = z.infer<typeof CriterionEvaluationSchema>;
export type CriterionStatus = z.infer<typeof CriterionStatusSchema>;

export const MatchResultSchema = rejectOwnUndefined(z.object({
  status: z.enum(["POSSIBLE_MATCH", "PENDENTE", "SEM_MATCH"]),
  criteria: z.array(CriterionEvaluationSchema),
  reviewedStudyVersion: PositiveSafeRevisionSchema,
}).strict().superRefine((result, context) => {
  if (!semDuplicados(result.criteria.map(item => item.criterionId)))
    context.addIssue({ code: "custom", path: ["criteria"], message: "DUPLICATE_MATCH_CRITERION_ID" });
}));
export type MatchResult = z.infer<typeof MatchResultSchema>;

export const ImportarEstudoPedidoSchema = rejectOwnUndefined(z.object({
  nome: z.string().min(1).max(300),
  mimeType: z.enum(["text/plain", "text/markdown", "application/json"]),
  conteudo: z.string().min(1).max(2_000_000),
  idempotencyKey: Id,
}).strict());
export type ImportarEstudoPedido = z.infer<typeof ImportarEstudoPedidoSchema>;

const VinculoCriterioEstudoSchema = rejectOwnUndefined(z.object({
  criterionId: Id,
  groupId: Id.nullable(),
  groupOperator: z.enum(["AND", "OR"]).nullable(),
  expression: CriterionExpressionSchema.nullable(),
  applicability: z.enum(["APLICAVEL", "NAO_APLICAVEL", "PENDENTE"]),
  notApplicableReason: z.string().nullable(),
}).strict().superRefine((binding, context) => {
  refinarGrupo(binding, context);
  if (binding.applicability === "NAO_APLICAVEL" && !binding.notApplicableReason?.trim())
    context.addIssue({ code: "custom", path: ["notApplicableReason"], message: "NOT_APPLICABLE_REASON_REQUIRED" });
  if (binding.applicability !== "NAO_APLICAVEL" && binding.notApplicableReason !== null)
    context.addIssue({ code: "custom", path: ["notApplicableReason"], message: "NOT_APPLICABLE_REASON_ONLY_FOR_NA" });
}));

export const RevisarEstudoPedidoSchema = rejectOwnUndefined(z.object({
  draftId: Id,
  expectedRevision: SafeRevisionSchema,
  candidateHash: HashSha256Schema,
  studyId: Id,
  decision: z.enum(["CONFIRMAR", "REJEITAR"]),
  titleText: NonEmptyTextSchema,
  titleEvidenceLocator: Id,
  bindings: z.array(VinculoCriterioEstudoSchema),
  reviewedArmIds: z.array(Id),
  idempotencyKey: Id,
}).strict().superRefine((request, context) => {
  if (!semDuplicados(request.bindings.map(item => item.criterionId)))
    context.addIssue({ code: "custom", path: ["bindings"], message: "DUPLICATE_BINDING_CRITERION_ID" });
  if (!semDuplicados(request.reviewedArmIds))
    context.addIssue({ code: "custom", path: ["reviewedArmIds"], message: "DUPLICATE_REVIEWED_ARM_ID" });
}));
export type RevisarEstudoPedido = z.infer<typeof RevisarEstudoPedidoSchema>;

const EstudoServicoBaseSchema = z.object({
  draftId: Id,
  revision: SafeRevisionSchema,
  source: StudySourceSchema,
  candidate: StudyCandidateDraftSchema,
  candidateHash: HashSha256Schema,
  review: StudyReviewSchema.nullable(),
}).strict();
export const EstudoServicoSchema = rejectOwnUndefined(EstudoServicoBaseSchema.superRefine((study, context) => {
  if (study.source.sourceId !== study.candidate.sourceId || study.source.contentHash !== study.candidate.sourceHash)
    context.addIssue({ code: "custom", path: ["candidate"], message: "STUDY_SOURCE_CANDIDATE_MISMATCH" });
  if (study.review && (study.review.candidateId !== study.candidate.candidateId
    || study.review.candidateHash !== study.candidateHash))
    context.addIssue({ code: "custom", path: ["review"], message: "STUDY_REVIEW_CANDIDATE_MISMATCH" });
}));
export type EstudoServico = z.infer<typeof EstudoServicoSchema>;

export const ListarEstudosRespostaSchema = rejectOwnUndefined(z.object({ estudos: z.array(EstudoServicoSchema) })
  .strict().superRefine((response, context) => {
    if (!semDuplicados(response.estudos.map(item => item.draftId)))
      context.addIssue({ code: "custom", path: ["estudos"], message: "DUPLICATE_STUDY_DRAFT_ID" });
  }));
export type ListarEstudosResposta = z.infer<typeof ListarEstudosRespostaSchema>;

export const AvaliarEstudoPedidoSchema = rejectOwnUndefined(z.object({
  contexto: ContextoAcaoComposta,
  draftId: Id,
  expectedRevision: SafeRevisionSchema,
  expectedReviewHash: HashSha256Schema,
}).strict());
export type AvaliarEstudoPedido = z.infer<typeof AvaliarEstudoPedidoSchema>;

const FatosTrialsBaseSchema = z.object({
  contexto: ContextoAcaoComposta,
  revisaoFatos: HashSha256Schema,
  fatos: z.array(PatientFactSchema),
}).strict();
export const SchemaFatosTrialsResposta = rejectOwnUndefined(FatosTrialsBaseSchema.superRefine((response, context) => {
  if (response.fatos.some(fact => fact.patientId !== response.contexto.patientId))
    context.addIssue({ code: "custom", path: ["fatos"], message: "FACT_PATIENT_CONTEXT_MISMATCH" });
}));
export type FatosTrialsResposta = z.infer<typeof SchemaFatosTrialsResposta>;

export const AvaliacaoEstudoRespostaSchema = rejectOwnUndefined(z.object({
  contexto: ContextoAcaoComposta,
  estudo: EstudoServicoSchema,
  revisaoFatos: HashSha256Schema,
  resultado: MatchResultSchema,
  fatos: z.array(PatientFactSchema),
  elegivel: z.literal(false),
}).strict().superRefine((response, context) => {
  if (!response.estudo.review || response.estudo.review.decision !== "CONFIRMAR")
    context.addIssue({ code: "custom", path: ["estudo", "review"], message: "UNREVIEWED_STUDY_CANNOT_BE_EVALUATED" });
  if (response.fatos.some(fact => fact.patientId !== response.contexto.patientId))
    context.addIssue({ code: "custom", path: ["fatos"], message: "FACT_PATIENT_CONTEXT_MISMATCH" });
  if (response.estudo.review && response.resultado.reviewedStudyVersion !== response.estudo.review.version)
    context.addIssue({ code: "custom", path: ["resultado", "reviewedStudyVersion"], message: "MATCH_STUDY_VERSION_MISMATCH" });
}));
export type AvaliacaoEstudoResposta = z.infer<typeof AvaliacaoEstudoRespostaSchema>;
