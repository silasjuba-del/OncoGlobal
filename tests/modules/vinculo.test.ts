import { describe, expect, it } from "vitest";
import { resolverVinculo } from "../../src/modules/canal/vinculo.js";
import type { CadastroVinculo, ContatoVinculo } from "../../src/modules/canal/vinculo.js";

const ANA: CadastroVinculo = {
  patientId: "pac-teste-01",
  identificadores: [
    { tipo: "TELEFONE", valor: "11900000001" },
    { tipo: "CNS", valor: "700000000000001" },
  ],
  chaveDemografica: "1980-01-01|F",
  nome: "Paciente Teste 01",
};

const BIA: CadastroVinculo = {
  patientId: "pac-teste-02",
  identificadores: [{ tipo: "TELEFONE", valor: "11900000001" }],
  chaveDemografica: "1981-02-02|F",
  nome: "Paciente Teste 01",
};

function contato(sobre: Partial<ContatoVinculo> = {}): ContatoVinculo {
  return {
    contatoId: "ct-1",
    tipo: "TELEFONE",
    endereco: "11900000001",
    nomeInformado: "Paciente Teste 01",
    chaveDemografica: null,
    consentimentoRegistrado: true,
    ...sobre,
  };
}

describe("GRK-09 vínculo", () => {
  it("positivo: telefone exato e único vincula; CNS exato vincula mesmo com o mesmo nome em outro cadastro", () => {
    const soAna = resolverVinculo(contato(), [ANA]);
    expect(soAna.classe).toBe("VINCULO");
    expect(soAna.patientId).toBe("pac-teste-01");
    expect(soAna.podeRespostaFixa).toBe(true);

    const porCns = resolverVinculo(contato({ tipo: "CNS", endereco: "700000000000001" }), [ANA, {
      ...BIA,
      identificadores: [{ tipo: "TELEFONE", valor: "11900000099" }],
    }]);
    expect(porCns).toMatchObject({ classe: "VINCULO", patientId: "pac-teste-01" });
  });

  it("negativo: telefone compartilhado e nome igual vão para a fila; sem consentimento não há resposta fixa", () => {
    const compartilhado = resolverVinculo(contato(), [ANA, BIA]);
    expect(compartilhado.classe).toBe("FILA");
    expect(compartilhado.patientId).toBeNull();
    expect(compartilhado.motivo).toContain("telefone compartilhado");

    const soNome = resolverVinculo(contato({ endereco: "11900000077" }), [ANA]);
    expect(soNome.classe).toBe("FILA");
    expect(soNome.patientId).toBeNull();
    expect(soNome.motivo).toContain("nome não vincula");

    const semConsentimento = resolverVinculo(contato({ consentimentoRegistrado: false }), [ANA]);
    expect(semConsentimento.classe).toBe("VINCULO");
    expect(semConsentimento.podeRespostaFixa).toBe(false);
    expect(semConsentimento.motivo).toContain("A10");
  });

  it("borda: demográfico exato é candidato; formatação diferente não liga; trim ainda é o mesmo número", () => {
    const candidato = resolverVinculo(
      contato({ endereco: "nao-cadastrado", chaveDemografica: "1980-01-01|F" }),
      [ANA, BIA],
    );
    expect(candidato.classe).toBe("CANDIDATO");
    expect(candidato.patientId).toBeNull();
    expect(candidato.patientIds).toEqual(["pac-teste-01"]);

    const formatado = resolverVinculo(contato({ endereco: "(11) 90000-0001" }), [ANA]);
    expect(formatado.classe).toBe("FILA");

    const comEspaco = resolverVinculo(contato({ endereco: " 11900000001 " }), [ANA]);
    expect(comEspaco.classe).toBe("VINCULO");

    const doisDemograficos = resolverVinculo(
      contato({ endereco: "outro", chaveDemografica: "1980-01-01|F" }),
      [ANA, { ...BIA, chaveDemografica: "1980-01-01|F", identificadores: [] }],
    );
    expect(doisDemograficos.classe).toBe("FILA");
  });
});
