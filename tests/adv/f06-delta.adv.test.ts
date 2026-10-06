import { describe, expect, it } from "vitest";
import { delta, type SnapshotAtual, type SnapshotConfirmado } from "../../src/rules/delta.js";

const anterior: SnapshotConfirmado = { kind: "CONFIRMED",
  campos: { estadio: { valor: null, estado: "VERMELHO" } } };

describe("F6 · delta clínico, conflito e proposta CURRENT (W4-05)", () => {
  it("ADV-010 · conflito confirmado não vira PENDENTE silencioso se CURRENT estiver ausente", () => {
    const atual: SnapshotAtual = { kind: "CURRENT",
      campos: { estadio: { valor: null, estado: "PENDENTE" } } };
    expect(delta(anterior, atual, {}).itens[0]).toMatchObject({ campo: "estadio", estado: "VERMELHO" });
  });
  it("ADV-010 · proposta não apaga conflito de duas fontes confirmadas", () => {
    const atual = { kind: "CURRENT", campos: { estadio: {
      valor: null, estado: "PENDENTE", proposta: { valor: "proposta sintética", sourceId: "extrator" },
    } } } as SnapshotAtual;
    expect(delta(anterior, atual, {}).itens[0]).toMatchObject({ campo: "estadio", estado: "VERMELHO" });
  });
  it("ADV-010 · ausência do campo CURRENT não rebaixa conflito anterior", () => {
    expect(delta(anterior, { kind: "CURRENT", campos: {} }, {}).itens[0])
      .toMatchObject({ campo: "estadio", estado: "VERMELHO" });
  });
  it("ADV-010 · RESISTIU: só proposta sem fato anterior não gera NOVO VERDE", () => {
    const atual: SnapshotAtual = { kind: "CURRENT",
      campos: { achado: { valor: null, estado: "PENDENTE" } } };
    expect(delta(null, atual, {}).linhaDeBase).toBe(true);
  });
});
