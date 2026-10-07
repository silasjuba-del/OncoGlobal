import { describe, expect, it } from "vitest";
import { avaliarSerieRecist, type RecistPontoSerie, type RecistSerieInput } from "../../src/rules/recist/index.js";

function recistPoint(eventId: string, data: string, values: number[], patch: Partial<RecistPontoSerie> = {}): RecistPontoSerie {
  return {
    eventId, patientId: "paciente-teste-01", tumorLotId: "tumor-01", episodioId: "episodio-01", data,
    lesoes: values.map((diametroMm, i) => ({ codigo: `L${i + 1}`, diametroMm, fonteIds: [`fonte-${eventId}-${i + 1}`] })),
    novasLesoes: false, naoAlvos: "AUSENTE_DOCUMENTADO", fonteIds: [`fonte-${eventId}`], ...patch,
  };
}
function recistInput(pontos: RecistPontoSerie[], alvos: RecistSerieInput["alvos"] = [
  { codigo: "L1", tipo: "NAO_NODAL", eixo: "MAIOR" },
]): RecistSerieInput {
  return { patientId: "paciente-teste-01", tumorLotId: "tumor-01", episodioId: "episodio-01",
    baselineEventId: "baseline", alvos, pontos };
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
