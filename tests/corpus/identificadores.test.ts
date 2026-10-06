// W8/GLM-15 · ruleset identificadores: validação por valor (nunca por rótulo), estrutura sem valores decididos.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { validarRuleset } from "../../src/kernel/corpus/loader.js";

interface Identificador {
  id: string;
  nome: string;
  quantidadeDigitos: number;
  regrasDeInicio?: string;
  digitoVerificador: { quantidadeDigitos: number | string; algoritmo: string };
  ativo: boolean;
  fonte: string;
}
const json = JSON.parse(readFileSync(fileURLToPath(new URL("../../corpus/rulesets/identificadores.v1.json", import.meta.url)), "utf8")) as {
  principio: string;
  identificadores: Identificador[];
  conflitos: { id: string; regra: string; ativo: boolean; fonte: string }[];
};

/** Varredura recursiva devolvendo todo objeto aninhado. */
function* objetos(valor: unknown): Generator<Record<string, unknown>> {
  if (Array.isArray(valor)) { for (const v of valor) yield* objetos(v); return; }
  if (typeof valor === "object" && valor !== null) {
    yield valor as Record<string, unknown>;
    for (const v of Object.values(valor)) yield* objetos(v);
  }
}

describe("identificadores.v1.json (W8/GLM-15)", () => {
  it("header válido (G-17) e id correto", () => {
    const r = validarRuleset(json);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.header.id).toBe("identificadores");
  });

  it("estrutura: CPF com 11 dígitos + DV; CNS com 15 dígitos, início e DV [VERIFICAR]", () => {
    const cpf = json.identificadores.find((i) => i.id === "cpf");
    const cns = json.identificadores.find((i) => i.id === "cns");
    expect(cpf).toBeDefined();
    expect(cns).toBeDefined();
    expect(cpf!.quantidadeDigitos).toBe(11);
    expect(cpf!.digitoVerificador.quantidadeDigitos).toBe(2);
    expect(cns!.quantidadeDigitos).toBe(15);
    expect(cns!.regrasDeInicio).toBe("[VERIFICAR]");
    expect(cns!.digitoVerificador.algoritmo).toBe("[VERIFICAR]");
  });

  it("nenhum algoritmo de DV inventado: toda fonte de identificador é [VERIFICAR]", () => {
    for (const i of json.identificadores) {
      expect(i.fonte, i.id).toBe("[VERIFICAR]");
      expect(i.digitoVerificador.algoritmo, i.id).toBe("[VERIFICAR]");
    }
  });

  it("nada ativo (valida em validate-corpus como item sem fonte); princípio por valor, nunca rótulo", () => {
    for (const o of objetos(json)) expect(o.ativo).not.toBe(true);
    expect(json.principio).toContain("rótulo não prova o tipo");
    expect(json.principio).toContain("classificar pelo valor");
    expect(json.principio).toContain("conflito VERMELHO");
    expect(json.conflitos[0]!.regra).toContain("nunca pelo rótulo");
  });

  it("conflito rótulo×valor descrito com os exemplos do caso real 01 (I1/I2)", () => {
    const c = json.conflitos.find((x) => x.id === "rotulo-x-valor");
    expect(c).toBeDefined();
    for (const exemplo of ["'Cartão SUS' com 11 dígitos", "'CI' repetindo o número do CPF", "'Matrícula' com 15 dígitos"])
      expect(c!.regra).toContain(exemplo);
  });
});
