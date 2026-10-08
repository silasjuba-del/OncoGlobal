// W11-H9 · FOLFOX4 (decisão médica do Dr. Silas, 2026-10-08): duas fichas, com e sem port-a-cath.
// Mesmas doses; a única diferença é o acesso, registrado na observação da lavagem de acesso.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { ProtocolTemplate } from "../../src/contracts/w10/prescricao.js";

const lerFicha = (arquivo: string) =>
  ProtocolTemplate.parse(JSON.parse(readFileSync(resolve(process.cwd(), "corpus/fichas/colon-reto", arquivo), "utf8")));

const COM = lerFicha("folfox4-com-port__paliativo-metastatico.json");
const SEM = lerFicha("folfox4-sem-port__paliativo-metastatico.json");
const FICHAS = [COM, SEM];

const item = (f: ProtocolTemplate, re: RegExp) => {
  const achados = f.itens.filter((i) => re.test(i.drug));
  expect(achados.length).toBe(1);
  return achados[0]!;
};

describe("FOLFOX4 com e sem port-a-cath", () => {
  it("as duas fichas carregam no contrato ProtocolTemplate e são RASCUNHO", () => {
    expect(COM.nome).toBe("FOLFOX4 — com port-a-cath");
    expect(SEM.nome).toBe("FOLFOX4 — sem port-a-cath");
    for (const f of FICHAS) expect(f.status).toBe("RASCUNHO");
  });

  it.each(FICHAS.map((f) => [f.nome, f] as const))("%s: oxaliplatina 85 mg/m² só no D1, EV 2 h", (_n, f) => {
    const oxa = item(f, /^oxaliplatina/i);
    expect(oxa.standardDose).toBe(85);
    expect(oxa.doseBasis).toBe("MG_M2");
    expect(oxa.days).toEqual(["d1"]);
    expect(oxa.route).toBe("EV");
    expect(oxa.infusionTime).toBe("2 h");
  });

  it.each(FICHAS.map((f) => [f.nome, f] as const))("%s: leucovorina 200 mg/m² D1 e D2, EV 2 h", (_n, f) => {
    const lv = item(f, /leucovorina/i);
    expect(lv.standardDose).toBe(200);
    expect(lv.doseBasis).toBe("MG_M2");
    expect(lv.days).toEqual(["d1", "d2"]);
    expect(lv.infusionTime).toBe("2 h");
  });

  it.each(FICHAS.map((f) => [f.nome, f] as const))("%s: 5-FU bolus 400 mg/m² D1 e D2", (_n, f) => {
    const bolus = item(f, /5-FU\) em bolus/i);
    expect(bolus.standardDose).toBe(400);
    expect(bolus.doseBasis).toBe("MG_M2");
    expect(bolus.days).toEqual(["d1", "d2"]);
  });

  it.each(FICHAS.map((f) => [f.nome, f] as const))("%s: 5-FU infusão 600 mg/m² em 22 h D1 e D2", (_n, f) => {
    const fu = item(f, /5-FU\) infusão contínua/i);
    expect(fu.standardDose).toBe(600);
    expect(fu.doseBasis).toBe("MG_M2");
    expect(fu.infusionTime).toBe("22 h");
    expect(fu.days).toEqual(["d1", "d2"]);
  });

  it.each(FICHAS.map((f) => [f.nome, f] as const))("%s: intervalo de 14 dias", (_n, f) => {
    expect(f.intervaloDias).toBe(14);
  });

  it("fonte registra DECISAO_MEDICA do Dr. Silas em 2026-10-08 nas duas fichas", () => {
    for (const f of FICHAS) expect(f.fonte).toMatch(/DECISAO_MEDICA do Dr\. Silas em 2026-10-08/);
  });

  it("as duas fichas têm o mesmo conjunto de itens, com as mesmas doses, e diferem só no acesso", () => {
    expect(COM.itens.length).toBe(SEM.itens.length);
    COM.itens.forEach((ic, k) => {
      const is = SEM.itens[k]!;
      const { observacao: obsC, ...restoC } = ic;
      const { observacao: obsS, ...restoS } = is;
      expect(restoS).toEqual(restoC);
      if (obsC !== obsS) expect(ic.drug).toMatch(/lavagem/i);
    });
    const acessoC = item(COM, /lavagem de acesso/i).observacao;
    const acessoS = item(SEM, /lavagem de acesso/i).observacao;
    expect(acessoC).toMatch(/com port-a-cath/);
    expect(acessoS).toMatch(/sem port-a-cath/);
    expect(COM.templateId).not.toBe(SEM.templateId);
    expect(COM.hash).not.toBe(SEM.hash);
  });
});
