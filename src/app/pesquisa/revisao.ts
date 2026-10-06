import { hashCanonico } from "../../modules/tipos.js";
import type { ReviewedCriterion, StudyCandidateDraft, StudyReview } from "./tipos.js";

export interface ReviewInput {
  decisionId: string;
  reviewerId: string;
  reviewedAt: string;
  decision: "CONFIRMAR" | "REJEITAR";
  version: number;
  studyId: string;
  titleText: string;
  titleEvidenceLocator: string;
  reviewedCriteria: ReviewedCriterion[];
  reviewedArmIds: string[];
}

/** Registra uma revisão humana explícita, versionada e vinculada ao hash do rascunho. */
export function reviewStudy(candidate: StudyCandidateDraft, input: ReviewInput): StudyReview {
  if (!input.decisionId.trim() || !input.reviewerId.trim() || !input.studyId.trim() || input.version < 1 ||
      !Number.isInteger(input.version) || !validTimestamp(input.reviewedAt) || !["CONFIRMAR", "REJEITAR"].includes(input.decision) ||
      !Array.isArray(input.reviewedCriteria) || !Array.isArray(input.reviewedArmIds)) throw new Error("INVALID_MEDICAL_REVIEW");
  const candidateArmIds = candidate.arms.map((arm) => arm.armId);
  if (new Set(candidateArmIds).size !== candidateArmIds.length || new Set(input.reviewedArmIds).size !== input.reviewedArmIds.length ||
      candidateArmIds.length !== input.reviewedArmIds.length || candidateArmIds.some((id) => !input.reviewedArmIds.includes(id))) throw new Error("ALL_STUDY_ARMS_REQUIRE_REVIEW");
  const evidence = [...(candidate.title?.evidence ?? []), ...(candidate.description?.evidence ?? []), ...candidate.arms.flatMap((a) => a.name.evidence),
    ...candidate.inclusionCriteria.flatMap((c) => c.evidence), ...candidate.exclusionCriteria.flatMap((c) => c.evidence), ...candidate.outcomes.flatMap((o) => o.evidence)];
  const titleEvidence = evidence.find((e) => e.locator === input.titleEvidenceLocator && e.exactText === input.titleText);
  if (!titleEvidence) throw new Error("REVIEW_TITLE_NEEDS_EXACT_SOURCE_EVIDENCE");
  const originalCriteria = [...candidate.inclusionCriteria, ...candidate.exclusionCriteria];
  const seen = new Set<string>();
  const groups = new Map<string, string>();
  for (const criterion of input.reviewedCriteria) {
    if (!validReviewedCriterion(criterion)) throw new Error("INVALID_REVIEWED_CRITERION");
    const original = originalCriteria.find((c) => c.criterionId === criterion.criterionId);
    if (!original || seen.has(criterion.criterionId) || original.polarity !== criterion.polarity || original.rawText !== criterion.rawText ||
      !sameEvidence(original.evidence, criterion.evidence)) throw new Error("CRITERION_REVIEW_SOURCE_OR_ID_MISMATCH");
    seen.add(criterion.criterionId);
    if (criterion.groupId && criterion.groupOperator) {
      const prior = groups.get(criterion.groupId);
      if (prior && prior !== criterion.groupOperator) throw new Error("GROUP_OPERATOR_MISMATCH");
      groups.set(criterion.groupId, criterion.groupOperator);
    }
    if (criterion.applicability === "NAO_APLICAVEL" && !criterion.notApplicableReason?.trim()) throw new Error("NA_REQUIRES_REASON");
    if (criterion.applicability === "APLICAVEL" && !criterion.expression) throw new Error("APPLICABLE_CRITERION_NEEDS_EXPLICIT_BINDING");
    if (criterion.applicability === "PENDENTE" && criterion.expression) throw new Error("PENDING_CRITERION_CANNOT_HAVE_BINDING");
    if (criterion.groupId && !criterion.groupOperator) throw new Error("GROUP_OPERATOR_REQUIRED");
  }
  if (seen.size !== originalCriteria.length) throw new Error("ALL_CRITERIA_REQUIRE_REVIEW");
  const review = { candidateId: candidate.candidateId, decisionId: input.decisionId, reviewerId: input.reviewerId, reviewedAt: input.reviewedAt,
    decision: input.decision, version: input.version, candidateHash: hashCanonico(candidate), studyId: input.studyId,
    title: { text: input.titleText, evidence: [titleEvidence] }, reviewedCriteria: structuredClone(input.reviewedCriteria), reviewedArmIds: [...input.reviewedArmIds] };
  return { ...review, reviewHash: hashCanonico(review) };
}

export function verifyStudyReview(review: StudyReview): boolean {
  if (!review || typeof review !== "object" || typeof review.reviewHash !== "string" || !review.title ||
      typeof review.title.text !== "string" || !Array.isArray(review.title.evidence) || !Array.isArray(review.reviewedCriteria) || !Array.isArray(review.reviewedArmIds)) return false;
  const { reviewHash, ...content } = review;
  return !!reviewHash && reviewHash === hashCanonico(content) && review.version > 0 && Number.isInteger(review.version) &&
    (review.decision === "CONFIRMAR" || review.decision === "REJEITAR") && validTimestamp(review.reviewedAt) &&
    review.title.text.trim().length > 0 && review.title.evidence.some((e) => e.exactText === review.title.text && validEvidenceRef(e)) &&
    new Set(review.reviewedCriteria.map((c) => c.criterionId)).size === review.reviewedCriteria.length &&
    new Set(review.reviewedArmIds).size === review.reviewedArmIds.length && review.reviewedArmIds.every((id) => typeof id === "string" && !!id.trim()) &&
    review.reviewedCriteria.every(validReviewedCriterion);
}

function sameEvidence(a: readonly { sourceId: string; sourceRef: string; locator: string; exactText: string; contentHash: string }[],
  b: readonly { sourceId: string; sourceRef: string; locator: string; exactText: string; contentHash: string }[]): boolean {
  return hashCanonico(a) === hashCanonico(b);
}
function validTimestamp(value: string): boolean {
  if (!/^\d{4}-\d\d-\d\dT\d\d:\d\d(?::\d\d(?:\.\d+)?)?(?:Z|[+-]\d\d:\d\d)$/.test(value) || !Number.isFinite(Date.parse(value))) return false;
  const date = value.slice(0, 10);
  const parsed = new Date(`${date}T00:00:00Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === date;
}
function validReviewedCriterion(c: ReviewedCriterion): boolean {
  if (!c || typeof c !== "object" || typeof c.criterionId !== "string" || !c.criterionId || typeof c.rawText !== "string" || !c.rawText ||
      !Array.isArray(c.evidence) || !c.evidence.length || !c.evidence.some((e) => e?.exactText === c.rawText) ||
      !c.evidence.every(validEvidenceRef)) return false;
  if (!["INCLUSAO", "EXCLUSAO"].includes(c.polarity) || !["APLICAVEL", "NAO_APLICAVEL", "PENDENTE"].includes(c.applicability)) return false;
  if (c.applicability === "NAO_APLICAVEL" && !c.notApplicableReason?.trim()) return false;
  if (c.applicability === "APLICAVEL" && !validExpression(c.expression)) return false;
  if (c.applicability === "PENDENTE" && c.expression !== null) return false;
  if (c.groupId && !["AND", "OR"].includes(String(c.groupOperator))) return false;
  return true;
}
function validExpression(e: ReviewedCriterion["expression"]): boolean {
  if (!e || !e.factKey.trim()) return false;
  if (e.kind === "EQUALS") return ["string", "number", "boolean"].includes(typeof e.value) && (typeof e.value !== "number" || Number.isFinite(e.value));
  if (e.kind === "NUMBER") return Number.isFinite(e.value) && !!e.unit.trim() && ["EQ", "GT", "GTE", "LT", "LTE"].includes(e.operator);
  return ["ON_OR_AFTER", "ON_OR_BEFORE"].includes(e.operator) && validDate(e.value);
}
function validEvidenceRef(e: { sourceId: string; sourceRef: string; locator: string; exactText: string; contentHash: string }): boolean {
  return !!e && typeof e.sourceId === "string" && !!e.sourceId && typeof e.sourceRef === "string" && !!e.sourceRef &&
    typeof e.locator === "string" && !!e.locator && typeof e.exactText === "string" && !!e.exactText &&
    typeof e.contentHash === "string" && /^[a-f\d]{64}$/i.test(e.contentHash);
}
function validDate(value: string): boolean {
  if (!/^\d{4}-\d\d-\d\d$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}
