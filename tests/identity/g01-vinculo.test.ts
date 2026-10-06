import { describe, expect, it } from "vitest";
import type { Contato, Paciente } from "../../src/contracts/clinico.js";
import { rotearContato } from "../../src/kernel/identity/filaVinculo.js";

// Identificadores opacos e nomes sintéticos: não representam pessoas reais.
const cadastro: Paciente[] = [
  { patientId: "p1", nome: "Paciente Teste 01", nascimento: "2000-01-01",
    sexoCadastral: "F", divergencia: false,
    identificadores: [{ tipo: "CNS", valor: "CNS-SINTETICO-01" }] },
  { patientId: "p2", nome: "Paciente Teste 02", nascimento: "2000-02-02",
    sexoCadastral: "M", divergencia: false,
    identificadores: [{ tipo: "CPF", valor: "CPF-SINTETICO-02" }] },
];
const contato: Contato = {
  contatoId: "contato-sintetico", canal: "TELEFONE", endereco: "+55-00-0000-0000",
  patientId: "p1", relacao: "FAMILIAR", vinculadoEm: "2026-10-05T12:00:00Z", revogadoEm: null,
};

describe("G-01 · fronteira de vínculo do contato e identidade", () => {
  it("positivo: contato único e identificador exato mantêm o vínculo sem afirmar identidade do falante", () => {
    const result = rotearContato(contato.endereco, "remetente-01", [contato], {
      identificadores: [{ tipo: "CNS", valor: "CNS-SINTETICO-01" }],
    }, cadastro);
    expect(result).toEqual({ vinculo: contato, identidadePacienteConfirmada: false });
  });

  it("negativo: identificadores de pacientes distintos não promovem vínculo, ainda com contato único", () => {
    const result = rotearContato(contato.endereco, "remetente-02", [contato], {
      identificadores: [
        { tipo: "CNS", valor: "CNS-SINTETICO-01" },
        { tipo: "CPF", valor: "CPF-SINTETICO-02" },
      ],
    }, cadastro);
    expect(result).toEqual({ fila: {
      contatoNaoVinculadoId: "remetente-02", endereco: contato.endereco,
      candidatos: ["p1"], estado: "VERMELHO",
    } });
  });
});
