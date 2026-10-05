// FN-05 validadeHemograma — T-22 (Q23): >7 dias, ausente ou futura ⇒ PENDENTE; ≤7 ⇒ VERDE.
import { describe, expect, it } from "vitest";
import { validadeHemograma } from "../../src/rules/index.js";
import { salaoRuleset } from "../fixtures/rulesets.js";
import { HOJE } from "../fixtures/triagem.js";

describe("FN-05 validade do hemograma (igual passa)", () => {
  it("coleta há 7 dias → VERDE", () => {
    const r = validadeHemograma("2026-09-28", HOJE, salaoRuleset);
    expect(r.estado).toBe("VERDE");
    expect(r.dias).toBe(7);
  });
  it("coleta hoje → VERDE com 0 dias", () => {
    const r = validadeHemograma("2026-10-05", HOJE, salaoRuleset);
    expect(r.estado).toBe("VERDE");
    expect(r.dias).toBe(0);
  });
  it("coleta há 8 dias → PENDENTE", () => {
    const r = validadeHemograma("2026-09-27", HOJE, salaoRuleset);
    expect(r.estado).toBe("PENDENTE");
    expect(r.dias).toBe(8);
  });
  it("data futura → PENDENTE", () => {
    expect(validadeHemograma("2026-10-06", HOJE, salaoRuleset).estado).toBe("PENDENTE");
  });
  it("coleta ausente (null) → PENDENTE", () => {
    const r = validadeHemograma(null, HOJE, salaoRuleset);
    expect(r.estado).toBe("PENDENTE");
    expect(r.dias).toBeNull();
  });
});
