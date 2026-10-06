import { describe, expect, it } from "vitest";
import { appendStudyFollowUp, draftStudyCandidate, ingestDocument, reviewStudy } from "../../../src/app/pesquisa/index.js";
import type { StudyFollowUp } from "../../../src/app/pesquisa/tipos.js";

const hash = "c".repeat(64);
async function setup() {
  const source = await ingestDocument({ sourceId: "study-source", sourceRef: "local://study", originalName: "study.md", mimeType: "text/markdown",
    content: "# Study title\n\n## Arms\nArm A" }, async () => hash);
  const candidate = await draftStudyCandidate(source, "candidate", async () => hash);
  const review = reviewStudy(candidate, { decisionId: "decision", reviewerId: "physician", reviewedAt: "2026-10-05T08:00:00Z", decision: "CONFIRMAR",
    version: 1, studyId: "study", titleText: "Study title", titleEvidenceLocator: "line:1", reviewedCriteria: [], reviewedArmIds: ["candidate-arm-1"] });
  return { review, registry: { review, patientArmAssignments: [{ patientId: "patient-local", armId: "candidate-arm-1" }] } };
}
function item(overrides: Partial<StudyFollowUp> = {}): StudyFollowUp {
  return { followUpId: "f1", studyId: "study", studyVersion: 1, patientId: "patient-local", armId: "candidate-arm-1", kind: "RESPONSE",
    occurredAt: "2026-10-05T09:00:00Z", source: { sourceId: "patient-source", sourceRef: "local://record", locator: "line:4", exactText: "response reviewed",
      contentHash: hash }, response: { value: "PENDENTE", informedBy: "physician" }, ...overrides };
}

describe("study follow-up relationships", () => {
  it("records a physician-informed response as a sourced follow-up without RECIST calculation", async () => {
    const { registry } = await setup();
    const rows = appendStudyFollowUp([], registry, item());
    expect(rows[0]?.response?.value).toBe("PENDENTE");
    expect(rows[0]?.source.exactText).toBe("response reviewed");
  });

  it("rejects a different study version, patient or arm", async () => {
    const { registry } = await setup();
    expect(() => appendStudyFollowUp([], registry, item({ patientId: "other" }))).toThrow("FOLLOWUP_RELATIONSHIP_MISMATCH");
    expect(() => appendStudyFollowUp([], registry, item({ armId: "other" }))).toThrow("FOLLOWUP_RELATIONSHIP_MISMATCH");
    expect(() => appendStudyFollowUp([], registry, item({ studyVersion: 2 }))).toThrow("FOLLOWUP_RELATIONSHIP_MISMATCH");
  });

  it("accepts only manually confirmed CTCAE v6 grade entries", async () => {
    const { registry } = await setup();
    const toxicity = { followUpId: "tox", studyId: "study", studyVersion: 1, patientId: "patient-local", armId: "candidate-arm-1", kind: "TOXICITY" as const,
      occurredAt: "2026-10-05T09:00:00Z", source: item().source, toxicity: { term: "nausea", grade: 2, ctcaeVersion: "6" as const, confirmedBy: "physician" } };
    expect(appendStudyFollowUp([], registry, toxicity)[0]?.toxicity?.grade).toBe(2);
    expect(() => appendStudyFollowUp([], registry, { ...toxicity, toxicity: { ...toxicity.toxicity, ctcaeVersion: "5" as unknown as "6" } }))
      .toThrow("MANUAL_CTCAE_V6_ENTRY_REQUIRED");
    expect(() => appendStudyFollowUp([], registry, { ...toxicity, toxicity: { ...toxicity.toxicity, grade: 6 } }))
      .toThrow("MANUAL_CTCAE_V6_ENTRY_REQUIRED");
  });
});
