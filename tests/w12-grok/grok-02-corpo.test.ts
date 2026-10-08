// W12-GROK-02 · um corpo no barrel; porta lê LimiaresBula; portões do salão continuam distintos.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { LimiaresBula } from "../../src/contracts/w10/prescricao.js";
import * as barrel from "../../src/rules/index.js";
import * as porta from "../../src/rules/portaCiclo.js";
import * as triagem from "../../src/rules/triagem.js";
import { presente, triagemBase } from "../fixtures/triagem.js";
import { salaoRuleset } from "../fixtures/rulesets.js";

const rs = porta.lerSalaoCtcae(JSON.parse(readFileSync("corpus/rulesets/salao-ctcae.v1.json", "utf8")));
const EXTRA = { pad: 80, crCentesimos: 100 };
const labs = { anc: 2000, plq: 200000, clearance: 80, feve: 60 };

const bula = (over: Partial<LimiaresBula> = {}): LimiaresBula => ({
  neutrofilosMin: null,
  plaquetasMin: null,
  clcrMinMlMin: null,
  fevePctMin: null,
  fonte: "bula sintética D-W9-22a",
  ...over,
});

describe("W12-GROK-02 um só corpo", () => {
  it("o barrel reexporta as mesmas funções, sem segunda implementação", () => {
    expect(barrel.avaliarTriagem).toBe(triagem.avaliarTriagem);
    expect(barrel.avaliarCorteSalao).toBe(triagem.avaliarCorteSalao);
    expect(barrel.avaliarTriagemCiclo).toBe(triagem.avaliarTriagemCiclo);
    expect(barrel.avaliarPortoesW10).toBe(triagem.avaliarPortoesW10);
    expect(barrel.portaCiclo).toBe(porta.portaCiclo);
    expect(barrel.grauCtcae).toBe(porta.grauCtcae);
  });
});

describe("W12-GROK-02 LimiaresBula", () => {
  it("neutrófilos 1499 ficam abaixo da bula 1500; 1500 passa; grau não abre a porta", () => {
    const grau = porta.grauCtcae("neutrofilos", 1200, rs);
    expect(grau.grau).not.toBeNull();
    const segura = porta.portaCiclo(labs, bula({ neutrofilosMin: 1500 }), rs);
    const abaixo = porta.portaCiclo({ ...labs, anc: 1499 }, bula({ neutrofilosMin: 1500 }), rs);
    const igual = porta.portaCiclo({ ...labs, anc: 1500 }, bula({ neutrofilosMin: 1500 }), rs);
    expect(segura.solta).toBe(true);
    expect(abaixo.solta).toBe(false);
    expect(abaixo.grauUsadoNaPorta).toBe(false);
    expect(abaixo.bloqueiaSalvar).toBe(false);
    expect(abaixo.motivos.map((m) => m.codigo)).toEqual(["portaCiclo.anc.abaixo"]);
    expect(abaixo.motivos[0]?.texto).toContain("bula sintética D-W9-22a");
    expect(igual.solta).toBe(true);
    expect(igual.destino).toBe("SEM_FILA");
  });

  it("bula sem nenhum mínimo é PENDENTE e não usa grau", () => {
    const portaVazia = porta.portaCiclo({ ...labs, anc: 100 }, bula(), rs);
    expect(portaVazia.solta).toBe(false);
    expect(portaVazia.motivos).toEqual([]);
    expect(portaVazia.grauUsadoNaPorta).toBe(false);
    expect(portaVazia.pendentes.map((m) => m.codigo)).toContain("pendente.portaCiclo.limiares");
  });
});

describe("W12-GROK-02 portões distintos (D-W9-22g)", () => {
  it("FC 49 corta o salão e não a triagem do ciclo; PAS 150 faz o inverso", () => {
    const fc = barrel.avaliarPortoesW10(triagemBase({ fc: presente(49) }), EXTRA, salaoRuleset);
    expect(fc.corteSalao.motivos.map((m) => m.codigo)).toContain("corteSalao.fc.baixa");
    expect(fc.triagemCiclo.motivos).toEqual([]);
    const pas = barrel.avaliarPortoesW10(triagemBase({ pas: presente(150) }), EXTRA, salaoRuleset);
    expect(pas.triagemCiclo.motivos.length).toBeGreaterThan(0);
    expect(pas.corteSalao.motivos).toEqual([]);
    expect(pas.triagemCiclo.portao).not.toBe(pas.corteSalao.portao);
  });
});
