import { describe, expect, it } from "vitest";
import { apacPrazo } from "../../src/rules/apac.js";
import { dataCivilDoServico } from "../../src/kernel/gateway/tempo.js";

const civil = (instant: string) => {
  const result = dataCivilDoServico(instant, "-03:00");
  expect(result.estado).toBe("OK");
  return result.estado === "OK" ? result.dataCivil : "";
};

describe("W10-LUNA2 · data civil de serviço e prazo APAC", () => {
  it("converte instantes equivalentes e respeita a virada civil -03:00", () => {
    expect(dataCivilDoServico("2026-10-07T10:00:00Z", "-03:00")).toEqual({ estado: "OK", dataCivil: "2026-10-07" });
    expect(dataCivilDoServico("2026-10-07T07:00:00-03:00", "-03:00")).toEqual({ estado: "OK", dataCivil: "2026-10-07" });
    expect(civil("2026-04-01T02:59:59Z")).toBe("2026-03-31");
    expect(civil("2026-04-01T03:00:00Z")).toBe("2026-04-01");
    expect(civil("2027-01-01T02:59:59Z")).toBe("2026-12-31");
    expect(civil("2027-01-01T03:00:00Z")).toBe("2027-01-01");
    expect(civil("2024-03-01T02:59:59Z")).toBe("2024-02-29");
  });

  it("não transforma instante/data/fuso ausentes ou inválidos em liberação", () => {
    expect(dataCivilDoServico(undefined, "-03:00")).toEqual({ estado: "PENDENTE", codigo: "INSTANTE_AUSENTE" });
    for (const instante of ["", "2026-02-30T10:00:00Z", "2026-01-01T25:00:00Z", "2026-01-01T10:00:00", "ontem"]) {
      expect(dataCivilDoServico(instante, "-03:00").estado).toBe("PENDENTE");
    }
    expect(dataCivilDoServico("2026-01-01T10:00:00Z", "-03:99")).toEqual({ estado: "PENDENTE", codigo: "FUSO_INVALIDO" });
  });

  it("alimenta FN-12 com D85 e mantém consulta ativa no D90", () => {
    const apac = "2026-01-01";
    expect(apacPrazo(apac, civil("2026-03-26T15:00:00-03:00"), null)).toMatchObject({ dias: 84, aviso: false, faturamentoPodeEmitir: true, consultaSegue: true });
    expect(apacPrazo(apac, civil("2026-03-27T15:00:00-03:00"), null)).toMatchObject({ dias: 85, aviso: true, faturamentoPodeEmitir: true, consultaSegue: true });
    expect(apacPrazo(apac, civil("2026-03-31T15:00:00-03:00"), null)).toMatchObject({ dias: 89, aviso: true, faturamentoPodeEmitir: true, consultaSegue: true });
    expect(apacPrazo(apac, civil("2026-04-01T15:00:00-03:00"), null)).toMatchObject({ dias: 90, aviso: false, estado: "VENCIDA", faturamentoPodeEmitir: false, consultaSegue: true });
    expect(apacPrazo("2026-04-02", civil("2026-04-01T15:00:00-03:00"), null).faturamentoPodeEmitir).toBe(false);
  });
});
