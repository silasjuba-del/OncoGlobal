import { describe, expect, it } from "vitest";
import { avaliarCumulativoAlerta } from "../../src/rules/cumulativoAlerta.js";
import { avaliarCtcaeGrau } from "../../src/rules/ctcaeGrau.js";
import { avaliarEscore } from "../../src/rules/escores.js";
import { ultimaAdministracaoQtEfetiva } from "../../src/rules/intervaloQt.js";
import { avaliarLabAlerts } from "../../src/rules/labAlerts.js";
import { avaliarRadAlerts } from "../../src/rules/radAlerts.js";
import { avaliarRecist } from "../../src/rules/recist.js";
import { avaliarRedFlagsCanal } from "../../src/rules/redFlagsCanal.js";
import {
  administracaoCompleta,
  administracaoOmitida,
  canalRuleset,
  ctcaeRuleset,
  eventoQt,
  labRuleset,
  limiteCumulativo,
  radRuleset,
  recistRuleset,
  scoreRuleset,
} from "./fixtures.js";

describe("W3 CDX-02 labAlerts", () => {
  it("positivo: valor abaixo do limiar ativo fica vermelho com conversao rastreada", () => {
    const r = avaliarLabAlerts([{ codigo: "HB", valor: 79, unidade: "dg/dL" }], labRuleset);
    expect(r.achados[0]?.estado).toBe("VERMELHO");
    expect(r.valores_normalizados[0]?.valor).toBe(7.9);
    expect(r.valores_normalizados[0]?.convertidoPorRegraId).toBe("conv.hb.dgdl");
  });

  it("negativo: unidade desconhecida fica pendente", () => {
    const r = avaliarLabAlerts([{ codigo: "HB", valor: 8, unidade: "mmol/L" }], labRuleset);
    expect(r.achados[0]?.estado).toBe("PENDENTE");
    expect(r.achados[0]?.inputs_missing).toContain("conversao.mmol/L->g/dL");
  });

  it("borda: igual ao limiar passa; conflito no mesmo analito fica vermelho; threshold inativo sem cor", () => {
    expect(avaliarLabAlerts([{ codigo: "HB", valor: 8, unidade: "g/dL" }], labRuleset).achados[0]?.estado).toBe("VERDE");
    expect(
      avaliarLabAlerts(
        [
          { codigo: "HB", valor: 8, unidade: "g/dL" },
          { codigo: "HB", valor: 9, unidade: "g/dL" },
        ],
        labRuleset,
      ).achados[0]?.motivo,
    ).toContain("conflito");
    expect(avaliarLabAlerts([{ codigo: "ANC", valor: 1500, unidade: "/uL" }], labRuleset).achados[0]?.motivo).toContain("sem cor");
    expect(avaliarLabAlerts([{ codigo: "HB", valor: 8, unidade: "g/dL" }], null).achados[0]?.estado).toBe("PENDENTE");
  });
});

describe("W3 CDX-03 radAlerts", () => {
  it("positivo: termo em transcricao gera RED_RAD_ALERT com revisao medica", () => {
    const r = avaliarRadAlerts({ tipoFonte: "TRANSCRIPTION", texto: "Laudo descreve TEP central.", data: "2026-10-05" }, radRuleset);
    expect(r.alerts[0]?.tipo).toBe("RED_RAD_ALERT");
    expect(r.alerts[0]?.needs_physician_review).toBe(true);
  });

  it("negativo: negacao nao confirma alerta", () => {
    const r = avaliarRadAlerts({ tipoFonte: "TRANSCRIPTION", texto: "Sem TEP.", data: "2026-10-05" }, radRuleset);
    expect(r.alerts).toHaveLength(0);
    expect(r.achados[0]?.estado).toBe("VERDE");
  });

  it("borda: suspeita vira REVISAO_URGENTE e imagem bruta fica pendente", () => {
    expect(
      avaliarRadAlerts({ tipoFonte: "TRANSCRIPTION", texto: "Suspeita de TEP.", data: "2026-10-05" }, radRuleset).alerts[0]?.tipo,
    ).toBe("REVISAO_URGENTE");
    expect(avaliarRadAlerts({ tipoFonte: "IMAGE_RAW", texto: "TEP", data: "2026-10-05" }, radRuleset).achados[0]?.estado).toBe("PENDENTE");
    expect(avaliarRadAlerts({ tipoFonte: "TRANSCRIPTION", texto: "TEP", data: "2026-10-05" }, null).achados[0]?.motivo).toContain("[VERIFICAR]");
  });
});

describe("W3 CDX-04 redFlagsCanal", () => {
  const msg = { texto: "Estou com febre hoje", contatoId: "contato-01", patientId: "paciente-teste-01", classificadorOk: true };

  it("positivo: flag ativa tem resposta fixa e alvo paciente", () => {
    const r = avaliarRedFlagsCanal(msg, canalRuleset);
    expect(r.flags[0]?.templateId).toBe("TPL_EMERGENCIA");
    expect(r.flags[0]?.alvo).toBe("paciente");
  });

  it("negativo: falha do classificador fica pendente", () => {
    const r = avaliarRedFlagsCanal({ ...msg, classificadorOk: false }, canalRuleset);
    expect(r.flags).toHaveLength(0);
    expect(r.achados[0]?.estado).toBe("PENDENTE");
  });

  it("borda: negacao nao vira flag; terceira pessoa mira contato; passado fica pendente", () => {
    expect(avaliarRedFlagsCanal({ ...msg, texto: "Nao estou com febre" }, canalRuleset).flags).toHaveLength(0);
    expect(avaliarRedFlagsCanal({ ...msg, texto: "Minha mae esta com febre" }, canalRuleset).flags[0]?.alvo).toBe("contato");
    expect(avaliarRedFlagsCanal({ ...msg, texto: "Tive febre ontem" }, canalRuleset).achados[0]?.estado).toBe("PENDENTE");
    expect(avaliarRedFlagsCanal(msg, null).achados[0]?.motivo).toContain("[VERIFICAR]");
  });
});

describe("W3 CDX-05 cumulativoAlerta", () => {
  it("positivo: soma efetiva acima do limite fica vermelho", () => {
    const r = avaliarCumulativoAlerta(
      { patientId: "paciente-teste-01", episodioId: "episodio-01", droga: "DOXO", administracoes: [administracaoCompleta("a1", 101)] },
      limiteCumulativo,
    );
    expect(r.total).toBe(101);
    expect(r.achado.estado).toBe("VERMELHO");
  });

  it("negativo: limite ausente fica pendente", () => {
    const r = avaliarCumulativoAlerta(
      { patientId: "paciente-teste-01", episodioId: "episodio-01", droga: "DOXO", administracoes: [] },
      { ...limiteCumulativo, maximo: null },
    );
    expect(r.achado.estado).toBe("PENDENTE");
  });

  it("borda: igual passa e OMITIDA nao soma", () => {
    const r = avaliarCumulativoAlerta(
      {
        patientId: "paciente-teste-01",
        episodioId: "episodio-01",
        droga: "DOXO",
        administracoes: [administracaoCompleta("a1", 100), administracaoOmitida("a2")],
      },
      limiteCumulativo,
    );
    expect(r.total).toBe(100);
    expect(r.achado.estado).toBe("VERDE");
    expect(avaliarCumulativoAlerta({ ...r, administracoes: [] }, null).achado.estado).toBe("PENDENTE");
  });
});

describe("W3 CDX-06 ctcaeGrau", () => {
  it("positivo: retorna candidate_grade, nunca fato", () => {
    const r = avaliarCtcaeGrau({ termo: "toxicidade-fixture", ctcae_version: "v6", medidas: { valor: 3 }, basal: { valor: 1 } }, ctcaeRuleset);
    expect(r.candidate_grade).toBe(3);
    expect(r.achado.motivo).toContain("candidate_grade");
  });

  it("negativo: basal exigido ausente fica pendente", () => {
    const r = avaliarCtcaeGrau({ termo: "toxicidade-fixture", ctcae_version: "v6", medidas: { valor: 3 } }, ctcaeRuleset);
    expect(r.achado.estado).toBe("PENDENTE");
  });

  it("borda: ctcae_version obrigatoria e ruleset vazio pendente", () => {
    expect(avaliarCtcaeGrau({ termo: "toxicidade-fixture", ctcae_version: null, medidas: { valor: 1 } }, ctcaeRuleset).achado.estado).toBe("PENDENTE");
    expect(avaliarCtcaeGrau({ termo: "x", ctcae_version: "v6", medidas: {} }, { ...ctcaeRuleset, termos: [] }).achado.estado).toBe("PENDENTE");
  });
});

describe("W3 CDX-07 recist", () => {
  it("positivo: PR candidata por limiar parametrizado", () => {
    const r = avaliarRecist(
      {
        lesoesAtuais: [{ codigo: "L1", diametroMm: 60, confirmadaPorMedico: true }],
        baseline: [{ codigo: "L1", diametroMm: 100, confirmadaPorMedico: true }],
        nadir: [{ codigo: "L1", diametroMm: 60, confirmadaPorMedico: true }],
      },
      recistRuleset,
    );
    expect(r.candidate_response).toBe("PR");
    expect(r.percentualBaseline).toBe(-40);
  });

  it("negativo: lesao sem confirmacao fica pendente", () => {
    const r = avaliarRecist(
      {
        lesoesAtuais: [{ codigo: "L1", diametroMm: 60, confirmadaPorMedico: false }],
        baseline: [{ codigo: "L1", diametroMm: 100, confirmadaPorMedico: true }],
        nadir: [{ codigo: "L1", diametroMm: 60, confirmadaPorMedico: true }],
      },
      recistRuleset,
    );
    expect(r.achado.estado).toBe("PENDENTE");
  });

  it("borda: limiar ausente pendente e PD por nadir", () => {
    const input = {
      lesoesAtuais: [{ codigo: "L1", diametroMm: 130, confirmadaPorMedico: true }],
      baseline: [{ codigo: "L1", diametroMm: 100, confirmadaPorMedico: true }],
      nadir: [{ codigo: "L1", diametroMm: 100, confirmadaPorMedico: true }],
    };
    expect(avaliarRecist(input, recistRuleset).candidate_response).toBe("PD");
    expect(avaliarRecist(input, { ...recistRuleset, thresholds: {} }).achado.estado).toBe("PENDENTE");
  });
});

describe("W3 CDX-08 escores", () => {
  it("positivo: SOMA declarativa calcula e interpreta", () => {
    const r = avaliarEscore({ scoreId: "SCORE_FIXTURE", entradas: { a: 1, b: 2 } }, scoreRuleset);
    expect(r.valor).toBe(3);
    expect(r.interpretacao).toBe("alto");
  });

  it("negativo: entrada obrigatoria ausente fica pendente", () => {
    expect(avaliarEscore({ scoreId: "SCORE_FIXTURE", entradas: { a: 1 } }, scoreRuleset).achado.estado).toBe("PENDENTE");
  });

  it("borda: PESOS declarativo e ruleset ausente", () => {
    expect(
      avaliarEscore(
        { scoreId: "SCORE_FIXTURE", entradas: { a: 2, b: 3 } },
        { ...scoreRuleset, formula: { tipo: "PESOS", pesos: { a: 2, b: 1 } } },
      ).valor,
    ).toBe(7);
    expect(avaliarEscore({ scoreId: "SCORE_FIXTURE", entradas: { a: 1, b: 1 } }, null).achado.estado).toBe("PENDENTE");
  });
});

describe("W3 CDX-09 intervaloQt", () => {
  it("positivo: devolve ultima administracao efetiva de QT", () => {
    const r = ultimaAdministracaoQtEfetiva([eventoQt("a1", "2026-09-01T10:00:00-03:00"), eventoQt("a2", "2026-10-01T10:00:00-03:00")]);
    expect(r.adminId).toBe("a2");
    expect(r.data).toBe("2026-10-01");
  });

  it("negativo: OMITIDA e ignorada", () => {
    const r = ultimaAdministracaoQtEfetiva([eventoQt("a1", "2026-10-01T10:00:00-03:00", "OMITIDA")]);
    expect(r.data).toBeNull();
    expect(r.inputs_missing).toContain("administracao_qt_efetiva");
  });

  it("borda: PARCIAL conta como efetiva", () => {
    expect(ultimaAdministracaoQtEfetiva([eventoQt("a1", "2026-10-02T10:00:00-03:00", "PARCIAL")]).data).toBe("2026-10-02");
  });
});
