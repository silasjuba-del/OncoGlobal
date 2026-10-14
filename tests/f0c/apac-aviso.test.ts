import { describe, expect, it } from "vitest";
import { apacPrazo } from "../../src/rules/apac.js";

describe("F0-COMPLEMENTO / F05: aviso APAC não se perde após D90", () => {
  const geracao = "2026-01-01";

  it.each([
    ["2026-03-26", 84, false, "RASCUNHO", true],
    ["2026-03-27", 85, true, "RASCUNHO", true],
    ["2026-03-31", 89, true, "RASCUNHO", true],
    ["2026-04-01", 90, true, "VENCIDA", false],
    ["2026-04-02", 91, true, "VENCIDA", false],
    ["2026-05-01", 120, true, "VENCIDA", false],
  ] as const)("sem aviso prévio em %s (D%d)", (hoje, dias, aviso, estado, faturamentoPodeEmitir) => {
    expect(apacPrazo(geracao, hoje, null)).toEqual({
      dias, aviso, estado, faturamentoPodeEmitir, consultaSegue: true,
    });
  });

  it.each([
    ["2026-04-01", 90],
    ["2026-04-02", 91],
    ["2026-05-01", 120],
  ] as const)("aviso registrado não se repete em %s (D%d)", (hoje, dias) => {
    expect(apacPrazo(geracao, hoje, "2026-03-27")).toEqual({
      dias, aviso: false, estado: "VENCIDA",
      faturamentoPodeEmitir: false, consultaSegue: true,
    });
  });

  it("preserva geração futura sem aviso nem emissão de faturamento", () => {
    expect(apacPrazo("2026-04-02", "2026-04-01", null)).toEqual({
      dias: -1, aviso: false, estado: "RASCUNHO",
      faturamentoPodeEmitir: false, consultaSegue: true,
    });
  });

  it.each([
    ["2026-02-30", "2026-04-01"],
    [geracao, "2026-02-30"],
    ["", "2026-04-01"],
    [geracao, "ontem"],
  ])("preserva rejeição de data inválida: %s / %s", (inicio, hoje) => {
    expect(() => apacPrazo(inicio, hoje, null)).toThrow("DATA_INVALIDA");
  });
});
