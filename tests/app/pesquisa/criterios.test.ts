import { describe, expect, it } from "vitest";
import { draftStudyCandidate, evaluateMatch, ingestDocument, reviewStudy } from "../../../src/app/pesquisa/index.js";
import type { EvidenceRef, ReviewedCriterion } from "../../../src/app/pesquisa/tipos.js";

const hash = "b".repeat(64);
async function study() {
  const source = await ingestDocument({ sourceId: "study-source", sourceRef: "local://study", originalName: "study.json", mimeType: "application/json",
    content: JSON.stringify({ title: "Study Gamma", inclusionCriteria: ["age eligibility"], exclusionCriteria: ["active condition", "prior therapy"] }) }, async () => hash);
  const candidate = await draftStudyCandidate(source, "candidate-1", async () => hash);
  const criteria: ReviewedCriterion[] = [
    { criterionId: "candidate-1-INCLUSAO-1", polarity: "INCLUSAO", groupId: null, groupOperator: null,
      expression: { kind: "NUMBER", factKey: "age", operator: "GTE", value: 18, unit: "year" }, applicability: "APLICAVEL", notApplicableReason: null,
      rawText: "age eligibility", evidence: candidate.inclusionCriteria[0]!.evidence },
    ...candidate.exclusionCriteria.map((criterion, i) => ({ criterionId: criterion.criterionId, polarity: "EXCLUSAO" as const, groupId: null,
      groupOperator: null, expression: { kind: "EQUALS" as const, factKey: i === 0 ? "activeCondition" : "priorTherapy", value: true },
      applicability: "APLICAVEL" as const, notApplicableReason: null, rawText: criterion.rawText, evidence: criterion.evidence }))
  ];
  const review = reviewStudy(candidate, { decisionId: "decision-1", reviewerId: "clinician-local", reviewedAt: "2026-10-05T10:00:00-03:00",
    decision: "CONFIRMAR", version: 2, studyId: "study-1", titleText: "Study Gamma", titleEvidenceLocator: "title", reviewedCriteria: criteria, reviewedArmIds: [] });
  return { candidate, review };
}
function fact(factKey: string, value: string | number | boolean, unit?: string): { patientId: string; factKey: string; value: string | number | boolean; unit?: string; status: "CONFIRMADO"; source: EvidenceRef; validFrom: string } {
  return { patientId: "patient-1", factKey, value, ...(unit ? { unit } : {}), status: "CONFIRMADO", validFrom: "2026-01-01",
    source: { sourceId: `src-${factKey}`, sourceRef: `local://${factKey}`, locator: "line:1", exactText: String(value), contentHash: hash } };
}

describe("deterministic study comparison", () => {
  it("returns POSSIBLE_MATCH only after an explicit reviewed version and confirmed sourced facts", async () => {
    const { candidate, review } = await study();
    const result = evaluateMatch({ patientId: "patient-1", candidate, review, asOf: "2026-10-05", facts: [fact("age", 42, "year"), fact("activeCondition", false), fact("priorTherapy", false)] });
    expect(result.status).toBe("POSSIBLE_MATCH");
    expect(result.reviewedStudyVersion).toBe(2);
  });

  it("does not require exclusion facts when the reviewed study has no exclusion criteria", async () => {
    const source = await ingestDocument({ sourceId: "solo-source", sourceRef: "local://solo", originalName: "solo.json", mimeType: "application/json",
      content: JSON.stringify({ title: "Solo Trial", inclusionCriteria: ["protocol condition"] }) }, async () => hash);
    const candidate = await draftStudyCandidate(source, "solo", async () => hash);
    const criterion = candidate.inclusionCriteria[0]!;
    const review = reviewStudy(candidate, { decisionId: "solo-review", reviewerId: "clinician", reviewedAt: "2026-10-05T10:00:00Z", decision: "CONFIRMAR",
      version: 1, studyId: "solo-study", titleText: "Solo Trial", titleEvidenceLocator: "title", reviewedArmIds: [],
      reviewedCriteria: [{ criterionId: criterion.criterionId, polarity: "INCLUSAO", groupId: null, groupOperator: null,
        expression: { kind: "EQUALS", factKey: "protocolCondition", value: true }, applicability: "APLICAVEL", notApplicableReason: null,
        rawText: criterion.rawText, evidence: criterion.evidence }] });
    expect(evaluateMatch({ patientId: "patient-1", candidate, review, asOf: "2026-10-05", facts: [fact("protocolCondition", true)] }).status)
      .toBe("POSSIBLE_MATCH");
  });

  it("treats one met exclusion as SEM_MATCH even when another independent exclusion is not met", async () => {
    const { candidate, review } = await study();
    const result = evaluateMatch({ patientId: "patient-1", candidate, review, asOf: "2026-10-05", facts: [fact("age", 42, "year"), fact("activeCondition", true), fact("priorTherapy", false)] });
    expect(result.status).toBe("SEM_MATCH");
    expect(result.criteria.find((c) => c.criterionId.endsWith("EXCLUSAO-1"))?.status).toBe("ATENDIDO");
  });

  it("preserves missing data, conflict, unit mismatch and invalid calendar dates as PENDENTE", async () => {
    const { candidate, review } = await study();
    const conflict = { patientId: "patient-1", factKey: "age", status: "CONFLITO" as const, sources: [fact("age", 21, "year").source, fact("age", 22, "year").source] };
    const missingOrConflict = evaluateMatch({ patientId: "patient-1", candidate, review, asOf: "2026-10-05", facts: [conflict] });
    expect(missingOrConflict.status).toBe("PENDENTE");
    expect(missingOrConflict.criteria[0]?.status).toBe("PENDENTE");

    const wrongUnit = evaluateMatch({ patientId: "patient-1", candidate, review, asOf: "2026-10-05", facts: [fact("age", 21, "months")] });
    expect(wrongUnit.status).toBe("PENDENTE");

    const dateReview = reviewStudy(candidate, { decisionId: "decision-date", reviewerId: "clinician-local", reviewedAt: "2026-10-05T12:00:00-03:00",
      decision: "CONFIRMAR", version: 4, studyId: "study-1", titleText: "Study Gamma", titleEvidenceLocator: "title",
      reviewedCriteria: review.reviewedCriteria.map((c) => c.criterionId.includes("INCLUSAO")
        ? { ...c, expression: { kind: "DATE" as const, factKey: "diagnosisDate", operator: "ON_OR_AFTER" as const, value: "2026-02-28" } } : c), reviewedArmIds: [] });
    const invalidDate = evaluateMatch({ patientId: "patient-1", candidate, review: dateReview, asOf: "2026-10-05", facts: [fact("diagnosisDate", "2026-02-31")] });
    expect(invalidDate.status).toBe("PENDENTE");
  });

  it("rejects stale candidate hashes and keeps unbound negated free-text pending", async () => {
    const { candidate, review } = await study();
    const changed = { ...candidate, title: { text: "other", evidence: candidate.title!.evidence } };
    expect(() => evaluateMatch({ patientId: "patient-1", candidate: changed, review, asOf: "2026-10-05", facts: [] })).toThrow("CONFIRMED_VERSIONED_STUDY_REQUIRED");
    expect(() => evaluateMatch({ patientId: "patient-1", candidate, review: { ...review, version: 8 }, asOf: "2026-10-05", facts: [] }))
      .toThrow("CONFIRMED_VERSIONED_STUDY_REQUIRED");
    const source = await ingestDocument({ sourceId: "negated-source", sourceRef: "local://negated", originalName: "negated.md", mimeType: "text/markdown",
      content: "# Negated Trial\n\n## Inclusion Criteria\n- No prior therapy" }, async () => hash);
    const freeTextCandidate = await draftStudyCandidate(source, "free-text-candidate", async () => hash);
    const criterion = freeTextCandidate.inclusionCriteria[0]!;
    const pendingReview = reviewStudy(freeTextCandidate, { decisionId: "decision-2", reviewerId: "clinician-local", reviewedAt: "2026-10-05T11:00:00-03:00",
      decision: "CONFIRMAR", version: 3, studyId: "study-2", titleText: "Negated Trial", titleEvidenceLocator: "line:1",
      reviewedCriteria: [{ criterionId: criterion.criterionId, polarity: "INCLUSAO", groupId: null, groupOperator: null, expression: null,
        applicability: "PENDENTE", notApplicableReason: null, rawText: criterion.rawText, evidence: criterion.evidence }], reviewedArmIds: [] });
    const result = evaluateMatch({ patientId: "patient-1", candidate: freeTextCandidate, review: pendingReview, asOf: "2026-10-05", facts: [fact("priorTherapy", false)] });
    expect(result.status).toBe("PENDENTE");
    expect(result.criteria.find((criterion) => criterion.criterionId.endsWith("INCLUSAO-1"))?.status).toBe("PENDENTE");
  });

  it("rejects facts scoped to another patient", async () => {
    const { candidate, review } = await study();
    const wrongPatient = { ...fact("age", 30, "year"), patientId: "patient-2" };
    expect(() => evaluateMatch({ patientId: "patient-1", candidate, review, asOf: "2026-10-05", facts: [wrongPatient] })).toThrow("PATIENT_SCOPE_MISMATCH");
  });
});
