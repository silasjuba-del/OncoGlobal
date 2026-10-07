// RT-15 · Erro de análise de exame ponta a ponta (S1) — FALHAS do pipeline de extração
// num caso completo sintético (PT10): colar laudo AP + prescrição + Plaud com contradições.
// Especificação (PIPELINE §10): saem EXATAMENTE as exceções esperadas — cisplatina ×
// carboplatina; PET antes do diagnóstico; cN2 sem prova; "prednisona 10 mg por hora" — e
// nenhuma conclusão silenciosa.
// Dono provável: orchestration/pipeline-extracao.ts (Fugu) — ReconciliationEngine/safety no-op.
import { describe, expect, it } from "vitest";
import { executarPipelineExtracao } from "../../src/orchestration/pipeline-extracao.js";
import { PLAUD_CONTRADICOES, PRESCRICAO_CARBO, LAUDO_AP_PT10 } from "../fixtures/redteam/laudos.js";

const rodarCaso = () => {
  const plaud = executarPipelineExtracao({
    recordingId: "grav-rt15", sourceId: "plaud-pt10", sourceType: "plaud",
    rawTranscript: PLAUD_CONTRADICOES,
    registeredPatients: [{ patientId: "Paciente Teste 10", age: 60, tumor: "mama" }],
  });
  const ap = executarPipelineExtracao({
    recordingId: "grav-rt15-ap", sourceId: "ap-pt10", sourceType: "pathology",
    rawTranscript: LAUDO_AP_PT10,
    registeredPatients: [{ patientId: "Paciente Teste 10", age: 60, tumor: "mama" }],
  });
  const rx = executarPipelineExtracao({
    recordingId: "grav-rt15-rx", sourceId: "rx-pt10", sourceType: "prescription",
    rawTranscript: PRESCRICAO_CARBO,
    registeredPatients: [{ patientId: "Paciente Teste 10", age: 60, tumor: "mama" }],
  });
  return { plaud, ap, rx };
};

describe("RT-15 · caso completo com contradições: exceções esperadas (spec §10)", () => {
  it("SEM_IMPLEMENTACAO: ReconciliationEngine emite CONFLICT para regimen planejado × prescrito", async () => {
    const mod = (await import("../../src/orchestration/pipeline-extracao.js")) as Record<string, unknown>;
    const fn = mod["reconciliarComConflitos"] ?? mod["detectarConflitos"] ?? mod["reconciliar"];
    expect(fn,
      "reconciliarFontes é no-op declarado (fields sempre {}): a contradição central do caso " +
      "(Plaud fala cisplatina; prescrição ordena carboplatina) nunca vira exceção CONFLICT " +
      "('planned_regimen != ordered_regimen'). PIPELINE §4/§7 exige o conflito, nunca escolha " +
      "silenciosa. Dono provável: orchestration/pipeline-extracao.ts (Fugu).")
      .toBeTypeOf("function");
  });

  it("cisplatina (falada) × carboplatina (prescrita) ⇒ exceção CONFLICT, nunca escolha silenciosa", async () => {
    const mod = (await import("../../src/orchestration/pipeline-extracao.js")) as Record<string, unknown>;
    if (typeof mod["reconciliar"] !== "function") return;
    const { plaud, rx } = rodarCaso();
    const conflitos = [...plaud.exceptions, ...rx.exceptions].filter((e) => e.kind === "CONFLICT");
    expect(conflitos.length,
      "esperada exceção CONFLICT unindo as duas fontes (regimen divergente)")
      .toBeGreaterThan(0);
  });

  it("PET de 02/2030 antes do diagnóstico de 11/2030 ⇒ TEMPORAL_CONFLICT", async () => {
    const mod = (await import("../../src/orchestration/pipeline-extracao.js")) as Record<string, unknown>;
    if (typeof mod["reconciliar"] !== "function") return;
    const { plaud } = rodarCaso();
    expect(plaud.exceptions.some((e) => e.kind === "TEMPORAL_CONFLICT")).toBe(true);
  });

  it("'cN2' falado sem prova anexada ⇒ exceção/pendência de confirmação (nunca fato firme, nunca silêncio)", () => {
    const { plaud } = rodarCaso();
    // Hoje o TNM parcial nem é extraído (regex exige cT…N…M completo): o cN2 some em silêncio.
    const estagio = plaud.facts.filter((f) => f.domain === "stage");
    const excecaoEstadiamento = plaud.exceptions.some((e) => /cN2|estadiamento/iu.test(e.reason));
    expect(estagio.length > 0 || excecaoEstadiamento,
      "'o estadiamento é cN2, sem imagem de axila anexada' não gera NADA: nem fato (regex TNM " +
      "exige T-N-M completos), nem exceção de confirmação. Spec §10 espera pendência de " +
      "estadiamento sem prova (cN2 = canditado que exige documento).")
      .toBe(true);
  });

  it("'prednisona 10 mg por hora' dita em consulta ⇒ exceção (dose absurda nunca entra como plano)", () => {
    const { plaud } = rodarCaso();
    const mencionaPrednisona = plaud.exceptions.some((e) => e.reason.match(/prednisona/iu)) ||
      plaud.facts.some((f) => f.rawEvidence.match(/prednisona/iu));
    expect(mencionaPrednisona,
      "A linha de prednisona 10 mg por hora desaparece sem rastro: extrator não extraí fármaco de " +
      "plaud e nenhuma exceção registra o trecho. Spec §10 espera essa linha entre as 4 exceções.")
      .toBe(true);
  });

  it("nenhuma conclusão silenciosa: campos resolvidos vazios, timeline nula, nada promovido", () => {
    const { plaud, ap, rx } = rodarCaso();
    for (const estado of [plaud, ap, rx]) {
      expect(estado.fields).toEqual({});
      expect(estado.timeline).toBeNull();
      for (const fato of estado.facts) expect(fato.patientCandidateId).toBeNull();
      expect(estado.exceptions.some((e) => e.kind === "UNLINKED_PATIENT")).toBe(true);
    }
    // O ap (pathology) extrai histologia como CANDIDATA confirmável — nunca como fato fechado:
    const histologia = ap.facts.find((f) => f.domain === "histology");
    expect(histologia?.value).toContain("carcinoma ductal");
  });
});
