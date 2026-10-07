import { describe, expect, it } from "vitest";
import { parserLinha } from "../../src/rules/prescricao/parserLinha.js";
import { QuickLine } from "../../src/contracts/w10/prescricao.js";

const p = (e: string) => { const r = parserLinha(e); expect(QuickLine.safeParse(r).success).toBe(true); return r; };

describe("W10-INT-PRESC-01 · parserLinha", () => {
  it("ondansetrona 8 mg VO 8/8h se náusea", () => {
    const r = p("ONDANSETRONA 8 MG VO 8/8H SE NÁUSEA");
    expect(r.parsed).toEqual({ drug: "ONDANSETRONA", doseValue: 8, doseUnit: "mg", route: "VO", frequency: "8/8H",
      prn: true, prnIndication: "NÁUSEA", maxDaily: null, duration: null });
    expect(r.pendencias).toEqual([]);
    expect(r.expression).toBe("ONDANSETRONA 8 MG VO 8/8H SE NÁUSEA");
  });
  it("SN equivale a SE", () => {
    const r = p("ONDANSETRONA 8 MG VO 8/8H SN NÁUSEA");
    expect(r.parsed.prn).toBe(true);
    expect(r.parsed.prnIndication).toBe("NÁUSEA");
    expect(r.pendencias).toEqual([]);
  });
  it("sem fármaco: não inventa, vai para pendência (500 mg 12/12h por 7 dias)", () => {
    const r = p("500 MG VO 12/12H POR 7 DIAS");
    expect(r.parsed).toMatchObject({ drug: null, doseValue: 500, doseUnit: "mg", route: "VO", frequency: "12/12H", duration: "7 DIAS", prn: false });
    expect(r.pendencias.some((x) => x.startsWith("drug"))).toBe(true);
  });
  it("com fármaco e duração", () => {
    const r = p("AMOXICILINA 500 MG VO 8/8H POR 7 DIAS");
    expect(r.parsed).toMatchObject({ drug: "AMOXICILINA", doseValue: 500, frequency: "8/8H", duration: "7 DIAS" });
    expect(r.pendencias).toEqual([]);
  });
  it("máx diário depois do travessão", () => {
    const r = p("ONDANSETRONA 8 MG VO 8/8H SE NÁUSEA — MÁX 24 MG/DIA");
    expect(r.parsed).toMatchObject({ drug: "ONDANSETRONA", doseValue: 8, prn: true, prnIndication: "NÁUSEA", maxDaily: "24 MG/DIA" });
    expect(r.pendencias).toEqual([]);
  });
  it("vírgula decimal e unidades mcg/g/UI/mL", () => {
    expect(p("LEVOTIROXINA 0,5 MCG VO 1X/DIA").parsed).toMatchObject({ doseValue: 0.5, doseUnit: "mcg", frequency: "1X/DIA" });
    expect(p("DIPIRONA 1 G VO 6/6H SE DOR").parsed).toMatchObject({ doseValue: 1, doseUnit: "g", prnIndication: "DOR" });
    expect(p("HEPARINA 5000 UI SC 12/12H").parsed).toMatchObject({ doseValue: 5000, doseUnit: "UI", route: "SC" });
    expect(p("XAROPE 2,5 ML VO 8/8H").parsed).toMatchObject({ doseValue: 2.5, doseUnit: "mL" });
    expect(p("PREDNISONA 1,5 MG VO 1X/DIA").parsed.doseValue).toBe(1.5);
  });
  it("todas as vias reconhecidas", () => {
    for (const v of ["VO", "EV", "IM", "SC", "SL", "TOP"]) expect(p(`DROGA 1 MG ${v} 8/8H`).parsed.route).toBe(v);
  });
  it("minúsculas e '1 CP'", () => {
    const r = p("dipirona 1 cp vo 6/6h se dor");
    expect(r.parsed).toMatchObject({ drug: "dipirona", doseValue: 1, doseUnit: "CP", route: "VO", frequency: "6/6H", prn: true });
  });
  it("ponto ambíguo (1.250) não vira dose", () => {
    const r = p("DROGA 1.250 MG VO 8/8H");
    expect(r.parsed.doseValue).toBeNull();
    expect(r.pendencias.some((x) => x.includes("ambíguo"))).toBe(true);
  });
  it("milhar com vírgula decimal (1.000,5)", () => {
    expect(p("DROGA 1.000,5 MG VO 8/8H").parsed.doseValue).toBe(1000.5);
  });
  it("dose zero é recusada", () => {
    const r = p("DROGA 0 MG VO 8/8H");
    expect(r.parsed.doseValue).toBeNull();
    expect(r.pendencias.some((x) => x.startsWith("doseValue"))).toBe(true);
  });
  it("texto sem estrutura: tudo pendente, nada inventado", () => {
    const r = p("FAZER CONFORME CONVERSADO");
    expect(r.parsed.doseValue).toBeNull();
    expect(r.parsed.route).toBeNull();
    expect(r.parsed.frequency).toBeNull();
    expect(r.pendencias.length).toBeGreaterThanOrEqual(3);
  });
  it("sobra não reconhecida é listada", () => {
    const r = p("DROGA 8 MG VO 8/8H COM ÁGUA");
    expect(r.pendencias.some((x) => x.includes("COM ÁGUA"))).toBe(true);
  });
  it("frequência inconsistente 8/12H vai a pendência", () => {
    const r = p("DROGA 8 MG VO 8/12H");
    expect(r.parsed.frequency).toBeNull();
    expect(r.pendencias.some((x) => x.includes("inconsistente"))).toBe(true);
  });
  it("se necessário sem indicação gera pendência", () => {
    const r = p("DIPIRONA 1 G VO 6/6H SE NECESSÁRIO");
    expect(r.parsed.prn).toBe(true);
    expect(r.pendencias.some((x) => x.startsWith("prnIndication"))).toBe(true);
  });
  it("vazio", () => {
    const r = parserLinha("  ");
    expect(r.parsed.drug).toBeNull();
    expect(r.pendencias.length).toBe(1);
  });
});
