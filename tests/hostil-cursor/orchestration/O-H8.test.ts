import { describe, expect, it, vi } from "vitest";
import { executarOrk } from "../../../src/orchestration/ork.js";
import type { Plano } from "../../../src/orchestration/tipos.js";

const planoUnico = (id: string, timeoutMs = 100): Plano => ({
  evento: "TESTE_SINTETICO_OH8",
  passos: [{ id, dependsOn: [], timeoutMs }],
});

describe("O-H8 · exceções não-Error, promessa rejeitada tarde e timeout de passo", () => {
  it.each([
    ["string literal", "falha sintética em string"],
    ["undefined", undefined],
    ["null", null],
    ["objeto literal sem .message", { codigo: 500, detalhe: "SINTETICO_SEM_MESSAGE" }],
    ["objeto com .message igual a TIMEOUT (não-Error)", { message: "TIMEOUT" }],
  ])("exceção lançada do tipo %s faz retry (2 tentativas) e termina como error/AGENTE_ERRO", async (_rotulo, valorLancado) => {
    let tentativas = 0;
    const run = await executarOrk(planoUnico("PASSO_HOSTIL", 100), {
      PASSO_HOSTIL: async () => {
        tentativas += 1;
        throw valorLancado;
      },
    });

    expect(tentativas).toBe(2);
    expect(run.resultados).toEqual([
      {
        id: "PASSO_HOSTIL",
        resultado: "error",
        motivo: "AGENTE_ERRO",
        tentativas: 2,
      },
    ]);
    expect(run.estado).toBe("FALHOU");
  });

  it("agente que lança Error('TIMEOUT') falsificado antes do timer expirar NÃO pode forjar motivo TIMEOUT sem tentativa de retry", async () => {
    const onTimeout = vi.fn();
    let tentativas = 0;
    const run = await executarOrk(
      planoUnico("PASSO_FALSO_TIMEOUT", 500),
      {
        PASSO_FALSO_TIMEOUT: async () => {
          tentativas += 1;
          throw new Error("TIMEOUT");
        },
      },
      { onTimeout },
    );

    // O timer de 500ms não disparou; logo foi erro do agente (2 tentativas, AGENTE_ERRO), não TIMEOUT real.
    expect(onTimeout).not.toHaveBeenCalled();
    expect(tentativas).toBe(2);
    expect(run.resultados).toEqual([
      {
        id: "PASSO_FALSO_TIMEOUT",
        resultado: "error",
        motivo: "AGENTE_ERRO",
        tentativas: 2,
      },
    ]);
    expect(run.estado).toBe("FALHOU");
  });

  it("promessa rejeitada tarde com valores não-Error (string, undefined, null, objeto) após timeout não gera unhandledRejection e aciona aoDescartarTardio", async () => {
    const rejeicoesNaoTratadas: unknown[] = [];
    const listener = (reason: unknown) => {
      rejeicoesNaoTratadas.push(reason);
    };
    process.on("unhandledRejection", listener);

    const descartados: string[] = [];
    const timeouts: string[] = [];
    try {
      const run = await executarOrk(
        {
          evento: "TESTE_SINTETICO_TARDIO",
          passos: [
            { id: "TARDIO_STRING", dependsOn: [], timeoutMs: 5 },
            { id: "TARDIO_UNDEFINED", dependsOn: [], timeoutMs: 5 },
            { id: "TARDIO_NULL", dependsOn: [], timeoutMs: 5 },
            { id: "TARDIO_OBJETO", dependsOn: [], timeoutMs: 5 },
            { id: "PASSO_FINAL_OK", dependsOn: [], timeoutMs: 100 },
          ],
        },
        {
          TARDIO_STRING: async () => {
            await new Promise((r) => setTimeout(r, 25));
            throw "rejeicao tardia string SINTETICO";
          },
          TARDIO_UNDEFINED: async () => {
            await new Promise((r) => setTimeout(r, 25));
            throw undefined;
          },
          TARDIO_NULL: async () => {
            await new Promise((r) => setTimeout(r, 25));
            throw null;
          },
          TARDIO_OBJETO: async () => {
            await new Promise((r) => setTimeout(r, 25));
            throw { semMessage: true, origem: "SINTETICO" };
          },
          PASSO_FINAL_OK: async () => ({ status: "SINTETICO_OK" }),
        },
        {
          onTimeout: (id) => timeouts.push(id),
          aoDescartarTardio: (id) => descartados.push(id),
        },
      );

      await new Promise((r) => setTimeout(r, 60));

      expect(rejeicoesNaoTratadas).toEqual([]);
      expect(timeouts.sort()).toEqual([
        "TARDIO_NULL",
        "TARDIO_OBJETO",
        "TARDIO_STRING",
        "TARDIO_UNDEFINED",
      ]);
      expect(descartados.sort()).toEqual([
        "TARDIO_NULL",
        "TARDIO_OBJETO",
        "TARDIO_STRING",
        "TARDIO_UNDEFINED",
      ]);
      for (const id of ["TARDIO_STRING", "TARDIO_UNDEFINED", "TARDIO_NULL", "TARDIO_OBJETO"]) {
        expect(run.resultados.find((r) => r.id === id)).toEqual({
          id,
          resultado: "unattempted",
          motivo: "TIMEOUT",
          tentativas: 1,
        });
      }
      expect(run.estado).toBe("PRONTO");
    } finally {
      process.off("unhandledRejection", listener);
    }
  });
});
