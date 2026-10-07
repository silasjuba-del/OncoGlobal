import { describe, expect, it } from "vitest";
import { vincularDocumentoAoPaciente } from "../../src/rules/w8/vinculoDocumento.js";

// Dados SINTÉTICOS para teste (sem vínculo com pacientes reais)
const CPF_SINTETICO_VALIDO = "12345678909";
const CPF_SINTETICO_INVALIDO_DV = "12345678900";
const CNS_SINTETICO_VALIDO = "700000000000005";

const PACIENTE_TESTE_07 = {
  patientId: "pac-teste-07",
  identificadores: [
    { tipo: "CPF" as const, valor: CPF_SINTETICO_VALIDO },
    { tipo: "CNS" as const, valor: CNS_SINTETICO_VALIDO },
  ],
};

describe("AG-02 · Vínculo de documento ao paciente (lições I3–I5)", () => {
  it("I3: comprovante de residência de terceiro (familiar) nunca vincula paciente", () => {
    const res = vincularDocumentoAoPaciente({
      tipoDocumento: "COMPROVANTE_RESIDENCIA_TERCEIRO",
      papelPessoa: "FAMILIAR",
      identificador: { rotulo: "CPF", valor: CPF_SINTETICO_VALIDO },
      pacienteAlvo: PACIENTE_TESTE_07,
    });
    expect(res.liga).toBe(false);
    expect(res.motivo).toContain("comprovante de terceiro");
  });

  it("I4: assinatura ou dado no rodapé de acompanhante nunca vincula paciente", () => {
    const res = vincularDocumentoAoPaciente({
      tipoDocumento: "FICHA_ADMIN",
      papelPessoa: "ACOMPANHANTE",
      identificador: { rotulo: "CPF", valor: CPF_SINTETICO_VALIDO },
      pacienteAlvo: PACIENTE_TESTE_07,
    });
    expect(res.liga).toBe(false);
    expect(res.motivo).toContain("acompanhante");
  });

  it("I5: médico solicitante, assistente ou laudista nunca vincula paciente", () => {
    for (const papel of ["MEDICO_SOLICITANTE", "MEDICO_ASSISTENTE", "MEDICO_LAUDISTA"] as const) {
      const res = vincularDocumentoAoPaciente({
        tipoDocumento: "LAUDO_PRIMARIO",
        papelPessoa: papel,
        identificador: { rotulo: "CRM", valor: "123456" },
        pacienteAlvo: PACIENTE_TESTE_07,
      });
      expect(res.liga).toBe(false);
      expect(res.motivo).toContain("médico");
    }
  });

  it("identificador com DV inválido por valor não vincula paciente", () => {
    const res = vincularDocumentoAoPaciente({
      tipoDocumento: "FICHA_ADMIN",
      papelPessoa: "PACIENTE",
      identificador: { rotulo: "CI", valor: CPF_SINTETICO_INVALIDO_DV },
      pacienteAlvo: PACIENTE_TESTE_07,
    });
    expect(res.liga).toBe(false);
    expect(res.motivo).toContain("inválido");
  });

  it("identificador válido que não pertence ao paciente alvo não vincula", () => {
    const res = vincularDocumentoAoPaciente({
      tipoDocumento: "LAUDO_PRIMARIO",
      papelPessoa: "PACIENTE",
      identificador: { rotulo: "CPF", valor: "11144477735" }, // CPF válido sintético diferente
      pacienteAlvo: PACIENTE_TESTE_07,
    });
    expect(res.liga).toBe(false);
    expect(res.motivo).toContain("não coincide");
  });

  it("identificador exato e válido por valor vincula ao paciente", () => {
    const resCpf = vincularDocumentoAoPaciente({
      tipoDocumento: "LAUDO_PRIMARIO",
      papelPessoa: "PACIENTE",
      identificador: { rotulo: "Cartão SUS", valor: CPF_SINTETICO_VALIDO }, // Mesmo com rótulo errado, o valor é CPF válido
      pacienteAlvo: PACIENTE_TESTE_07,
    });
    expect(resCpf.liga).toBe(true);

    const resCns = vincularDocumentoAoPaciente({
      tipoDocumento: "DOC_PESSOAL",
      papelPessoa: "PACIENTE",
      identificador: { rotulo: "Matrícula", valor: CNS_SINTETICO_VALIDO },
      pacienteAlvo: PACIENTE_TESTE_07,
    });
    expect(resCns.liga).toBe(true);
  });
});
