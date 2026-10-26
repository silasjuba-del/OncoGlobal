import { describe, expect, it } from "vitest";
import { executarOrk } from "../../../src/orchestration/ork.js";
import type { Plano } from "../../../src/orchestration/tipos.js";

// O-H6 (auditoria): o estado do run depende do grafo, não da posição do passo no array.
// tests/orchestration/ork-falha-tardia.test.ts fixa o contrato: ramo paralelo falho com irmão ok → PRONTO.
const agentes = {
  IRMAO: async () => ({ rascunho: "SINTETICO_IRMAO" }),
  FALHA: async () => { throw new Error("SINTETICO: falha do ramo"); },
};

function plano(ordem: readonly string[]): Plano {
  return { evento: "TESTE_SINTETICO_OH6_ORDEM", passos: ordem.map((id) => ({ id, dependsOn: [], timeoutMs: 50 })) };
}

describe("O-H6 · estado independe da ordem dos passos", () => {
  it.each([[["FALHA", "IRMAO"]], [["IRMAO", "FALHA"]]])("ramos paralelos %j: irmão ok mantém PRONTO", async (ordem) => {
    expect((await executarOrk(plano(ordem), agentes)).estado).toBe("PRONTO");
  });

  it("passo terminal falho fica FALHOU mesmo que não seja o último do array", async () => {
    const run = await executarOrk({ evento: "TESTE_SINTETICO_OH6_ORDEM", passos: [
      { id: "FALHA", dependsOn: ["IRMAO"], timeoutMs: 50 },
      { id: "IRMAO", dependsOn: [], timeoutMs: 50 },
    ] }, agentes);
    expect(run.estado).toBe("FALHOU");
  });
});
