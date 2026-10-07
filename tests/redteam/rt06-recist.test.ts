// RT-06 · RECIST e medidas (S1) — provas de DEFESA: a categoria nasce como CANDIDATA
// (candidate_response com achado PENDENTE), o cálculo é por código (BigInt, sem flutuação),
// recusa onde o ruleset manda recusar; lesão-alvo divergente e falta de confirmação recusam.
import { describe, expect, it } from "vitest";
import { avaliarRecist } from "../../src/rules/recist.js";
import type { LesaoRecist, RecistRuleset } from "../../src/rules/tipos-w3.js";

const rs: RecistRuleset = {
  id: "recist", versao: "1.0.0", ativo: true, regraId: "RECIST-1.1",
  thresholds: { prPercent: -30, pdPercent: 20, pdAbsoluteMm: 5 },
};

const lesao = (codigo: string, diametroMm: number, confirmadaPorMedico = true): LesaoRecist =>
  ({ codigo, diametroMm, confirmadaPorMedico });

describe("RT-06 · RECIST: categoria candidata calculada por código", () => {
  it("PR: −35% sobre baseline vira candidata PR com achado PENDENTE (nunca confirmado)", () => {
    const saida = avaliarRecist(
      { lesoesAtuais: [lesao("L1", 65)], baseline: [lesao("L1", 100)], nadir: [lesao("L1", 100)] }, rs);
    expect(saida.candidate_response).toBe("PR");
    expect(saida.achado.estado).toBe("PENDENTE");
    expect(saida.achado.motivo).toContain("candidata");
  });

  it("PD exige os DOIS critérios: +30% sobre o nadir com só 3 mm absolutos fica SD", () => {
    const saida = avaliarRecist(
      { lesoesAtuais: [lesao("L1", 13)], baseline: [lesao("L1", 15)], nadir: [lesao("L1", 10)] }, rs);
    expect(saida.candidate_response).toBe("SD");
    expect(saida.percentualNadir).toBeCloseTo(30);
  });

  it("PD: +60% E ≥5 mm sobre o nadir vira PD (sem PR concomitante)", () => {
    const saida = avaliarRecist(
      { lesoesAtuais: [lesao("L1", 16)], baseline: [lesao("L1", 16)], nadir: [lesao("L1", 10)] }, rs);
    expect(saida.candidate_response).toBe("PD");
    expect(saida.somaNadirMm).toBe(10);
  });

  it("nadir errado (usar baseline como nadir) mascara PD: código usa o nadir fornecido e exige consistência", () => {
    const correta = avaliarRecist(
      { lesoesAtuais: [lesao("L1", 60)], baseline: [lesao("L1", 65)], nadir: [lesao("L1", 50)] }, rs);
    const mascarada = avaliarRecist(
      { lesoesAtuais: [lesao("L1", 60)], baseline: [lesao("L1", 65)], nadir: [lesao("L1", 65)] }, rs);
    expect(correta.candidate_response).toBe("PD");
    expect(mascarada.candidate_response).toBe("SD"); // prova que o resultado depende do nadir dado
  });

  it("nadir maior que baseline recusa (PENDENTE 'somas ou nadir inconsistentes')", () => {
    const saida = avaliarRecist(
      { lesoesAtuais: [lesao("L1", 65)], baseline: [lesao("L1", 50)], nadir: [lesao("L1", 100)] }, rs);
    expect(saida.candidate_response).toBeNull();
    expect(saida.achado.motivo).toContain("nadir inconsistentes");
  });

  it("lesão-alvo trocada entre exames (A,B → A,C) recusa com motivo explícito", () => {
    const saida = avaliarRecist({
      lesoesAtuais: [lesao("A", 30), lesao("C", 20)],
      baseline: [lesao("A", 30), lesao("B", 20)],
      nadir: [lesao("A", 30), lesao("B", 20)],
    }, rs);
    expect(saida.candidate_response).toBeNull();
    expect(saida.achado.motivo).toContain("conjunto de lesoes-alvo divergente");
  });

  it("sem confirmação médica em qualquer série recusa (categoria nunca nasce de medida solta)", () => {
    const saida = avaliarRecist(
      { lesoesAtuais: [lesao("L1", 65, false)], baseline: [lesao("L1", 100)], nadir: [lesao("L1", 100)] }, rs);
    expect(saida.candidate_response).toBeNull();
    expect(saida.achado.motivo).toContain("sem confirmacao medica");
  });

  it("CR: soma zero vira candidata CR (nunca promovida a fato)", () => {
    const saida = avaliarRecist(
      { lesoesAtuais: [lesao("L1", 0)], baseline: [lesao("L1", 10)], nadir: [lesao("L1", 5)] }, rs);
    expect(saida.candidate_response).toBe("CR");
    expect(saida.achado.estado).toBe("PENDENTE");
  });

  it.each([
    ["diametro inválido (NaN)", { lesoesAtuais: [lesao("L1", Number.NaN)], baseline: [lesao("L1", 10)], nadir: [lesao("L1", 10)] }, "lesoes ausentes, invalidas ou duplicadas"],
    ["código duplicado", { lesoesAtuais: [lesao("L1", 12), lesao("L1", 12)], baseline: [lesao("L1", 10)], nadir: [lesao("L1", 10)] }, "lesoes ausentes, invalidas ou duplicadas"],
    ["sem lesões", { lesoesAtuais: [], baseline: [], nadir: [] }, "lesoes ausentes, invalidas ou duplicadas"],
  ])("%s ⇒ PENDENTE, nunca SD silencioso", (_nome, entrada, motivo) => {
    const saida = avaliarRecist(entrada, rs);
    expect(saida.candidate_response).toBeNull();
    expect(saida.achado.motivo).toContain(motivo);
  });

  it("ruleset inativo ou sem limiares recusa (PENDENTE 'regra não ativa')", () => {
    const inativo = avaliarRecist(
      { lesoesAtuais: [lesao("L1", 12)], baseline: [lesao("L1", 10)], nadir: [lesao("L1", 10)] },
      { ...rs, ativo: false });
    expect(inativo.achado.motivo).toContain("regra não ativa");
    const semLimiares = avaliarRecist(
      { lesoesAtuais: [lesao("L1", 12)], baseline: [lesao("L1", 10)], nadir: [lesao("L1", 10)] },
      { ...rs, thresholds: {} });
    expect(semLimiares.candidate_response).toBeNull();
  });
});
