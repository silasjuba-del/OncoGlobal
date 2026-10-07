// RT-09 · Agentes determinísticos, ORK e Maestro (S1) — LACUNAS.
// 1) T-56/G-16: nenhum veredito runtime de ownership (agente escrevendo objeto de outro dono).
// 2) Agente chamando agente: sem restrição representável no runtime do ORK.
// 3) Pipeline não valida os fatos contra o contrato w10 (normalizarFatos/validarSeguranca no-op).
// Dono provável: kernel/harness (tech lead) + orchestration (Fugu).
import { describe, expect, it } from "vitest";

async function probe(mod: string, nomes: readonly string[]): Promise<unknown> {
  try {
    const m = (await import(mod)) as Record<string, unknown>;
    for (const nome of nomes) if (typeof m[nome] === "function") return m[nome];
  } catch {
    // módulo inexistente
  }
  return null;
}

describe("RT-09 · ownership e composição de agentes", () => {
  it("SEM_IMPLEMENTACAO: veredito de ownership T-56/G-16 existe no harness (write alheio rejeitado)", async () => {
    const fn = await probe("../../src/kernel/harness/gates.js", ["g16Owner", "g16", "donoDoObjeto"]);
    const ownership = await probe("../../src/kernel/harness/ownership.js", ["g16Owner", "verificarDono"]);
    expect(fn ?? ownership,
      "capabilities.v1.json DECLARA ownerOf por agente, mas nenhum veredito runtime rejeita agente " +
      "escrevendo objeto de dono alheio (ex.: agente de extração escrevendo Conversation). " +
      "Kimi registrou a mesma lacuna (tests/adv-w8/t56-g16-owner-write.adv.ts). " +
      "Dono provável: src/kernel/harness/gates.ts ou ownership.ts (Grok tem faixa sobre ownership.ts).")
      .toBeTypeOf("function");
  });

  it("agente escrevendo objeto de outro dono é rejeitado; dono escrevendo no próprio objeto passa", async () => {
    const fn = (await probe("../../src/kernel/harness/gates.js", ["g16Owner", "g16"]) ??
      await probe("../../src/kernel/harness/ownership.js", ["g16Owner", "verificarDono"])) as
      ((input: { agenteId: string; objetoTipo: string; operacao: string }) => { decisao: string }) | null;
    if (typeof fn !== "function") return;
    expect(fn({ agenteId: "AG-04", objetoTipo: "Conversation", operacao: "write" }).decisao)
      .toMatch(/REJEITA|BLOQUEIA/);
    expect(fn({ agenteId: "AG-14", objetoTipo: "Conversation", operacao: "write" }).decisao).toBe("PASSA");
  });

  it("SEM_IMPLEMENTACAO: runtime impõe que agente não invoque agente (composição só via ORK/plano)", async () => {
    const fn = await probe("../../src/orchestration/ork.js", ["verificarChamadaAgente", "restricaoComposicao"]);
    expect(fn,
      "O AgenteFake recebe contexto e devolve unknown: nada impede um agente de 'chamar' outro " +
      "agente dentro da própria saída (ou disparar plano paralelo) — a composição só é auditável " +
      "se o runtime rejeitar saída-agente. Dono provável: orchestration/ork.ts (Fugu) + harness.")
      .toBeTypeOf("function");
  });

  it("SEM_IMPLEMENTACAO: pipeline valida fatos contra o contrato w10 (validarSeguranca é no-op)", async () => {
    const fn = await probe("../../src/orchestration/pipeline-extracao.js",
      ["validarFatosContraContrato", "validarContrato"]);
    expect(fn,
      "pipeline-extracao.ts declara validarSeguranca/normalizarFatos/reconciliarFontes como no-op: " +
      "um extrator que devolva campo fora do contrato (ou evidence inválida) atravessa sem rejeição " +
      "com motivo. O contrato Zod existe (ClinicalFact strict) mas o pipeline não o usa. " +
      "Dono provável: orchestration/pipeline-extracao.ts (Fugu).")
      .toBeTypeOf("function");
  });

  it("fato com campo fora do contrato é rejeitado pelo schema; pipeline teria que recusar com motivo", async () => {
    const { ClinicalFact } = await import("../../src/contracts/w10/extracao.js");
    const fora = {
      id: "f1", segmentId: "s1", patientCandidateId: null, domain: "diagnosis", value: "x",
      sourceType: "medical_note", evidence: "EXPLICIT", sourceId: "d1", rawEvidence: "x",
      confidence: 1, requiresConfirmation: false, campoInventado: true,
    };
    expect(ClinicalFact.safeParse(fora).success).toBe(false); // contrato recusa
    const fn = await probe("../../src/orchestration/pipeline-extracao.js", ["validarContrato"]);
    if (typeof fn !== "function") return;
    expect(fn([fora]).success).toBe(false);
  });
});
