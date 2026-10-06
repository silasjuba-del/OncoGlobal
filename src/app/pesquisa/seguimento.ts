import type { StudyFollowUp, StudyReview } from "./tipos.js";
import { verifyStudyReview } from "./revisao.js";

export interface FollowUpStudyRegistry {
  review: StudyReview;
  patientArmAssignments: readonly { patientId: string; armId: string }[];
}

/** Valida a relação estudo/versão/paciente/braço e mantém os tipos de seguimento separados. */
export function appendStudyFollowUp(existing: readonly StudyFollowUp[], registry: FollowUpStudyRegistry, item: StudyFollowUp): StudyFollowUp[] {
  if (!verifyStudyReview(registry.review) || registry.review.decision !== "CONFIRMAR" || item.studyId !== registry.review.studyId || item.studyVersion !== registry.review.version ||
      !registry.review.reviewedArmIds.includes(item.armId) ||
      !registry.patientArmAssignments.some((assignment) => assignment.patientId === item.patientId && assignment.armId === item.armId)) throw new Error("FOLLOWUP_RELATIONSHIP_MISMATCH");
  if (!item.followUpId?.trim() || existing.some((old) => old.followUpId === item.followUpId) || !validDateTime(item.occurredAt) ||
      !["CLINICAL_EVENT", "TOXICITY", "IMAGING", "RESPONSE"].includes(item.kind)) throw new Error("INVALID_FOLLOWUP_ID_OR_DATE");
  if (!validEvidence(item.source)) throw new Error("FOLLOWUP_SOURCE_REQUIRED");
  const payloadCount = Number(item.clinicalEvent !== undefined) + Number(item.toxicity !== undefined) + Number(item.imaging !== undefined) + Number(item.response !== undefined);
  if (payloadCount !== 1) throw new Error("FOLLOWUP_REQUIRES_ONE_TYPED_PAYLOAD");
  if (item.kind === "CLINICAL_EVENT" && (!item.clinicalEvent || typeof item.clinicalEvent.code !== "string" || !item.clinicalEvent.code.trim() ||
      typeof item.clinicalEvent.description !== "string" || !item.clinicalEvent.description.trim())) throw new Error("CLINICAL_EVENT_REQUIRED");
  if (item.kind === "TOXICITY" && (!item.toxicity || item.toxicity.ctcaeVersion !== "6" || !Number.isInteger(item.toxicity.grade) ||
      item.toxicity.grade < 1 || item.toxicity.grade > 5 || typeof item.toxicity.term !== "string" || !item.toxicity.term.trim() ||
      typeof item.toxicity.confirmedBy !== "string" || !item.toxicity.confirmedBy.trim())) throw new Error("MANUAL_CTCAE_V6_ENTRY_REQUIRED");
  if (item.kind === "IMAGING" && (!item.imaging || typeof item.imaging.modality !== "string" || !item.imaging.modality.trim() ||
      typeof item.imaging.description !== "string" || !item.imaging.description.trim())) throw new Error("IMAGING_DESCRIPTION_REQUIRED");
  if (item.kind === "RESPONSE" && (!item.response || !["PROGRESSAO", "ESTABILIDADE", "RESPOSTA", "PENDENTE"].includes(item.response.value) ||
      typeof item.response.informedBy !== "string" || !item.response.informedBy.trim())) throw new Error("PHYSICIAN_INFORMED_RESPONSE_REQUIRED");
  return [...existing, structuredClone(item)];
}

function validDateTime(value: string): boolean {
  return /^\d{4}-\d\d-\d\dT\d\d:\d\d(?::\d\d(?:\.\d+)?)?(?:Z|[+-]\d\d:\d\d)$/.test(value) &&
    validDate(value.slice(0, 10)) && Number.isFinite(Date.parse(value));
}
function validDate(value: string): boolean {
  if (!/^\d{4}-\d\d-\d\d$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}
function validEvidence(source: StudyFollowUp["source"]): boolean {
  return typeof source?.sourceId === "string" && !!source.sourceId.trim() && typeof source.sourceRef === "string" && !!source.sourceRef.trim() &&
    typeof source.locator === "string" && !!source.locator.trim() && typeof source.exactText === "string" && !!source.exactText.trim() &&
    typeof source.contentHash === "string" && /^[a-f\d]{64}$/i.test(source.contentHash);
}
