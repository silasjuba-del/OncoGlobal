// FN-03 ordenarFila — T-16, T-17. Estável, sem mutar a entrada.
import { describe, expect, it } from "vitest";
import type { EntradaFila } from "../../src/contracts/index.js";
import { ordenarFila } from "../../src/rules/index.js";
import { salaoRuleset } from "../fixtures/rulesets.js";

const entrada = (
  patientId: string,
  ecog: number | null,
  recurso: EntradaFila["recurso"],
  idadeAnos: number,
  hora: string,
): EntradaFila => ({ patientId, ecog, recurso, idadeAnos, chegadaEm: `2026-10-05T${hora}:00-03:00` });

describe("FN-03 ordenarFila", () => {
  it("ordena ECOG4 → ECOG3 → CAMA → CADEIRA → >80 (T-16)", () => {
    const entradas = [
      entrada("p-ecog4", 4, "CADEIRA", 50, "10:00"),
      entrada("p-ecog3", 3, "CADEIRA", 50, "09:00"),
      entrada("p-cama", 2, "CAMA", 50, "11:00"),
      entrada("p-cadeira", 1, "CADEIRA", 50, "08:00"),
      entrada("p-idosa", 1, "CADEIRA", 82, "08:00"),
      entrada("p-amb", 1, "AMBULATORIAL", 40, "07:00"),
    ];
    expect(ordenarFila(entradas, salaoRuleset).map((e: EntradaFila) => e.patientId)).toEqual([
      "p-ecog4", "p-ecog3", "p-cama", "p-cadeira", "p-idosa", "p-amb",
    ]);
  });
  it("empate de nível desempata por ECOG maior (mesmo com chegada mais tardia)", () => {
    const entradas = [
      entrada("p-ecog1", 1, "CAMA", 50, "07:00"),
      entrada("p-ecog2", 2, "CAMA", 50, "11:00"),
    ];
    expect(ordenarFila(entradas, salaoRuleset).map((e: EntradaFila) => e.patientId)).toEqual(["p-ecog2", "p-ecog1"]);
  });
  it("empate de nível e de ECOG desempata por chegada mais antiga", () => {
    const entradas = [
      entrada("p-tarde", 2, "CAMA", 50, "11:00"),
      entrada("p-cedo", 2, "CAMA", 50, "08:00"),
    ];
    expect(ordenarFila(entradas, salaoRuleset).map((e: EntradaFila) => e.patientId)).toEqual(["p-cedo", "p-tarde"]);
  });
  it("não muta o array de entrada", () => {
    const entradas = [
      entrada("p-b", 3, "CADEIRA", 50, "09:00"),
      entrada("p-a", 4, "CADEIRA", 50, "10:00"),
    ];
    const copia = [...entradas];
    ordenarFila(entradas, salaoRuleset);
    expect(entradas).toEqual(copia);
  });
  it("fila vazia → lista vazia (salão segue)", () => {
    expect(ordenarFila([], salaoRuleset)).toEqual([]);
  });
});
