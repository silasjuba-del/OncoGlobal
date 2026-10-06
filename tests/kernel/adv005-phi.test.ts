// Prova ADV-005 copiada de RED@5e1093d: fixtures inteiramente sintéticas.
import { describe, expect, it } from "vitest";
import { desidentificar, reidentificar } from "../../src/kernel/llm/desidentificar.js";
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

  it("ADV-005 · FN-24 tokeniza cada forma de nascimento e reidentifica só pelo mapa local", () => {
    for (const texto of [
      "nascido em 05/10/1980",
      "data de nascimento: 05-10-1980",
      "DN 05.10.1980",
    ]) {
      const r = desidentificar(texto, dic);
      expect(r.achados).toContainEqual({ tipo: "DATA_NASC", token: "⟨DATA_NASC_1⟩" });
      expect(r.texto).not.toMatch(/05[\/.-]10[\/.-]1980/);
      expect(reidentificar(r.texto, r.mapa)).toBe(texto);
    }
  });

  it("ADV-005 · G-02 barra DN cru sem nome conhecido; passa texto tokenizado (não prova egress)", () => {
    const original = "DN 05.10.1980";
    expect(g02PhiEgress(original, { nomes: [], identificadores: [] }).decisao).toBe("BLOQUEIA_SAIDA");
    const limpo = desidentificar(original, { nomes: [], identificadores: [] }).texto;
    expect(g02PhiEgress(limpo, { nomes: [], identificadores: [] }).decisao).toBe("PASSA");
  });

  it("ADV-005 · uma data clínica avulsa não é inventada como data de nascimento", () => {
    const texto = "coleta de exame sintético em 05.10.1980";
    expect(desidentificar(texto, { nomes: [], identificadores: [] }).texto).toBe(texto);
  });
});
