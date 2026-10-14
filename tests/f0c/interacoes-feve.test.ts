import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { semaforoInteracoes } from "../../src/rules/semaforoInteracoes.js";
import { avaliarInteracaoMedicamentosa } from "../../src/rules/w8/interacoes.js";
import { alertarFeve, lerAlertaFeve } from "../../src/rules/alertaFeve.js";
import type { CatalogoInteracoes } from "../../src/contracts/f0c/interacoes.js";

const corpus = JSON.parse(readFileSync("corpus/rulesets/interacoes.v1.json", "utf8"));
const catalogo: CatalogoInteracoes = JSON.parse(readFileSync("corpus/f0c/classes-farmacos.v1.json", "utf8"));
const fonte = { referencia: "fonte sintética do teste", trecho: "evidência sintética" };
const regra = { drogaA: "capecitabina", drogaBouClasse: "antagonista da vitamina K", ativo: true, fonte };

describe("F0-COMPLEMENTO: identidade explícita, fonte e cobertura das interações", () => {
  it("par curado fica vermelho nas duas APIs e na ordem inversa", () => {
    expect(semaforoInteracoes({ medicamentos: ["warfarin", "CAPECITABINA"] }, corpus, catalogo).estado).toBe("VERMELHO");
    expect(avaliarInteracaoMedicamentosa("warfarin", "capecitabine", corpus, catalogo).estado).toBe("VERMELHO");
    expect(corpus.interacoes.filter((r: { ativo: boolean }) => r.ativo)).toHaveLength(8);
  });
  it("classe só casa com membro explicitamente registrado", () => {
    expect(semaforoInteracoes({ medicamentos: ["capecitabina", "varfarina"] }, { interacoes: [regra] }, catalogo).estado).toBe("VERMELHO");
    expect(avaliarInteracaoMedicamentosa("varfarina", "capecitabina", { interacoes: [regra] }, catalogo).estado).toBe("VERMELHO");
    expect(avaliarInteracaoMedicamentosa("varfarina", "capecitabina", { interacoes: [regra] }).estado).toBe("PENDENTE");
    expect(avaliarInteracaoMedicamentosa("desconhecida", "capecitabina", { interacoes: [regra] }, catalogo).estado).toBe("PENDENTE");
  });
  it.each(["cape", "não usa capecitabina", "capecitabina 500 mg", "xcapecitabina"])("não infere identidade por substring: %s", (nome) => {
    expect(avaliarInteracaoMedicamentosa(nome, "varfarina", corpus, catalogo).estado).toBe("PENDENTE");
    expect(semaforoInteracoes({ medicamentos: [nome, "varfarina"] }, corpus, catalogo).estado).toBe("PENDENTE");
  });
  it("alias ambíguo não identifica droga", () => {
    const ambiguo = { ...catalogo, aliases: { a: ["ambíguo"], b: ["ambíguo"] } };
    expect(avaliarInteracaoMedicamentosa("ambíguo", "varfarina", corpus, ambiguo).estado).toBe("PENDENTE");
  });
  it.each([
    { referencia: "[VERIFICAR]", trecho: "texto" },
    { referencia: "referência", trecho: "" },
    { referencia: "referência", trecho: "[VERIFICAR]" },
  ])("fonte insuficiente não ativa regra em nenhuma API: %j", (f) => {
    const rs = { interacoes: [{ ...regra, fonte: f }] };
    expect(avaliarInteracaoMedicamentosa("capecitabina", "varfarina", rs, catalogo).estado).toBe("PENDENTE");
    expect(semaforoInteracoes({ medicamentos: ["capecitabina", "varfarina"] }, rs, catalogo).estado).toBe("PENDENTE");
  });
  it("semente inativa não esconde regra curada posterior", () => {
    const rs = { interacoes: [{ ...regra, ativo: false }, regra] };
    expect(avaliarInteracaoMedicamentosa("capecitabina", "varfarina", rs, catalogo).estado).toBe("VERMELHO");
  });
  it("verde exige todas as drogas e pares documentados, sem apagar achado vermelho", () => {
    const cobertura = { medicamentos: ["a", "b"], pares: [{ drogaA: "a", drogaB: "b" }], fonte: "revisão médica documentada" };
    expect(semaforoInteracoes({ medicamentos: ["a", "b"], checagemCompleta: true }, corpus).estado).toBe("PENDENTE");
    expect(semaforoInteracoes({ medicamentos: ["a", "b"], checagemCompleta: true, cobertura }, corpus).estado).toBe("VERDE");
    expect(semaforoInteracoes({ medicamentos: ["a", "b", "c"], checagemCompleta: true, cobertura }, corpus).estado).toBe("PENDENTE");
    expect(semaforoInteracoes({ medicamentos: ["a", "b"], checagemCompleta: true, cobertura: { ...cobertura, pares: [] } }, corpus).estado).toBe("PENDENTE");
    expect(semaforoInteracoes({ medicamentos: ["capecitabina", "varfarina"], checagemCompleta: true,
      cobertura: { medicamentos: ["capecitabina", "varfarina"], pares: [{ drogaA: "capecitabina", drogaB: "varfarina" }], fonte: "revisão" } }, corpus).estado).toBe("VERMELHO");
  });
});

describe("F0-COMPLEMENTO: FEVE inválida e pendências documentais", () => {
  const rs = lerAlertaFeve(JSON.parse(readFileSync("corpus/rulesets/salao-feve.v1.json", "utf8")));
  const programados = [{ nome: "doxorrubicina", classe: null }];
  it.each([0, null, -1, NaN, 101])("%s não apaga pendências de data e método", (percentual) => {
    const r = alertarFeve({ feve: { percentual, metodo: null, data: null }, programados }, rs);
    expect(r.estado).toBe("PENDENTE");
    expect(r.percentual).toBeNull();
    expect(r.pendentes.map((p) => p.codigo)).toContain("pendente.feve.metodo");
    expect(r.pendentes.map((p) => p.codigo)).toContain("pendente.feve.data");
  });
  it.each([50, 60])("%s sem data/método fica pendente mesmo acima do corte", (percentual) => {
    const r = alertarFeve({ feve: { percentual, metodo: null, data: null }, programados }, rs);
    expect(r.estado).toBe("PENDENTE");
    expect(r.pendentes).toHaveLength(2);
  });
  it("data futura não libera FEVE nem apaga a pendência", () => {
    const r = alertarFeve({ hoje: "2026-10-10", feve: { percentual: 60, metodo: "ECO", data: "2026-10-11" }, programados }, rs);
    expect(r.estado).toBe("PENDENTE");
    expect(r.percentual).toBeNull();
    expect(r.pendentes.map((p) => p.codigo)).toContain("pendente.feve.dataInvalida");
    expect(alertarFeve({ hoje: "2026-10-10", feve: { percentual: 60, metodo: "ECO", data: null }, programados }, rs).pendentes
      .map((p) => p.codigo)).toContain("pendente.feve.data");
  });
  it("FEVE baixa mantém alerta e pendências; sem classe aplicável não exige FEVE", () => {
    const feve = { percentual: 49, metodo: null, data: null };
    expect(alertarFeve({ feve, programados }, rs)).toMatchObject({ estado: "ALERTA", pendentes: expect.any(Array) });
    expect(alertarFeve({ feve, programados: [{ nome: "capecitabina", classe: null }] }, rs)).toMatchObject({ estado: "SEM_ALERTA", pendentes: [] });
  });
});
