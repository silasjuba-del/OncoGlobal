import { describe, expect, it } from "vitest";
import { sugerirTriagemNutricional as t, imcDeMedidas, textoSugestaoNutricional } from "../../../src/rules/triagemNutricional.js";
import * as regras from "../../../src/rules/index.js";

describe("F1-B1 triagem nutricional (D-F1-33, NRS-2002)", () => {
  it.each([
    {tumor:"Estômago",cid:"C15.4"}, {tumor:"Esôfago",cid:"C16.9"}, {tumor:"Esôfago e estômago",cid:null},
  ])("sítios contraditórios não elegem um diagnóstico (%j)", entrada => {
    const r = t({...entrada,imc:24}); expect(r.estado).toBe("PENDENTE");
    expect(r.motivos[0]).toMatch(/divergentes.*esôfago|divergentes.*estômago/);
    expect(textoSugestaoNutricional(r)).toBeNull();
  });
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
  it("thread #17: a fachada estável de regras exporta a triagem nutricional", () => {
    expect(regras.sugerirTriagemNutricional).toBe(t);
    expect(typeof regras.imcDeMedidas).toBe("function");
  });
  it("CID confirmado C15/C16 dispara mesmo sem texto do tumor; outro CID não", () => {
    expect(t({ tumor: null, cid: "C15.4", imc: null }).motivos).toEqual(["câncer de esôfago"]);
    expect(t({ tumor: null, cid: "c169", imc: 25 }).motivos).toEqual(["câncer de estômago"]);
    expect(t({ tumor: null, cid: "C50.9", imc: 25 }).estado).toBe("NAO_SUGERIR");
    expect(t({ tumor: null, cid: "C50.9", imc: null }).estado).toBe("PENDENTE");
  });
  it("IMC de medidas: valor NÃO arredondado (o corte compara o valor real), ausente/inválido é null (nunca 0)", () => {
    expect(imcDeMedidas(50, 170)).toBeCloseTo(17.301, 3);
    expect(imcDeMedidas(70, 170)).toBeCloseTo(24.221, 3);
    for (const [p, a] of [[null, 170], [70, null], [0, 170], [70, 0], [Number.NaN, 170], [70, -1]] as const) expect(imcDeMedidas(p, a)).toBeNull();
    expect(t({ tumor: "Mama", imc: imcDeMedidas(50, 170) }).estado).toBe("SUGERIR");
  });
  it("thread #17: IMC real logo abaixo de 18 (51,9 kg / 170 cm ≈ 17,96) sugere; texto nunca mostra valor ≥ corte", () => {
    const r = t({ tumor: "Mama", imc: imcDeMedidas(51.9, 170) });
    expect(r.estado).toBe("SUGERIR");
    expect(r.motivos).toEqual(["IMC 17.9 < 18"]);
    expect(t({ tumor: "Mama", imc: 17.999 }).estado).toBe("SUGERIR");
    expect(t({ tumor: "Mama", imc: imcDeMedidas(52.02, 170) }).estado).toBe("NAO_SUGERIR");
  });
  it("texto da Flash só existe para SUGERIR", () => {
    expect(textoSugestaoNutricional(t({ tumor: "Esôfago", imc: 17 }))).toBe("Sugestão: triagem nutricional (NRS-2002) — câncer de esôfago; IMC 17 < 18");
    expect(textoSugestaoNutricional(t({ tumor: "Mama", imc: null }))).toBeNull();
    expect(textoSugestaoNutricional(t({ tumor: "Mama", imc: 25 }))).toBeNull();
  });
});
