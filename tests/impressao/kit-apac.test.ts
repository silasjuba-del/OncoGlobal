import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { renderizarKit, type EntradaKit, type KitTemplate } from "../../src/impressao/kit.js";
import { renderizarApacLaudo, type TemplateApac } from "../../src/impressao/apacLaudo.js";

const template = (id: string): KitTemplate => JSON.parse(readFileSync(resolve(process.cwd(), `corpus/templates/kit/${id}.v1.json`), "utf8"));
const apacTemplate = (): TemplateApac => JSON.parse(readFileSync(resolve(process.cwd(), "corpus/templates/kit/apac-laudo.v1.json"), "utf8"));
const base = { cabecalho: { nomeInstituicao: "Instituição <teste>", linha2: "Linha 2", cidadeUf: "Cidade/UF", exemplo: true }, medico: { nome: "Médico", crm: "CRM 1" }, paciente: {} };

describe("impressão de kit e laudo APAC", () => {
  it("não aceita CID sem lote confirmado nem prazo/data clínica presumidos", () => {
    const apac = renderizarApacLaudo(apacTemplate(), { valores: { "cid-principal": "C99", "diagnostico-descricao": "texto não confirmado" } });
    expect(apac.campos.find(c => c.id === "cid-principal")?.valor).toBe("PENDENTE");
    expect(apac.campos.find(c => c.id === "diagnostico-descricao")?.valor).toBe("PENDENTE");
    const report = renderizarKit(template("relatorio-pericial"), base);
    expect(report.html).not.toContain("6 (seis) meses");
    expect(report.html).not.toContain("a\r\ncontar de ____/____/________");
    expect(report.html).toContain("a contar de PENDENTE");
    expect(report.html).not.toContain("Dr. Silas Negrao");
    const nutrition = renderizarKit(template("orientacao-nutricional"), base);
    expect(nutrition.html).not.toContain("PENDENTE/____/________");
  });
  it("escapa HTML, marca rascunho e mantém cabeçalho como configuração", () => {
    const r = renderizarKit(template("orientacao-nutricional"), base);
    expect(r.html).toContain("&lt;teste&gt;");
    expect(r.html).not.toContain("<script>");
    expect(r.html).toContain("RASCUNHO — NÃO VÁLIDO");
    expect(r.html).toContain("Cabeçalho de exemplo: altere nas configurações.");
    expect(r.html).toContain("PENDENTE");
  });

  it("separa alerta operacional, aceita itens de receita selecionados e modelo em branco", () => {
    const receita = renderizarKit(template("receita-sintomaticos"), { ...base, itensSelecionados: ["pantoprazol", "nao-existe"], alertasOperacionais: ["Atenção"], folhaOperacionalSalao: false });
    expect(receita.html).toContain("PANTOPRAZOL"); expect(receita.html).not.toContain("nao-existe"); expect(receita.html).not.toContain("Atenção");
    const blank = renderizarKit(template("sinais-alarme"), { ...base, modeloEmBranco: true });
    expect(blank.status).toBe("MODELO_EM_BRANCO"); expect(blank.html).toContain("MODELO EM BRANCO");
  });

  it("D-W9-04 · texto do kit sai acentuado e as âncoras de renderização continuam funcionando", () => {
    const r = renderizarKit(template("receita-sintomaticos"), { ...base, itensSelecionados: ["pantoprazol"] });
    expect(r.html).toContain("Medicações de apoio");
    expect(r.html).toContain("OBSERVAÇÃO AO MÉDICO PLANTONISTA");
  });

  it("ignora dose adulterada na entrada e renderiza a dose literal do template selecionado", () => {
    const entradaAdulterada = { ...base, itensSelecionados: ["pantoprazol"], itensReceita: [{ id: "pantoprazol", medicamento: "PANTOPRAZOL", dose: "999 mg", orientacao: "alterada", selecionado: true }] } as unknown as EntradaKit;
    const r = renderizarKit(template("receita-sintomaticos"), entradaAdulterada);
    expect(r.html).toContain("20 mg");
    expect(r.html).not.toContain("999 mg");
    expect(r.html).not.toContain("alterada");
  });

  it("preenche APAC com PENDENTE, mantém autorização e validade vazias e respeita ordem e escape", () => {
    const t = apacTemplate();
    const r = renderizarApacLaudo(t, { valores: { "paciente-nome": "<Paciente>", "proced-principal-nome": "QTP", "proced-principal-qtde": "1" }, metadados: { cidLoteConfirmado: "C50.9", finalidadeLote: "PENDENTE", temTabelaSigtap: false } });
    expect(r.html).toContain("&lt;Paciente&gt;"); expect(r.html).not.toContain("<Paciente>");
    expect(r.campos.find(x => x.id === "bloco-autorizacao")?.valor).toBe("");
    expect(r.campos.find(x => x.id === "periodo-validade")?.valor).toBe("");
    expect(r.campos.find(x => x.id === "paciente-nome")?.valor).toBe("<Paciente>");
    expect(r.campos.find(x => x.id === "cid-principal")?.valor).toBe("C50.9");
    expect(r.campos.find(x => x.id === "proced-principal-codigo")?.valor).toContain("PENDENTE [VERIFICAR]");
    expect(r.campos.find(x => x.id === "paciente-raca-cor")?.valor).toBe("PENDENTE");
    expect(r.html).not.toContain("sus PENDENTE");
    expect(r.html.indexOf("IDENTIFICAÇÃO DO PACIENTE")).toBeLessThan(r.html.indexOf("PROCEDIMENTO SOLICITADO"));
  });
});
