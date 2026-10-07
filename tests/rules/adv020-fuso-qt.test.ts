import { describe, expect, it } from "vitest";
import { ultimaAdministracaoQtEfetiva } from "../../src/rules/intervaloQt.js";
import { avisoIntervaloPosQt } from "../../src/rules/index.js";
import { eventoQt } from "../w3/fixtures.js";
import { prazosRuleset } from "../fixtures/rulesets.js";
// Prova RED 9db145d: so injecao explicita adicionada; expectativas preservadas.
const ultima = (fim: string) => ultimaAdministracaoQtEfetiva([eventoQt("admin-sintetica", fim)], "-03:00").data;

describe("F10/F11 · ADV-020 data civil do serviço -03:00 na última QT", () => {
  it("ADV-020 · mesmo instante UTC e -03 conserva data civil 05", () => {
    expect(ultima("2026-10-06T02:30:00Z")).toBe("2026-10-05");
    expect(ultima("2026-10-05T23:30:00-03:00")).toBe("2026-10-05");
  });
  it("ADV-020 · converter UTC antes do consumer preserva 30 dias e VERDE", () => {
    expect(avisoIntervaloPosQt(ultima("2026-10-06T02:30:00Z"),
      "2026-11-04", "CIRURGIA", prazosRuleset)).toMatchObject({ dias: 30, estado: "VERDE" });
  });
  it("ADV-020 · offset -06 não mascara intervalo curto no serviço -03", () => {
    const data = ultima("2026-10-05T23:30:00-06:00");
    expect(avisoIntervaloPosQt(data, "2026-11-04", "CIRURGIA", prazosRuleset))
      .toMatchObject({ dias: 29, estado: "VERMELHO" });
    expect(data).toBe("2026-10-06");
  });
});
