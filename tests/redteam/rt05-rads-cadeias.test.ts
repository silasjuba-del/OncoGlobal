// RT-05 · Laudo de imagem e RADS (S0/S1) — provas de DEFESA do avaliador de termos (FN-20):
// alerta só com termo ativo, fonte textual, trecho integral, sempre needs_physician_review;
// negação e antecedente anulam; suspeita vira REVISAO_URGENTE; imagem bruta nunca inferida.
import { describe, expect, it } from "vitest";
import { avaliarRadAlerts } from "../../src/rules/radAlerts.js";
import type { RadRuleset } from "../../src/rules/tipos-w3.js";

const rsAtivo: RadRuleset = {
  id: "rad-emergencia", versao: "1.0.0", ativo: true,
  termosEmergencia: [
    { codigo: "hidronefrose", termo: "hidronefrose", regraId: "R-UROPATIA" },
    { codigo: "compressao-medular", termo: "compressão medular", regraId: "R-COMPRESSAO" },
    { codigo: "formacoes-expansivas", termo: "formações expansivas", regraId: "R-CRANIO" },
  ],
};

const input = (texto: string, tipoFonte: "TRANSCRIPTION" | "IMAGE_RAW" = "TRANSCRIPTION") =>
  ({ tipoFonte, texto, data: "2030-01-01" });

describe("RT-05 · alerta RADS só com cadeia válida e trecho-fonte", () => {
  it("termo de emergência em transcrição ⇒ alerta VERMELHO com trecho e revisão obrigatória", () => {
    const saida = avaliarRadAlerts(input("TC: acentuada hidronefrose à direita com afilamento do parênquima."), rsAtivo);
    expect(saida.alerts).toHaveLength(1);
    const alert = saida.alerts[0];
    expect(alert?.tipo).toBe("RED_RAD_ALERT");
    expect(alert?.needs_physician_review).toBe(true);
    expect(alert?.confirmado).toBe(false);
    expect(alert?.source_text).toContain("hidronefrose à direita");
  });

  it("negação anula o elo: 'sem hidronefrose' não alerta (marca VERDE)", () => {
    const saida = avaliarRadAlerts(input("Rim esquerdo sem hidronefrose, sem cálculos."), rsAtivo);
    expect(saida.alerts).toEqual([]);
    expect(saida.achados.some((a) => a.estado === "VERDE")).toBe(true);
  });

  it("antecedente anula: 'história de compressão medular' tratada em 2028 não alerta", () => {
    const saida = avaliarRadAlerts(input("Paciente com história de compressão medular em 2028, hoje sem sinais."), rsAtivo);
    expect(saida.alerts).toEqual([]);
  });

  it("suspeita eleva para REVISAO_URGENTE (nunca diagnóstico automático)", () => {
    const saida = avaliarRadAlerts(input("suspeita de compressão medular em T7."), rsAtivo);
    expect(saida.alerts[0]?.tipo).toBe("REVISAO_URGENTE");
    expect(saida.alerts[0]?.confirmado).toBe(false);
  });

  it("imagem bruta nunca vira alerta (PENDENTE: nunca inferir de imagem)", () => {
    const saida = avaliarRadAlerts(input("massa epidural com compressão", "IMAGE_RAW"), rsAtivo);
    expect(saida.alerts).toEqual([]);
    expect(saida.achados[0]?.estado).toBe("PENDENTE");
  });

  it("ruleset inativo (corpus esqueleto) ⇒ PENDENTE 'regra não ativa', zero alerta", () => {
    const inativo: RadRuleset = { ...rsAtivo, ativo: false };
    const saida = avaliarRadAlerts(input("hidronefrose bilateral com trombose"), inativo);
    expect(saida.alerts).toEqual([]);
    expect(saida.achados[0]?.motivo).toMatch(/regra não ativa/iu);
  });
});
