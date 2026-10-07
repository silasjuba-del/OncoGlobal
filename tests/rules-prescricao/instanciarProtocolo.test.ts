import { describe, expect, it } from "vitest";
import { arredondaMeioParaCima, instanciarProtocolo, type DadosCorporais } from "../../src/rules/prescricao/instanciarProtocolo.js";
import { calcularDose } from "../../src/rules/dose.js";
import type { DoseRuleset } from "../../src/contracts/regras.js";
import { item, template } from "./_fixtures.js";

const dados = (o: Partial<DadosCorporais> = {}): DadosCorporais => ({
  pesoKg: 70, alturaCm: 170, bsaM2: 1.8, clcr: 80, medidoEm: "2026-10-06T08:00:00-03:00", ...o,
});
const rs: DoseRuleset = { header: { id: "dose", versao: "teste" }, reducoesPct: [0, 20, 30, 40], semPesoConsecutivosVermelho: 2, AC: { ciclosComMedico: [] } };

const tpl = () => template([
  item({ drug: "Ondansetrona", classe: "PRE_QT", sequence: 1, doseBasis: "FIXED", standardDose: 16, unit: "mg" }),
  item({ drug: "Docetaxel", sequence: 2, doseBasis: "MG_M2", standardDose: 75, unit: "mg/m²" }),
  item({ drug: "Carboplatina", sequence: 3, doseBasis: "AUC", standardDose: 5, unit: "AUC" }),
  item({ drug: "Droga Kg", sequence: 4, doseBasis: "MG_KG", standardDose: 2, unit: "mg/kg" }),
]);

describe("W10-INT-PRESC-02 · instanciarProtocolo", () => {
  it("calcula FIXED, mg/m², AUC (Calvert) e mg/kg", () => {
    const r = instanciarProtocolo(tpl(), dados());
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const [a, b, c, d] = r.itens;
    expect(a?.item.calculatedDose).toBe(16);
    expect(b?.item.calculatedDose).toBe(135); // 75 × 1,8
    expect(b?.item.unit).toBe("mg");
    expect(b?.unidadePadrao).toBe("mg/m²");
    expect(c?.item.calculatedDose).toBe(525); // 5 × (80 + 25)
    expect(d?.item.calculatedDose).toBe(140);
    expect(r.pendentes).toBe(0);
    expect(r.itens.every((i) => i.estado === "PRONTO" && i.item.prescribedDose === i.item.calculatedDose)).toBe(true);
    expect(r.itens.every((i) => i.item.adjustmentPercent === null)).toBe(true);
  });
  it("mg/m² sem peso ou sem altura ⇒ PENDENTE (nunca 0)", () => {
    for (const d of [dados({ pesoKg: null }), dados({ alturaCm: null })]) {
      const r = instanciarProtocolo(tpl(), d);
      if (!r.ok) throw new Error("esperado ok");
      const b = r.itens[1];
      expect(b?.estado).toBe("PENDENTE");
      expect(b?.item.calculatedDose).toBeNull();
      expect(b?.item.prescribedDose).toBeNull();
      expect(b?.motivo).toContain("peso/altura");
    }
  });
  it("mg/m² com peso e altura mas sem BSA ⇒ calcula por Mosteller (D-W9-61); sem peso/altura ⇒ PENDENTE", () => {
    const r = instanciarProtocolo(tpl(), dados({ bsaM2: null }));
    if (!r.ok) throw new Error("esperado ok");
    expect(r.itens[1]?.estado).toBe("PRONTO");
    const s2 = instanciarProtocolo(tpl(), dados({ bsaM2: null, pesoKg: null }));
    if (!s2.ok) throw new Error("esperado ok");
    expect(s2.itens[1]?.estado).toBe("PENDENTE");
  });
  it("AUC sem clcr ⇒ PENDENTE; demais itens seguem", () => {
    const r = instanciarProtocolo(tpl(), dados({ clcr: null }));
    if (!r.ok) throw new Error("esperado ok");
    expect(r.itens[2]?.estado).toBe("PENDENTE");
    expect(r.itens[2]?.item.calculatedDose).toBeNull();
    expect(r.itens[0]?.estado).toBe("PRONTO");
    expect(r.pendentes).toBe(1);
  });
  it("template RASCUNHO ou INATIVA ⇒ recusa tipada", () => {
    for (const st of ["RASCUNHO", "INATIVA"] as const) {
      const r = instanciarProtocolo(template([item({ drug: "X", standardDose: 1 })], st), dados());
      expect(r).toMatchObject({ ok: false, recusa: { codigo: "TEMPLATE_NAO_CONFERIDO", status: st } });
    }
  });
  it("base OTHER e dose padrão ausente ⇒ PENDENTE", () => {
    const r = instanciarProtocolo(template([
      item({ drug: "Outra", doseBasis: "OTHER", standardDose: 10 }),
      item({ drug: "Sem padrão", doseBasis: "FIXED", standardDose: null }),
    ]), dados());
    if (!r.ok) throw new Error("esperado ok");
    expect(r.itens.map((i) => i.estado)).toEqual(["PENDENTE", "PENDENTE"]);
  });
  it("registra a dose prescrita do ciclo anterior (casando por fármaco e ocorrência)", () => {
    const anterior = [item({ drug: "DOCETAXEL", sequence: 2, doseBasis: "MG_M2", standardDose: 75, prescribedDose: 108, calculatedDose: 135, adjustmentPercent: -20, adjustmentReason: "neutropenia" })];
    const r = instanciarProtocolo(tpl(), dados(), anterior);
    if (!r.ok) throw new Error("esperado ok");
    expect(r.itens[1]?.doseAnteriorPrescrita).toBe(108);
    expect(r.itens[0]?.doseAnteriorPrescrita).toBeNull();
  });
  it("não muta o template (o histórico não muda com a instanciação)", () => {
    const t = tpl();
    const antes = JSON.stringify(t);
    instanciarProtocolo(t, dados());
    expect(JSON.stringify(t)).toBe(antes);
  });
  it("arredondamento é o mesmo de FN-04 (calcularDose, redução 0)", () => {
    for (const base of [0, 1, 50, 99, 100, 129, 135, 524, 1000, 1234]) {
      const fn04 = calcularDose({ doseAdministradaAnteriorMg: base, reducaoPct: 0, pesoKg: 70, origemPeso: "MEDIDO", ciclosSemPesoAnteriores: 0 }, rs);
      expect(arredondaMeioParaCima(base)).toBe(fn04.doseMg);
    }
    expect(arredondaMeioParaCima(129.5)).toBe(130);
    expect(arredondaMeioParaCima(129.49)).toBe(129);
    expect(arredondaMeioParaCima(75 * 1.73)).toBe(130); // 129,75 sem ruído de ponto flutuante
  });
});
