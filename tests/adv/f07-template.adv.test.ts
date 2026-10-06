import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { renderizarDocumento } from "../../src/modules/documentos/render.js";

interface TemplateCorpus { id: string; versao: string; proibidoConter: string[] }
const corpus = (nome: string): TemplateCorpus =>
  JSON.parse(readFileSync(fileURLToPath(
    new URL(`../../corpus/templates/${nome}.v1.json`, import.meta.url)), "utf8")) as TemplateCorpus;

describe("F7 · proibidoConter não é verificado no render (somente função; nenhuma impressão)", () => {
  for (const [nome, origem] of [
    ["evolucao", "ALERTA"],
    ["receita", "CORRECAO_IA"],
    ["laudo-judicial", "ALERTA"],
  ]) {
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
});
