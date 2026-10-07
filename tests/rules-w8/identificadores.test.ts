import { describe, expect, it } from "vitest";
import {
  classificarIdentificador,
  cnsValido,
  cpfValido,
} from "../../src/rules/w8/identificadores.js";

// Números SINTÉTICOS gerados estritamente para teste, sem vínculo com pessoas reais
const CPF_SINTETICO_VALIDO = "12345678909";
const CPF_SINTETICO_INVALIDO_DV = "12345678900"; // DV intencionalmente inválido (Caso 07)
const CNS_SINTETICO_VALIDO = "700000000000005"; // Soma ponderada divisível por 11
const CNS_SINTETICO_INVALIDO_DV = "700000000000004";

describe("AG-01 · Identificador por valor (lições I1–I2)", () => {
  it("valida algoritmo de CPF sintético por DV e rejeita dígitos repetidos", () => {
    expect(cpfValido(CPF_SINTETICO_VALIDO)).toBe(true);
    expect(cpfValido("123.456.789-09")).toBe(true);
    expect(cpfValido(CPF_SINTETICO_INVALIDO_DV)).toBe(false);
    expect(cpfValido("11111111111")).toBe(false);
    expect(cpfValido("123")).toBe(false);
  });

  it("valida algoritmo público do CNS sintético [VERIFICAR fonte]", () => {
    expect(cnsValido(CNS_SINTETICO_VALIDO)).toBe(true);
    expect(cnsValido("700 0000 0000 0005")).toBe(true);
    expect(cnsValido(CNS_SINTETICO_INVALIDO_DV)).toBe(false);
    expect(cnsValido("000000000000000")).toBe(false);
  });

  it("classifica CPF rotulado como 'Cartão SUS' como tipoPorValor: CPF e conflitoRotulo: true", () => {
    const res = classificarIdentificador({
      rotulo: "Cartão SUS",
      valor: CPF_SINTETICO_VALIDO,
    });
    expect(res).toEqual({
      tipoPorValor: "CPF",
      valido: true,
      conflitoRotulo: true,
    });
  });

  it("detecta conflito quando rótulo é 'CI' mas o valor é um CPF de 11 dígitos", () => {
    const res = classificarIdentificador({
      rotulo: "CI",
      valor: CPF_SINTETICO_INVALIDO_DV,
    });
    expect(res).toEqual({
      tipoPorValor: "CPF",
      valido: false,
      conflitoRotulo: true,
    });
  });

  it("classifica CNS rotulado como 'Matrícula' com conflitoRotulo: true", () => {
    const res = classificarIdentificador({
      rotulo: "Matrícula",
      valor: CNS_SINTETICO_VALIDO,
    });
    expect(res).toEqual({
      tipoPorValor: "CNS",
      valido: true,
      conflitoRotulo: true,
    });
  });

  it("sem conflito quando rótulo e tipo apurado por valor concordam", () => {
    const cpfOk = classificarIdentificador({
      rotulo: "CPF",
      valor: CPF_SINTETICO_VALIDO,
    });
    expect(cpfOk).toEqual({
      tipoPorValor: "CPF",
      valido: true,
      conflitoRotulo: false,
    });

    const cnsOk = classificarIdentificador({
      rotulo: "CNS",
      valor: CNS_SINTETICO_VALIDO,
    });
    expect(cnsOk).toEqual({
      tipoPorValor: "CNS",
      valido: true,
      conflitoRotulo: false,
    });
  });

  it("retorna DESCONHECIDO para formatos arbitrários", () => {
    const res = classificarIdentificador({
      rotulo: "Doc",
      valor: "ABC-12345",
    });
    expect(res).toEqual({
      tipoPorValor: "DESCONHECIDO",
      valido: false,
      conflitoRotulo: false,
    });
  });
});
