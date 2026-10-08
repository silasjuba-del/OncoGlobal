// RT-15 · caso completo: contradicções entre fala e prescrição exigem escopo e revisão.
import { describe, expect, it } from "vitest";
import { executarPipelineExtracao, type ExtractionInput } from "../../src/orchestration/pipeline-extracao.js";
import type { ReviewAction } from "../../src/kernel/extracao/tipos.js";
import { PLAUD_CONTRADICOES, PRESCRICAO_CARBO } from "../fixtures/redteam/laudos.js";

const em = "2030-01-03T10:00:00-03:00";
const contexto = { encounterId: "encontro-rt15-sintetico", dataClinica: "03/01/2030" };
const input: ExtractionInput = {
  recordingId: "grav-rt15-fala", sourceId: "fala-rt15", sourceType: "plaud",
  rawTranscript: PLAUD_CONTRADICOES, contexto,
  additionalSources: [{ recordingId: "grav-rt15-prescricao", sourceId: "prescricao-rt15",
    sourceType: "prescription", rawTranscript: PRESCRICAO_CARBO, contexto }],
};

function decisoes(state: ReturnType<typeof executarPipelineExtracao>, patientBySource: Readonly<Record<string, string>>): ReviewAction[] {
  return state.exceptions.filter((item) => item.kind === "UNLINKED_PATIENT").map((item) => ({
    exceptionId: item.id, acao: "LIGAR_PACIENTE", medicoId: "medico-rt15-sintetico", em,
    patientId: patientBySource[item.sourceIds[0] ?? ""] ?? "Paciente Teste 10",
  }));
}

describe("RT-15 · não reconciliar plano e ordem sem autorização e contexto equivalentes", () => {
  it("sem ações de vínculo persistidas, não cruza as fontes nem inventa paciente", () => {
    const state = executarPipelineExtracao(input);
    expect(state.exceptions.some((item) => item.reason.includes("planned_regimen"))).toBe(false);
    expect(state.segments.every((segment) => segment.patientId === null)).toBe(true);
    expect(state.facts.every((fact) => fact.patientCandidateId === null)).toBe(true);
    expect(state.timeline).toBeNull();
    expect(state.exceptions.filter((item) => item.kind === "UNLINKED_PATIENT")).toHaveLength(2);
  });

  it("ReviewAction com exceção inventada ou alvo divergente não autoriza confronto entre fontes", () => {
    const unlinked = executarPipelineExtracao(input);
    const valid = decisoes(unlinked, { "fala-rt15": "Paciente Teste 10", "prescricao-rt15": "Paciente Teste 10" });
    const [fala, prescricao] = valid;
    expect(fala).toBeDefined();
    expect(prescricao).toBeDefined();
    const variantes: ExtractionInput[] = [
      { ...input, confirmacoes: [{ ...fala!, exceptionId: "exc:UNLINKED_PATIENT:segmento-inexistente" }, prescricao!] },
      { ...input, confirmacoes: decisoes(unlinked, { "fala-rt15": "Paciente Teste 10", "prescricao-rt15": "Paciente Teste 11" }) },
    ];
    for (const variante of variantes) {
      const state = executarPipelineExtracao(variante);
      expect(state.exceptions.some((item) => item.reason.includes("planned_regimen"))).toBe(false);
      expect(state.facts).toHaveLength(unlinked.facts.length);
    }
  });

  it("com duas decisões explícitas no mesmo paciente/encontro/data, mantém conflito e os dois candidatos", () => {
    const unlinked = executarPipelineExtracao(input);
    const state = executarPipelineExtracao({ ...input, confirmacoes: decisoes(unlinked, {
      "fala-rt15": "Paciente Teste 10", "prescricao-rt15": "Paciente Teste 10",
    }) });
    const plano = state.facts.find((fact) => fact.domain === "plan");
    const receita = state.facts.find((fact) => fact.domain === "drug" && fact.sourceId === "prescricao-rt15");
    const conflito = state.exceptions.find((item) => item.reason.includes("planned_regimen"));
    expect(plano).toBeDefined();
    expect(receita).toBeDefined();
    expect(conflito).toMatchObject({ kind: "CONFLICT", factIds: expect.arrayContaining([plano!.id, receita!.id]),
      sourceIds: expect.arrayContaining(["fala-rt15", "prescricao-rt15"]) });
    expect(state.confirmationRequired).toContainEqual(conflito);
    expect(state.fields[`${plano!.segmentId}::plan`]?.resolvedFactId).toBeNull();
    expect(state.facts).toHaveLength(unlinked.facts.length);
    expect(state.segments.every((segment) => segment.patientId === null)).toBe(true);
  });

  it("mesmo vínculo não cruza uma prescrição de outro encontro ou data clínica", () => {
    const unlinked = executarPipelineExtracao(input);
    const confirmacoes = decisoes(unlinked, { "fala-rt15": "Paciente Teste 10", "prescricao-rt15": "Paciente Teste 10" });
    const prescricao = input.additionalSources![0]!;
    const variants: ExtractionInput[] = [
      { ...input, confirmacoes, additionalSources: [{ ...prescricao,
        contexto: { ...contexto, encounterId: "outro-encontro" } }] },
      { ...input, confirmacoes, additionalSources: [{ ...prescricao,
        contexto: { ...contexto, dataClinica: "04/01/2030" } }] },
      { ...input, confirmacoes, additionalSources: [{ ...prescricao,
        contexto: { ...contexto, dataClinica: "31/02/2030" } }] },
    ];
    for (const variant of variants) {
      const state = executarPipelineExtracao(variant);
      expect(state.exceptions.some((item) => item.reason.includes("planned_regimen"))).toBe(false);
      expect(state.facts).toHaveLength(unlinked.facts.length);
    }
  });
});
