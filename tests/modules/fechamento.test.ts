import { describe, expect, it } from "vitest";
import { planejarFechamento } from "../../src/modules/consulta/fechamento.js";

describe("GRK-03 fechamento", () => {
  it("positivo: assina só o que foi exibido e lista o alerta exibido para reconhecimento", () => {
    const plano = planejarFechamento("TUDO", [
      { documentId: "evo-1", documentVersion: 2, exibido: true },
      { documentId: "rec-1", documentVersion: 1, exibido: true },
    ], [
      { alertaId: "al-1", exibido: true },
    ]);
    expect(plano.escopoAssinatura).toEqual([
      { documentId: "evo-1", documentVersion: 2 },
      { documentId: "rec-1", documentVersion: 1 },
    ]);
    expect(plano.alertasAReconhecer).toEqual(["al-1"]);
    expect(plano.imprime).toBe(false);
    expect(plano.motivo).toContain("não imprime");
    expect(JSON.stringify(plano)).not.toContain("IMPRIMIR");
  });

  it("negativo: item ou alerta não exibido fica fora; versão menor que 1 também", () => {
    const plano = planejarFechamento("PRESCRICAO", [
      { documentId: "rx-oculta", documentVersion: 3, exibido: false },
      { documentId: "rx-zero", documentVersion: 0, exibido: true },
      { documentId: " ", documentVersion: 1, exibido: true },
    ], [
      { alertaId: "al-oculto", exibido: false },
      { alertaId: " ", exibido: true },
    ]);
    expect(plano.escopoAssinatura).toEqual([]);
    expect(plano.alertasAReconhecer).toEqual([]);
    expect(plano.imprime).toBe(false);
  });

  it("borda: versão 1 entra; duplicata da mesma versão entra uma vez; versões distintas coexistem", () => {
    const plano = planejarFechamento("EVOLUCAO", [
      { documentId: "evo-1", documentVersion: 1, exibido: true },
      { documentId: "evo-1", documentVersion: 1, exibido: true },
      { documentId: "evo-1", documentVersion: 2, exibido: true },
    ], [
      { alertaId: "al-1", exibido: true },
      { alertaId: "al-1", exibido: true },
    ]);
    expect(plano.escopoAssinatura).toEqual([
      { documentId: "evo-1", documentVersion: 1 },
      { documentId: "evo-1", documentVersion: 2 },
    ]);
    expect(plano.alertasAReconhecer).toEqual(["al-1"]);
  });

  it("bloco desconhecido não monta escopo e continua sem impressão", () => {
    const plano = planejarFechamento("OUTRO" as "TUDO", [
      { documentId: "evo-1", documentVersion: 1, exibido: true },
    ], []);
    expect(plano.bloco).toBeNull();
    expect(plano.escopoAssinatura).toEqual([]);
    expect(plano.imprime).toBe(false);
  });
});
