import { describe, expect, it } from "vitest";
import type { ClinicalFact } from "../../src/kernel/extracao/tipos.js";
import {
  classificarMetastaseVisceral, excecoesProgressao, regraProgressaoIntervalar, seriesDeImagem,
} from "../../src/kernel/projections/radiologia.js";

let sequencia = 0;
function imagem(over: {
  value: Record<string, unknown>; date?: string; rawEvidence?: string; sourceId?: string;
}): ClinicalFact {
  sequencia += 1;
  return {
    id: `img-${sequencia}`, segmentId: "seg-1", patientCandidateId: null, domain: "imaging",
    sourceType: "imaging_report", evidence: "EXPLICIT", sourceId: over.sourceId ?? "fonte-img",
    rawEvidence: over.rawEvidence ?? "foco em L5", confidence: 1, requiresConfirmation: false,
    ...(over.date === undefined ? {} : { date: over.date }),
    value: over.value,
  };
}

describe("FUGU-11a · séries de imagem por sítio", () => {
  it("agrupa o mesmo sítio, ordena por data e preserva lateralidade e comparação declarada", () => {
    const serie = seriesDeImagem([
      imagem({
        date: "19/08/29", sourceId: "fonte-A",
        rawEvidence: "19/08/29 - Cintilografia ossea: foco de hipercaptacao em L5 a esquerda, aumentado em relacao a CO de 14/05/28",
        value: { siteRaw: "L5", sitioCanonico: null, lateralidade: "ESQUERDO", measureMm: null, metodo: "CINTILOGRAFIA", comparacao: { tipo: "AUMENTO", refData: "14/05/28" } },
      }),
      imagem({
        date: "14/05/28", sourceId: "fonte-B",
        rawEvidence: "14/05/28 - L5: foco previo",
        value: { siteRaw: "L5", sitioCanonico: null, lateralidade: null, measureMm: null, metodo: "CINTILOGRAFIA", comparacao: null },
      }),
    ]);
    expect(serie).toHaveLength(1);
    expect(serie[0]!.sitio).toBe("L5");
    expect(serie[0]!.lateralidade).toBe("ESQUERDO");
    expect(serie[0]!.pontos.map((p) => p.data)).toEqual(["2028-05-14", "2029-08-19"]);
    expect(serie[0]!.pontos[1]!.comparacao).toEqual({ tipo: "AUMENTO", refData: "2028-05-14" });
  });

  it("sítios diferentes não são fundidos e sítio não reconhecido é ignorado", () => {
    const series = seriesDeImagem([
      imagem({ value: { sitioCanonico: "mama", measureMm: 12 } }),
      imagem({ value: { sitioCanonico: "pulmao", measureMm: 8 } }),
      imagem({ value: { siteRaw: null, sitioCanonico: null } }),
    ]);
    expect(series.map((s) => s.sitio)).toEqual(["mama", "pulmao"]);
  });
});

describe("FUGU-11a · porta INTERVAL_PROGRESSION (dublê de D-W9-43)", () => {
  const avaliar = (over: Partial<Parameters<typeof regraProgressaoIntervalar.avaliar>[0]>) =>
    regraProgressaoIntervalar.avaliar({
      sitio: "L5", metodoAnterior: "CINTILOGRAFIA", metodoAtual: "CINTILOGRAFIA",
      anteriorMm: 10, atualMm: 14, aumentoDeclarado: false, ...over,
    });

  it("mesmo sítio + mesmo método + aumento ⇒ ALERTA, nunca metástase automática", () => {
    const veredito = avaliar({});
    expect(veredito.decisao).toBe("ALERTA");
    expect(veredito.regra).toBe("D-W9-43");
    expect(veredito.motivo).toContain("nunca metástase automática");
  });

  it("aumento declarado pela fonte também eleva suspeição", () => {
    expect(avaliar({ anteriorMm: null, atualMm: null, aumentoDeclarado: true }).decisao).toBe("ALERTA");
  });

  it("método diferente, medida ausente e ausência de aumento não disparam alerta", () => {
    expect(avaliar({ metodoAtual: "RM" }).decisao).toBe("PENDENTE");
    expect(avaliar({ anteriorMm: null }).decisao).toBe("PENDENTE");
    expect(avaliar({ atualMm: 10 }).decisao).toBe("PASSA");
    expect(avaliar({ atualMm: 8 }).decisao).toBe("PASSA");
  });

  it("gera exceção INTERVAL_PROGRESSION com as origens da série", () => {
    const series = seriesDeImagem([
      imagem({ date: "14/05/28", sourceId: "fonte-A", value: { sitioCanonico: "coluna", siteRaw: "L5", measureMm: 10, metodo: "CINTILOGRAFIA" } }),
      imagem({ date: "19/08/29", sourceId: "fonte-A", value: { sitioCanonico: "coluna", siteRaw: "L5", measureMm: 14, metodo: "CINTILOGRAFIA" } }),
    ]);
    const excecoes = excecoesProgressao(series);
    expect(excecoes).toHaveLength(1);
    expect(excecoes[0]!.kind).toBe("INTERVAL_PROGRESSION");
    expect(excecoes[0]!.factIds).toHaveLength(2);
    expect(excecoes[0]!.sourceIds).toEqual(["fonte-A"]);
  });
});

describe("FUGU-11a · M1 visceral nunca vira M0", () => {
  it("sem exames reconhecidos é INDETERMINADO; série estável é SEM_M1_VISIVEL com escopo", () => {
    expect(classificarMetastaseVisceral([]).estado).toBe("INDETERMINADO");
    const estavel = seriesDeImagem([
      imagem({ date: "01/01/29", value: { sitioCanonico: "mama", measureMm: 12 } }),
      imagem({ date: "01/03/29", value: { sitioCanonico: "mama", measureMm: 12 } }),
    ]);
    const veredito = classificarMetastaseVisceral(estavel);
    expect(veredito.estado).toBe("SEM_M1_VISIVEL");
    expect(veredito.escopo).toBe("exames apresentados");
    expect(veredito.motivo).toContain("≠ M0");
    expect(JSON.stringify(veredito)).not.toContain("\"M0\"");
  });

  it("crescimento seriado é SUSPEITO (indeterminado), não metástase", () => {
    const crescente = seriesDeImagem([
      imagem({ date: "01/01/29", value: { sitioCanonico: "coluna", measureMm: 10 } }),
      imagem({ date: "01/03/29", value: { sitioCanonico: "coluna", measureMm: 18 } }),
    ]);
    const veredito = classificarMetastaseVisceral(crescente);
    expect(veredito.estado).toBe("SUSPEITO");
    expect(veredito.motivo).toContain("não classificar como metástase");
  });
});