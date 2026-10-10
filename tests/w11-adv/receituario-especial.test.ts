// W11-H12 · receituário especial: tramadol/morfina só saem com receituário especial do serviço, nunca substituídos.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  CONFIGURACAO_RECEITUARIO_PADRAO,
  montarReceitas,
  rotearItemReceita,
  type EntradaControlado,
  type ItemReceita,
} from "../../src/rules/prescricao/receituarioEspecial.js";

const CORPUS = JSON.parse(
  readFileSync(resolve(process.cwd(), "corpus/regulatorio/medicamentos-controlados.v1.json"), "utf8"),
) as { entradas: EntradaControlado[] };
const TABELA = CORPUS.entradas;

const SEM = { servicoTemReceituarioEspecial: false };
const COM = { servicoTemReceituarioEspecial: true };

const item = (id: string, medicamento: string, contexto?: ItemReceita["contexto"]): ItemReceita =>
  contexto === undefined ? { id, medicamento } : { id, medicamento, contexto };

describe("W11-H12 · receituário especial", () => {
  it("configuração padrão é sem receituário especial", () => {
    expect(CONFIGURACAO_RECEITUARIO_PADRAO.servicoTemReceituarioEspecial).toBe(false);
  });

  it("corpus marca tramadol e morfina como exigentes, sem afirmar lista A/B", () => {
    const porNome = (n: string) => TABELA.find((e) => e.nomes.includes(n));
    expect(porNome("tramadol")).toMatchObject({ exigeReceituarioEspecial: true, status: "PENDENTE_VERIFICACAO" });
    expect(porNome("morfina")).toMatchObject({ exigeReceituarioEspecial: true, status: "PENDENTE_VERIFICACAO" });
    for (const e of TABELA) expect((e as unknown as { lista: unknown }).lista).toBeNull();
  });

  it("tramadol sem receituário especial do serviço => indisponível, com motivo e sem substituto", () => {
    const r = rotearItemReceita(item("a", "Tramadol 50 mg"), SEM, TABELA);
    expect(r.estado).toBe("INDISPONIVEL_SEM_RECEITUARIO_ESPECIAL");
    if (r.estado !== "INDISPONIVEL_SEM_RECEITUARIO_ESPECIAL") throw new Error("esperado indisponível");
    expect(r.motivo).toMatch(/receituário especial/);
    expect(r.fonte).toMatch(/344/);
    expect(r).not.toHaveProperty("substituto");
  });

  it("tramadol com receituário especial => documento separado RECEITA_ESPECIAL", () => {
    const r = rotearItemReceita(item("a", "TRAMADOL 50 MG"), COM, TABELA);
    expect(r).toMatchObject({ estado: "RECEITA_ESPECIAL", tipoDocumento: "RECEITA_ESPECIAL" });

    const m = montarReceitas([item("a", "tramadol"), item("b", "Dipirona 500 mg")], COM, TABELA);
    expect(m.receitaComum.map((i) => i.id)).toEqual(["b"]);
    expect(m.documentosEspeciais).toEqual([{ tipoDocumento: "RECEITA_ESPECIAL", itens: [item("a", "tramadol")] }]);
    expect(m.indisponiveis).toEqual([]);
  });

  it("tramadol nunca aparece na receita comum, com ou sem receituário especial", () => {
    for (const cfg of [SEM, COM]) {
      const m = montarReceitas([item("a", "tramadol")], cfg, TABELA);
      expect(m.receitaComum).toEqual([]);
    }
  });

  it("fármaco comum não é afetado, com ou sem receituário especial", () => {
    for (const cfg of [SEM, COM]) {
      const m = montarReceitas([item("p", "Paracetamol 750 mg"), item("o", "Ondansetrona 8 mg")], cfg, TABELA);
      expect(m.receitaComum.map((i) => i.id)).toEqual(["p", "o"]);
      expect(m.documentosEspeciais).toEqual([]);
      expect(m.indisponiveis).toEqual([]);
    }
  });

  it("nome parcial não casa como controlado (tramadolina não é tramadol)", () => {
    const r = rotearItemReceita(item("x", "Tramadolina 10 mg"), SEM, TABELA);
    expect(r.estado).toBe("OFERECIDO_RECEITA_COMUM");
  });

  it("nunca substitui em silêncio: indisponível não gera item novo na receita comum", () => {
    const m = montarReceitas([item("a", "morfina 10 mg"), item("b", "tramadol")], SEM, TABELA);
    expect(m.receitaComum).toEqual([]);
    expect(m.indisponiveis.map((i) => i.item.id)).toEqual(["a", "b"]);
    expect(m.documentosEspeciais).toEqual([]);
  });

  it("receita de sintomáticos da QT nunca leva tramadol, mesmo com receituário especial", () => {
    const r = rotearItemReceita(item("s", "Tramadol 50 mg", "SINTOMATICOS_QT"), COM, TABELA);
    expect(r.estado).toBe("INDISPONIVEL_SEM_RECEITUARIO_ESPECIAL");
    const m = montarReceitas([item("s", "Tramadol 50 mg", "SINTOMATICOS_QT")], COM, TABELA);
    expect(m.receitaComum).toEqual([]);
    expect(m.documentosEspeciais).toEqual([]);
    expect(m.indisponiveis).toHaveLength(1);
  });

  it("o modelo de sintomáticos do corpus não contém tramadol", () => {
    const texto = readFileSync(resolve(process.cwd(), "corpus/templates/kit/receita-sintomaticos.v1.json"), "utf8");
    expect(texto.toLowerCase()).not.toContain("tramadol");
  });
});
