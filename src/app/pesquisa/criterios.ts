import { hashCanonico } from "../../modules/tipos.js";
import { verifyStudyReview } from "./revisao.js";
import type { CriterionEvaluation, CriterionExpression, MatchResult, PatientFact, ReviewedCriterion, StudyCandidateDraft, StudyReview } from "./tipos.js";

export function evaluateMatch(input: { patientId: string; candidate: StudyCandidateDraft; review: StudyReview; facts: readonly PatientFact[]; asOf: string }): MatchResult {
  const { patientId, candidate, review, facts, asOf } = input;
  if (!patientId.trim() || facts.some((fact) => fact.patientId !== patientId)) throw new Error("PATIENT_SCOPE_MISMATCH");
  if (!verifyStudyReview(review) || review.decision !== "CONFIRMAR" || review.candidateId !== candidate.candidateId || review.candidateHash !== hashCanonico(candidate) ||
      review.version < 1 || !validDate(asOf)) throw new Error("CONFIRMED_VERSIONED_STUDY_REQUIRED");
  const factMap = new Map<string, PatientFact[]>();
  for (const fact of facts) factMap.set(fact.factKey, [...(factMap.get(fact.factKey) ?? []), fact]);
  const results = review.reviewedCriteria.map((criterion) => evaluateCriterion(criterion, factMap.get(criterion.expression?.factKey ?? "") ?? [], asOf));
  const byId = new Map(results.map((r) => [r.criterionId, r]));
  const included = review.reviewedCriteria.filter((c) => c.polarity === "INCLUSAO");
  const excluded = review.reviewedCriteria.filter((c) => c.polarity === "EXCLUSAO");
  const includeState = aggregate(included, byId, "ALL_GROUPS");
  const excludeState = aggregate(excluded, byId, "ANY_GROUP");
  let status: MatchResult["status"];
  if (includeState === "NAO_ATENDIDO" || excludeState === "ATENDIDO") status = "SEM_MATCH";
  else if (includeState === "ATENDIDO" && excludeState === "NAO_ATENDIDO") status = "POSSIBLE_MATCH";
  else status = "PENDENTE";
  return { status, criteria: results, reviewedStudyVersion: review.version };
}

function evaluateCriterion(criterion: ReviewedCriterion, matching: PatientFact[], asOf: string): CriterionEvaluation {
  if (criterion.applicability === "NAO_APLICAVEL") return { criterionId: criterion.criterionId, status: "NAO_APLICAVEL",
    reason: criterion.notApplicableReason ?? "Aplicabilidade definida na revisão médica.", sources: criterion.evidence };
  const expression = criterion.expression;
  if (!expression) return { criterionId: criterion.criterionId, status: "PENDENTE", reason: "Critério sem vínculo estruturado confirmado.", sources: criterion.evidence };
  if (matching.length !== 1) return { criterionId: criterion.criterionId, status: "PENDENTE",
    reason: matching.length === 0 ? "Fato confirmado com fonte ausente." : "Fontes conflitantes ou fatos duplicados.",
    sources: [...criterion.evidence, ...matching.flatMap((f) => f.status === "CONFIRMADO" ? [f.source] : f.sources)] };
  const fact = matching[0];
  if (!fact || fact.status !== "CONFIRMADO") return { criterionId: criterion.criterionId, status: "PENDENTE", reason: "Fato conflitante.", sources: criterion.evidence };
  if (!validEvidence(fact.source)) return { criterionId: criterion.criterionId, status: "PENDENTE", reason: "Proveniência do fato inválida ou ausente.", sources: criterion.evidence };
  if (!isValidAt(fact, asOf)) return { criterionId: criterion.criterionId, status: "PENDENTE", reason: "Fato fora do período de validade requerido.", sources: [fact.source] };
  const result = compare(expression, fact);
  if (result === null) return { criterionId: criterion.criterionId, status: "PENDENTE", reason: "Tipo, unidade ou data incompatível.", sources: [fact.source] };
  const matched = result;
  return { criterionId: criterion.criterionId, status: matched ? "ATENDIDO" : "NAO_ATENDIDO",
    reason: matched ? "Comparação determinística atendida." : "Comparação determinística não atendida.", sources: [fact.source] };
}
function compare(rule: CriterionExpression, fact: Extract<PatientFact, { status: "CONFIRMADO" }>): boolean | null {
  if (rule.kind === "EQUALS") return typeof fact.value === typeof rule.value ? fact.value === rule.value : null;
  if (rule.kind === "NUMBER") {
    if (typeof fact.value !== "number" || fact.unit !== rule.unit) return null;
    return rule.operator === "EQ" ? fact.value === rule.value : rule.operator === "GT" ? fact.value > rule.value
      : rule.operator === "GTE" ? fact.value >= rule.value : rule.operator === "LT" ? fact.value < rule.value : fact.value <= rule.value;
  }
  if (typeof fact.value !== "string" || !validDate(fact.value) || !validDate(rule.value)) return null;
  return rule.operator === "ON_OR_AFTER" ? fact.value >= rule.value : fact.value <= rule.value;
}
function aggregate(criteria: readonly ReviewedCriterion[], results: Map<string, CriterionEvaluation>, acrossGroups: "ALL_GROUPS" | "ANY_GROUP"): CriterionEvaluation["status"] {
  const applicable = criteria.filter((c) => c.applicability !== "NAO_APLICAVEL");
  if (!applicable.length) return acrossGroups === "ANY_GROUP" ? "NAO_ATENDIDO" : "PENDENTE";
  const groups = new Map<string, ReviewedCriterion[]>();
  const units: ReviewedCriterion[][] = [];
  for (const c of applicable) {
    if (!c.groupId) units.push([c]);
    else groups.set(c.groupId, [...(groups.get(c.groupId) ?? []), c]);
  }
  units.push(...groups.values());
  const states = units.map((unit) => {
    const memberStates = unit.map((c) => results.get(c.criterionId)?.status ?? "PENDENTE");
    const op = unit[0]?.groupOperator ?? "AND";
    if (op === "OR") {
      if (memberStates.includes("ATENDIDO")) return "ATENDIDO";
      if (memberStates.includes("PENDENTE")) return "PENDENTE";
      return "NAO_ATENDIDO";
    }
    if (memberStates.includes("NAO_ATENDIDO")) return "NAO_ATENDIDO";
    if (memberStates.includes("PENDENTE")) return "PENDENTE";
    return "ATENDIDO";
  });
  if (acrossGroups === "ALL_GROUPS") {
    if (states.includes("NAO_ATENDIDO")) return "NAO_ATENDIDO";
    if (states.includes("PENDENTE")) return "PENDENTE";
    return "ATENDIDO";
  }
  if (states.includes("ATENDIDO")) return "ATENDIDO";
  if (states.includes("PENDENTE")) return "PENDENTE";
  return "NAO_ATENDIDO";
}
function isValidAt(fact: Extract<PatientFact, { status: "CONFIRMADO" }>, asOf: string): boolean {
  return (!fact.validFrom || (validDate(fact.validFrom) && fact.validFrom <= asOf)) && (!fact.validTo || (validDate(fact.validTo) && fact.validTo >= asOf));
}
function validDate(value: string): boolean {
  if (!/^\d{4}-\d\d-\d\d$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}
function validEvidence(source: { sourceId: string; sourceRef: string; locator: string; exactText: string; contentHash: string }): boolean {
  return !!source.sourceId.trim() && !!source.sourceRef.trim() && !!source.locator.trim() && !!source.exactText.trim() && /^[a-f\d]{64}$/i.test(source.contentHash);
}
