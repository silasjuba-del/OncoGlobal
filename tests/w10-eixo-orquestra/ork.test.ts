import { expect, it, vi } from "vitest";
import { maestro } from "../../src/orchestration/maestro.js";
import { executarOrk, verificarChamadaAgente } from "../../src/orchestration/ork.js";

it("nomes herdados não selecionam roteiros ou executores", async () => {
  for (const nome of ["constructor", "__proto__", "toString"]) {
    expect(maestro(nome)).toBeNull();
    const run = await executarOrk({ evento: "TESTE", passos: [{ id: nome, dependsOn: [], timeoutMs: 100 }] }, {});
    expect(run.resultados[0]).toMatchObject({ resultado: "missing", tentativas: 0 });
  }
});
it("ORK recusa plano aninhado de um agente antes de chamar executores", async () => {
  const filho = vi.fn(async () => "não executar");
  const plano = { evento: "TESTE", passos: [{ id: "A", dependsOn: [], timeoutMs: 100 }] };
  const run = await executarOrk(plano, { A: async () => {
    expect(verificarChamadaAgente().decisao).toBe("REJEITA");
    return executarOrk(plano, { A: filho });
  } });
  expect(filho).not.toHaveBeenCalled();
  expect(run.estado).toBe("FALHOU");
  expect(verificarChamadaAgente().decisao).toBe("PASSA");
});
it("entrada runtime inválida não chama agentes", async () => {
  const agente = vi.fn(async () => "x");
  for (const timeoutMs of [NaN, Infinity, 0, -1, 2_147_483_648]) {
    await expect(executarOrk({ evento: "T", passos: [{ id: "A", dependsOn: [], timeoutMs }] }, { A: agente }))
      .rejects.toThrow("PLANO_INVALIDO");
  }
  expect(agente).not.toHaveBeenCalled();
});
