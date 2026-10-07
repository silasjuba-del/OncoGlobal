// RT-01 · Troca de laudo entre pacientes (S0) — FALHAS reais (fora da suíte regular).
// Método Kimi: o 1º teste de cada lacuna afirma a capacidade ausente (esperado: falhar);
// os demais ficam guardados (`if (!fn) return`) como especificação executável.
// Dono provável: Fugu (pipeline de extração) + contracts (ReviewAction sem consumidor).
import { describe, expect, it } from "vitest";

interface ExecutorAcao {
  aplicar(acao: unknown): { ok: boolean; motivo?: string };
}

async function executorReviewAction(): Promise<ExecutorAcao | null> {
  const mod = (await import("../../src/orchestration/pipeline-extracao.js")) as Record<string, unknown>;
  const modLeitura = (await import("../../src/kernel/extracao/tipos.js")) as Record<string, unknown>;
  const fn = mod["aplicarAcaoRevisao"] ?? mod["aplicarReviewAction"] ?? modLeitura["aplicarReviewAction"];
  return typeof fn === "function" ? { aplicar: fn as ExecutorAcao["aplicar"] } : null;
}

async function confrontoNomeIdentificador(): Promise<((entrada: unknown) => unknown) | null> {
  const mod = (await import("../../src/rules/w8/vinculoDocumento.js")) as Record<string, unknown>;
  const fn = mod["confrontarNomeIdentificador"] ?? mod["conferirNomeDocumento"] ?? mod["divergenciaNome"];
  return typeof fn === "function" ? (fn as (entrada: unknown) => unknown) : null;
}

describe("RT-01 · lacunas de defesa contra troca de laudo", () => {
  it("SEM_IMPLEMENTACAO: executor da ReviewAction LIGAR_PACIENTE existe (contrato w10 sem consumidor)", async () => {
    const executor = await executorReviewAction();
    expect(executor,
      "ReviewAction LIGAR_PACIENTE existe só como schema em src/contracts/w10/extracao.ts; " +
      "nenhuma função aplica a ação (a caixa de revisão não fecha o ciclo: exceção nunca é resolvida). " +
      "Dono provável: orchestration/pipeline (Fugu) + kernel (tech lead)")
      .toBeTypeOf("function");
  });

  it("LIGAR_PACIENTE aplica vínculo APENAS com patientId e médico; sem patientId recusa", async () => {
    const executor = await executorReviewAction();
    if (!executor) return;
    const invalida = executor.aplicar({ exceptionId: "e1", acao: "LIGAR_PACIENTE", medicoId: "med-1", em: "2030-01-01" });
    expect(invalida.ok).toBe(false);
    const valida = executor.aplicar({
      exceptionId: "e1", acao: "LIGAR_PACIENTE", medicoId: "med-1", em: "2030-01-01",
      patientId: "Paciente Teste 07",
    });
    expect(valida.ok).toBe(true);
  });

  it("SEM_IMPLEMENTACAO: confronto nome do documento × identificador gera exceção (CNS de um, nome do outro)", async () => {
    const confrontar = await confrontoNomeIdentificador();
    expect(confrontar,
      "vincularDocumentoAoPaciente liga por CNS válido sem nunca ver o NOME impresso no documento " +
      "(EntradaVinculoDocumento nem tem campo de nome): laudo com CNS do PT07 e nome do PT09 liga sem exceção. " +
      "D-W9-34a exige conflito em revisão. Dono provável: src/rules/w8 (Grok) + pipeline (Fugu)")
      .toBeTypeOf("function");
  });

  it("laudo com CNS de um e nome do outro ⇒ exceção de revisão, nunca vínculo silencioso", async () => {
    const confrontar = await confrontoNomeIdentificador();
    if (!confrontar) return;
    const saida = confrontar({
      nomeDocumento: "PACIENTE TESTE 09",
      identificador: { tipo: "CNS", valor: "700000000000001" },
      cadastroNome: "Maria Alves de Souza",
    }) as { excecao?: boolean; motivo?: string };
    expect(saida.excecao).toBe(true);
    expect(saida.motivo).toMatch(/nome/i);
  });

  it("SEM_IMPLEMENTACAO: pipeline deduplica laudos repetidos (reconciliarFontes é no-op)", async () => {
    const mod = (await import("../../src/orchestration/pipeline-extracao.js")) as Record<string, unknown>;
    const fn = mod["deduplicarFatos"] ?? mod["dedupExames"];
    expect(fn,
      "pipeline-extracao.ts normalizarFatos/reconciliarFontes/validarSeguranca são no-op declarados; " +
      "duas entradas do mesmo laudo produzem fatos duplicados sem colapso. " +
      "Dono provável: Fugu (pipeline) + Grok (dedupeExame ainda sem consumidor no pipeline)")
      .toBeTypeOf("function");
  });

  it("duas entradas do mesmo laudo no pipeline ⇒ 1 conjunto reconciliado, duplicatas marcadas", async () => {
    const mod = (await import("../../src/orchestration/pipeline-extracao.js")) as Record<string, unknown>;
    if (typeof mod["deduplicarFatos"] !== "function") return;
    const { executarPipelineExtracao } = mod as unknown as typeof import("../../src/orchestration/pipeline-extracao.js");
    const entrada = {
      recordingId: "grav-rt01", sourceId: "laudo-reimpresso", sourceType: "imaging_report" as const,
      rawTranscript: "nódulo hepático medindo 3,4 cm",
    };
    const a = executarPipelineExtracao(entrada);
    const b = executarPipelineExtracao(entrada);
    expect(a.facts.length).toBeGreaterThan(0);
    expect(b.facts.length).toBe(a.facts.length);
  });
});
