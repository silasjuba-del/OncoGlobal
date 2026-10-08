// W11-H20 · Suíte adversarial da APAC (página 1/2, gates AG-13…AG-18, check-in, render). Só dados sintéticos.
// Cada caso é de borda ou malícia; o objetivo é achar o que quebra, não confirmar o caminho feliz.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { antiglosa, gatesCoerencia, type ContextoAntiglosa, type RegraCidSexo } from "../../src/apac/antiglosa.js";
import {
  aplicarIdentificacaoCheckin, lerIdentificacaoCheckin, lerCampo, type CadastroCheckin, type EntradaIbge,
} from "../../src/apac/campos.js";
import { BLOCOS_COMPLEMENTARES, CAMPOS_COMPLEMENTARES, preencherLaudo } from "../../src/apac/laudo.js";
import { montarTabelaSigtap } from "../../src/apac/sigtap.js";
import { renderizarApacComplementar, renderizarApacLaudo, type TemplateApac } from "../../src/impressao/apacLaudo.js";
import { apac, CAIXAS, COD_QT, COD_ZERO, proc, CNS_OK, CNS_RUIM } from "../apac-w10/helpers.js";

const RAIZ = process.cwd();
const regrasCidSexo = (JSON.parse(
  readFileSync(resolve(RAIZ, "corpus/rulesets/apac-cid-sexo.v1.json"), "utf8"),
) as { regras: RegraCidSexo[] }).regras;
const TABELA_IBGE: EntradaIbge[] = (JSON.parse(
  readFileSync(resolve(RAIZ, "corpus/regulatorio/municipios-ibge-pb.v1.json"), "utf8"),
) as { municipios: { nome: string; codigoIbge: string }[] }).municipios.map((m) => ({ nome: m.nome, uf: "PB", codigoIbge: m.codigoIbge }));
const TEMPLATE: TemplateApac = JSON.parse(readFileSync(resolve(RAIZ, "corpus/templates/kit/apac-laudo.v1.json"), "utf8"));

const sigtap = { "2026-09": montarTabelaSigtap("2026-09", [proc(), proc({ codigo: COD_ZERO, nome: "CONSULTA SINTETICA" })]) };
const ctx = (o: Partial<ContextoAntiglosa> = {}): ContextoAntiglosa => ({
  hoje: "2026-09-11", sigtap, caixas: CAIXAS, cnesConfigurado: "2605473", ...o,
});
const ctxGates = (o: Partial<ContextoAntiglosa> = {}): ContextoAntiglosa =>
  ctx({ regrasCidSexo, codigosSigtapLocal: new Set([COD_QT]), esquemaVigente: "Carboplatina + paclitaxel AUC 2", ...o });
const achadosGate = (campos: Record<string, unknown>, id: string, o: Partial<ContextoAntiglosa> = {}) =>
  gatesCoerencia(apac("adv", campos), ctxGates(o)).filter((a) => a.regraId === id);

// Cadastro sintético de check-in confirmado (base para os casos de identificação).
function cadastro(over: Partial<CadastroCheckin> = {}): CadastroCheckin {
  return {
    revisao: "CONFIRMADO", prontuario: "PRONT-SINT-9", cns: CNS_OK, nome: "Paciente Sintetico Adv", nascimento: "1960-05-10",
    sexo: "F", racaCor: "PARDA", etnia: null, mae: "Mae Sintetica", telefones: ["(00) 90000-0009"],
    responsavel: null, endereco: "Rua Sintetica, 0", municipio: "JOAO PESSOA", uf: "PB", cep: "58010-000", ...over,
  };
}

describe("APAC adversarial · CID com formatação não canônica (AG-13 e AG-14)", () => {
  it.each([["c61"], ["C 61"], ["C61.9"], ["c61.9"], [" C61 "]])("CID %j em paciente feminina é VERMELHO (AG-13)", (cid) => {
    const a = achadosGate({ cidPrincipal: cid, pacienteSexo: "F" }, "AG-13");
    expect(a).toHaveLength(1);
    expect(a[0]!.severidade).toBe("BLOQUEIA_EXPORTACAO");
  });

  it.each([["C50,4"], ["c50,4"], ["C50.4"], ["C 50"]])("CID %j em paciente masculino é VERMELHO (AG-13)", (cid) => {
    expect(achadosGate({ cidPrincipal: cid, pacienteSexo: "M" }, "AG-13")).toHaveLength(1);
  });

  it("CID de próstata com caixa baixa e espaço em paciente masculino não gera AG-13", () => {
    expect(achadosGate({ cidPrincipal: "c 61", pacienteSexo: "M" }, "AG-13")).toEqual([]);
  });

  it("CID 37 'c50' contra topografia 57 'C50.4' é VERMELHO (AG-14) sem traduzir o código", () => {
    const a = achadosGate({ cidPrincipal: "c50", cidTopografia: "C50.4" }, "AG-14");
    expect(a).toHaveLength(1);
    expect(a[0]!.severidade).toBe("BLOQUEIA_EXPORTACAO");
  });

  it("CID igual em caixa diferente não gera AG-14 (normalização só de caixa e pontuação)", () => {
    expect(achadosGate({ cidPrincipal: "c50.4", cidTopografia: "C50.4" }, "AG-14")).toEqual([]);
  });

  it("CID de mama sem sexo informado não gera AG-13 (PENDENTE fica no campo)", () => {
    expect(achadosGate({ cidPrincipal: "C50", pacienteSexo: "" }, "AG-13")).toEqual([]);
  });
});

describe("APAC adversarial · variantes de sexo (nunca VERDE)", () => {
  it("sexo vazio gera AG-08 bloqueante e a caixa sai PENDENTE", () => {
    const v = antiglosa(apac("sx-vazio", { pacienteSexo: "" }), ctxGates());
    expect(v.exportavel).toBe(false);
    expect(v.achados.some((a) => a.regraId === "AG-08" && a.motivo.includes("pacienteSexo"))).toBe(true);
  });

  it.each([["X"], ["masculino"], ["MASC"], ["m"], ["I"]])("sexo %j em CID de próstata vira PENDENTE, não VERMELHO", (sexo) => {
    const a = achadosGate({ cidPrincipal: "C61", pacienteSexo: sexo }, "AG-13");
    expect(a.every((x) => x.severidade === "ALERTA")).toBe(true);
    expect(a.every((x) => x.motivo.startsWith("PENDENTE: "))).toBe(true);
  });

  it("sexo 'M' e 'F' canônicos continuam decididos pelo gate", () => {
    expect(achadosGate({ cidPrincipal: "C61", pacienteSexo: "M" }, "AG-13")).toEqual([]);
    expect(achadosGate({ cidPrincipal: "C61", pacienteSexo: "F" }, "AG-13")[0]?.severidade).toBe("BLOQUEIA_EXPORTACAO");
  });
});

describe("APAC adversarial · radioterapia solicitada com respostas variadas (AG-15)", () => {
  const rtPreenchida = { rtFinalidade: "Paliativa", rtCidTopografico: "C50.4" };
  it.each([["não"], ["Não"], [false], ["NAO"], [undefined]])("radioterapiaSolicitada %j com RT preenchida é VERMELHO", (valor) => {
    const a = achadosGate({ ...rtPreenchida, radioterapiaSolicitada: valor }, "AG-15");
    expect(a).toHaveLength(1);
    expect(a[0]!.severidade).toBe("BLOQUEIA_EXPORTACAO");
  });

  it("radioterapiaSolicitada 'sim' em caixa baixa libera o bloco", () => {
    expect(achadosGate({ ...rtPreenchida, radioterapiaSolicitada: "sim" }, "AG-15")).toEqual([]);
  });

  it("bloco de RT só com espaços não dispara AG-15 sem RT solicitada", () => {
    expect(achadosGate({ rtFinalidade: "   ", rtCidTopografico: "" }, "AG-15")).toEqual([]);
  });
});

describe("APAC adversarial · histórico de quimioterapia com tipos misturados (AG-16 e laudo)", () => {
  const misto = [
    5, null, "CICLO 1", { foo: 1 }, { esquema: 7, dataInicio: "2026-01-10" },
    { esquema: "FOLFOX ciclo 1", dataInicio: "2026-01-10" },
    { esquema: "FOLFOX C2", dataInicio: "2026-01-10" },
    { esquema: "FOLFOX ciclo1", dataInicio: "2026-01-10" },
    { esquema: "FOLFOX", dataInicio: 2026 }, [], true,
  ];

  it("lista mista não lança exceção no gate, no laudo nem na antiglosa", () => {
    expect(() => achadosGate({ historicoQuimioterapia: misto }, "AG-16")).not.toThrow();
    expect(() => preencherLaudo(apac("mx", { historicoQuimioterapia: misto, qtTratamentoAnterior: "SIM" }), sigtap)).not.toThrow();
    expect(() => antiglosa(apac("mx2", { historicoQuimioterapia: misto }), ctxGates())).not.toThrow();
  });

  it("string solta, número, null e objeto sem esquema não geram AG-16 nem exceção", () => {
    for (const v of ["CICLO 1", "C1", "ciclo1", { esquema: "X" }, 42, null]) {
      expect(achadosGate({ historicoQuimioterapia: v }, "AG-16")).toEqual([]);
    }
  });

  it("três ciclos do mesmo esquema com mesma data (variações 'ciclo 1', 'C2', 'ciclo1') é VERMELHO AG-16", () => {
    const a = achadosGate({ historicoQuimioterapia: misto.slice(5, 8) }, "AG-16");
    expect(a).toHaveLength(1);
    expect(a[0]!.severidade).toBe("BLOQUEIA_EXPORTACAO");
  });

  it("ciclos do mesmo esquema com datas diferentes não geram AG-16", () => {
    const v = [{ esquema: "FOLFOX ciclo 1", dataInicio: "2026-01-10" }, { esquema: "FOLFOX ciclo 2", dataInicio: "2026-01-24" }];
    expect(achadosGate({ historicoQuimioterapia: v }, "AG-16")).toEqual([]);
  });

  it("ciclos do mesmo esquema na linha do laudo colapsam em uma linha (uma por esquema, nunca por ciclo)", () => {
    const l = preencherLaudo(apac("col", {
      qtTratamentoAnterior: "SIM",
      historicoQuimioterapia: [{ esquema: "FOLFOX ciclo 1", dataInicio: "2026-01-10" }, { esquema: "FOLFOX ciclo 2", dataInicio: "2026-01-24" }],
    }), sigtap);
    expect(l.complementares.qtAnterior1Descricao).toEqual({ estado: "PREENCHIDO", valor: "FOLFOX ciclo 1" });
    expect(l.complementares).not.toHaveProperty("qtAnterior2Descricao");
    expect(l.naoAplicavel).toEqual(expect.arrayContaining(["qtAnterior2Descricao", "qtAnterior2DataInicio"]));
  });
});

describe("APAC adversarial · check-in não confirmado, CNS, CEP, município e etnia", () => {
  it("cadastro em RASCUNHO não preenche nenhum campo", () => {
    const id = lerIdentificacaoCheckin(cadastro({ revisao: "RASCUNHO" }), TABELA_IBGE);
    expect(id.campos).toEqual({});
    expect(id.pendencias.length).toBeGreaterThan(0);
    expect(id.pendencias.every((p) => p.motivo === "cadastro não confirmado")).toBe(true);
  });

  it("cadastro sem revisão não preenche e aplicar não mantém valor antigo", () => {
    const semRevisao = cadastro();
    delete semRevisao.revisao;
    const id = lerIdentificacaoCheckin(semRevisao, TABELA_IBGE);
    expect(id.campos).toEqual({});
    expect(aplicarIdentificacaoCheckin({ pacienteNome: "Antigo" }, id)).toEqual({});
  });

  it("CNS com dígito verificador errado não entra em campos e vira pendência", () => {
    const id = lerIdentificacaoCheckin(cadastro({ cns: CNS_RUIM }), TABELA_IBGE);
    expect(id.campos.pacienteCns).toBeUndefined();
    expect(id.pendencias.find((p) => p.chave === "pacienteCns")?.motivo).toMatch(/CNS inválido/);
  });

  it.each([["5801A000"], ["58010-00O"], ["ABCDE-FGH"], ["5801-000"]])("CEP %j é PENDENTE e nunca entra em campos", (cep) => {
    const id = lerIdentificacaoCheckin(cadastro({ cep }), TABELA_IBGE);
    expect(id.campos.cep).toBeUndefined();
    expect(id.pendencias.some((p) => p.chave === "cep")).toBe(true);
  });

  it("município em caixa e acento diferentes resolve o IBGE pela tabela ('joão pessoa')", () => {
    const id = lerIdentificacaoCheckin(cadastro({ municipio: "joão pessoa", uf: "pb" }), TABELA_IBGE);
    expect(id.campos.codIbgeMunicipio?.valor).toBe("2507507");
  });

  it("município fora da tabela fica PENDENTE e nenhum código IBGE é inventado", () => {
    const id = lerIdentificacaoCheckin(cadastro({ municipio: "Cidade Inventada" }), TABELA_IBGE);
    expect(id.campos.codIbgeMunicipio).toBeUndefined();
    expect(id.pendencias.some((p) => p.chave === "codIbgeMunicipio")).toBe(true);
  });

  it("município com nome de PB mas UF de outro estado não resolve IBGE", () => {
    const id = lerIdentificacaoCheckin(cadastro({ municipio: "JOAO PESSOA", uf: "SP" }), TABELA_IBGE);
    expect(id.campos.codIbgeMunicipio).toBeUndefined();
  });

  it("etnia preenchida para paciente não indígena é ignorada", () => {
    const id = lerIdentificacaoCheckin(cadastro({ racaCor: "PARDA", etnia: "Etnia Sintetica" }), TABELA_IBGE);
    expect(id.campos.etnia).toBeUndefined();
    expect(id.pendencias.find((p) => p.chave === "etnia")?.motivo).toMatch(/não se aplica/);
  });

  it("etnia de paciente indígena é lida", () => {
    const id = lerIdentificacaoCheckin(cadastro({ racaCor: "indigena", etnia: "Etnia Sintetica" }), TABELA_IBGE);
    expect(id.campos.etnia?.valor).toBe("Etnia Sintetica");
  });
});

describe("APAC adversarial · render com strings maliciosas (páginas 1 e 2)", () => {
  const MALICIA = `<script>alert(1)</script>"><img src=x onerror=alert(2)>{{ constructor }}\nlinha dois <b>x</b>`;
  const semEstilo = (html: string): string => html.replace(/<style[\s\S]*?<\/style>/gi, "");

  it("página 1 escapa o conteúdo, não ativa tags e mantém a marca de rascunho", () => {
    const valores: Record<string, string> = {
      "paciente-nome": MALICIA, "paciente-endereco": MALICIA, "justificativa-observacoes": MALICIA, "cid-principal": "C61",
    };
    const r = renderizarApacLaudo(TEMPLATE, { valores });
    const corpo = semEstilo(r.html);
    expect(corpo).not.toContain("<script>");
    expect(corpo).not.toMatch(/<img\b/);
    expect(corpo).not.toMatch(/<b>/);
    expect(corpo).toContain("&lt;script&gt;");
    expect(corpo).toContain("&quot;&gt;&lt;img");
    expect(r.status).toBe("RASCUNHO");
    expect(r.html).toContain("RASCUNHO — NÃO VÁLIDO");
  });

  it("página 2 escapa valores maliciosos e mantém a marca de rascunho", () => {
    const l = preencherLaudo(apac("pg2-xss", { localizacaoTumorPrimario: MALICIA, qtEsquema: MALICIA, qtTratamentoAnterior: "NAO" }), sigtap);
    const r = renderizarApacComplementar({
      documentId: "pg2-xss", documentVersion: 1, naoAplicavel: l.naoAplicavel, assinado: false,
      blocos: BLOCOS_COMPLEMENTARES.map((b) => ({ titulo: b.titulo, campos: b.chaves.map((chave) => ({ chave, rotulo: CAMPOS_COMPLEMENTARES[chave]! })) })),
      campos: l.complementares,
    });
    const corpo = semEstilo(r.html);
    expect(corpo).not.toContain("<script>");
    expect(corpo).not.toMatch(/<img\b/);
    expect(corpo).toContain("&lt;script&gt;");
    expect(r.status).toBe("RASCUNHO");
    expect(r.html).toContain("RASCUNHO — NÃO VÁLIDO");
  });
});

describe("APAC adversarial · caixa 72 e autorização sempre em branco", () => {
  it("meses autorizados preenchido pelo solicitante não entra na página 2", () => {
    const l = preencherLaudo(apac("m72", { qtMesesAutorizados: 6, qtMesesPlanejados: 3 }), sigtap);
    expect(l.complementares).not.toHaveProperty("qtMesesAutorizados");
    expect(Object.values(CAMPOS_COMPLEMENTARES)).not.toContain("Nº DE MESES AUTORIZADOS");
  });

  it("autorização continua em branco mesmo com valores preenchidos no template", () => {
    const campoAutorizacao = TEMPLATE.campos.filter((f) => f.bloco === "AUTORIZAÇÃO" && f.tipo === "CAMPO");
    expect(campoAutorizacao.length).toBeGreaterThan(0);
    const valores = Object.fromEntries(campoAutorizacao.map((f) => [f.id, "VALOR-SINTETICO-AUT"]));
    const r = renderizarApacLaudo(TEMPLATE, { valores, metadados: { finalidadeLote: "PALIATIVA" } });
    expect(r.html).not.toContain("VALOR-SINTETICO-AUT");
    for (const f of campoAutorizacao) expect(r.campos.find((c) => c.id === f.id)?.valor).toBe("");
  });

  it("laudo.ts devolve autorização e assinatura do solicitante sempre em branco", () => {
    const l = preencherLaudo(apac("aut", { numeroAutorizacao: "123", dataAutorizacao: "2026-09-01" }), sigtap);
    expect(Object.values(l.autorizacao).every((v) => v === "EM_BRANCO")).toBe(true);
    expect(l.assinaturaSolicitante).toBe("EM_BRANCO");
  });

  it("lerCampo lê valor bruto sem tipar", () => {
    expect(lerCampo({ x: 1 }, "x")).toEqual({ estado: "PRESENTE", valor: 1 });
  });
});
