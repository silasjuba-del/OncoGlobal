// KIMI-13 · G-09 + T-51 · PT_DE_BIOPSIA (PLANO R-15, linha 456; AG-05; MATRIZ docs/w5/MATRIZ.md).
// Regra: pTNM exige SURGICAL_RESECTION + TNM explícito; biópsia sem ressecção ⇒ campo rejeitado.
// ESTADO: SEM_IMPLEMENTACAO — o contrato tipa Estadiamento (prefixo c/p/yp/r/a, fontes), mas
// nenhum código valida specimen×prefixo; "tipo de prefixo/fonte não prova rejeição" (MATRIZ T-51).
// Dono provável: harness/Claude (gate) + AG-05 PATH (F1). S1: pT de biópsia contaminaria
// estadiamento → protocolo/APAC (S1 do caso real 01, §2 S1: TNM é do médico).
import { describe, expect, it } from "vitest";

interface VereditoLike { gate?: string; decisao?: string; motivo?: string }

async function gateG09(): Promise<((input: unknown) => VereditoLike) | null> {
  const mod = (await import("../../src/kernel/harness/gates.js")) as Record<string, unknown>;
  const fn = mod["g09PtDeBiopsia"] ?? mod["g09"] ?? mod["ptDeBiopsia"];
  return typeof fn === "function" ? (fn as (input: unknown) => VereditoLike) : null;
}

describe("G-09 / T-51 · gate pTNM exige ressecção + TNM explícito", () => {
  it("G-09 · SEM_IMPLEMENTACAO: gate de pTNM existe em src/kernel/harness", async () => {
    expect(await gateG09(),
      "G-09 não implementado: nenhuma função rejeita pTNM de biópsia sem ressecção; " +
      "o schema Estadiamento aceita prefixo p sem checar specimen (MATRIZ: 'tipo deprefixo/fonte não prova rejeição')").not.toBeNull();
  });

  it("G-09 · positivo: pT2 vindo de BIOPSIA (sem ressecção) ⇒ campo rejeitado", async () => {
    const g09 = await gateG09();
    if (!g09) return;
    const v = g09({ prefixo: "p", tnmExplicito: true, specimen: "NEEDLE_BIOPSY" });
    expect(v.gate).toBe("G-09");
    expect(v.decisao).toMatch(/REJEITA|BLOQUEIA/);
  });

  it("G-09 · negativo: pT2 de SURGICAL_RESECTION com TNM explícito passa", async () => {
    const g09 = await gateG09();
    if (!g09) return;
    expect(g09({ prefixo: "p", tnmExplicito: true, specimen: "SURGICAL_RESECTION" }).decisao).toBe("PASSA");
  });

  it("G-09 · negativo: cT de biópsia é clínico e passa (regra só veta p de biópsia)", async () => {
    const g09 = await gateG09();
    if (!g09) return;
    expect(g09({ prefixo: "c", tnmExplicito: true, specimen: "NEEDLE_BIOPSY" }).decisao).toBe("PASSA");
  });

  it("G-09 · negativo: ressecção sem TNM explícito ⇒ PENDENTE, nunca PASSA silencioso", async () => {
    const g09 = await gateG09();
    if (!g09) return;
    expect(g09({ prefixo: "p", tnmExplicito: false, specimen: "SURGICAL_RESECTION" }).decisao).not.toBe("PASSA");
  });
});
