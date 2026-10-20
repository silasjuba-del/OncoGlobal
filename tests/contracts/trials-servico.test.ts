import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  AvaliacaoEstudoRespostaSchema,
  AvaliarEstudoPedidoSchema,
  CriterionExpressionSchema,
  EvidenceRefSchema,
  EstudoServicoSchema,
  ImportarEstudoPedidoSchema,
  ListarEstudosRespostaSchema,
  MatchResultSchema,
  PatientFactSchema,
  RevisarEstudoPedidoSchema,
  ReviewedCriterionSchema,
  SchemaFatosTrialsResposta,
  StudyCandidateDraftSchema,
  StudyReviewSchema,
  StudySourceSchema,
} from "../../src/contracts/api/trialsServico.js";

const sha = (value: string) => createHash("sha256").update(value).digest("hex");
const hashSource = sha("fonte integral sintética");
const hashCandidate = sha("candidato sintético v1");
const hashReview = sha("revisão sintética v1");
const hashFacts = sha("ledger sintético v1");
const candidateHash = hashCandidate;
const reviewHash = hashReview;

function evidence(overrides: Record<string, unknown> = {}) {
  return { sourceId: "source-study-1", sourceRef: "local:study-1", locator: "page:2/paragraph:3",
    exactText: "Adult patients aged 18 years or older.", contentHash: hashSource, ...overrides };
}

function evidencedText(text: string, overrides: Record<string, unknown> = {}) {
  return { text, evidence: [evidence({ exactText: text })], ...overrides };
}

function criterion(overrides: Record<string, unknown> = {}) {
  return { criterionId: "criterion-age", polarity: "INCLUSAO", groupId: null, groupOperator: null,
    expression: { kind: "NUMBER", factKey: "ageYears", operator: "GTE", value: 18, unit: "years" },
    rawText: "Adult patients aged 18 years or older.", status: "PENDENTE",
    evidence: [evidence()], ...overrides };
}

function candidate(overrides: Record<string, unknown> = {}) {
  return { candidateId: "candidate-1", sourceId: "source-study-1", sourceHash: hashSource,
    reviewStatus: "PENDENTE_REVISAO_MEDICA", studyId: null,
    title: evidencedText("Synthetic study title"), description: null,
    arms: [{ armId: "arm-1", name: evidencedText("Experimental arm"), description: null }],
    inclusionCriteria: [criterion()], exclusionCriteria: [], outcomes: [], warnings: [],
    ...overrides };
}

function reviewedCriterion(overrides: Record<string, unknown> = {}) {
  return { criterionId: "criterion-age", polarity: "INCLUSAO", groupId: null, groupOperator: null,
    expression: { kind: "NUMBER", factKey: "ageYears", operator: "GTE", value: 18, unit: "years" },
    applicability: "APLICAVEL", notApplicableReason: null,
    rawText: "Adult patients aged 18 years or older.", evidence: [evidence()], ...overrides };
}

function source(overrides: Record<string, unknown> = {}) {
  return { sourceId: "source-study-1", sourceRef: "local:study-1", originalName: "study.json",
    mimeType: "application/json", kind: "JSON", contentHash: hashSource,
    originalContent: "{\"title\":\"Synthetic study title\"}", attachmentRef: null, locator: null,
    ...overrides };
}

function review(overrides: Record<string, unknown> = {}) {
  return { candidateId: "candidate-1", decisionId: "decision-1", reviewerId: "reviewer-1",
    reviewedAt: "2026-10-20T14:30:00-03:00", decision: "CONFIRMAR", version: 1,
    candidateHash, reviewHash, studyId: "study-1", title: evidencedText("Synthetic study title"),
    reviewedCriteria: [reviewedCriterion()], reviewedArmIds: ["arm-1"], ...overrides };
}

function study(overrides: Record<string, unknown> = {}) {
  return { draftId: "draft-study-1", revision: 2, source: source(), candidate: candidate(),
    candidateHash, review: null, ...overrides };
}

function patientFact(overrides: Record<string, unknown> = {}) {
  return { patientId: "patient-synthetic-1", factKey: "ageYears", value: 62, unit: "years",
    status: "CONFIRMADO", source: evidence(), validFrom: "2025-01-01", validTo: "2026-12-31", ...overrides };
}

function matchResult(overrides: Record<string, unknown> = {}) {
  return { status: "POSSIBLE_MATCH", criteria: [{ criterionId: "criterion-age", status: "ATENDIDO",
    reason: "Idade confirmada atende ao critério.", sources: [evidence()] }], reviewedStudyVersion: 1, ...overrides };
}

function context() {
  return { patientId: "patient-synthetic-1", encounterId: "encounter-synthetic-1", tumorLotId: "lot-synthetic-1" };
}

describe("contratos Zod do serviço de trials", () => {
  it("preserva conteúdo textual literal e valida MIME/hash de fonte", () => {
    const conteudo = "{\r\n  \"title\": \"Synthetic study\"\r\n}\r\n";
    const pedido = { nome: "study.json", mimeType: "application/json", conteudo, idempotencyKey: "import-1" };
    expect(ImportarEstudoPedidoSchema.parse(pedido).conteudo).toBe(conteudo);
    expect(ImportarEstudoPedidoSchema.safeParse({ ...pedido, mimeType: "application/pdf" }).success).toBe(false);
    expect(ImportarEstudoPedidoSchema.safeParse({ ...pedido, actorId: "client-actor" }).success).toBe(false);
    expect(ImportarEstudoPedidoSchema.safeParse({ ...pedido, conteudo: "x".repeat(2_000_001) }).success).toBe(false);
    expect(StudySourceSchema.parse(source()).originalContent).toBe(source().originalContent);
    expect(StudySourceSchema.safeParse(source({ contentHash: "sha1-not-sha256" })).success).toBe(false);
  });

  it("exige referência de evidência estrita com hash SHA-256", () => {
    expect(EvidenceRefSchema.parse(evidence())).toMatchObject({ sourceId: "source-study-1", contentHash: hashSource });
    expect(EvidenceRefSchema.safeParse(evidence({ contentHash: "bad" })).success).toBe(false);
    expect(EvidenceRefSchema.safeParse({ ...evidence(), filename: "client/path.pdf" }).success).toBe(false);
    expect(EvidenceRefSchema.safeParse(evidence({ exactText: "" })).success).toBe(false);
  });

  it("rejeita critério DATE impossível e números NaN ou infinitos", () => {
    expect(CriterionExpressionSchema.safeParse({ kind: "DATE", factKey: "diagnosisDate",
      operator: "ON_OR_AFTER", value: "2026-02-30" }).success).toBe(false);
    for (const value of [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) {
      expect(CriterionExpressionSchema.safeParse({ kind: "NUMBER", factKey: "ageYears",
        operator: "GTE", value, unit: "years" }).success).toBe(false);
      expect(CriterionExpressionSchema.safeParse({ kind: "EQUALS", factKey: "ageYears", value }).success).toBe(false);
    }
  });

  it("rejeita provenance divergente e criterionId duplicado entre inclusão e exclusão", () => {
    const valid = candidate();
    expect(StudyCandidateDraftSchema.parse(valid)).toMatchObject({ candidateId: "candidate-1", sourceHash: hashSource });
    expect(StudyCandidateDraftSchema.safeParse(candidate({ sourceId: "other-source" })).success).toBe(false);
    expect(StudyCandidateDraftSchema.safeParse(candidate({ exclusionCriteria: [criterion({ polarity: "EXCLUSAO" })] })).success).toBe(false);
    expect(StudyCandidateDraftSchema.safeParse(candidate({ inclusionCriteria: [criterion({
      evidence: [evidence({ contentHash: sha("other source") })],
    })] })).success).toBe(false);
  });

  it("exige pareamento groupId/operator e motivo para não aplicável", () => {
    expect(ReviewedCriterionSchema.safeParse(reviewedCriterion({ groupId: "group-1", groupOperator: null })).success).toBe(false);
    expect(ReviewedCriterionSchema.safeParse(reviewedCriterion({ groupId: null, groupOperator: "OR" })).success).toBe(false);
    expect(ReviewedCriterionSchema.safeParse(reviewedCriterion({ applicability: "NAO_APLICAVEL",
      notApplicableReason: null })).success).toBe(false);
    expect(ReviewedCriterionSchema.safeParse(reviewedCriterion({ applicability: "APLICAVEL",
      notApplicableReason: "reason supplied for another state" })).success).toBe(false);
    expect(ReviewedCriterionSchema.safeParse(reviewedCriterion({ groupId: "group-1", groupOperator: "OR" })).success).toBe(true);
  });

  it("rejeita duplicidade de criteria/arms e Instante de revisão impossível", () => {
    expect(StudyReviewSchema.safeParse(review({ reviewedCriteria: [reviewedCriterion(), reviewedCriterion()] })).success).toBe(false);
    expect(StudyReviewSchema.safeParse(review({ reviewedArmIds: ["arm-1", "arm-1"] })).success).toBe(false);
    expect(StudyReviewSchema.safeParse(review({ reviewedAt: "2026-02-30T12:00:00Z" })).success).toBe(false);
    expect(StudyReviewSchema.parse(review()).reviewedAt).toBe("2026-10-20T14:30:00-03:00");
  });

  it("valida fatos confirmados/conflitados, datas civis e rejeita own undefined", () => {
    expect(PatientFactSchema.parse(patientFact()).status).toBe("CONFIRMADO");
    expect(PatientFactSchema.safeParse(patientFact({ validFrom: "2026-12-31", validTo: "2026-01-01" })).success).toBe(false);
    expect(PatientFactSchema.safeParse(patientFact({ validFrom: "2026-02-30" })).success).toBe(false);
    expect(PatientFactSchema.safeParse(patientFact({ value: Number.POSITIVE_INFINITY })).success).toBe(false);
    expect(PatientFactSchema.safeParse({ ...patientFact(), unit: undefined }).success).toBe(false);
    expect(PatientFactSchema.safeParse({ patientId: "patient-synthetic-1", factKey: "ageYears",
      status: "CONFLITO", sources: [evidence(), evidence({ locator: "page:3" })] }).success).toBe(true);
  });

  it("rejeita criteria duplicados e versão de estudo inválida no MatchResult", () => {
    expect(MatchResultSchema.parse(matchResult()).status).toBe("POSSIBLE_MATCH");
    expect(MatchResultSchema.safeParse(matchResult({ criteria: [
      matchResult().criteria[0], { ...matchResult().criteria[0], status: "PENDENTE" },
    ] })).success).toBe(false);
    expect(MatchResultSchema.safeParse(matchResult({ reviewedStudyVersion: 0 })).success).toBe(false);
    expect(MatchResultSchema.safeParse(matchResult({ reviewedStudyVersion: Number.MAX_SAFE_INTEGER + 1 })).success).toBe(false);
  });

  it("exige bindings únicos, operador pareado e bloqueia metadata de ator fornecida por HTTP", () => {
    const pedido = { draftId: "draft-study-1", expectedRevision: 2, candidateHash,
      studyId: "study-1", decision: "CONFIRMAR", titleText: "Synthetic study title",
      titleEvidenceLocator: "page:1/title", bindings: [{ criterionId: "criterion-age", groupId: null,
        groupOperator: null, expression: criterion().expression, applicability: "APLICAVEL", notApplicableReason: null }],
      reviewedArmIds: ["arm-1"], idempotencyKey: "review-study-1" };
    expect(RevisarEstudoPedidoSchema.parse(pedido).studyId).toBe("study-1");
    expect(RevisarEstudoPedidoSchema.safeParse({ ...pedido, reviewerId: "client-reviewer" }).success).toBe(false);
    expect(RevisarEstudoPedidoSchema.safeParse({ ...pedido, bindings: [pedido.bindings[0], pedido.bindings[0]] }).success).toBe(false);
    expect(RevisarEstudoPedidoSchema.safeParse({ ...pedido, bindings: [{ ...pedido.bindings[0], groupId: "g1" }] }).success).toBe(false);
  });

  it("valida revisão ligada ao candidato e resposta de listagem sem drafts duplicados", () => {
    const result = study({ review: review() });
    expect(EstudoServicoSchema.parse(result).review?.reviewHash).toBe(hashReview);
    expect(EstudoServicoSchema.safeParse(study({ review: review({ candidateHash: sha("stale") }) })).success).toBe(false);
    expect(ListarEstudosRespostaSchema.parse({ estudos: [study({ draftId: "draft-study-2" }), result] }).estudos).toHaveLength(2);
    expect(ListarEstudosRespostaSchema.safeParse({ estudos: [study(), study()] }).success).toBe(false);
  });

  it("contextualiza leitura de fatos e avaliação, sempre mantendo elegibilidade false", () => {
    const facts = [patientFact()];
    expect(SchemaFatosTrialsResposta.parse({ contexto: context(), revisaoFatos: hashFacts, fatos: facts }).fatos).toHaveLength(1);
    expect(SchemaFatosTrialsResposta.safeParse({ contexto: context(), revisaoFatos: "stale", fatos: facts }).success).toBe(false);
    expect(AvaliarEstudoPedidoSchema.parse({ contexto: context(), draftId: "draft-study-1",
      expectedRevision: 2, expectedReviewHash: hashReview }).contexto).toEqual(context());
    const resposta = { contexto: context(), estudo: study({ review: review() }), revisaoFatos: hashFacts,
      resultado: matchResult(), fatos: facts, elegivel: false };
    expect(AvaliacaoEstudoRespostaSchema.parse(resposta).elegivel).toBe(false);
    expect(AvaliacaoEstudoRespostaSchema.safeParse({ ...resposta, elegivel: true }).success).toBe(false);
    expect(AvaliacaoEstudoRespostaSchema.safeParse({ ...resposta, fatos: [patientFact({ patientId: "other-patient" })] }).success).toBe(false);
  });
});
