import { describe, expect, it } from "vitest";
import { mesesDoEixo, posicaoNoEixo, timelineSintetica } from "../../src/ui/oncochart/timeline-visao.js";

describe("timeline visão", () => {
  it("posiciona HOJE e eventos futuros no eixo", () => {
    expect(posicaoNoEixo("2026-05-01", "2026-05-01", "2026-12-01")).toBe(0);
    expect(posicaoNoEixo("2026-12-01", "2026-05-01", "2026-12-01")).toBe(100);
    const meio = posicaoNoEixo("2026-08-16", "2026-05-01", "2026-12-01");
    expect(meio).toBeGreaterThan(40);
    expect(meio).toBeLessThan(60);
  });

  it("lista meses e marca futuros tracejados nos dados sintéticos", () => {
    expect(mesesDoEixo("2026-05-01", "2026-07-01").map((m) => m.rotulo)).toEqual(["mai", "jun", "jul"]);
    const tl = timelineSintetica("pt-verde", "2026-10-06");
    expect(tl.lanes).toHaveLength(4);
    expect(tl.barras.some((b) => b.futuro)).toBe(true);
    expect(tl.eventos.some((e) => e.futuro)).toBe(true);
    expect(tl.stageHistory.length).toBeGreaterThan(0);
  });
});
