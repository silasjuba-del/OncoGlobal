import { expect, it } from "vitest";
import { delta, type SnapshotAtual, type SnapshotConfirmado } from "../../src/rules/delta.js";

const previous: SnapshotConfirmado = { kind: "CONFIRMED", campos: {
  Hb: { valor: 11, estado: "VERDE" }, creatinina: { valor: 1, estado: "VERDE" },
  CEA: { valor: 2, estado: "VERDE" }, sintoma: { valor: "dor", estado: "VERDE" },
} };
const current: SnapshotAtual = { kind: "CURRENT", campos: {
  Hb: { valor: 12, estado: "VERDE" }, creatinina: { valor: 2, estado: "VERDE" },
  CEA: { valor: 3, estado: "VERDE" }, sintoma: { valor: null, estado: "PENDENTE" },
  novo: { valor: "texto", estado: "VERDE" },
} };

it("linha de base não inventa delta", () => {
  expect(delta(null, current, {})).toEqual({ linhaDeBase: true, itens: [] });
});
it("FN-14 Hb/creatinina/CEA subindo sem regra são MUDOU, com diferença, sem seta", () => {
  const items = delta(previous, current, {}).itens;
  for (const campo of ["Hb", "creatinina", "CEA"]) {
    expect(items.find((i) => i.campo === campo)).toMatchObject({
      classe: "MUDOU", diferencaNumerica: expect.any(Number),
    });
    expect(items.find((i) => i.campo === campo)).not.toHaveProperty("direcao");
  }
  expect(items.find((i) => i.campo === "novo")?.classe).toBe("NOVO");
  expect(items.find((i) => i.campo === "sintoma")).toMatchObject({ classe: "PERSISTE", estado: "PENDENTE" });
});
it("direção só aparece com regra injetada; RESOLVEU exige evento explícito", () => {
  const result = delta(previous, { ...current, campos: {
    ...current.campos, sintoma: { valor: null, estado: "VERDE", resolvidoExplicitamente: true },
  } }, { Hb: "MAIOR_MELHOR", CEA: "MENOR_MELHOR" }).itens;
  expect(result.find((i) => i.campo === "Hb")?.direcao).toBe("MELHOR");
  expect(result.find((i) => i.campo === "CEA")?.direcao).toBe("PIOR");
  expect(result.find((i) => i.campo === "sintoma")?.classe).toBe("RESOLVEU");
});
it("conflito é VERMELHO; texto que tenta mudar estado não tem autoridade", () => {
  const result = delta(previous, { kind: "CURRENT", campos: {
    Hb: { valor: { state: "CONFIRMADO" }, estado: "VERMELHO" },
  } }, {});
  expect(result.itens.find((i) => i.campo === "Hb")).toMatchObject({ classe: "MUDOU", estado: "VERMELHO" });
  expect(() => delta({ kind: "CURRENT", campos: {} } as never, current, {})).toThrow();
});
