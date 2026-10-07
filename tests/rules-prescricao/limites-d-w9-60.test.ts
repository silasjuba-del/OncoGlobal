import { describe, expect, it } from "vitest";
import { instanciarProtocolo, BSA_MAX_M2, BSA_MIN_M2, CLCR_MAX_CALVERT } from "../../src/rules/prescricao/instanciarProtocolo.js";
import { FinalidadeApacRt } from "../../src/contracts/index.js";
import type { ProtocolTemplate, PrescriptionItem } from "../../src/contracts/index.js";

const base: PrescriptionItem = {
  drug: "X", classe: "QT", sequence: 1, standardDose: 100, doseBasis: "MG_M2", calculatedDose: null,
  prescribedDose: null, unit: "mg/m²", adjustmentPercent: null, adjustmentReason: null, route: "EV",
  diluent: null, finalVolumeMl: null, infusionTime: null, days: ["d1"], observacao: null, source: "PROTOCOL", overrideMotivo: null,
};
const tpl = (itens: PrescriptionItem[]): ProtocolTemplate => ({
  templateId: "t", tumor: "teste", nome: "teste", cenario: "teste", versao: "1", hash: "h", codigoInstitucional: null,
  intervaloDias: 21, ciclos: 1, itens, limiaresBula: null, fonte: "sintético", status: "CONFERIDA_MEDICO",
});
const dados = (bsaM2: number, clcr: number) => ({ pesoKg: 70, alturaCm: 170, bsaM2, clcr, medidoEm: "2030-01-01" });
const um = (r: ReturnType<typeof instanciarProtocolo>) => { if (!r.ok) throw new Error("recusa"); return r.itens[0]!; };

describe("D-W9-60 · limites de BSA e ClCr", () => {
  it("constantes", () => { expect([BSA_MIN_M2, BSA_MAX_M2, CLCR_MAX_CALVERT]).toEqual([1.4, 2.2, 125]); });
  it("BSA acima de 2,20 é limitada com aviso", () => {
    const i = um(instanciarProtocolo(tpl([base]), dados(2.5, 90)));
    expect(i.item.calculatedDose).toBe(220); expect(i.aviso).toMatch(/2\.2/);
  });
  it("BSA abaixo de 1,40 é elevada a 1,40 com aviso", () => {
    const i = um(instanciarProtocolo(tpl([base]), dados(1.2, 90)));
    expect(i.item.calculatedDose).toBe(140); expect(i.aviso).toMatch(/1\.4/);
  });
  it("BSA dentro da faixa: sem aviso", () => {
    const i = um(instanciarProtocolo(tpl([base]), dados(1.8, 90)));
    expect(i.item.calculatedDose).toBe(180); expect(i.aviso).toBeNull();
  });
  it("Calvert com ClCr 150 usa 125 (AUC 5 → 750 mg) com aviso", () => {
    const i = um(instanciarProtocolo(tpl([{ ...base, standardDose: 5, doseBasis: "AUC", unit: "AUC" }]), dados(1.8, 150)));
    expect(i.item.calculatedDose).toBe(750); expect(i.aviso).toMatch(/125/);
  });
  it("Calvert com ClCr 100 não limita", () => {
    const i = um(instanciarProtocolo(tpl([{ ...base, standardDose: 5, doseBasis: "AUC", unit: "AUC" }]), dados(1.8, 100)));
    expect(i.item.calculatedDose).toBe(625); expect(i.aviso).toBeNull();
  });
  it("finalidades de RT no contrato", () => {
    expect(FinalidadeApacRt.options).toEqual(["RADICAL", "ADJUVANTE", "ANTIALGICA", "PALIATIVA", "PREVIA", "ANTI_HEMORRAGICA"]);
  });
});

import { bsaMosteller } from "../../src/rules/prescricao/instanciarProtocolo.js";
describe("D-W9-61 · Mosteller", () => {
  it("170 cm e 70 kg = 1,82 m²", () => { expect(bsaMosteller(70, 170)).toBe(1.82); });
  it("ausente ou inválido = null", () => { expect(bsaMosteller(null, 170)).toBeNull(); expect(bsaMosteller(70, 0)).toBeNull(); });
  it("sem bsaM2 informada, calcula por Mosteller e limita", () => {
    const r = instanciarProtocolo(tpl([base]), { pesoKg: 70, alturaCm: 170, bsaM2: null, clcr: 90, medidoEm: "2030-01-01" });
    if (!r.ok) throw new Error(); expect(r.itens[0]!.item.calculatedDose).toBe(182);
    const g = instanciarProtocolo(tpl([base]), { pesoKg: 150, alturaCm: 200, bsaM2: null, clcr: 90, medidoEm: "2030-01-01" });
    if (!g.ok) throw new Error(); expect(g.itens[0]!.item.calculatedDose).toBe(220); expect(g.itens[0]!.aviso).toMatch(/2\.2/);
  });
});
