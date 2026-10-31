import { describe, expect, it } from "vitest";
import { EstadoCampoRevisao, TelaRevisaoConsulta } from "../../src/contracts/fase2/revisaoClinica.js";
import { montarTelaRevisao } from "../../src/modules/consulta/telaRevisao.js";

function estados(valor: unknown, achados: string[] = []): string[] {
  if (!valor || typeof valor !== "object") return achados;
  if ("estado" in valor && typeof valor.estado === "string") achados.push(valor.estado);
  for (const item of Object.values(valor)) {
    if (Array.isArray(item)) item.forEach((i) => estados(i, achados));
    else if (item && typeof item === "object") estados(item, achados);
  }
  return achados;
}

describe("contrato da revisão da consulta", () => {
  it("não aceita estado fora do enum e não completa campo omitido", () => {
    const tela = montarTelaRevisao({});
    expect(TelaRevisaoConsulta.safeParse({ ...tela, identidade: { ...tela.identidade, cirurgia: { ...tela.identidade.cirurgia, estado: "PENDENTE" } } }).success).toBe(false);
    expect(estados(tela).every((e) => EstadoCampoRevisao.safeParse(e).success)).toBe(true);
    expect(tela.identidade.intencao).toEqual({ estado: "NAO_INFORMADO", bloqueiaLiberacao: true, valor: null });
    expect(tela.aptidaoHoje.ecog.estado).toBe("NAO_INFORMADO");
    expect(tela.fechamento.respostaDoenca.estado).toBe("NAO_INFORMADO");
    expect(tela.aptidaoHoje.toxicidadeAnterior.estado).toBe("NAO_INFORMADO");
  });

  it("separa ECOG, resposta e toxicidade; grau 3 bloqueia e grau 2 não", () => {
    const tela = montarTelaRevisao({
      ecog: { estado: "INFORMADO", valor: 1 },
      resposta: { estado: "INFORMADO", valor: { criterio: "RECIST", dataReavaliacao: "2026-10-01" } },
      toxicidade: { estado: "INFORMADO", valor: { grauMaximo: 2, ajusteDose: "nenhum" } },
    });
    expect(tela.aptidaoHoje.ecog).toMatchObject({ estado: "INFORMADO", valor: 1, bloqueiaLiberacao: false });
    expect(tela.fechamento.respostaDoenca.valor).toEqual({ criterio: "RECIST", dataReavaliacao: "2026-10-01" });
    expect(tela.aptidaoHoje.toxicidadeAnterior.bloqueiaLiberacao).toBe(false);
    const grave = montarTelaRevisao({ toxicidade: { estado: "INFORMADO", valor: { grauMaximo: 3, ajusteDose: "reducao" } } });
    expect(grave.aptidaoHoje.toxicidadeAnterior.bloqueiaLiberacao).toBe(true);
  });

  it("calcula SC e ClCr e não aceita superfície digitada", () => {
    const tela = montarTelaRevisao({
      pesoKg: { estado: "INFORMADO", valor: 70 },
      alturaCm: { estado: "INFORMADO", valor: 170 },
      idadeAnos: { estado: "INFORMADO", valor: 60 },
      sexoFormula: { estado: "INFORMADO", valor: "MASCULINO" },
      creatininaMgDl: { estado: "INFORMADO", valor: 1 },
      fontePeso: "balança",
      fonteCreatinina: "laboratório",
    });
    expect(tela.aptidaoHoje.antropometria.sc).toMatchObject({ estado: "INFORMADO", origem: "CALCULADA", valor: 1.82, bloqueiaLiberacao: false });
    expect(tela.aptidaoHoje.antropometria.clcr.origem).toBe("CALCULADO");
    expect(tela.aptidaoHoje.antropometria.clcr.valor).toBeCloseTo(77.777, 2);
    const semFonte = montarTelaRevisao({
      pesoKg: { estado: "INFORMADO", valor: 70 }, alturaCm: { estado: "INFORMADO", valor: 170 },
      idadeAnos: { estado: "INFORMADO", valor: 60 }, sexoFormula: { estado: "INFORMADO", valor: "MASCULINO" },
      creatininaMgDl: { estado: "INFORMADO", valor: 1 },
    });
    expect(semFonte.aptidaoHoje.antropometria.clcr.estado).toBe("NAO_INFORMADO");
    expect(semFonte.aptidaoHoje.antropometria.clcr.valor).toBeNull();
  });

  it("variação de peso de 10% ou mais pede recálculo", () => {
    const tela = montarTelaRevisao({
      pesoKg: { estado: "INFORMADO", valor: 70 },
      pesoAnteriorKg: { estado: "INFORMADO", valor: 80 },
    });
    expect(tela.aptidaoHoje.antropometria.variacaoPesoPct.alertaRecalculo).toBe(true);
    expect(tela.aptidaoHoje.antropometria.variacaoPesoPct.bloqueiaLiberacao).toBe(true);
    expect(tela.aptidaoHoje.antropometria.variacaoPesoPct.valor).toBeCloseTo(-12.5, 5);
    const estavel = montarTelaRevisao({ pesoKg: { estado: "INFORMADO", valor: 78 }, pesoAnteriorKg: { estado: "INFORMADO", valor: 80 } });
    expect(estavel.aptidaoHoje.antropometria.variacaoPesoPct.alertaRecalculo).toBe(false);
  });

  it("cirurgia não realizada não é cirurgia não informada", () => {
    const naoRealizada = montarTelaRevisao({ cirurgia: { estado: "AUSENTE_CONFIRMADO" } });
    const naoInformada = montarTelaRevisao({});
    expect(naoRealizada.identidade.cirurgia.estado).toBe("AUSENTE_CONFIRMADO");
    expect(naoInformada.identidade.cirurgia.estado).toBe("NAO_INFORMADO");
    expect(naoRealizada.identidade.cirurgia.valor).toBeNull();
    expect(naoInformada.identidade.cirurgia.valor).toBeNull();
    expect(naoRealizada.identidade.cirurgia.estado).not.toBe(naoInformada.identidade.cirurgia.estado);
  });

  it("laboratório fora da janela volta a não informado e biomarcador exigido pelo esquema bloqueia", () => {
    const tela = montarTelaRevisao({
      hoje: "2026-10-31",
      janelaLabDias: 7,
      labs: [{ exame: "Hemograma", valor: "Hb 10", data: "2026-10-01" }],
      dependenciasBiomarcador: ["EGFR"],
    });
    expect(tela.aptidaoHoje.labPreCiclo.itens[0]).toMatchObject({ estado: "NAO_INFORMADO", valor: null, bloqueiaLiberacao: true });
    expect(tela.identidade.biomarcadores.itens).toEqual([
      { nome: "EGFR", estado: "NAO_INFORMADO", bloqueiaLiberacao: true, resultado: null, data: null },
    ]);
    const dentro = montarTelaRevisao({
      hoje: "2026-10-31", janelaLabDias: 7,
      labs: [{ exame: "Hemograma", valor: "Hb 10", data: "2026-10-30" }],
    });
    expect(dentro.aptidaoHoje.labPreCiclo.estado).toBe("INFORMADO");
    expect(dentro.aptidaoHoje.labPreCiclo.bloqueiaLiberacao).toBe(false);
  });
});
