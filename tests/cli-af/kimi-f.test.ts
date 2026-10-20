// FUGU-R2 seção F (BSA-OVERFLOW) · regressão da fatia AF-F nas duas fachadas de cálculo de dose.
// Fixtures SINTÉTICAS. Oráculo: PRONTO só com resultado finito; falha de finitude ⇒ PENDENTE estruturada
// (dose null + motivo/pendente), nunca exceção genérica, nunca Infinity escondido por teto.
import { describe, expect, it } from "vitest";
import { PrescriptionItem } from "../../src/contracts/w10/prescricao.js";
import {
  arredondaMeioParaCima, bsaMosteller, instanciarProtocolo, type DadosCorporais,
} from "../../src/rules/prescricao/instanciarProtocolo.js";
import { calcularDoseBasis, calcularDosePorBase } from "../../src/rules/prescricao/index.js";
import { item, template } from "../rules-prescricao/_fixtures.js";

const corpo = (o: Partial<DadosCorporais> = {}): DadosCorporais => ({
  pesoKg: 1, alturaCm: 170, bsaM2: null, clcr: 100, medidoEm: "2026-10-19", ...o,
});

const temNaoFinito = (v: unknown): boolean =>
  typeof v === "number" ? !Number.isFinite(v)
    : v !== null && typeof v === "object" ? Object.values(v).some(temNaoFinito) : false;

describe("FUGU-R2 F · overflow de intermediários nas duas fachadas", () => {
  it("F-R2-ROUND-MG_KG: produto finito 1e303 × 1 não gera Infinity na escala ×1e6", () => {
    const d = calcularDosePorBase({ basis: "MG_KG", mgKg: 1e303, pesoKg: 1 });
    expect(d.estado).toBe("PRONTO"); // 1e303 já é inteiro exato; arredondamento é a identidade, sem teto
    expect(d.dose).toBe(1e303);
    expect(d.doseMg).toBe(1e303);
    expect(Number.isFinite(d.doseMg)).toBe(true);
    expect(d.unidade).toBe("mg"); // unidade não muda para esconder erro
    const t = instanciarProtocolo(
      template([item({ drug: "FARMACO_SINTETICO_R2", doseBasis: "MG_KG", standardDose: 1e303, unit: "mg/kg" })]),
      corpo(),
    );
    expect(t.ok).toBe(true);
    if (!t.ok) return;
    expect(t.itens[0]!.estado).toBe("PRONTO");
    expect(t.itens[0]!.item.calculatedDose).toBe(1e303);
    expect(PrescriptionItem.safeParse(t.itens[0]!.item).success).toBe(true);
    expect(temNaoFinito(t.itens[0])).toBe(false);
  });

  it("F-R2-ROUND-MCG_KG: micrograma preservado; doseMg convertido continua finito", () => {
    const d = calcularDosePorBase({ basis: "MCG_KG", mcgKg: 1e303, pesoKg: 1 });
    expect(d.estado).toBe("PRONTO");
    expect(d.dose).toBe(1e303);
    expect(d.unidade).toBe("µg");
    expect(d.doseMg).toBe(1e300);
    expect(Number.isFinite(d.doseMg)).toBe(true);
    const t = instanciarProtocolo(
      template([item({ drug: "FARMACO_SINTETICO_R2", doseBasis: "MCG_KG", standardDose: 1e303, unit: "mcg/kg" })]),
      corpo(),
    );
    expect(t.ok).toBe(true);
    if (!t.ok) return;
    expect(t.itens[0]!.estado).toBe("PRONTO");
    expect(t.itens[0]!.item.calculatedDose).toBe(1e303);
    expect(t.itens[0]!.item.unit).toBe("µg");
    expect(temNaoFinito(t.itens[0])).toBe(false);
  });

  it("F-R2-MG_M2-ROUND: SC fornecida finita não protegia o arredondamento; agora fica finito", () => {
    const d = calcularDosePorBase({ basis: "MG_M2", mgM2: 1e303, bsaM2: 1, pesoKg: 70, alturaCm: 170 });
    expect(d.estado).toBe("PRONTO");
    expect(d.doseMg).toBe(1e303);
    expect(Number.isFinite(d.doseMg)).toBe(true);
    const t = instanciarProtocolo(
      template([item({ drug: "FARMACO_SINTETICO_R2", doseBasis: "MG_M2", standardDose: 1e303, unit: "mg/m²" })]),
      corpo({ pesoKg: 70, bsaM2: 1 }),
    );
    expect(t.ok).toBe(true);
    if (!t.ok) return;
    expect(t.itens[0]!.estado).toBe("PRONTO");
    expect(t.itens[0]!.item.calculatedDose).toBe(1e303);
    expect(temNaoFinito(t.itens[0])).toBe(false);
  });

  it("F-R2-RATE-OVERFLOW: 100 mg a 1e-308 mg/min ⇒ PENDENTE estruturada, nunca 'Infinity min' PRONTO", () => {
    const tpl = template([item({
      drug: "FARMACO_SINTETICO_R2", standardDose: 100, doseBasis: "FIXED", unit: "mg",
      taxaMaximaMgMin: 1e-308, infusionTime: "30 min",
    })]);
    const antes = JSON.stringify(tpl);
    const r = instanciarProtocolo(tpl, corpo());
    expect(JSON.stringify(tpl)).toBe(antes); // ficha não é alterada pelo cálculo
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const it0 = r.itens[0]!;
    expect(it0.estado).toBe("PENDENTE");
    expect(it0.item.calculatedDose).toBeNull();
    expect(it0.item.prescribedDose).toBeNull();
    expect(it0.motivo).toMatch(/não finita/iu);
    expect(it0.item.infusionTime ?? "").not.toMatch(/\b(?:Infinity|NaN)\b/u);
    expect(temNaoFinito(it0)).toBe(false);
    expect(r.pendentes).toBe(1);
  });

  it("F-R2-DURATION-OVERFLOW: horas finitas que transbordam ao converter p/ minutos ⇒ PENDENTE, nunca PRONTO", () => {
    const duracaoGigante = `1${"0".repeat(307)} h`; // horas legíveis; × 60 vira Infinity
    const tpl = template([item({
      drug: "FARMACO_SINTETICO_R2", standardDose: 100, doseBasis: "FIXED", unit: "mg",
      taxaMaximaMgMin: 2, infusionTime: duracaoGigante,
    })]);
    const antes = JSON.stringify(tpl);
    const r = instanciarProtocolo(tpl, corpo());
    expect(JSON.stringify(tpl)).toBe(antes); // ficha não é alterada pelo cálculo
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const it0 = r.itens[0]!;
    expect(it0.estado).toBe("PENDENTE");
    expect(it0.item.calculatedDose).toBeNull();
    expect(it0.item.prescribedDose).toBeNull();
    expect(it0.motivo).toMatch(/não finita/iu);
    expect(it0.item.infusionTime ?? "").not.toMatch(/\b(?:Infinity|NaN)\b/u);
    expect(temNaoFinito(it0)).toBe(false);
    expect(r.pendentes).toBe(1);
  });

  it("F-R2-DURATION-HOURS-OK: duração válida em horas continua convertendo (controle positivo)", () => {
    const suficiente = instanciarProtocolo(
      template([item({ drug: "FARMACO_SINTETICO_R2", standardDose: 100, doseBasis: "FIXED", unit: "mg", taxaMaximaMgMin: 2, infusionTime: "2 h" })]),
      corpo(),
    );
    expect(suficiente.ok).toBe(true);
    if (!suficiente.ok) return;
    expect(suficiente.itens[0]!.estado).toBe("PRONTO"); // 120 min ≥ 50 min: duração preservada, sem aviso
    expect(suficiente.itens[0]!.item.infusionTime).toBe("2 h");
    expect(suficiente.itens[0]!.aviso).toBeNull();
    const curta = instanciarProtocolo(
      template([item({ drug: "FARMACO_SINTETICO_R2", standardDose: 100, doseBasis: "FIXED", unit: "mg", taxaMaximaMgMin: 2, infusionTime: "0.5 h" })]),
      corpo(),
    );
    expect(curta.ok).toBe(true);
    if (!curta.ok) return;
    expect(curta.itens[0]!.estado).toBe("PRONTO"); // 30 min < 50 min: amplia com aviso, como antes
    expect(curta.itens[0]!.item.infusionTime).toBe("50 min");
    expect(curta.itens[0]!.aviso).toMatch(/2 mg\/min/u);
  });

  it("produto que transborda (1e200 × 1e200) ⇒ PENDENTE estruturada nas duas fachadas, sem exceção", () => {
    const d = calcularDosePorBase({ basis: "MG_KG", mgKg: 1e200, pesoKg: 1e200 });
    expect(d.estado).toBe("PENDENTE");
    expect(d.dose).toBeNull();
    expect(d.doseMg).toBeNull();
    expect(d.pendente).toMatch(/não finito/iu);
    expect(d.unidade).toBe("mg");
    const t = instanciarProtocolo(
      template([item({ drug: "FARMACO_SINTETICO_R2", doseBasis: "MG_KG", standardDose: 1e200, unit: "mg/kg" })]),
      corpo({ pesoKg: 1e200 }),
    );
    expect(t.ok).toBe(true);
    if (!t.ok) return;
    expect(t.itens[0]!.estado).toBe("PENDENTE");
    expect(t.itens[0]!.item.calculatedDose).toBeNull();
    expect(t.itens[0]!.motivo).toMatch(/não finito|overflow/iu);
    expect(temNaoFinito(t.itens[0])).toBe(false);
  });

  it("intermediário de Mosteller não finito ⇒ pendência; AUC com produto não finito ⇒ PENDENTE", () => {
    expect(bsaMosteller(1e200, 1e200)).toBeNull(); // altura × peso transborda
    const m2 = calcularDosePorBase({ basis: "MG_M2", mgM2: 100, pesoKg: 1e200, alturaCm: 1e200 });
    expect(m2.estado).toBe("PENDENTE");
    expect(m2.pendente).toMatch(/bsaM2|Mosteller/iu);
    const auc = calcularDosePorBase({ basis: "AUC", auc: 1e307, clearance: 100 });
    expect(auc.estado).toBe("PENDENTE"); // 1e307 × (100 + 25) transborda após o limite Calvert 125
    expect(auc.doseMg).toBeNull();
  });

  it("arredondaMeioParaCima: não finito ⇒ null; finito gigante é exato; casos válidos intactos", () => {
    expect(arredondaMeioParaCima(Infinity)).toBeNull();
    expect(arredondaMeioParaCima(NaN)).toBeNull();
    expect(arredondaMeioParaCima(-Infinity)).toBeNull();
    expect(arredondaMeioParaCima(1e303)).toBe(1e303);
    expect(arredondaMeioParaCima(390.5)).toBe(391);
    expect(arredondaMeioParaCima(129.49)).toBe(129);
    expect(arredondaMeioParaCima(75 * 1.73)).toBe(130);
  });

  it("taxa máxima legítima continua ampliando a duração com aviso (sem corte)", () => {
    const r = instanciarProtocolo(
      template([item({ drug: "FARMACO_SINTETICO_R2", standardDose: 100, doseBasis: "FIXED", unit: "mg", taxaMaximaMgMin: 2, infusionTime: "30 min" })]),
      corpo(),
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.itens[0]!.estado).toBe("PRONTO");
    expect(r.itens[0]!.item.infusionTime).toBe("50 min");
    expect(r.itens[0]!.aviso).toMatch(/2 mg\/min/u);
  });
});

describe("FUGU-R2 F · controles válidos preservados", () => {
  it("F-R2-FIXED-INDEPENDENT: item FIXED não depende de BSA; pendência é por item", () => {
    const r = instanciarProtocolo(template([
      item({ drug: "FIXED_SINTETICO", standardDose: 100, doseBasis: "FIXED", unit: "mg" }),
      item({ drug: "M2_SINTETICO", sequence: 2, doseBasis: "MG_M2", standardDose: 100, unit: "mg/m²" }),
    ]), corpo({ pesoKg: null, alturaCm: null }));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.itens[0]!.estado).toBe("PRONTO");
    expect(r.itens[0]!.item.calculatedDose).toBe(100);
    expect(r.itens[1]!.estado).toBe("PENDENTE");
    expect(r.pendentes).toBe(1);
  });

  it("F-R2-VALID-ROUNDING-PROVENANCE: 390,5 µg ⇒ 391 µg uma vez; 0,391 mg; unidade/fonte preservadas", () => {
    const d = calcularDosePorBase({ basis: "MCG_KG", mcgKg: 5.5, pesoKg: 71 });
    expect(d).toMatchObject({ estado: "PRONTO", dose: 391, doseMg: 0.391, unidade: "µg" });
    const t = instanciarProtocolo(
      template([item({ drug: "FARMACO_SINTETICO_R2", doseBasis: "MCG_KG", standardDose: 5.5, unit: "mcg/kg" })]),
      corpo({ pesoKg: 71 }),
    );
    expect(t.ok).toBe(true);
    if (!t.ok) return;
    expect(t.itens[0]!.item.calculatedDose).toBe(391);
    expect(t.itens[0]!.item.unit).toBe("µg");
    expect(t.itens[0]!.unidadePadrao).toBe("mcg/kg");
    expect(t.itens[0]!.medidoEm).toBe("2026-10-19");
  });

  it("F-R2-NO-CUTOFF: sem piso/teto fisiológico novo em bsaMosteller", () => {
    const dimensoes: Array<[number, number]> = [[1, 30], [500, 250], [1e300, 1]];
    const valores = dimensoes.map(([p, h]) => bsaMosteller(p, h));
    const esperado = dimensoes.map(([p, h]) => Math.round(Math.sqrt((p * h) / 3600) * 100) / 100);
    expect(valores).toEqual(esperado);
    expect(valores.every((v) => v !== null && Number.isFinite(v))).toBe(true);
  });

  it("F-R2-ALIAS: calcularDoseBasis e calcularDosePorBase equivalentes", () => {
    const entrada = { basis: "MG_KG", mgKg: 2.5, pesoKg: 70 } as const;
    const a = calcularDoseBasis(entrada);
    const b = calcularDosePorBase(entrada);
    expect(a).toEqual(b);
    expect(a).toMatchObject({ estado: "PRONTO", dose: 175, unidade: "mg", doseMg: 175 });
  });
});
