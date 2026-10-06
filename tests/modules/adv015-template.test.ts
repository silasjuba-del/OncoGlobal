import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { renderizarDocumento } from "../../src/modules/documentos/render.js";
import type { EntradaRender } from "../../src/modules/documentos/render.js";

// Copiado de f0/w5-red@4890792:tests/adv/f07-template.adv.test.ts.
interface TemplateCorpus { id: string; versao: string; proibidoConter: string[] }
const corpus = (nome: string): TemplateCorpus =>
  JSON.parse(readFileSync(fileURLToPath(
    new URL(`../../corpus/templates/${nome}.v1.json`, import.meta.url)), "utf8")) as TemplateCorpus;

describe("F7 · proibidoConter no render (somente função; nenhuma impressão)", () => {
  for (const [nome, origem] of [
    ["evolucao", "ALERTA"],
    ["receita", "CORRECAO_IA"],
    ["laudo-judicial", "ALERTA"],
  ] as const) {
    it(`ADV-015 · ${nome} não deve conter fato com origem proibida ${origem}`, () => {
      const spec = corpus(nome!);
      expect(spec.proibidoConter).toContain(origem);
      const template = { templateId: spec.id, versao: spec.versao,
        campos: ["conteudo"], proibidoConter: spec.proibidoConter };
      const fato = { campo: "conteudo", valor: "texto sintético sem dado clínico",
        revisao: "CONFIRMADO" as const, origem };
      const doc = renderizarDocumento({ template, fatos: [fato] });
      expect(doc.campos.conteudo).toBe("");
      expect(doc.camposVazios).toContain("conteudo");
    });
  }

  it("ADV-015 · fato com origem permitida permanece, inclusive ALERTA na folha operacional", () => {
    const folha = corpus("folha-operacional-salao");
    const template = { templateId: folha.id, versao: folha.versao,
      campos: ["conteudo"], proibidoConter: folha.proibidoConter };
    expect(template.proibidoConter).not.toContain("ALERTA");
    const doc = renderizarDocumento({ template, fatos: [{
      campo: "conteudo", valor: "alerta operacional sintético",
      revisao: "CONFIRMADO", origem: "ALERTA",
    }] });
    expect(doc.campos.conteudo).toBe("alerta operacional sintético");
    expect(doc.camposVazios).toEqual([]);
  });

  it("ADV-015 · origem ou política ausente/desconhecida falha fechada no runtime", () => {
    const template = { templateId: "evolucao", versao: "1.0.0",
      campos: ["conteudo"], proibidoConter: ["ALERTA", "CORRECAO_IA"] };
    const fato = { campo: "conteudo", valor: "texto sintético",
      revisao: "CONFIRMADO", origem: "FATO_CONFIRMADO" };
    const entradas = [
      { template, fatos: [{ ...fato, origem: undefined }] },
      { template, fatos: [{ ...fato, origem: "DESCONHECIDA" }] },
      { template: { ...template, proibidoConter: undefined }, fatos: [fato] },
    ];
    for (const entrada of entradas) {
      const doc = renderizarDocumento(entrada as unknown as EntradaRender);
      expect(doc.campos.conteudo).toBe("");
      expect(doc.camposVazios).toContain("conteudo");
    }
  });
});
