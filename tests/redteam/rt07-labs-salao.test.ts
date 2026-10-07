// RT-07 · Labs e cortes do salão (S1) — provas de DEFESA nas fronteiras exatas.
// Febre estritamente > 37,8 (D-W9-38); igual ao limite passa (FN-01); ausente = PENDENTE,
// nunca 0/VERDE; dois portões distintos (D-W9-22g); porta do ciclo é bula, nunca grau CTCAE.
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { avaliarCorteSalao, avaliarPortoesW10, avaliarTriagemCiclo, validadeHemograma } from "../../src/rules/index.js";
import { dataCivilNoOffset } from "../../src/rules/intervaloQt.js";
import { portaCiclo, grauCtcae, lerSalaoCtcae, type LabsCiclo, type ProtocoloCiclo } from "../../src/rules/portaCiclo.js";
import { ausente, presente, triagemBase } from "../fixtures/triagem.js";
import { salaoRuleset } from "../fixtures/rulesets.js";


const EXTRA = { pad: 80, crCentesimos: 100 };
const salao = (over: Parameters<typeof triagemBase>[0], extra = EXTRA) =>
  avaliarCorteSalao(triagemBase(over), extra, salaoRuleset);
const ciclo = (over: Parameters<typeof triagemBase>[0], extra = EXTRA) =>
  avaliarTriagemCiclo(triagemBase(over), extra, salaoRuleset);
const cortaSalao = (over: Parameters<typeof triagemBase>[0], extra = EXTRA) => {
  const r = salao(over, extra);
  expect(r.destino).toBe("FILA_MEDICO");
  expect(r.motivos.length).toBeGreaterThan(0);
  expect(r.bloqueiaSalvar).toBe(false);
};
const passaSalao = (over: Parameters<typeof triagemBase>[0], extra = EXTRA) => {
  const r = salao(over, extra);
  expect(r.motivos).toEqual([]);
};

const salaoCtcae = lerSalaoCtcae(JSON.parse(readFileSync("corpus/rulesets/salao-ctcae.v1.json", "utf8")));

describe("RT-07 · fronteiras exatas do corte do salão (igual passa)", () => {
  it("febre estritamente > 37,8: 37,8 passa / 37,9 corta", () => {
    passaSalao({ tempDecimos: presente(378) });
    cortaSalao({ tempDecimos: presente(379) });
  });

  it.each([
    ["Hb", { hbDgDl: presente(80) }, { hbDgDl: presente(79) }],
    ["ANC", { anc: presente(1500) }, { anc: presente(1499) }],
    ["plaquetas", { plq: presente(100000) }, { plq: presente(99999) }],
    ["SpO₂", { spo2: presente(88) }, { spo2: presente(87) }],
    ["PAS", { pas: presente(90) }, { pas: presente(89) }],
  ])("%s: limite passa, abaixo corta", (_nome, passa, corta) => {
    passaSalao(passa);
    cortaSalao(corta);
  });

  it("creatinina (centésimos): 1,50 passa / 1,51 corta — só no corte do salão", () => {
    passaSalao({ }, { pad: 80, crCentesimos: 150 });
    cortaSalao({ }, { pad: 80, crCentesimos: 151 });
  });

  it("FC < 50 corta só o salão (D-W9-37): 50 passa / 49 corta / 49 não corta o ciclo", () => {
    passaSalao({ fc: presente(50) });
    cortaSalao({ fc: presente(49) });
    const r = ciclo({ fc: presente(49) });
    expect(r.motivos).toEqual([]);
  });
});

describe("RT-07 · ausente = PENDENTE, nunca 0 nem VERDE", () => {
  it("campo ausente gera pendência e fila do médico; não corta nem passa como zero", () => {
    const r = salao({ anc: ausente(), plq: ausente() });
    expect(r.pendentes.length).toBeGreaterThanOrEqual(2);
    expect(r.destino).toBe("FILA_MEDICO");
    expect(r.motivos).toEqual([]);
    const geral = avaliarPortoesW10(triagemBase({ anc: ausente() }), EXTRA, salaoRuleset);
    expect(geral.corteSalao.pendentes.some((p) => p.codigo.includes("anc"))).toBe(true);
  });

  it("idade ausente vai à fila do médico (D-W9-03), nunca vira 0/FRENTE", () => {
    const geral = avaliarPortoesW10(triagemBase({ idadeAnos: null }), EXTRA, salaoRuleset);
    expect(geral.corteSalao.destino).toBe("FILA_MEDICO");
  });

  it("hemograma: 7 dias é válido; 8 vence; ausente e futura são PENDENTE", () => {
    expect(validadeHemograma("2026-09-28", "2026-10-05", salaoRuleset).estado).toBe("VERDE");
    const vencido = validadeHemograma("2026-09-27", "2026-10-05", salaoRuleset);
    expect(vencido.estado).toBe("PENDENTE");
    expect(vencido.motivo).toContain("vencido");
    expect(validadeHemograma(null, "2026-10-05", salaoRuleset).motivo).toContain("ausente");
    expect(validadeHemograma("2026-10-06", "2026-10-05", salaoRuleset).motivo).toContain("futura");
  });

  it("fuso −03:00: 23:30 locais é o MESMO dia civil (conversão por offset injetado)", () => {
    expect(dataCivilNoOffset("2029-01-05T23:30:00-03:00", "-03:00")).toBe("2029-01-05");
    // E a validade conta dias civis: coleta 05/01, hoje 12/01 ⇒ 7 dias ⇒ VERDE
    expect(validadeHemograma("2029-01-05", "2029-01-12", salaoRuleset).estado).toBe("VERDE");
  });
});

describe("RT-07 · dois portões nunca fundidos (D-W9-22g)", () => {
  it("PAS 150 corta o ciclo (>140) e NÃO corta o salão (<160)", () => {
    const par = avaliarPortoesW10(triagemBase({ pas: presente(150) }), EXTRA, salaoRuleset);
    expect(par.triagemCiclo.motivos.length).toBeGreaterThan(0);
    expect(par.corteSalao.motivos).toEqual([]);
    expect(par.triagemCiclo.portao).toBe("TRIAGEM_CICLO");
    expect(par.corteSalao.portao).toBe("CORTE_SALAO");
  });

  it("PAS 89 corta o salão e NÃO corta o ciclo (portão do ciclo só tem tetos)", () => {
    const par = avaliarPortoesW10(triagemBase({ pas: presente(89) }), EXTRA, salaoRuleset);
    expect(par.corteSalao.motivos.length).toBeGreaterThan(0);
    expect(par.triagemCiclo.motivos).toEqual([]);
  });

  it("FC 140 corta o ciclo (>110); o salão avalia só o piso de FC", () => {
    const par = avaliarPortoesW10(triagemBase({ fc: presente(140) }), EXTRA, salaoRuleset);
    expect(par.triagemCiclo.motivos.length).toBeGreaterThan(0);
    expect(par.corteSalao.motivos).toEqual([]);
  });
});

describe("RT-07 · a porta do ciclo é bula, nunca grau CTCAE (D-W9-22a)", () => {
  const protocolo: ProtocoloCiclo = {
    protocoloId: "GC-bexiga", versao: "1",
    limiares: [
      { codigo: "anc", minimo: 1500 },
      { codigo: "plq", minimo: 100000 },
      { codigo: "clearance", minimo: 60 },
      { codigo: "feve", minimo: 50 },
    ],
    // Armadilha deliberada (D-W9-22a): o protocolo DECLARA porta por grau e o código IGNORA.
    portaPorGrau: { grauMinimo: 4 },
  };
  const labs: LabsCiclo = { anc: 1500, plq: 100000, clearance: 60, feve: 50 };

  it("igual ao limiar da bula passa mesmo com portaPorGrau declarado", () => {
    const saida = portaCiclo(labs, protocolo, salaoCtcae);
    expect(saida.solta).toBe(true);
    expect(saida.grauUsadoNaPorta).toBe(false);
    expect(saida.destino).toBe("SEM_FILA");
  });

  it("um abaixo do limiar solta motivo; laboratório ausente é PENDENTE, nunca 0/verde", () => {
    const abaixo = portaCiclo({ ...labs, anc: 1499 }, protocolo, salaoCtcae);
    expect(abaixo.solta).toBe(false);
    expect(abaixo.pendentes.some((p) => p.codigo.includes("anc"))).toBe(false);
    expect(abaixo.motivos.some((m) => m.codigo.includes("anc"))).toBe(true);
    const semANC = portaCiclo({ ...labs, anc: null }, protocolo, salaoCtcae);
    expect(semANC.solta).toBe(false);
    expect(semANC.pendentes.some((p) => p.codigo.includes("anc"))).toBe(true);
  });

  it("grau CTCAE calculado por código está sempre PENDENTE de confirmação e nunca abre/fecha porta", () => {
    const grau = grauCtcae("neutropenia", 3, salaoCtcae);
    expect(grau.estado).toBe("PENDENTE");
    expect(grau.confirmadoPeloMedico).toBe(false);
    const semValor = grauCtcae("neutropenia", null, salaoCtcae);
    expect(semValor.grau).toBeNull(); // ausente nunca vira 0
    expect(semValor.estado).toBe("PENDENTE");
  });
});
