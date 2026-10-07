import { describe, expect, it } from "vitest";
import { diffCiclo } from "../../src/rules/prescricao/diffCiclo.js";
import { ClinicalOrder, type PrescriptionItem } from "../../src/contracts/w10/prescricao.js";
import { item } from "./_fixtures.js";

const ordem = (itens: PrescriptionItem[], o: Partial<ClinicalOrder> = {}): ClinicalOrder =>
  ClinicalOrder.parse({
    orderId: "o1", patientId: "p1", encounterId: "e1", cancerEpisodeId: null, orderType: "ANTINEOPLASTIC", indication: null,
    templateId: "tpl-1", templateVersao: "1", cycle: 2, day: "d1", itens, authoredBy: "u1",
    authoredAt: "2026-10-07T09:00:00-03:00", status: "DRAFT", supersedesOrderId: null, ...o,
  });

const base = () => [
  item({ drug: "Ondansetrona", classe: "PRE_QT", sequence: 1, prescribedDose: 16 }),
  item({ drug: "Docetaxel", sequence: 2, prescribedDose: 135, calculatedDose: 135 }),
  item({ drug: "SF 0,9%", classe: "POS_QT", sequence: 3, prescribedDose: 100, unit: "mL" }),
];

describe("W10-INT-PRESC-04 · diffCiclo", () => {
  it("ordens idênticas: nenhuma exceção", () => {
    const d = diffCiclo(ordem(base()), ordem(base(), { orderId: "o0", cycle: 1 }));
    expect(d).toEqual({ temAnterior: true, ordem: [], excecoes: [], houveMudanca: false });
  });
  it("sem ordem anterior: nada é exceção", () => {
    expect(diffCiclo(ordem(base()), null)).toMatchObject({ temAnterior: false, excecoes: [], houveMudanca: false });
  });
  it("só o campo alterado aparece (dose ajustada com motivo)", () => {
    const atual = base();
    atual[1] = item({ drug: "Docetaxel", sequence: 2, prescribedDose: 108, calculatedDose: 135, adjustmentPercent: -20, adjustmentReason: "neutropenia" });
    const d = diffCiclo(ordem(atual), ordem(base()));
    expect(d.excecoes).toHaveLength(1);
    const e = d.excecoes[0];
    expect(e).toMatchObject({ tipo: "ALTERADO", drug: "Docetaxel" });
    expect(e?.tipo === "ALTERADO" && e.mudancas.map((m) => m.campo).sort()).toEqual(["adjustmentPercent", "adjustmentReason", "prescribedDose"]);
    expect(e?.tipo === "ALTERADO" && e.mudancas.find((m) => m.campo === "prescribedDose")).toMatchObject({ anterior: 135, atual: 108 });
  });
  it("item adicionado e removido", () => {
    const atual = base().filter((i) => i.drug !== "Ondansetrona");
    atual.push(item({ drug: "Cimetidina", classe: "PRE_QT", sequence: 4, prescribedDose: 300 }));
    const d = diffCiclo(ordem(atual), ordem(base()));
    expect(d.excecoes).toContainEqual({ tipo: "ADICIONADO", drug: "Cimetidina", sequence: 4 });
    expect(d.excecoes).toContainEqual({ tipo: "REMOVIDO", drug: "Ondansetrona", sequence: 1 });
    expect(d.excecoes).toHaveLength(2);
  });
  it("nome casa sem acento/caixa; fármaco repetido casa por ocorrência", () => {
    const ant = [item({ drug: "SF 0,9%", sequence: 1, prescribedDose: 100 }), item({ drug: "SF 0,9%", sequence: 2, prescribedDose: 500 })];
    const atu = [item({ drug: "sf 0,9%", sequence: 1, prescribedDose: 100 }), item({ drug: "SF 0,9%", sequence: 2, prescribedDose: 250 })];
    const d = diffCiclo(ordem(atu), ordem(ant));
    expect(d.excecoes).toHaveLength(1);
    expect(d.excecoes[0]).toMatchObject({ tipo: "ALTERADO", sequence: 2 });
  });
  it("mudança de versão do template é destacada", () => {
    const d = diffCiclo(ordem(base(), { templateVersao: "2" }), ordem(base()));
    expect(d.ordem).toEqual([{ campo: "templateVersao", anterior: "1", atual: "2" }]);
    expect(d.houveMudanca).toBe(true);
  });
  it("diluente/volume/tempo/dias contam como mudança", () => {
    const atu = base();
    atu[1] = item({ drug: "Docetaxel", sequence: 2, prescribedDose: 135, calculatedDose: 135, diluent: "SG 5%", finalVolumeMl: 250, infusionTime: "60 min", days: ["d1", "d8"] });
    const m = diffCiclo(ordem(atu), ordem(base())).excecoes[0];
    expect(m?.tipo === "ALTERADO" && m.mudancas.map((x) => x.campo).sort()).toEqual(["days", "diluent", "finalVolumeMl", "infusionTime"]);
  });
});
