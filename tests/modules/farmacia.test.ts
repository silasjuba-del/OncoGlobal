import { describe, expect, it } from "vitest";
import { registroEnviado, transicionarFarmacia } from "../../src/modules/farmacia/estados.js";
import type { EstadoFarmacia as EstadoContrato } from "../../src/contracts/estados.js";
import type { EstadoFarmacia as EstadoLocal } from "../../src/modules/farmacia/estados.js";

type EstadoIgual = [EstadoContrato] extends [EstadoLocal]
  ? [EstadoLocal] extends [EstadoContrato] ? true : never
  : never;
const estadoIgual: EstadoIgual = true;

describe("GRK-06 farmácia", () => {
  it("os quatro estados D9 coincidem com o contrato", () => {
    expect(estadoIgual).toBe(true);
  });

  it("positivo: ENVIADA → CONFERIDA e ENVIADA → CORRECAO_PEDIDA → ACEITA", () => {
    const enviada = registroEnviado("rx-teste-01");
    const conferida = transicionarFarmacia(enviada, { ator: "FARMACIA", acao: "CONFERIR" });
    expect(conferida.ok).toBe(true);
    expect(conferida.registro.estado).toBe("CONFERIDA");
    expect(conferida.bloqueiaMedico).toBe(false);

    const pedida = transicionarFarmacia(enviada, {
      ator: "FARMACIA", acao: "PEDIR_CORRECAO", motivo: "dose ilegível no chat",
    });
    expect(pedida.registro.estado).toBe("CORRECAO_PEDIDA");
    const aceita = transicionarFarmacia(pedida.registro, { ator: "MEDICO", acao: "ACEITAR" });
    expect(aceita.ok).toBe(true);
    expect(aceita.registro.estado).toBe("ACEITA");
    expect(aceita.registro.historico.map((evento) => evento.acao)).toEqual(["PEDIR_CORRECAO", "ACEITAR"]);
    expect(aceita.registro.conteudoPrescricaoId).toBe("rx-teste-01");
  });

  it("negativo: edição da farmácia e transição fora do grafo devolvem erro e preservam o estado", () => {
    const enviada = registroEnviado("rx-teste-01");
    const edicao = transicionarFarmacia(enviada, { ator: "FARMACIA", acao: "EDITAR", campo: "dose" });
    expect(edicao.ok).toBe(false);
    expect(edicao.erro?.codigo).toBe("FARMACIA_NAO_EDITA");
    expect(edicao.registro.estado).toBe("ENVIADA");
    expect(edicao.registro.historico).toEqual([]);
    expect(edicao.bloqueiaMedico).toBe(false);
    expect(enviada.historico).toEqual([]);

    const pulo = transicionarFarmacia(enviada, { ator: "MEDICO", acao: "ACEITAR" });
    expect(pulo.ok).toBe(false);
    expect(pulo.erro?.codigo).toBe("TRANSICAO_INVALIDA");
    expect(pulo.registro.estado).toBe("ENVIADA");

    const conferida = transicionarFarmacia(enviada, { ator: "FARMACIA", acao: "CONFERIR" }).registro;
    const depois = transicionarFarmacia(conferida, { ator: "MEDICO", acao: "ACEITAR" });
    expect(depois.ok).toBe(false);
    expect(depois.registro.estado).toBe("CONFERIDA");
  });

  it("borda: motivo em branco não pede correção; recusa conserva histórico e o conteúdo", () => {
    const enviada = registroEnviado("rx-teste-01");
    const branco = transicionarFarmacia(enviada, { ator: "FARMACIA", acao: "PEDIR_CORRECAO", motivo: "  " });
    expect(branco.ok).toBe(false);
    expect(branco.registro.estado).toBe("ENVIADA");

    const pedida = transicionarFarmacia(enviada, {
      ator: "FARMACIA", acao: "PEDIR_CORRECAO", motivo: "conferir superfície",
    }).registro;
    const recusa = transicionarFarmacia(pedida, { ator: "MEDICO", acao: "RECUSAR" });
    expect(recusa.ok).toBe(true);
    expect(recusa.registro.estado).toBe("CORRECAO_PEDIDA");
    expect(recusa.registro.conteudoPrescricaoId).toBe("rx-teste-01");
    expect(recusa.registro.historico.map((evento) => evento.acao)).toEqual(["PEDIR_CORRECAO", "RECUSAR"]);
    expect(pedida.historico).toHaveLength(1);
  });
});
