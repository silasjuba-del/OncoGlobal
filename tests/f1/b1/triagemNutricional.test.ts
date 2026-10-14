import { describe, expect, it } from "vitest";
import { sugerirTriagemNutricional as t } from "../../../src/rules/triagemNutricional.js";

describe("F1-B1 triagem nutricional (D-F1-33, NRS-2002)", () => {
  it.each(["Esôfago", "esofago", "ESÔFAGO", "Estômago", "estomago", "Gástrico"])("positivo: tumor %s sugere", tumor => {
    const r = t({ tumor, imc: 24 });
    expect(r.estado).toBe("SUGERIR"); expect(r.instrumento).toBe("NRS-2002"); expect(r.bloqueia).toBe(false);
  });
  it("positivo: IMC 17,9 em qualquer tumor sugere", () => {
    const r = t({ tumor: "Mama", imc: 17.9 });
    expect(r.estado).toBe("SUGERIR"); expect(r.motivos[0]).toMatch(/IMC 17.9/);
  });
  it("negativo: IMC 18,0 fora de esôfago/estômago não sugere", () => {
    expect(t({ tumor: "Mama", imc: 18 }).estado).toBe("NAO_SUGERIR");
  });
  it("borda: IMC ausente ou inválido fora dos tumores gatilho é PENDENTE, nunca 'sem triagem'", () => {
    for (const imc of [null, undefined, Number.NaN, 0, -3, 250]) expect(t({ tumor: "Mama", imc }).estado).toBe("PENDENTE");
  });
  it("borda: esôfago sem IMC ainda sugere pelo tumor", () => {
    expect(t({ tumor: "Esofago", imc: null }).estado).toBe("SUGERIR");
  });
  it("adversarial: tumor ausente nunca vira NAO_SUGERIR, mesmo com IMC normal", () => {
    for (const tumor of [null, undefined, "", "   "]) expect(t({ tumor, imc: 25 }).estado).toBe("PENDENTE");
  });
  it("adversarial: tumores sem gatilho não disparam", () => {
    expect(t({ tumor: "Sarcoma", imc: 25 }).estado).toBe("NAO_SUGERIR");
    expect(t({ tumor: "Tireoide", imc: 25 }).estado).toBe("NAO_SUGERIR");
  });
  it("nunca bloqueia", () => {
    for (const e of [{ tumor: "Esofago", imc: 15 }, { tumor: "Mama", imc: null }, { tumor: null, imc: null }]) expect(t(e).bloqueia).toBe(false);
  });
});
