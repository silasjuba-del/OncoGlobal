// FN-01 avaliarTriagem + FN-02 decidirDestino — bordas da Parte 7 (T-01…T-15, N08). Igual passa.
import { describe, expect, it } from "vitest";
import { avaliarTriagem, decidirDestino } from "../../src/rules/index.js";
import { ausente, ctxBase, presente, triagemBase } from "../fixtures/triagem.js";
import { RULESET_VERSAO, salaoRuleset } from "../fixtures/rulesets.js";

const avaliar = (over: Parameters<typeof triagemBase>[0], ctxOver: Parameters<typeof ctxBase>[0] = {}) =>
  avaliarTriagem(triagemBase(over), ctxBase(ctxOver), salaoRuleset);

describe("FN-01 cortes vitais e exames (igual passa, inteiros nas bordas — K-10)", () => {
  it("PA 160 → SALAO; PA 161 → FILA_MEDICO", () => {
    expect(avaliar({ pas: presente(160) }).destino).toBe("SALAO");
    const r161 = avaliar({ pas: presente(161) });
    expect(r161.destino).toBe("FILA_MEDICO");
    expect(r161.cortes.length).toBeGreaterThan(0);
  });
  it("PA 90 → SALAO; PA 89 → FILA_MEDICO", () => {
    expect(avaliar({ pas: presente(90) }).destino).toBe("SALAO");
    expect(avaliar({ pas: presente(89) }).destino).toBe("FILA_MEDICO");
  });
  it("FC 120 → SALAO; FC 121 → FILA_MEDICO", () => {
    expect(avaliar({ fc: presente(120) }).destino).toBe("SALAO");
    expect(avaliar({ fc: presente(121) }).destino).toBe("FILA_MEDICO");
  });
  it("FC 49 → SALAO com anotação em naoCortes (FC<50 não corta)", () => {
    const r = avaliar({ fc: presente(49) });
    expect(r.destino).toBe("SALAO");
    expect(r.cortes).toHaveLength(0);
    expect(r.naoCortes.length).toBeGreaterThan(0);
  });
  it("SpO2 88 → SALAO; SpO2 87 → FILA_MEDICO", () => {
    expect(avaliar({ spo2: presente(88) }).destino).toBe("SALAO");
    expect(avaliar({ spo2: presente(87) }).destino).toBe("FILA_MEDICO");
  });
  it("temp 378 → SALAO; temp 379 → FILA_MEDICO", () => {
    expect(avaliar({ tempDecimos: presente(378) }).destino).toBe("SALAO");
    expect(avaliar({ tempDecimos: presente(379) }).destino).toBe("FILA_MEDICO");
  });
  it("Hb 80 → SALAO; Hb 79 → FILA_MEDICO", () => {
    expect(avaliar({ hbDgDl: presente(80) }).destino).toBe("SALAO");
    expect(avaliar({ hbDgDl: presente(79) }).destino).toBe("FILA_MEDICO");
  });
  it("ANC 1500 → SALAO; ANC 1499 → FILA_MEDICO", () => {
    expect(avaliar({ anc: presente(1500) }).destino).toBe("SALAO");
    expect(avaliar({ anc: presente(1499) }).destino).toBe("FILA_MEDICO");
  });
  it("PLQ 100000 → SALAO; PLQ 99999 → FILA_MEDICO", () => {
    expect(avaliar({ plq: presente(100000) }).destino).toBe("SALAO");
    expect(avaliar({ plq: presente(99999) }).destino).toBe("FILA_MEDICO");
  });
});

describe("FN-01 grau CTCAE e ECOG", () => {
  it("grau 2 → SALAO com anotação em naoCortes", () => {
    const r = avaliar({ grauCtcae: presente(2) });
    expect(r.destino).toBe("SALAO");
    expect(r.naoCortes.length).toBeGreaterThan(0);
  });
  it("grau 3 → FILA_MEDICO", () => {
    expect(avaliar({ grauCtcae: presente(3) }).destino).toBe("FILA_MEDICO");
  });
  it("grau 4 → FILA_MEDICO + emergencia (E1)", () => {
    const r = avaliar({ grauCtcae: presente(4) });
    expect(r.destino).toBe("FILA_MEDICO");
    expect(r.emergencia).toBe(true);
  });
  it("ECOG 2 + tontura → SALAO com anotação em naoCortes", () => {
    const r = avaliar({ ecog: presente(2), tontura: true });
    expect(r.destino).toBe("SALAO");
    expect(r.cortes).toHaveLength(0);
    expect(r.naoCortes.length).toBeGreaterThan(0);
  });
  it("ECOG 3 → FILA_MEDICO; ECOG 4 → FILA_MEDICO", () => {
    expect(avaliar({ ecog: presente(3) }).destino).toBe("FILA_MEDICO");
    expect(avaliar({ ecog: presente(4) }).destino).toBe("FILA_MEDICO");
  });
});

describe("FN-01 ausências e validade do hemograma (K-10, Q27)", () => {
  it("requisito aplicável ausente → pendente + FILA_MEDICO", () => {
    const r = avaliar({ hbDgDl: ausente<number>() });
    expect(r.pendentes.length).toBeGreaterThan(0);
    expect(r.destino).toBe("FILA_MEDICO");
  });
  it("campo ausente NÃO listado em requisitosAplicaveis → sem pendência", () => {
    const r = avaliar(
      { ecog: ausente<number>() },
      { requisitosAplicaveis: ["pas", "fc", "spo2", "tempDecimos", "hbDgDl", "anc", "plq", "coletaHemograma", "grauCtcae"] },
    );
    expect(r.pendentes).toHaveLength(0);
    expect(r.destino).toBe("SALAO");
  });
  it("hemograma coletado há 7 dias → sem pendência; há 8 dias → pendente; futura → pendente", () => {
    expect(avaliar({ coletaHemograma: presente("2026-09-28") }).pendentes).toHaveLength(0);
    expect(avaliar({ coletaHemograma: presente("2026-09-27") }).pendentes.length).toBeGreaterThan(0);
    expect(avaliar({ coletaHemograma: presente("2026-10-06") }).pendentes.length).toBeGreaterThan(0);
  });
  it("hemograma ausente → pendente + FILA_MEDICO", () => {
    const r = avaliar({ coletaHemograma: ausente<string>() });
    expect(r.pendentes.length).toBeGreaterThan(0);
    expect(r.destino).toBe("FILA_MEDICO");
  });
});

describe("FN-01 emergência (A7)", () => {
  it("febre 379 + ANC 900 → emergencia true e destino FILA_MEDICO (emergência não muda destino)", () => {
    const r = avaliar({ tempDecimos: presente(379), anc: presente(900) });
    expect(r.emergencia).toBe(true);
    expect(r.destino).toBe("FILA_MEDICO");
  });
});

describe("FN-01/FN-02 destino (Q26, N08)", () => {
  it("CAMA sem corte e sem pendência → FRENTE", () => {
    expect(avaliar({ recurso: "CAMA" }).destino).toBe("FRENTE");
  });
  it("CAMA com pendência → FILA_MEDICO (N08)", () => {
    expect(avaliar({ recurso: "CAMA", hbDgDl: ausente<number>() }).destino).toBe("FILA_MEDICO");
  });
  it("CAMA com febre → FILA_MEDICO (nunca frente com corte)", () => {
    expect(avaliar({ recurso: "CAMA", tempDecimos: presente(379) }).destino).toBe("FILA_MEDICO");
  });
  it("idade 81 sem corte → FRENTE; idade 80 → SALAO (igual NÃO passa na idade)", () => {
    expect(avaliar({ idadeAnos: 81 }).destino).toBe("FRENTE");
    expect(avaliar({ idadeAnos: 80 }).destino).toBe("SALAO");
  });
  it("saída carrega rulesetVersao 1.0.0", () => {
    expect(avaliar({}).rulesetVersao).toBe(RULESET_VERSAO);
  });
});

describe("FN-02 decidirDestino (função pura isolada)", () => {
  it("CAMA sem corte e sem pendência → FRENTE", () =>
    expect(decidirDestino({ temCorte: false, temPendencia: false, recurso: "CAMA", idadeAnos: 60 }, salaoRuleset)).toBe("FRENTE"));
  it("CAMA com corte → FILA_MEDICO", () =>
    expect(decidirDestino({ temCorte: true, temPendencia: false, recurso: "CAMA", idadeAnos: 60 }, salaoRuleset)).toBe("FILA_MEDICO"));
  it("CAMA com pendência → FILA_MEDICO (N08)", () =>
    expect(decidirDestino({ temCorte: false, temPendencia: true, recurso: "CAMA", idadeAnos: 60 }, salaoRuleset)).toBe("FILA_MEDICO"));
  it("AMBULATORIAL sem corte e sem pendência → SALAO", () =>
    expect(decidirDestino({ temCorte: false, temPendencia: false, recurso: "AMBULATORIAL", idadeAnos: 60 }, salaoRuleset)).toBe("SALAO"));
  it("idade 81 AMBULATORIAL → FRENTE; idade 80 → SALAO (igual NÃO passa na idade)", () => {
    expect(decidirDestino({ temCorte: false, temPendencia: false, recurso: "AMBULATORIAL", idadeAnos: 81 }, salaoRuleset)).toBe("FRENTE");
    expect(decidirDestino({ temCorte: false, temPendencia: false, recurso: "AMBULATORIAL", idadeAnos: 80 }, salaoRuleset)).toBe("SALAO");
  });
  it("CADEIRA sem corte e sem pendência → FRENTE em qualquer idade (Q26)", () =>
    expect(decidirDestino({ temCorte: false, temPendencia: false, recurso: "CADEIRA", idadeAnos: 60 }, salaoRuleset)).toBe("FRENTE"));
});

describe("FN-01 qtPodeIniciarSemMedico (Q21)", () => {
  it("true sem cortes, sem pendências e prescrição vigente", () => {
    const r = avaliar({});
    expect(r.cortes).toHaveLength(0);
    expect(r.pendentes).toHaveLength(0);
    expect(r.qtPodeIniciarSemMedico).toBe(true);
  });
  it("false quando prescricaoVigente é null", () =>
    expect(avaliar({}, { prescricaoVigente: null }).qtPodeIniciarSemMedico).toBe(false));
  it("false quando validaAte < hoje", () =>
    expect(avaliar({}, { prescricaoVigente: { documentId: "rx-teste-02", ciclosCobertos: 2, validaAte: "2026-10-04" } }).qtPodeIniciarSemMedico).toBe(false));
  it("false quando há corte", () =>
    expect(avaliar({ pas: presente(161) }).qtPodeIniciarSemMedico).toBe(false));
  it("false quando há pendência", () =>
    expect(avaliar({ anc: ausente<number>() }).qtPodeIniciarSemMedico).toBe(false));
});
