import { describe, expect, it } from "vitest";
import { montarRevisaoSintetica, resumoExcecoes } from "../../src/ui/oncochart/caixa-revisao-visao.js";

describe("caixa de revisão sintética", () => {
  it("resume ✓ N · ⚠ K e marca órfão sem junção automática", () => {
    const r = montarRevisaoSintetica({
      origemRotulo: "colar",
      texto: "laudo sintético com achado",
      patientIdAberto: "pt-verde",
      candidatos: [{ patientId: "pt-verde", nome: "Paciente Teste", prontuario: "PR-VERDE" }],
    });
    expect(resumoExcecoes(r)).toMatch(/✓ \d+ fatos reconciliados · ⚠ \d+ precisam confirmação/);
    expect(r.excecoes.some((e) => e.patientId == null)).toBe(true);
    expect(r.caixas.some((c) => c.valor == null)).toBe(true);
  });

  it("PDF ilegível deixa caixas PENDENTE", () => {
    const r = montarRevisaoSintetica({
      origemRotulo: "scan-ilegivel.pdf",
      texto: "",
      patientIdAberto: null,
      candidatos: [],
    });
    expect(r.caixas.every((c) => c.valor == null)).toBe(true);
  });
});
