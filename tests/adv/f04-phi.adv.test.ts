import { describe, expect, it } from "vitest";
import { desidentificar } from "../../src/kernel/llm/desidentificar.js";
import { g02PhiEgress } from "../../src/kernel/harness/gates.js";

const dic = { nomes: ["Paciente Teste 01"], identificadores: [] };

describe("F4 · importação de transcrição sintética antes do LLM", () => {
  for (const texto of [
    "Paciente Teste 01, nascido em 05/10/1980, apresenta sintoma sintético.",
    "Paciente Teste 01, data de nascimento: 05-10-1980, documento em análise.",
    "Paciente Teste 01, DN 05.10.1980, exame sintético.",
  ]) {
    it(`ADV-005 · data de nascimento residual não sai para LLM: ${texto.slice(0, 55)}`, () => {
      const limpo = desidentificar(texto, dic).texto;
      // Controle: o dicionário conhecido foi aplicado, mas a data também precisa ser removida ou barrada.
      expect(limpo).not.toContain("Paciente Teste 01");
      const sobrouNascimento = /05[\/.-]10[\/.-]1980/.test(limpo);
      expect(sobrouNascimento && g02PhiEgress(limpo, dic).decisao !== "BLOQUEIA_SAIDA").toBe(false);
    });
  }
  it("ADV-005 · RESISTIU: data DN com barras vira token", () => {
    expect(desidentificar("DN 05/10/1980", dic).texto).not.toContain("05/10/1980");
  });
});
