import { describe, expect, it } from "vitest";
import { escalaDoCanvas } from "../../src/ui/oncochart/escala.js";

describe("escala do canvas OncoChart", () => {
  it("cabe exatamente em 1680×1000", () => {
    expect(escalaDoCanvas(1680, 1000)).toEqual({ escala: 1, x: 0, y: 0 });
  });

  it("letterbox quando a janela é mais baixa ou mais estreita", () => {
    expect(escalaDoCanvas(840, 1000)).toEqual({ escala: 0.5, x: 0, y: 250 });
    expect(escalaDoCanvas(1680, 500)).toEqual({ escala: 0.5, x: 420, y: 0 });
  });

  it("não divide por zero", () => {
    expect(escalaDoCanvas(0, 0)).toEqual({ escala: 1, x: 0, y: 0 });
  });
});
