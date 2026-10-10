import { describe, expect, it } from "vitest";
import * as api from "../../src/rules/index.js";
import * as triagem from "../../src/rules/triagem.js";
import * as w8 from "../../src/rules/w8/index.js";
import * as identidade from "../../src/rules/w8/identificadores.js";
import { validarCns, calcularCnsDefinitivo } from "../../src/rules/cns.js";
import { validarCns as apac } from "../../src/apac/cns.js";
import { validarCns as modulo } from "../../src/modules/apac/cns.js";
import { cnsValido as llm, desidentificar } from "../../src/kernel/llm/desidentificar.js";
import { vincularDocumentoAoPaciente } from "../../src/rules/w8/vinculoDocumento.js";

describe("Muse: autoridade única para regras e CNS", () => {
  it("barrels preservam exatamente a implementação consumida pelo servidor", () => {
    expect(api.avaliarTriagem).toBe(triagem.avaliarTriagem);
    expect(api.avaliarPortoesW10).toBe(triagem.avaliarPortoesW10);
    expect(w8.classificarIdentificador).toBe(identidade.classificarIdentificador);
    expect(apac).toBe(validarCns); expect(modulo).toBe(validarCns);
  });
  it.each(["345678901234568", "700000000000005", "700000000000004",
    calcularCnsDefinitivo("12345678901"), calcularCnsDefinitivo("23456789012")])("mesma decisão em todas as camadas: %s", (numero) => {
    const valido = validarCns(numero).valido;
    expect(llm(numero)).toBe(valido);
    expect(identidade.cnsValido(numero)).toBe(valido);
    expect(w8.cnsValido(numero)).toBe(valido);
    expect(vincularDocumentoAoPaciente({ tipoDocumento: "LAUDO_PRIMARIO", papelPessoa: "PACIENTE",
      identificador: { valor: numero }, pacienteAlvo: { patientId: "Paciente Teste 01",
        identificadores: [{ tipo: "CNS", valor: numero }] } }).liga).toBe(valido);
  });
  it("prefixo inválido não vincula, mas continua desidentificado como dado pessoal", () => {
    expect(validarCns("345678901234568")).toEqual({ valido: false, motivo: "PREFIXO" });
    expect(desidentificar("CNS 345678901234568", { nomes: [], identificadores: [] }).texto).not.toContain("345678901234568");
  });
});
