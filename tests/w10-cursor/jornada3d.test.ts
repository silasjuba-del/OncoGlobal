import { describe, expect, it } from "vitest";
import { ctcaeSintetico, limiarRpMm, recistSintetico, somaRecist } from "../../src/ui/oncochart/chart3d-visao.js";
import { montarParadasJornada, sanitizarNarracao } from "../../src/ui/oncochart/jornada-visao.js";
import { timelineSintetica } from "../../src/ui/oncochart/timeline-visao.js";

describe("CURSOR-08 jornada / chart visão", () => {
  it("sanitiza conduta OncoFab e monta paradas da timeline", () => {
    expect(sanitizarNarracao("precisa trocar antes da HT o antidepressivo")).toMatch(
      /interação apontada:/i,
    );
    const paradas = montarParadasJornada(timelineSintetica("pt-verde", "2026-10-06"));
    expect(paradas.length).toBeGreaterThan(0);
    expect(paradas.some((p) => p.hoje)).toBe(true);
    expect(paradas.every((p) => !/trocar antes da HT/i.test(p.narracao))).toBe(true);
  });

  it("RECIST tem limiar −30% e CTCAE só graus confirmados (sem G0)", () => {
    const lesoes = recistSintetico();
    const base = somaRecist(lesoes, 0);
    expect(limiarRpMm(lesoes)).toBeCloseTo(base * 0.7, 5);
    const tox = ctcaeSintetico();
    expect(tox.every((g) => g.grau >= 1)).toBe(true);
    expect(tox.some((g) => (g as { grau: number }).grau === 0)).toBe(false);
  });
});
