// W12-GROK-01 · salao-triagem 1.1.0, FN-01 com FC < 50 e CREAT ativo (D-W9-37/38/58).
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { avaliarCorteSalao, avaliarTriagem, avaliarTriagemCiclo } from "../../src/rules/triagem.js";
import { ausente, ctxBase, presente, triagemBase } from "../fixtures/triagem.js";
import { salaoRuleset } from "../fixtures/rulesets.js";

const EXTRA = { pad: 80, crCentesimos: 100 };
const salao = (over: Parameters<typeof triagemBase>[0] = {}, extra = EXTRA) =>
  avaliarCorteSalao(triagemBase(over), extra, salaoRuleset);
const fn01 = (over: Parameters<typeof triagemBase>[0] = {}) =>
  avaliarTriagem(triagemBase(over), ctxBase(), salaoRuleset);

function cortaSalao(r: ReturnType<typeof salao>, codigo: string) {
  expect(r.destino).toBe("FILA_MEDICO");
  expect(r.bloqueiaSalvar).toBe(false);
  expect(r.motivos.map((m) => m.codigo)).toContain(codigo);
}

function passaSalao(r: ReturnType<typeof salao>) {
  expect(r.motivos).toEqual([]);
  expect(r.destino).not.toBe("FILA_MEDICO");
}

describe("W12-GROK-01 ruleset 1.1.0", () => {
  it("versão 1.1.0 e fonte D-W9-37 em cada limiar do corte do salão", () => {
    const json = JSON.parse(readFileSync("corpus/rulesets/salao-triagem.v1.json", "utf8")) as {
      header: { versao: string };
      portoes: { corteSalao: { fontes: Record<string, string>; pasMax: number; fcMin: number } };
    };
    expect(json.header.versao).toBe("1.1.0");
    expect(salaoRuleset.header.versao).toBe("1.1.0");
    const fontes = json.portoes.corteSalao.fontes;
    for (const chave of [
      "tempDecimosMax", "spo2Min", "pasMin", "pasMax", "fcMin",
      "hbDgDlMin", "crCentesimosMax", "ancMin", "plqMin", "ecogCorta",
    ]) {
      expect(fontes[chave]).toBe("D-W9-37");
    }
    expect(json.portoes.corteSalao.pasMax).toBe(160);
    expect(json.portoes.corteSalao.fcMin).toBe(50);
  });

  it("CREAT ativo: limiar superior 150; 1,50 passa no corte e 1,51 corta", () => {
    const json = JSON.parse(readFileSync("corpus/rulesets/lab-thresholds.v1.json", "utf8")) as {
      analitos: Array<{ codigo: string; ativo: boolean; limiarSuperior: number | null; limiarInferior: number | null }>;
    };
    const creat = json.analitos.find((a) => a.codigo === "CREAT");
    expect(creat).toMatchObject({ ativo: true, limiarInferior: null, limiarSuperior: 150 });
    passaSalao(salao({}, { pad: 80, crCentesimos: 150 }));
    cortaSalao(salao({}, { pad: 80, crCentesimos: 151 }), "corteSalao.cr.alta");
    passaSalao(salao({}, { pad: 80, crCentesimos: 149 }));
  });
});

describe("W12-GROK-01 bordas de cada limiar (abaixo, igual, acima)", () => {
  it("SpO2 87 corta, 88 passa, 89 passa", () => {
    cortaSalao(salao({ spo2: presente(87) }), "corteSalao.spo2.baixa");
    passaSalao(salao({ spo2: presente(88) }));
    passaSalao(salao({ spo2: presente(89) }));
  });

  it("PAS 89 corta, 90 passa, 160 passa, 161 corta", () => {
    cortaSalao(salao({ pas: presente(89) }), "corteSalao.pas.baixa");
    passaSalao(salao({ pas: presente(90) }));
    passaSalao(salao({ pas: presente(160) }));
    cortaSalao(salao({ pas: presente(161) }), "corteSalao.pas.alta");
  });

  it("FC 49 corta salão e FN-01; 50 passa nos dois; 51 passa", () => {
    cortaSalao(salao({ fc: presente(49) }), "corteSalao.fc.baixa");
    const fn = fn01({ fc: presente(49) });
    expect(fn.destino).toBe("FILA_MEDICO");
    expect(fn.cortes.map((m) => m.codigo)).toContain("corte.fc.baixa");
    passaSalao(salao({ fc: presente(50) }));
    expect(fn01({ fc: presente(50) }).destino).toBe("SALAO");
    passaSalao(salao({ fc: presente(51) }));
  });

  it("Hb 79 corta, 80 passa, 81 passa", () => {
    cortaSalao(salao({ hbDgDl: presente(79) }), "corteSalao.hb.baixa");
    passaSalao(salao({ hbDgDl: presente(80) }));
    passaSalao(salao({ hbDgDl: presente(81) }));
  });

  it("febre 377 passa, 378 passa, 379 corta", () => {
    passaSalao(salao({ tempDecimos: presente(377) }));
    passaSalao(salao({ tempDecimos: presente(378) }));
    cortaSalao(salao({ tempDecimos: presente(379) }), "corteSalao.temp.alta");
  });

  it("neutrófilos 1499 corta, 1500 passa, 1501 passa", () => {
    cortaSalao(salao({ anc: presente(1499) }), "corteSalao.anc.baixa");
    passaSalao(salao({ anc: presente(1500) }));
    passaSalao(salao({ anc: presente(1501) }));
  });

  it("plaquetas 99999 corta, 100000 passa, 100001 passa", () => {
    cortaSalao(salao({ plq: presente(99999) }), "corteSalao.plq.baixa");
    passaSalao(salao({ plq: presente(100000) }));
    passaSalao(salao({ plq: presente(100001) }));
  });

  it("ECOG 2 passa; ECOG 3 e 4 cortam", () => {
    passaSalao(salao({ ecog: presente(2) }));
    cortaSalao(salao({ ecog: presente(3) }), "corteSalao.ecog");
    cortaSalao(salao({ ecog: presente(4) }), "corteSalao.ecog");
  });
});

describe("W12-GROK-01 os portões continuam distintos", () => {
  it("FC 49 corta o salão e não a triagem do ciclo", () => {
    expect(avaliarTriagemCiclo(triagemBase({ fc: presente(49) }), EXTRA, salaoRuleset).motivos).toEqual([]);
    cortaSalao(salao({ fc: presente(49) }), "corteSalao.fc.baixa");
  });

  it("FC 140 corta o ciclo e não o salão", () => {
    const ciclo = avaliarTriagemCiclo(triagemBase({ fc: presente(140) }), EXTRA, salaoRuleset);
    expect(ciclo.motivos.length).toBeGreaterThan(0);
    passaSalao(salao({ fc: presente(140) }));
  });

  it("campo ausente no salão é PENDENTE, nunca corte", () => {
    const r = salao({ fc: ausente<number>() });
    expect(r.destino).toBe("FILA_MEDICO");
    expect(r.motivos).toEqual([]);
    expect(r.pendentes.length).toBeGreaterThan(0);
  });
});
