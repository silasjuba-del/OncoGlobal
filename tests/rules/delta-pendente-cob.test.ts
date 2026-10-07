import { describe, expect, it } from "vitest";
import { delta, type SnapshotConfirmado } from "../../src/rules/delta.js";

// FN-14 / T-32: numeros abaixo sao marcadores sinteticos, nao valores clinicos.
describe("FN-14 / T-32: ausente nao significa resolvido no delta", () => {
  const anterior: SnapshotConfirmado = { kind: "CONFIRMED", campos: {
    campoAusente: { valor: 10, estado: "VERDE" },
    campoPresente: { valor: 20, estado: "VERDE" },
  } };

  it("positivo: campo omitido no CURRENT permanece PENDENTE, sem RESOLVEU", () => {
    const itens = delta(anterior, { kind: "CURRENT", campos: {
      campoPresente: { valor: 21, estado: "VERDE" },
    } }, {}).itens;
    expect(itens).toEqual([
      { campo: "campoAusente", classe: "PERSISTE", estado: "PENDENTE" },
      { campo: "campoPresente", classe: "MUDOU", estado: "VERDE", diferencaNumerica: 1 },
    ]);
    expect(itens.some((item) => item.classe === "RESOLVEU")).toBe(false);
  });

  it("negativo: valor null sem resolucao explicita nao vira VERDE", () => {
    const item = delta(anterior, { kind: "CURRENT", campos: {
      campoAusente: { valor: null, estado: "VERDE" },
    } }, {}).itens.find((i) => i.campo === "campoAusente");
    expect(item).toEqual({ campo: "campoAusente", classe: "PERSISTE", estado: "PENDENTE" });
  });

  it("borda: campo antes PENDENTE so aparece como NOVO quando chega valor presente", () => {
    const antes: SnapshotConfirmado = { kind: "CONFIRMED", campos: {
      campoNovo: { valor: null, estado: "PENDENTE" },
    } };
    expect(delta(antes, { kind: "CURRENT", campos: {
      campoNovo: { valor: 1, estado: "VERDE" },
    } }, {}).itens).toEqual([
      { campo: "campoNovo", classe: "NOVO", estado: "VERDE" },
    ]);
  });
});
