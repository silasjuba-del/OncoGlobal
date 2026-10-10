import { describe, expect, it } from "vitest";
import { avaliarRadAlerts } from "../../src/rules/radAlerts.js";
import type { RadRuleset } from "../../src/rules/tipos-w3.js";

const rsAtivo: RadRuleset = {
  id: "rad-fixture", versao: "teste-1", ativo: true,
  termosEmergencia: [
    { codigo: "formacao-expansiva", termo: "formações expansivas", regraId: "R-FORMACAO" },
    { codigo: "formacao-expansiva-singular", termo: "formação expansiva", regraId: "R-FORMACAO-SINGULAR" },
    { codigo: "compressao-medular", termo: "compressão medular", regraId: "R-COMPRESSAO" },
  ],
};

const input = (texto: string) => ({ tipoFonte: "TRANSCRIPTION" as const, texto, data: "2030-01-01" });

describe("W10 entrega · negação contextual em alerta radiológico", () => {
  it.each([
    "Não observamos formações expansivas.",
    "Não há formações expansivas.",
    "Não se observa formação expansiva.",
  ])("não gera alerta quando o laudo nega o termo: %s", (texto) => {
    const resultado = avaliarRadAlerts(input(texto), rsAtivo);

    expect(resultado.alerts).toEqual([]);
    expect(resultado.achados.some((achado) => achado.estado === "VERDE")).toBe(true);
  });

  it("mantém REVISAO_URGENTE para 'não se pode excluir'", () => {
    const resultado = avaliarRadAlerts(input("Não se pode excluir formações expansivas."), rsAtivo);

    expect(resultado.alerts).toHaveLength(1);
    expect(resultado.alerts[0]?.tipo).toBe("REVISAO_URGENTE");
  });

  it("não deixa a negação de uma cláusula apagar um achado positivo na cláusula seguinte", () => {
    const resultado = avaliarRadAlerts(input("Não há formações expansivas; há compressão medular."), rsAtivo);

    expect(resultado.alerts.map((alerta) => alerta.codigo)).toEqual(["compressao-medular"]);
    expect(resultado.alerts[0]?.tipo).toBe("RED_RAD_ALERT");
  });

  it("preserva alerta positivo sem negador", () => {
    const resultado = avaliarRadAlerts(input("O exame demonstra formações expansivas."), rsAtivo);

    expect(resultado.alerts).toHaveLength(1);
    expect(resultado.alerts[0]?.tipo).toBe("RED_RAD_ALERT");
  });
});
