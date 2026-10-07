// RT-10 · MEMORY_OS (S0) — FALHAS reais: nada produz TEMPORAL_CONFLICT (PET antes do
// diagnóstico nunca é flagrado); historicalMetastaticDisease aceita true→false no schema;
// TNM sobrescrito via supersede apaga o valor antigo (stageHistory não existe na projeção).
// Dono provável: contracts/w10/clinico-w10.ts (tech lead) + kernel/projections (equipe interna).
import { describe, expect, it } from "vitest";
import { PatientTimeline } from "../../src/contracts/w10/clinico-w10.js";
import { eventosVigentes, projetarSnapshot } from "../../src/kernel/projections/snapshot.js";
import type { ClinicalEvent } from "../../src/contracts/operacao.js";

const em = "2030-01-01T12:00:00Z";
const evento = (id: string, campo: string, valor: unknown, criadoEm = em,
  supersedesEventId: string | null = null): ClinicalEvent => ({
  eventId: id, operationId: `op-${id}`, eventIndex: 0, patientId: "Paciente Teste 07",
  tumorLotId: "tumor-07", encounterId: "enc-07", criadoEm, tipo: "FATO",
  revisao: "CONFIRMADO", criadoPor: { tipo: "SESSAO", id: "medico-teste" }, fontes: [],
  supersedesEventId, payload: { reviewDecisionId: `rd-${id}`, data: { campo, valor } },
});
const projetar = (eventos: readonly ClinicalEvent[]) =>
  projetarSnapshot(eventos, "Paciente Teste 07", "tumor-07", "enc-07", "v1");

async function produtorTemporal(): Promise<((entrada: unknown) => unknown) | null> {
  for (const caminho of ["../../src/orchestration/pipeline-extracao.js", "../../src/kernel/projections/snapshot.js"]) {
    const mod = (await import(caminho)) as Record<string, unknown>;
    const fn = mod["detectarConflitoTemporal"] ?? mod["validarTemporal"] ?? mod["checarOrdemTemporal"];
    if (typeof fn === "function") return fn as (entrada: unknown) => unknown;
  }
  return null;
}

describe("RT-10 · ordem temporal e monotonicidade", () => {
  it("SEM_IMPLEMENTACAO: produtor de TEMPORAL_CONFLICT existe (evento antes do diagnóstico)", async () => {
    const fn = await produtorTemporal();
    expect(fn,
      "ExceptionKind.TEMPORAL_CONFLICT existe só como enum (kernel tipos + contrato w10): nenhum " +
      "código emite a exceção. PIPELINE §5.6 exige: evento que exige diagnóstico antes da data do " +
      "diagnóstico → TEMPORAL_CONFLICT (ex.: PET 02/25 × diagnóstico 11/25). " +
      "Dono provável: kernel/projections + orchestration (Fugu/equipe interna).")
      .toBeTypeOf("function");
  });

  it("PET de 02/2030 antes do diagnóstico de 11/2030 gera exceção TEMPORAL_CONFLICT", async () => {
    const fn = await produtorTemporal();
    if (!fn) return;
    const saida = fn({
      diagnosticoEm: "2030-11-10",
      eventos: [{ tipo: "ImagingStudy", campo: "PET", data: "2030-02-15" }],
    }) as { conflitos?: { kind?: string }[] };
    expect(saida.conflitos?.[0]?.kind).toBe("TEMPORAL_CONFLICT");
  });

  it("PROVA DE FALHA (S0): historicalMetastaticDisease true→false é aceito pelo schema sem bloqueio", () => {
    const base = {
      patientId: "Paciente Teste 07",
      historicalMetastaticDisease: true,
      stageHistory: [{ tipo: "CLINICO" as const, valor: "cT2N0M0", sistema: "TNM8", data: "2030-01-01", sourceId: "d1" }],
      treatments: [], recist: [], missingRequiredData: [], unresolvedConflicts: [],
    };
    expect(PatientTimeline.safeParse(base).success).toBe(true);
    const rebaixado = PatientTimeline.safeParse({ ...base, historicalMetastaticDisease: false });
    expect(rebaixado.success,
      "D-W9-33 §5.7: 'historicalMetastaticDisease = true nunca volta a false' — o contrato " +
      "PatientTimeline (clinico-w10.ts) apenas comenta a regra; o superRefine não existe e o " +
      "parse aceita o rebaixamento. Nenhum dado clinicamente confirmado pode ser rebaixado em silêncio.")
      .toBe(false);
  });

  it("PROVA DE FALHA (S0): TNM sobrescrito por supersede — o valor antigo some da projeção (sem stageHistory)", () => {
    const velho = evento("e1", "TNM", "cT2N0M0");
    const novo = { ...evento("e2", "TNM", "cT3N1M0", "2030-02-01T12:00:00Z"), supersedesEventId: "e1" };
    expect(eventosVigentes([velho, novo]).map((e) => e.eventId)).toEqual(["e2"]);
    const saida = projetar([velho, novo]);
    const campo = saida.campos.TNM;
    // O histórico (D-W9-33 §5.7 / A3: avaliações coexistem) precisaria estar acessível:
    const historico = (campo as { stageHistory?: unknown[] } | undefined)?.stageHistory;
    expect(historico,
      "A correção por supersede é legítima, mas a projeção não preserva o estádio anterior em " +
      "stageHistory: o cT2N0M0 original fica inacessível (só sobrevive no ledger bruto). " +
      "PIPELINE §5.7 exige stageHistory[] imutável. Dono: kernel/projections + contracts.")
      .toBeDefined();
    expect(historico?.length).toBeGreaterThanOrEqual(2);
  });
});
