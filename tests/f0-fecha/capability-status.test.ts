import { describe, expect, it } from "vitest";
import { CapabilityStatus } from "../../src/contracts/estados.js";
import { decidirFonteAlertaPorCapabilityStatus } from "../../src/kernel/harness/capabilityStatus.js";

describe("G-22 · CapabilityStatus como fonte de alerta", () => {
  it("aplica a regra positiva/negativa a cada estado declarado sem ordenar o enum", () => {
    const permitido = new Set(["TESTED", "VALIDATED", "OPERATING"]);
    for (const estado of CapabilityStatus.options) {
      const decisao = decidirFonteAlertaPorCapabilityStatus(estado);
      expect(decisao.gate).toBe("G-22");
      expect(decisao.mostrarComoFonteAlerta).toBe(permitido.has(estado));
      if (!permitido.has(estado)) expect(decisao.rotulo.toLowerCase()).toContain("em validação");
    }
  });

  it("oculta status ausente/desconhecido sem coerção e informa em validação", () => {
    for (const desconhecido of [undefined, null, "FUTURE_STATUS", 2]) {
      expect(decidirFonteAlertaPorCapabilityStatus(desconhecido)).toMatchObject({
        gate: "G-22", mostrarComoFonteAlerta: false, rotulo: "Em validação",
      });
    }
  });
});
