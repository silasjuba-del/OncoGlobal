// W11-H21 · check-in real: mapeador Modelo 08 -> CadastroCheckin, leitor da configuração do serviço e injeção no receituário.
// Só dados sintéticos.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { lerIdentificacaoCheckin } from "../../src/apac/campos.js";
import { mapearCadastroModelo08, separarCidadeUf, type CadastroModelo08Entrada } from "../../src/apac/mapearCadastro.js";
import { lerConfiguracaoServico } from "../../src/config/servico.js";
import { CONFIGURACAO_SERVICO_PADRAO } from "../../src/contracts/w11/configuracaoServico.js";
import {
  CONFIGURACAO_RECEITUARIO_PADRAO, montarReceitas, rotearItemReceita, type EntradaControlado, type ItemReceita,
} from "../../src/rules/prescricao/receituarioEspecial.js";

const CORPUS = JSON.parse(
  readFileSync(resolve(process.cwd(), "corpus/regulatorio/medicamentos-controlados.v1.json"), "utf8"),
) as { entradas: EntradaControlado[] };
const TABELA = CORPUS.entradas;

const modelo = (over: Partial<CadastroModelo08Entrada> = {}): CadastroModelo08Entrada => ({
  nascimento: "1960-05-10", mae: "Mae Sintetica", responsavel: "SEM INFORMACAO", cns: "700000000000001",
  cidadeUf: "Cidade Teste/PB", endereco: "Rua Sintetica, 0", ...over,
});

const item = (id: string, medicamento: string): ItemReceita => ({ id, medicamento });

describe("W11-H21 · separarCidadeUf", () => {
  it.each([
    ["Cidade Teste/PB", "Cidade Teste", "PB"],
    ["Cidade Teste - PB", "Cidade Teste", "PB"],
    ["Cidade Teste - pb", "Cidade Teste", "PB"],
  ])("%j separa em município e UF", (entrada, municipio, uf) => {
    expect(separarCidadeUf(entrada)).toEqual({ municipio, uf });
  });

  it.each([
    ["Cidade Teste · PB"],
    ["Cidade Teste PB"],
    ["Cidade Teste/XX"],
    ["Cidade Teste/PBA"],
    ["/PB"],
    ["Cidade Teste, PB"],
    [""],
    [null],
  ])("%j é inválido e não separa nada", (entrada) => {
    expect(separarCidadeUf(entrada)).toBeNull();
  });
});

describe("W11-H21 · mapearCadastroModelo08", () => {
  it("transporta o que o modelo tem e separa cidadeUf válido", () => {
    const c = mapearCadastroModelo08(modelo());
    expect(c).toMatchObject({
      cns: "700000000000001", nascimento: "1960-05-10", mae: "Mae Sintetica",
      endereco: "Rua Sintetica, 0", municipio: "Cidade Teste", uf: "PB", responsavel: null,
    });
  });

  it("cidadeUf inválido deixa município e UF ausentes (PENDENTE)", () => {
    const c = mapearCadastroModelo08(modelo({ cidadeUf: "Cidade Teste · PB" }));
    expect(c.municipio).toBeNull();
    expect(c.uf).toBeNull();
  });

  it("cidadeUf ausente deixa município e UF ausentes (PENDENTE)", () => {
    const c = mapearCadastroModelo08(modelo({ cidadeUf: null }));
    expect(c.municipio).toBeNull();
    expect(c.uf).toBeNull();
  });

  it("não cria campos que o modelo 08 não tem", () => {
    const c = mapearCadastroModelo08(modelo());
    for (const k of ["revisao", "prontuario", "nome", "sexo", "racaCor", "etnia", "telefones", "cep"] as const) {
      expect(c[k]).toBeUndefined();
    }
  });

  it("placeholder SEM INFORMACAO no responsável não vira nome", () => {
    expect(mapearCadastroModelo08(modelo({ responsavel: "SEM INFORMACAO" })).responsavel).toBeNull();
  });

  it("responsável real vira nome, sem telefone inventado", () => {
    expect(mapearCadastroModelo08(modelo({ responsavel: "Responsavel Sintetico" })).responsavel)
      .toEqual({ nome: "Responsavel Sintetico", telefone: null });
  });

  it("sem revisão confirmada, o leitor da APAC deixa tudo PENDENTE", () => {
    const id = lerIdentificacaoCheckin(mapearCadastroModelo08(modelo()), []);
    expect(id.campos).toEqual({});
    expect(id.pendencias.map((p) => p.chave)).toEqual(expect.arrayContaining(["pacienteNascimento", "nomeMae", "cep"]));
  });
});

describe("W11-H21 · configuração do serviço", () => {
  it("padrão é sem receituário especial", () => {
    expect(CONFIGURACAO_SERVICO_PADRAO).toEqual({ servicoTemReceituarioEspecial: false });
    expect(CONFIGURACAO_RECEITUARIO_PADRAO.servicoTemReceituarioEspecial).toBe(false);
  });

  it.each([[undefined], [null], ["sim"], [{}], [{ servicoTemReceituarioEspecial: "true" }], [{ servicoTemReceituarioEspecial: true, extra: 1 }]])(
    "valor inválido %j cai no padrão seguro (false)", (valor) => {
      expect(lerConfiguracaoServico(valor)).toEqual({ servicoTemReceituarioEspecial: false });
    },
  );

  it("valor válido é lido", () => {
    expect(lerConfiguracaoServico({ servicoTemReceituarioEspecial: true })).toEqual({ servicoTemReceituarioEspecial: true });
  });
});

describe("W11-H21 · injeção da configuração no receituário", () => {
  it("padrão false: tramadol fica indisponível", () => {
    const cfg = lerConfiguracaoServico(undefined);
    const r = rotearItemReceita(item("a", "Tramadol 50 mg"), cfg, TABELA);
    expect(r.estado).toBe("INDISPONIVEL_SEM_RECEITUARIO_ESPECIAL");
  });

  it("true: tramadol vai para receita especial, nunca para a receita comum", () => {
    const cfg = lerConfiguracaoServico({ servicoTemReceituarioEspecial: true });
    const m = montarReceitas([item("a", "Tramadol 50 mg"), item("b", "Dipirona 500 mg")], cfg, TABELA);
    expect(m.documentosEspeciais).toHaveLength(1);
    expect(m.documentosEspeciais[0]!.itens.map((i) => i.id)).toEqual(["a"]);
    expect(m.receitaComum.map((i) => i.id)).toEqual(["b"]);
    expect(m.indisponiveis).toEqual([]);
  });
});
