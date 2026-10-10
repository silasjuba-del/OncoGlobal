// W11-H10 · Identificação da página 1 da APAC a partir do cadastro confirmado no check-in.
// Só dados sintéticos. CNS gerado pelo próprio algoritmo. Sem tradução: valida formato, deriva IBGE por tabela.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { calcularCnsDefinitivo } from "../../src/apac/cns.js";
import {
  CHAVES_IDENTIFICACAO, aplicarIdentificacaoCheckin, dvIbge, lerCampo, lerIdentificacaoCheckin, lerTexto,
  type CadastroCheckin, type EntradaIbge,
} from "../../src/apac/campos.js";
import { CAMPOS_SOLICITACAO } from "../../src/apac/laudo.js";

const RAIZ = process.cwd();
const TABELA: EntradaIbge[] = (JSON.parse(
  readFileSync(resolve(RAIZ, "corpus/regulatorio/municipios-ibge-pb.v1.json"), "utf8"),
) as { municipios: { nome: string; codigoIbge: string }[] }).municipios.map((m) => ({ nome: m.nome, uf: "PB", codigoIbge: m.codigoIbge }));

const CNS_SINTETICO = calcularCnsDefinitivo("10000000001");
const CNS_SINTETICO_RUIM = CNS_SINTETICO.slice(0, 14) + String((Number(CNS_SINTETICO[14]) + 1) % 10);

function cadastroCompleto(over: Partial<CadastroCheckin> = {}): CadastroCheckin {
  return {
    revisao: "CONFIRMADO",
    prontuario: "PRONT-SINT-0001",
    cns: CNS_SINTETICO,
    nome: "Paciente Sintético Um",
    nascimento: "1960-05-10",
    sexo: "F",
    racaCor: "parda",
    etnia: null,
    mae: "Mãe Sintética",
    telefones: ["(00) 90000-0001"],
    responsavel: { nome: "Responsável Sintético", telefone: "00 90000-0002" },
    endereco: "Rua Sintética, 0, Bairro Teste",
    municipio: "João Pessoa",
    uf: "pb",
    cep: "58000-000",
    ...over,
  };
}

describe("W11-H10 · identificação APAC a partir do check-in", () => {
  it("cadastro sintético completo deixa a página 1 toda PREENCHIDA, cada campo com origem", () => {
    const id = lerIdentificacaoCheckin(cadastroCompleto(), TABELA);
    expect(id.pendencias).toEqual([{ chave: "etnia", motivo: "não se aplica (raça/cor não indígena)" }]);

    const campos = aplicarIdentificacaoCheckin({}, id);
    const esperado: Record<string, string> = {
      numeroProntuario: "CHECKIN:prontuario",
      pacienteCns: "CHECKIN:cns",
      pacienteNome: "CHECKIN:nome",
      pacienteNascimento: "CHECKIN:nascimento",
      pacienteSexo: "CHECKIN:sexo",
      racaCor: "CHECKIN:racaCor",
      nomeMae: "CHECKIN:mae",
      telefoneContato: "CHECKIN:telefones",
      nomeResponsavel: "CHECKIN:responsavel.nome",
      telefoneResponsavel: "CHECKIN:responsavel.telefone",
      endereco: "CHECKIN:endereco",
      municipioResidencia: "CHECKIN:municipio",
      codIbgeMunicipio: "DERIVADO:TABELA_IBGE_MUNICIPIOS",
      uf: "CHECKIN:uf",
      cep: "CHECKIN:cep",
    };
    for (const [chave, origem] of Object.entries(esperado)) {
      expect(lerCampo(campos, chave), chave).toMatchObject({ estado: "PRESENTE" });
      expect((campos[chave] as { origem: string }).origem, chave).toBe(origem);
    }
    expect(lerTexto(campos, "pacienteCns")).toBe(CNS_SINTETICO);
    expect(lerTexto(campos, "codIbgeMunicipio")).toBe("2507507");
    expect(lerTexto(campos, "uf")).toBe("PB");
    expect(lerTexto(campos, "cep")).toBe("58000-000");
    expect(lerTexto(campos, "telefoneContato")).toBe("00900000001");
    expect(lerTexto(campos, "racaCor")).toBe("PARDA");
    expect(lerCampo(campos, "etnia")).toMatchObject({ estado: "PENDENTE" });
  });

  it("todas as chaves de identificação existem na página 1 do laudo (inclui telefone do responsável)", () => {
    const naPagina = CHAVES_IDENTIFICACAO.filter((c) => c in CAMPOS_SOLICITACAO);
    expect(naPagina).toHaveLength(CHAVES_IDENTIFICACAO.length);
    expect(CAMPOS_SOLICITACAO).toHaveProperty("telefoneResponsavel");
  });

  it("chave pendente no check-in apaga valor antigo da APAC", () => {
    const id = lerIdentificacaoCheckin(cadastroCompleto({ cep: null }), TABELA);
    const campos = aplicarIdentificacaoCheckin({ cep: { estado: "PRESENTE", valor: "00000000" } }, id);
    expect(campos).not.toHaveProperty("cep");
  });

  it("cadastro sem CEP deixa o CEP PENDENTE com motivo e não inventa valor", () => {
    const id = lerIdentificacaoCheckin(cadastroCompleto({ cep: null }), TABELA);
    expect(id.pendencias).toContainEqual({ chave: "cep", motivo: "ausente" });
    const campos = aplicarIdentificacaoCheckin({}, id);
    expect(campos).not.toHaveProperty("cep");
    expect(lerCampo(campos, "cep")).toEqual({ estado: "PENDENTE", motivo: "ausente" });
  });

  it("município sem código na tabela deixa o código IBGE PENDENTE", () => {
    const id = lerIdentificacaoCheckin(cadastroCompleto({ municipio: "Município Sintético" }), TABELA);
    expect(id.pendencias).toContainEqual({ chave: "codIbgeMunicipio", motivo: "IBGE não encontrado na tabela" });
    expect(id.campos).not.toHaveProperty("codIbgeMunicipio");
    expect(id.campos.municipioResidencia?.valor).toBe("Município Sintético");
  });

  it("município da tabela resolve o código por nome normalizado, sem acento nem caixa", () => {
    const id = lerIdentificacaoCheckin(cadastroCompleto({ municipio: "  campina   grande ", uf: "PB" }), TABELA);
    expect(id.campos.codIbgeMunicipio?.valor).toBe("2504009");
  });

  it("CNS inválido não preenche o campo e registra a pendência", () => {
    const id = lerIdentificacaoCheckin(cadastroCompleto({ cns: CNS_SINTETICO_RUIM }), TABELA);
    expect(id.campos).not.toHaveProperty("pacienteCns");
    expect(id.pendencias).toContainEqual({ chave: "pacienteCns", motivo: "CNS inválido (DV)" });
  });

  it("etnia só é preenchida quando a raça/cor é indígena", () => {
    const naoIndigena = lerIdentificacaoCheckin(cadastroCompleto({ racaCor: "PRETA", etnia: "Etnia Sintética" }), TABELA);
    expect(naoIndigena.campos).not.toHaveProperty("etnia");
    expect(naoIndigena.pendencias).toContainEqual({ chave: "etnia", motivo: "não se aplica (raça/cor não indígena)" });

    const indigena = lerIdentificacaoCheckin(cadastroCompleto({ racaCor: "INDIGENA", etnia: "Etnia Sintética" }), TABELA);
    expect(indigena.campos.etnia).toEqual({ campo: "PRESENTE", valor: "Etnia Sintética", revisao: "CONFIRMADO", origem: "CHECKIN:etnia" });

    const indigenaSemEtnia = lerIdentificacaoCheckin(cadastroCompleto({ racaCor: "INDIGENA", etnia: null }), TABELA);
    expect(indigenaSemEtnia.campos).not.toHaveProperty("etnia");
  });

  it("cadastro não confirmado deixa toda a identificação PENDENTE", () => {
    const id = lerIdentificacaoCheckin(cadastroCompleto({ revisao: "RASCUNHO" }), TABELA);
    expect(Object.keys(id.campos)).toHaveLength(0);
    expect(id.pendencias).toHaveLength(CHAVES_IDENTIFICACAO.length);
    expect(id.pendencias.every((p) => p.motivo === "cadastro não confirmado")).toBe(true);
  });

  it("código IBGE com dígito verificador inconsistente na tabela não é usado", () => {
    const adulterada: EntradaIbge[] = [{ nome: "JOAO PESSOA", uf: "PB", codigoIbge: "2507508" }];
    const id = lerIdentificacaoCheckin(cadastroCompleto(), adulterada);
    expect(id.pendencias).toContainEqual({ chave: "codIbgeMunicipio", motivo: "código IBGE da tabela inconsistente" });
  });

  it("cada código da tabela PB confere com o dígito verificador do IBGE e começa com 25", () => {
    expect(TABELA.length).toBeGreaterThan(0);
    for (const m of TABELA) {
      expect(m.codigoIbge).toMatch(/^25\d{5}$/);
      expect(dvIbge(m.codigoIbge.slice(0, 6))).toBe(Number(m.codigoIbge[6]));
    }
  });
});
