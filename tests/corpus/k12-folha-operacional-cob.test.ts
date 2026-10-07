import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

interface Template {
  id: string;
  secoes: { id: string; origem: string }[];
  proibidoConter: string[];
  exibeE1: boolean;
}

const nomes = [
  "evolucao", "receita", "pedido-exame", "resumo-14",
  "sinais-alarme", "laudo-judicial", "folha-operacional-salao",
] as const;
function template(nome: string): Template {
  const caminho = fileURLToPath(new URL(`../../corpus/templates/${nome}.v1.json`, import.meta.url));
  return JSON.parse(readFileSync(caminho, "utf8")) as Template;
}

describe("K-12 · separação declarativa do E1 (escopo: templates, não render/UI/chat)", () => {
  it("positivo: somente a folha operacional declara a seção ALERTA/E1", () => {
    const operacao = template("folha-operacional-salao");
    expect(operacao.id).toBe("folha-operacional-salao");
    expect(operacao.exibeE1).toBe(true);
    expect(operacao.secoes.filter((s) => s.origem === "ALERTA").map((s) => s.id)).toEqual(["e1"]);
    expect(operacao.proibidoConter).not.toContain("ALERTA");
    expect(operacao.proibidoConter).toContain("CORRECAO_IA");
  });

  it("negativo: evolução, receita, laudo e demais templates não declaram ALERTA/E1", () => {
    for (const nome of nomes.filter((n) => n !== "folha-operacional-salao")) {
      const documento = template(nome);
      expect(documento.exibeE1, nome).toBe(false);
      expect(documento.secoes.some((s) => s.origem === "ALERTA"), nome).toBe(false);
      expect(documento.proibidoConter, nome).toContain("ALERTA");
      expect(documento.proibidoConter, nome).toContain("CORRECAO_IA");
    }
  });
});
