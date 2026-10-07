import { describe, expect, it } from "vitest";
import { avaliarSerieRecist, type RecistAlvoDefinido, type RecistPontoSerie, type RecistSerieInput } from "../../src/rules/recist/index.js";

type AlvoFixture = Pick<RecistAlvoDefinido, "codigo" | "tipo" | "eixo">
  & Partial<Pick<RecistAlvoDefinido, "orgaoId" | "elegibilidadeBasal" | "fonteElegibilidadeIds">>;

function recistPoint(eventId: string, data: string, values: number[], patch: Partial<RecistPontoSerie> = {}): RecistPontoSerie {
  return {
    eventId, patientId: "paciente-teste-01", tumorLotId: "tumor-01", episodioId: "episodio-01", data,
    metodo: "TC", tecnicaId: "tc-5mm-fixo", espessuraCorteMm: 5, qualidadeMedicao: "ADEQUADA",
    lesoes: values.map((diametroMm, i) => ({ codigo: `L${i + 1}`, diametroMm, fonteIds: [`fonte-${eventId}-${i + 1}`] })),
    novasLesoes: false, naoAlvos: "AUSENTE_DOCUMENTADO", fonteIds: [`fonte-${eventId}`], ...patch,
  };
}
function recistInput(pontos: RecistPontoSerie[], alvos: readonly AlvoFixture[] = [
  { codigo: "L1", tipo: "NAO_NODAL", eixo: "MAIOR" },
]): RecistSerieInput {
  return { patientId: "paciente-teste-01", tumorLotId: "tumor-01", episodioId: "episodio-01",
    baselineEventId: "baseline", alvos: alvos.map((alvo) => ({
      ...alvo,
      orgaoId: alvo.orgaoId === undefined ? "orgao-1" : alvo.orgaoId,
      elegibilidadeBasal: alvo.elegibilidadeBasal === undefined ? "ELEGIVEL" : alvo.elegibilidadeBasal,
      fonteElegibilidadeIds: alvo.fonteElegibilidadeIds ?? [`selecao-${alvo.codigo}`],
    })), pontos };
}
function byId(result: ReturnType<typeof avaliarSerieRecist>, id: string) {
  return result.pontos.find((point) => point.eventId === id)!;
}

describe("W10-LUNA4 F07 · série RECIST longitudinal", () => {
  it("usa só nadir histórico até cada ponto, mesmo com input embaralhado e futuro menor", () => {
    const result = avaliarSerieRecist(recistInput([
      recistPoint("futuro", "2026-04-01", [40]),
      recistPoint("atual", "2026-03-01", [101]),
      recistPoint("baseline", "2026-01-01", [100]),
    ]));
    const atual = byId(result, "atual");
    expect(atual.calculo?.nadirEventId).toBe("baseline");
    expect(atual.calculo?.progressaoAlvos).toBeNull();
    expect(atual.avaliacao?.categoria).toBe("DE");
    expect(atual.avaliacao?.revisao).toBe("PROPOSTO");
    expect(atual.categoriaGlobal).toBe("DE");
    expect(atual.estadoCalculo).toBe("CALCULADO");
    expect(atual.estadoInterpretacao).toBe("PROPOSTO");
    expect(result.estado).toBe("CALCULADO");
    expect(result.estadoInterpretacao).toBe("PROPOSTO");

    const prefixo = avaliarSerieRecist(recistInput([
      recistPoint("baseline", "2026-01-01", [100]),
      recistPoint("atual", "2026-03-01", [101]),
    ]));
    const comFuturoInadequado = avaliarSerieRecist(recistInput([
      recistPoint("baseline", "2026-01-01", [100]),
      recistPoint("atual", "2026-03-01", [101]),
      recistPoint("futuro-inadequado", "2026-04-01", [40], { qualidadeMedicao: "INADEQUADA", metodo: "RM" }),
    ]));
    expect(byId(comFuturoInadequado, "atual")).toEqual(byId(prefixo, "atual"));
  });

  it.each([
    [24.5, 29.4, null], // 20% exatos, mas só +4,9 mm
    [30, 35, null], // +5 mm, mas <20%
    [100, 120, "PROPOSTO_PD"], // os dois limiares inclusivos
  ] as const)("exige simultaneamente +20% e +5 mm (%s -> %s)", (baseline, current, expected) => {
    const result = avaliarSerieRecist(recistInput([
      recistPoint("baseline", "2026-01-01", [baseline]),
      recistPoint("atual", "2026-02-01", [current]),
    ]));
    expect(byId(result, "atual").calculo?.progressaoAlvos).toBe(expected);
    expect(byId(result, "atual").calculo?.revisao).toBe("PROPOSTO");
  });

  it("preserva cálculo parcial sem transformar novos achados ausentes em negativo", () => {
    const result = avaliarSerieRecist(recistInput([
      recistPoint("baseline", "2026-01-01", [100]),
      recistPoint("atual", "2026-02-01", [101], { novasLesoes: null, naoAlvos: "NAO_AVALIADO" }),
    ]));
    const atual = byId(result, "atual");
    expect(atual.calculo?.somaMm).toBe(101);
    expect(atual.calculo?.deltaBaselinePct).toBe(1);
    expect(atual.calculo?.progressaoAlvos).toBeNull();
    expect(atual.pendencias).toContain("NOVAS_LESOES_NAO_AVALIADAS");
    expect(atual.pendencias).toContain("NAO_ALVOS_NAO_AVALIADOS");
    expect(atual.categoriaGlobal).toBeNull();
    expect(atual.estadoCalculo).toBe("CALCULADO");
    expect(atual.estadoInterpretacao).toBe("PENDENTE");
  });

  it.each([
    { baseline: 100, atual: 70, esperado: "RP", nodal: false },
    { baseline: 100, atual: 100, esperado: "DE", nodal: false },
    { baseline: 15, atual: 9, esperado: "RC", nodal: true },
  ] as const)("propõe categoria completa $esperado com medida alvo suficiente", (scenario) => {
    const result = avaliarSerieRecist(recistInput([
      recistPoint("baseline", "2026-01-01", [scenario.baseline]),
      recistPoint("atual", "2026-02-01", [scenario.atual]),
    ], [{ codigo: "L1", tipo: scenario.nodal ? "LINFONODO" : "NAO_NODAL",
      eixo: scenario.nodal ? "CURTO" : "MAIOR" }]));
    expect(byId(result, "atual").avaliacao?.categoria).toBe(scenario.esperado);
    expect(byId(result, "atual").avaliacao?.revisao).toBe("PROPOSTO");
  });

  it("reconhece RC com alvo não nodal desaparecido sem dividir pelo nadir atualizado zero", () => {
    const result = avaliarSerieRecist(recistInput([
      recistPoint("baseline", "2026-01-01", [20]),
      recistPoint("atual", "2026-02-01", [0]),
    ]));
    const atual = byId(result, "atual");
    expect(atual.calculo?.nadirMm).toBe(20);
    expect(atual.calculo?.deltaNadirPct).toBe(-100);
    expect(atual.calculo?.novoNadirMm).toBe(0);
    expect(atual.avaliacao?.categoria).toBe("RC");
    expect(atual.avaliacao?.revisao).toBe("PROPOSTO");
  });

  it("reconhece RC com alvo nodal residual abaixo de 10 mm", () => {
    const result = avaliarSerieRecist(recistInput([
      recistPoint("baseline", "2026-01-01", [15]),
      recistPoint("atual", "2026-02-01", [9]),
    ], [{ codigo: "L1", tipo: "LINFONODO", eixo: "CURTO" }]));
    expect(byId(result, "atual").calculo?.somaMm).toBe(9);
    expect(byId(result, "atual").avaliacao?.categoria).toBe("RC");
  });

  it.each([
    { novasLesoes: true, naoAlvos: "PERSISTENTE_SEM_PROGRESSAO" as const },
    { novasLesoes: false, naoAlvos: "PROGRESSAO_INEQUIVOCA" as const },
  ])("propõe PD com evidência explícita de nova lesão ou progressão não alvo", ({ novasLesoes, naoAlvos }) => {
    const result = avaliarSerieRecist(recistInput([
      recistPoint("baseline", "2026-01-01", [100]),
      recistPoint("atual", "2026-02-01", [100], { novasLesoes, naoAlvos }),
    ]));
    expect(byId(result, "atual").avaliacao?.categoria).toBe("PD");
    expect(byId(result, "atual").avaliacao?.revisao).toBe("PROPOSTO");
  });

  it.each([0, Number.NaN, Number.POSITIVE_INFINITY, -1])("não gera percentual/categoria a partir de medida inválida ou zero (%s)", (baseline) => {
    const result = avaliarSerieRecist(recistInput([
      recistPoint("baseline", "2026-01-01", [baseline]),
      recistPoint("atual", "2026-02-01", [120]),
    ]));
    const atual = byId(result, "atual");
    if (baseline === 0) {
      expect(atual.calculo?.deltaBaselinePct).toBeNull();
      expect(atual.calculo?.progressaoAlvos).toBeNull();
      expect(atual.pendencias).toContain("BASELINE_ZERO_SEM_PERCENTUAL");
    } else {
      expect(atual.calculo).toBeNull();
      expect(atual.pendencias).toContain("MEDIDA_INVALIDA");
    }
  });

  it("não usa percentual quando o nadir válido é zero", () => {
    const result = avaliarSerieRecist(recistInput([
      recistPoint("baseline", "2026-01-01", [100]),
      recistPoint("nadir-zero", "2026-02-01", [0]),
      recistPoint("atual", "2026-03-01", [10]),
    ]));
    const atual = byId(result, "atual");
    expect(atual.calculo?.nadirEventId).toBe("nadir-zero");
    expect(atual.calculo?.deltaNadirPct).toBeNull();
    expect(atual.calculo?.progressaoAlvos).toBeNull();
    expect(atual.pendencias).toContain("NADIR_ZERO_SEM_PERCENTUAL");
  });

  it("mantém RC proposta em 20→0→0 com nadir atualizado zero, sem fabricar percentual", () => {
    const result = avaliarSerieRecist(recistInput([
      recistPoint("baseline", "2026-01-01", [20]),
      recistPoint("resposta", "2026-02-01", [0]),
      recistPoint("atual", "2026-03-01", [0]),
    ]));
    const atual = byId(result, "atual");
    expect(atual.calculo?.nadirMm).toBe(0);
    expect(atual.calculo?.deltaNadirPct).toBeNull();
    expect(atual.avaliacao).toBeNull();
    expect(atual.categoriaGlobal).toBe("RC");
    expect(atual.categoriaGlobalRevisao).toBe("PROPOSTO");
    expect(atual.pendencias).toContain("NADIR_ZERO_SEM_PERCENTUAL");
  });

  it("propõe PD por nova lesão mesmo se o nadir anterior zero torna o delta indefinido", () => {
    const result = avaliarSerieRecist(recistInput([
      recistPoint("baseline", "2026-01-01", [20]),
      recistPoint("resposta", "2026-02-01", [0]),
      recistPoint("atual", "2026-03-01", [10], { novasLesoes: true }),
    ]));
    const atual = byId(result, "atual");
    expect(atual.calculo?.deltaNadirPct).toBeNull();
    expect(atual.avaliacao).toBeNull();
    expect(atual.categoriaGlobal).toBe("PD");
    expect(atual.categoriaGlobalRevisao).toBe("PROPOSTO");
    expect(atual.pendencias).toContain("NADIR_ZERO_SEM_PERCENTUAL");
  });

  it("mantém seguimentos pendentes sem lançar quando o baseline não tem todos os alvos válidos", () => {
    const result = avaliarSerieRecist(recistInput([
      recistPoint("baseline", "2026-01-01", []),
      recistPoint("atual", "2026-02-01", [120]),
    ]));
    expect(byId(result, "baseline").pendencias).toContain("ALVO_AUSENTE");
    expect(byId(result, "atual").calculo).toBeNull();
    expect(byId(result, "atual").pendencias).toContain("BASELINE_INVALIDO");

    const invalidMeasure = avaliarSerieRecist(recistInput([
      recistPoint("baseline", "2026-01-01", [Number.NaN]),
      recistPoint("atual", "2026-02-01", [120]),
    ]));
    expect(byId(invalidMeasure, "atual").calculo).toBeNull();
    expect(byId(invalidMeasure, "atual").pendencias).toContain("BASELINE_INVALIDO");
  });

  it("falha fechado quando a soma basal de medidas finitas transborda", () => {
    const input = recistInput([
      recistPoint("baseline", "2026-01-01", [Number.MAX_VALUE, Number.MAX_VALUE]),
      recistPoint("atual", "2026-02-01", [20, 20]),
    ], [
      { codigo: "L1", tipo: "NAO_NODAL", eixo: "MAIOR", orgaoId: "orgao-1" },
      { codigo: "L2", tipo: "NAO_NODAL", eixo: "MAIOR", orgaoId: "orgao-1" },
    ]);
    expect(() => avaliarSerieRecist(input)).not.toThrow();
    const result = avaliarSerieRecist(input);
    expect(byId(result, "baseline").pendencias).toContain("MEDIDA_INVALIDA");
    expect(byId(result, "atual").calculo).toBeNull();
    expect(byId(result, "atual").pendencias).toContain("BASELINE_INVALIDO");
  });

  it("pendura categoria para baseline não elegível, seleção excessiva ou proveniência de elegibilidade vazia", () => {
    const tiny = avaliarSerieRecist(recistInput([
      recistPoint("baseline", "2026-01-01", [1]), recistPoint("atual", "2026-02-01", [0]),
    ]));
    expect(byId(tiny, "atual").calculo?.somaMm).toBe(0);
    expect(byId(tiny, "atual").categoriaGlobal).toBeNull();
    expect(byId(tiny, "atual").pendencias).toContain("MEDIDA_BASAL_INELEGIVEL");

    const sixTargets = Array.from({ length: 6 }, (_, i) => ({ codigo: `L${i + 1}`, tipo: "NAO_NODAL" as const, eixo: "MAIOR" as const }));
    const excess = avaliarSerieRecist(recistInput([
      recistPoint("baseline", "2026-01-01", Array(6).fill(10)),
      recistPoint("atual", "2026-02-01", Array(6).fill(10)),
    ], sixTargets));
    expect(byId(excess, "atual").categoriaGlobal).toBeNull();
    expect(byId(excess, "atual").pendencias).toContain("ALVOS_MAXIMO_EXCEDIDO");
    expect(byId(excess, "atual").pendencias).toContain("ALVOS_ORGAO_MAXIMO_EXCEDIDO");

    const noSource = avaliarSerieRecist(recistInput([
      recistPoint("baseline", "2026-01-01", [20]), recistPoint("atual", "2026-02-01", [0]),
    ], [{ codigo: "L1", tipo: "NAO_NODAL", eixo: "MAIOR", fonteElegibilidadeIds: [] }]));
    expect(byId(noSource, "atual").categoriaGlobal).toBeNull();
    expect(byId(noSource, "atual").pendencias).toContain("FONTE_ELEGIBILIDADE_AUSENTE");
  });

  it("aceita cinco alvos distribuídos até dois por órgão, aplica corte de TC e rejeita nodo <15 mm", () => {
    const validTargets = Array.from({ length: 5 }, (_, i) => ({ codigo: `L${i + 1}`, tipo: "NAO_NODAL" as const,
      eixo: "MAIOR" as const, orgaoId: `orgao-${Math.floor(i / 2) + 1}` }));
    const five = avaliarSerieRecist(recistInput([
      recistPoint("baseline", "2026-01-01", Array(5).fill(10)),
      recistPoint("atual", "2026-02-01", Array(5).fill(10)),
    ], validTargets));
    expect(byId(five, "atual").categoriaGlobal).toBe("DE");

    const thickCut = avaliarSerieRecist(recistInput([
      recistPoint("baseline", "2026-01-01", [20], { espessuraCorteMm: 10 }),
      recistPoint("atual", "2026-02-01", [20], { espessuraCorteMm: 10 }),
    ]));
    expect(byId(thickCut, "atual").categoriaGlobal).toBe("DE");
    const belowThickCut = avaliarSerieRecist(recistInput([
      recistPoint("baseline", "2026-01-01", [19], { espessuraCorteMm: 10 }),
      recistPoint("atual", "2026-02-01", [19], { espessuraCorteMm: 10 }),
    ]));
    expect(byId(belowThickCut, "atual").categoriaGlobal).toBeNull();
    expect(byId(belowThickCut, "atual").pendencias).toContain("MEDIDA_BASAL_INELEGIVEL");

    const smallNode = avaliarSerieRecist(recistInput([
      recistPoint("baseline", "2026-01-01", [9]), recistPoint("atual", "2026-02-01", [0]),
    ], [{ codigo: "L1", tipo: "LINFONODO", eixo: "CURTO" }]));
    expect(byId(smallNode, "atual").categoriaGlobal).toBeNull();
    expect(byId(smallNode, "atual").pendencias).toContain("MEDIDA_BASAL_INELEGIVEL");
  });

  it("não presume elegibilidade, órgão, técnica ou qualidade ausentes", () => {
    const missing = avaliarSerieRecist(recistInput([
      recistPoint("baseline", "2026-01-01", [20]), recistPoint("atual", "2026-02-01", [20]),
    ], [{ codigo: "L1", tipo: "NAO_NODAL", eixo: "MAIOR", orgaoId: null,
      elegibilidadeBasal: null, fonteElegibilidadeIds: [" "] }]));
    expect(byId(missing, "atual").categoriaGlobal).toBeNull();
    expect(byId(missing, "atual").pendencias).toContain("ORGAO_ALVO_AUSENTE");
    expect(byId(missing, "atual").pendencias).toContain("ALVO_ELEGIBILIDADE_AUSENTE");
    expect(byId(missing, "atual").pendencias).toContain("FONTE_ELEGIBILIDADE_AUSENTE");

    const unsupported = avaliarSerieRecist(recistInput([
      recistPoint("baseline", "2026-01-01", [20], { metodo: "RM" }),
      recistPoint("atual", "2026-02-01", [20], { metodo: "RM" }),
    ]));
    expect(byId(unsupported, "atual").categoriaGlobal).toBeNull();
    expect(byId(unsupported, "atual").pendencias).toContain("METODO_NAO_SUPORTADO");

    const badQuality = avaliarSerieRecist(recistInput([
      recistPoint("baseline", "2026-01-01", [20], { qualidadeMedicao: "NAO_AVALIADA" }),
      recistPoint("atual", "2026-02-01", [20]),
    ]));
    expect(byId(badQuality, "atual").categoriaGlobal).toBeNull();
    expect(byId(badQuality, "atual").pendencias).toContain("QUALIDADE_MEDICAO_PENDENTE");
  });

  it("mantém baseline e conjuntos de alvo explícitos; ausência, duplicidade e conflito temporal pendem", () => {
    const baseline = recistPoint("baseline", "2026-01-01", [40, 60]);
    const atualSemAlvo = recistPoint("atual", "2026-02-01", [40]);
    const result = avaliarSerieRecist(recistInput([baseline, atualSemAlvo], [
      { codigo: "L1", tipo: "NAO_NODAL", eixo: "MAIOR" },
      { codigo: "L2", tipo: "LINFONODO", eixo: "CURTO" },
    ]));
    expect(byId(result, "atual").calculo).toBeNull();
    expect(byId(result, "atual").pendencias).toContain("ALVO_AUSENTE");

    const duplicate = recistPoint("dup", "2026-02-01", [20, 30], {
      lesoes: [
        { codigo: "L1", diametroMm: 20, fonteIds: ["f1"] },
        { codigo: "L1", diametroMm: 30, fonteIds: ["f2"] },
      ],
    });
    const duplicateResult = avaliarSerieRecist(recistInput([baseline, duplicate], [
      { codigo: "L1", tipo: "NAO_NODAL", eixo: "MAIOR" },
      { codigo: "L2", tipo: "LINFONODO", eixo: "CURTO" },
    ]));
    expect(byId(duplicateResult, "dup").pendencias).toContain("ALVO_DUPLICADO");

    const dateConflict = avaliarSerieRecist(recistInput([
      baseline, recistPoint("same-day", "2026-01-01", [90]),
    ]));
    expect(dateConflict.pendencias).toContain("CONFLITO_TEMPORAL");

    const duplicateEvent = avaliarSerieRecist(recistInput([
      baseline, recistPoint("baseline", "2026-02-01", [90]),
    ]));
    expect(duplicateEvent.pendencias).toContain("EVENTO_DUPLICADO");
  });

  it("preserva fontes e rejeita série de outra identidade ou episódio", () => {
    const baseline = recistPoint("baseline", "2026-01-01", [100]);
    const wrong = recistPoint("wrong", "2026-02-01", [120], { episodioId: "outro-episodio" });
    const result = avaliarSerieRecist(recistInput([baseline, wrong]));
    expect(result.estado).toBe("PENDENTE");
    expect(result.pendencias).toContain("IDENTIDADE_OU_EPISODIO_DIVERGENTE");

    const good = avaliarSerieRecist(recistInput([baseline, recistPoint("atual", "2026-02-01", [120])]));
    expect(byId(good, "atual").calculo?.fonteIds).toEqual(["fonte-atual"]);
    expect(byId(good, "atual").calculo?.lesoes[0]?.fonteIds).toEqual(["fonte-atual-1"]);
  });

  it("exige eixo curto para alvo nodal e proveniência mensurável", () => {
    const invalidAxis = avaliarSerieRecist(recistInput([
      recistPoint("baseline", "2026-01-01", [40]),
    ], [{ codigo: "L1", tipo: "LINFONODO", eixo: "MAIOR" }]));
    expect(invalidAxis.pendencias).toContain("ALVOS_INVALIDOS");

    const missingSource = avaliarSerieRecist(recistInput([
      recistPoint("baseline", "2026-01-01", [40], { fonteIds: [] }),
    ]));
    expect(byId(missingSource, "baseline").pendencias).toContain("PROVENIENCIA_AUSENTE");
  });
});
