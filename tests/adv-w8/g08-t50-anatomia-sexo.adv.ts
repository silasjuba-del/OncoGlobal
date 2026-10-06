// KIMI-12 · G-08 + T-50 · ANATOMIA×SEXO (PLANO R-15, linha 455; MATRIZ docs/w5/MATRIZ.md).
// Regra: incoerência anatomia × sexo cadastral (ex.: próstata × cadastro F) ⇒ revisão de
// identidade/anatomia — NUNCA veto (o app alerta e nunca bloqueia o clínico).
// ESTADO: SEM_IMPLEMENTACAO — o contrato tipa sexoCadastral/divergencia (src/contracts/clinico.ts),
// mas nenhum código executa a comparação; campo tipado não é gate (MATRIZ T-50).
// Dono provável: harness/Claude (gate) consumindo Paciente (C-05). Cuidado do implementador:
// o efeito é revisão humana obrigatória, nunca bloqueio do ato clínico.
import { describe, expect, it } from "vitest";

interface VereditoLike { gate?: string; decisao?: string; motivo?: string }

async function gateG08(): Promise<((input: unknown) => VereditoLike) | null> {
  const mod = (await import("../../src/kernel/harness/gates.js")) as Record<string, unknown>;
  const fn = mod["g08AnatomiaSexo"] ?? mod["g08"] ?? mod["anatomiaSexo"];
  return typeof fn === "function" ? (fn as (input: unknown) => VereditoLike) : null;
}

describe("G-08 / T-50 · gate anatomia × sexo cadastral", () => {
  it("G-08 · SEM_IMPLEMENTACAO: gate de anatomia×sexo existe em src/kernel/harness", async () => {
    expect(await gateG08(),
      "G-08 não implementado: sexoCadastral/divergencia são só campos tipados; nenhum " +
      "código compara anatomia do documento com cadastro (MATRIZ: 'campo tipado não é gate de revisão')").not.toBeNull();
  });

  it("G-08 · positivo: próstata × cadastro F ⇒ revisão de identidade/anatomia (nunca veto)", async () => {
    const g08 = await gateG08();
    if (!g08) return;
    const v = g08({ anatomia: "prostata", sexoCadastral: "F" });
    expect(v.gate).toBe("G-08");
    expect(v.decisao).not.toBe("PASSA");
    expect(v.decisao).not.toMatch(/BLOQUEIA/); // alerta, nunca bloqueia o clínico
  });

  it("G-08 · positivo: mama × cadastro M ⇒ revisão (simetria da regra)", async () => {
    const g08 = await gateG08();
    if (!g08) return;
    expect(g08({ anatomia: "mama", sexoCadastral: "M" }).decisao).not.toBe("PASSA");
  });

  it("G-08 · negativo: próstata × cadastro M passa", async () => {
    const g08 = await gateG08();
    if (!g08) return;
    expect(g08({ anatomia: "prostata", sexoCadastral: "M" }).decisao).toBe("PASSA");
  });

  it("G-08 · negativo: sexo NAO_INFORMADO ⇒ PENDENTE, nunca PASSA silencioso nem acusa incoerência", async () => {
    const g08 = await gateG08();
    if (!g08) return;
    const v = g08({ anatomia: "prostata", sexoCadastral: "NAO_INFORMADO" });
    expect(v.decisao).not.toBe("PASSA");
  });
});
