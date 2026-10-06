import { describe, expect, it } from "vitest";
import { avaliarTriagem } from "../../src/rules/triagem.js";
import { salaoRuleset } from "../fixtures/rulesets.js";
import { ctxBase, presente, triagemBase } from "../fixtures/triagem.js";

const avaliar = (overrides: Parameters<typeof triagemBase>[0]) =>
  avaliarTriagem(triagemBase(overrides), ctxBase(), salaoRuleset);

describe("F6 · cortes decididos, sem criar limiar clínico novo", () => {
  it("ADV-016 · RESISTIU: PAS 160 passa e 161 corta", () => {
    expect(avaliar({ pas: presente(160) }).cortes.some((m) => m.codigo === "corte.pas.alta")).toBe(false);
    expect(avaliar({ pas: presente(161) }).cortes.some((m) => m.codigo === "corte.pas.alta")).toBe(true);
  });
  it("ADV-016 · RESISTIU: PAS 90 passa e 89 corta", () => {
    expect(avaliar({ pas: presente(90) }).cortes.some((m) => m.codigo === "corte.pas.baixa")).toBe(false);
    expect(avaliar({ pas: presente(89) }).cortes.some((m) => m.codigo === "corte.pas.baixa")).toBe(true);
  });
  it("ADV-016 · RESISTIU: FC 120 passa, 121 corta e 49 só anota", () => {
    expect(avaliar({ fc: presente(120) }).cortes).toHaveLength(0);
    expect(avaliar({ fc: presente(121) }).cortes.some((m) => m.codigo === "corte.fc.alta")).toBe(true);
    expect(avaliar({ fc: presente(49) })).toMatchObject({ cortes: [], naoCortes: [
      expect.objectContaining({ codigo: "naoCorte.fc.baixa" }),
    ] });
  });
  it("ADV-016 · RESISTIU: Hb 80 passa e 79 corta (dg/dL)", () => {
    expect(avaliar({ hbDgDl: presente(80) }).cortes.some((m) => m.codigo === "corte.hb.baixa")).toBe(false);
    expect(avaliar({ hbDgDl: presente(79) }).cortes.some((m) => m.codigo === "corte.hb.baixa")).toBe(true);
  });
  it("ADV-016 · RESISTIU: ANC 1500 passa e 1499 corta", () => {
    expect(avaliar({ anc: presente(1500) }).cortes.some((m) => m.codigo === "corte.anc.baixa")).toBe(false);
    expect(avaliar({ anc: presente(1499) }).cortes.some((m) => m.codigo === "corte.anc.baixa")).toBe(true);
  });
  it("ADV-016 · RESISTIU: grau 4 corta e aciona E1 sem inventar diagnóstico", () => {
    expect(avaliar({ grauCtcae: presente(4) })).toMatchObject({
      emergencia: true, cortes: [expect.objectContaining({ codigo: "corte.grau" })],
    });
  });
});
