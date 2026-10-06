import { describe, expect, it } from "vitest";
import { apacPrazo } from "../../src/rules/apac.js";

// FN-12 / T-30 / N13: somente datas civis injetadas; a conversao de instante
// para data civil no offset D-W5-01 NAO e responsabilidade desta funcao.
describe("FN-12 / T-30: prazo APAC em dias civis (D-W5-02)", () => {
  const geracao = "2024-01-01"; // 2024 inclui 29/02.

  it("positivo: D85 e D89 avisam sem atrasar e sem interromper a consulta", () => {
    for (const [hoje, dias] of [["2024-03-26", 85], ["2024-03-30", 89]] as const) {
      expect(apacPrazo(geracao, hoje, null)).toEqual({
        dias, aviso: true, estado: "RASCUNHO",
        faturamentoPodeEmitir: true, consultaSegue: true,
      });
    }
  });

  it("negativo: D84 nao avisa; aviso registrado nao se repete em D89", () => {
    expect(apacPrazo(geracao, "2024-03-25", null)).toMatchObject({
      dias: 84, aviso: false, faturamentoPodeEmitir: true,
    });
    expect(apacPrazo(geracao, "2024-03-30", "2024-03-26")).toMatchObject({
      dias: 89, aviso: false, faturamentoPodeEmitir: true,
    });
  });

  it("borda: D90 mesmo sem aviso previo vence para faturamento, consulta segue", () => {
    expect(apacPrazo(geracao, "2024-03-31", null)).toEqual({
      dias: 90, aviso: false, estado: "VENCIDA",
      faturamentoPodeEmitir: false, consultaSegue: true,
    });
  });
});
