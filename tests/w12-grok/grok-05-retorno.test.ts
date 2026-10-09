// W12-GROK-05 · Paciente Teste 91: diarreia G3 + plaquetas 20.000 vão à fila.
// Alerta de plaquetas < 50.000 é independente do CTCAE. E1 não altera a fila.
// Diarreia > 24 h com HAS e vômito + diarreia só alertam. Nunca bloqueiam nem definem dose.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { avaliarRetornoToxicidade } from "../../src/rules/index.js";
import type { EntradaRetornoToxicidade } from "../../src/rules/retornoToxicidade.js";

const suporte = JSON.parse(readFileSync("corpus/rulesets/salao-suporte.v1.json", "utf8"));
const lab = JSON.parse(readFileSync("corpus/rulesets/lab-thresholds.v1.json", "utf8"));
const triagem = JSON.parse(readFileSync("corpus/rulesets/salao-triagem.v1.json", "utf8"));
const ctcae = JSON.parse(readFileSync("corpus/rulesets/salao-ctcae.v1.json", "utf8"));

const PROIBIDO = /\b(liberado|aprovado|apto)\b/i;
const DOSE = /\d+\s*mg|\bcomprimido\b|\bgotas\b|\b8\/8\b|causad[oa] por|\bposologia\b/i;

function entrada(over: Partial<EntradaRetornoToxicidade> = {}): EntradaRetornoToxicidade {
  return {
    pacienteId: "Paciente Teste 91",
    grau: 3,
    plaquetas: 20000,
    dataPlaquetas: "2026-10-08",
    horasDiarreia: null,
    vomito: false,
    medicamentos: [],
    dm2: false,
    tempDecimos: 365,
    ...over,
  };
}

function avaliar(over: Partial<EntradaRetornoToxicidade> = {}) {
  return avaliarRetornoToxicidade(entrada(over), suporte, lab, triagem, ctcae);
}

function codigos(itens: readonly { codigo: string }[]): string[] {
  return itens.map((item) => item.codigo);
}

function semPrescricao(valor: unknown) {
  const texto = JSON.stringify(valor);
  expect(texto).not.toMatch(PROIBIDO);
  expect(texto).not.toMatch(DOSE);
}

describe("W12-GROK-05 retorno com toxicidade", () => {
  it("G3 + plaquetas 20.000 → FILA_MEDICO, corte de grau e de plaquetas, alerta < 50.000, sem E1", () => {
    const r = avaliar();
    expect(r.pacienteId).toBe("Paciente Teste 91");
    expect(r.destino).toBe("FILA_MEDICO");
    expect(codigos(r.motivos)).toEqual(["corte.grau", "corte.plq.baixa"]);
    expect(codigos(r.alertas)).toContain("alerta.plq");
    expect(codigos(r.alertas)).not.toContain("alerta.e1");
    expect(r.bloqueiaSalvar).toBe(false);
    expect(r.confirmadoPeloMedico).toBe(false);
    expect(r.sugestao).toBe(true);
    for (const alerta of r.alertas) {
      expect(alerta.bloqueiaSalvar).toBe(false);
      expect(alerta.alteraFila).toBe(false);
      expect(alerta.defineDose).toBe(false);
      expect(alerta.defineCausalidade).toBe(false);
    }
    semPrescricao(r);
  });

  it("G4 com as mesmas plaquetas mantém destino e motivos e acrescenta E1 sem alterar a fila", () => {
    const g3 = avaliar({ grau: 3 });
    const g4 = avaliar({ grau: 4 });
    expect(g4.destino).toBe(g3.destino);
    expect(codigos(g4.motivos)).toEqual(codigos(g3.motivos));
    const e1 = g4.alertas.find((a) => a.codigo === "alerta.e1");
    expect(e1).toBeDefined();
    expect(e1?.alteraFila).toBe(false);
    expect(e1?.bloqueiaSalvar).toBe(false);
    expect(codigos(g3.alertas)).not.toContain("alerta.e1");
    semPrescricao(g4);
  });

  it("60.000 corta o salão e não dispara o alerta de 50.000; 50.000 exato também não alerta", () => {
    const sessenta = avaliar({ plaquetas: 60000 });
    expect(codigos(sessenta.motivos)).toEqual(["corte.grau", "corte.plq.baixa"]);
    expect(codigos(sessenta.alertas)).not.toContain("alerta.plq");

    const cinq = avaliar({ grau: 1, plaquetas: 50000 });
    expect(codigos(cinq.motivos)).toEqual(["corte.plq.baixa"]);
    expect(codigos(cinq.alertas)).not.toContain("alerta.plq");
    expect(codigos(cinq.alertas)).not.toContain("alerta.e1");
  });

  it("100.000 passa o corte e o alerta; 9.999 é E1 pela faixa G4 e não vira motivo", () => {
    const passa = avaliar({ grau: 1, plaquetas: 100000 });
    expect(passa.destino).toBe("SEM_FILA");
    expect(passa.motivos).toEqual([]);
    expect(codigos(passa.alertas)).not.toContain("alerta.plq");

    const g4plq = avaliar({ grau: 1, plaquetas: 9999 });
    expect(g4plq.destino).toBe("FILA_MEDICO");
    expect(codigos(g4plq.motivos)).toEqual(["corte.plq.baixa"]);
    expect(codigos(g4plq.alertas)).toContain("alerta.e1");
    expect(codigos(g4plq.alertas)).toContain("alerta.plq");
    expect(g4plq.alertas.every((a) => a.alteraFila === false)).toBe(true);
  });

  it("grau e plaquetas ausentes ficam PENDENTE na fila, sem motivo e sem E1", () => {
    const r = avaliar({ grau: null, plaquetas: null, dataPlaquetas: null });
    expect(r.destino).toBe("FILA_MEDICO");
    expect(r.motivos).toEqual([]);
    expect(codigos(r.pendencias)).toEqual(["pendente.grau", "pendente.plaquetas"]);
    expect(codigos(r.alertas)).not.toContain("alerta.e1");
    semPrescricao(r);
  });

  it("G1 com plaquetas 200.000 e sem diarreia não entra na fila", () => {
    const r = avaliar({ grau: 1, plaquetas: 200000 });
    expect(r.destino).toBe("SEM_FILA");
    expect(r.motivos).toEqual([]);
    expect(r.pendencias).toEqual([]);
    expect(r.alertas).toEqual([]);
    expect(JSON.stringify(r)).not.toMatch(PROIBIDO);
  });

  it("diarreia acima de 24 h com HAS alerta suspender; 24 h exato não alerta", () => {
    const has = { nome: "HAS", classe: "NAO_ONCOLOGICA" as const };
    const acima = avaliar({
      grau: 1,
      plaquetas: 200000,
      horasDiarreia: 25,
      medicamentos: [has],
    });
    expect(acima.alertas.some((a) => a.texto.includes("suspender anti-hipertensivo"))).toBe(true);
    expect(acima.alertas.every((a) => a.bloqueiaSalvar === false && a.defineDose === false)).toBe(true);

    const igual = avaliar({
      grau: 1,
      plaquetas: 200000,
      horasDiarreia: 24,
      medicamentos: [has],
    });
    expect(igual.alertas.some((a) => a.texto.includes("suspender anti-hipertensivo"))).toBe(false);
    expect(igual.destino).toBe("SEM_FILA");
  });

  it("vômito + diarreia alerta PS para hidratação venosa e não suspende anti-hipertensivo", () => {
    const r = avaliar({
      grau: 1,
      plaquetas: 200000,
      horasDiarreia: 10,
      vomito: true,
      medicamentos: [],
    });
    expect(r.alertas.some((a) => a.texto.includes("PS para hidratação venosa"))).toBe(true);
    expect(r.alertas.some((a) => a.texto.includes("suspender anti-hipertensivo"))).toBe(false);
    expect(r.alertas.every((a) => a.defineCausalidade === false && a.defineDose === false)).toBe(true);
    semPrescricao(r);
  });

  it("a mesma entrada devolve a mesma saída e não altera o congelado", () => {
    const base = entrada({ horasDiarreia: 25, vomito: true, medicamentos: [{ nome: "HAS", classe: "NAO_ONCOLOGICA" }] });
    const congelado = JSON.parse(JSON.stringify(base)) as EntradaRetornoToxicidade;
    const a = avaliarRetornoToxicidade(base, suporte, lab, triagem, ctcae);
    const b = avaliarRetornoToxicidade(base, suporte, lab, triagem, ctcae);
    expect(b).toEqual(a);
    expect(base).toEqual(congelado);
    semPrescricao(a);
  });
});
