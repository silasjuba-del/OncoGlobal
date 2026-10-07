// KIMI-12 · G-07 + T-49 · LATERALIDADE (PLANO R-15, linha 454; MATRIZ docs/w5/MATRIZ.md).
// Regra: PATH × RADS × procedimento × diagnóstico divergem ⇒ WARN + revisão humana obrigatória.
// ESTADO: SEM_IMPLEMENTACAO — não há função de gate nem consumer em src/ (harness tem
// G-02/03/05/10/13/14/23/25/26; prompts PATH/RADS só mencionam lateralidade — G-04 exige
// o literal, mas nenhum código confronta as fontes). Dono provável: harness/Claude (gates)
// com dados de AG-05 PATH e AG-04 RADS (F1). Provável causa: gate previsto no PLANO sem dono de fatia em F0.
import { describe, expect, it } from "vitest";

interface VereditoLike { gate?: string; decisao?: string; motivo?: string }

/** Localiza o gate onde ele deveria viver (harness) sem quebrar o typecheck se ausente. */
async function gateG07(): Promise<((input: unknown) => VereditoLike) | null> {
  const mod = (await import("../../src/kernel/harness/gates.js")) as Record<string, unknown>;
  const fn = mod["g07Lateralidade"] ?? mod["g07"] ?? mod["lateralidade"];
  return typeof fn === "function" ? (fn as (input: unknown) => VereditoLike) : null;
}

describe("G-07 / T-49 · gate de lateralidade PATH×RADS×procedimento×diagnóstico", () => {
  it("G-07 · SEM_IMPLEMENTACAO: gate de lateralidade existe em src/kernel/harness", async () => {
    expect(await gateG07(),
      "G-07 não implementado: nenhuma função confronta lateralidade entre fontes; " +
      "prompts com o literal não equivalem a gate (MATRIZ: 'nenhum teste confronto PATH×RADS×procedimento')").not.toBeNull();
  });

  it("G-07 · positivo: divergência de lateralidade ⇒ WARN + revisão humana obrigatória", async () => {
    const g07 = await gateG07();
    if (!g07) return; // SEM_IMPLEMENTACAO — a prova acima já reprova
    const v = g07({ path: "ESQUERDA", rads: "DIREITA", procedimento: "DIREITA", diagnostico: "DIREITA" });
    expect(v.decisao).toBe("ALERTA");
    expect(v.gate).toBe("G-07");
    expect(JSON.stringify(v)).toContain("revisão");
  });

  it("G-07 · positivo: diagnóstico divergente das imagens também alerta", async () => {
    const g07 = await gateG07();
    if (!g07) return;
    const v = g07({ path: "DIREITA", rads: "DIREITA", procedimento: "DIREITA", diagnostico: "ESQUERDA" });
    expect(v.decisao).toBe("ALERTA");
  });

  it("G-07 · negativo: lateralidade concordante em todas as fontes passa", async () => {
    const g07 = await gateG07();
    if (!g07) return;
    expect(g07({ path: "DIREITA", rads: "DIREITA", procedimento: "DIREITA", diagnostico: "DIREITA" }).decisao).toBe("PASSA");
  });

  it("G-07 · negativo: lateralidade ausente em qualquer fonte ⇒ PENDENTE, nunca PASSA silencioso", async () => {
    const g07 = await gateG07();
    if (!g07) return;
    const v = g07({ path: null, rads: "DIREITA", procedimento: "DIREITA", diagnostico: "DIREITA" });
    expect(v.decisao).not.toBe("PASSA");
  });
});
