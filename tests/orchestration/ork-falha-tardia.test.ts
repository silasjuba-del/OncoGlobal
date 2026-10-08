import { expect, it } from "vitest";
import { executarOrk } from "../../src/orchestration/ork.js";

// Um agente que só rejeita DEPOIS de perder a corrida do timeout não pode
// virar unhandledRejection (derrubaria o processo do orquestrador).
it("rejeição tardia após timeout não derruba o run nem o processo", async () => {
  const rejeicoesTardias: unknown[] = [];
  const anterior = process.listenerCount("unhandledRejection");
  const escuta = (motivo: unknown) => void rejeicoesTardias.push(motivo);
  process.on("unhandledRejection", escuta);

  let chamadas = 0;
  const run = await executarOrk({ evento: "TESTE", passos: [
    { id: "FALHA_TARDIA", dependsOn: [], timeoutMs: 5 },
    { id: "IRMAO", dependsOn: [], timeoutMs: 100 },
  ] }, {
    FALHA_TARDIA: async () => {
      chamadas++;
      await new Promise((resolve) => setTimeout(resolve, 25));
      throw new Error("texto sintético: falha depois do timeout");
    },
    IRMAO: async () => "ok",
  });

  // Tempo suficiente para a rejeição tardia acontecer dentro do teste.
  await new Promise((resolve) => setTimeout(resolve, 60));
  process.off("unhandledRejection", escuta);

  expect(chamadas).toBe(1); // timeout não reenvia às cegas
  expect(run.resultados.find((r) => r.id === "FALHA_TARDIA"))
    .toMatchObject({ resultado: "unattempted", motivo: "TIMEOUT" });
  expect(run.resultados.find((r) => r.id === "IRMAO")).toMatchObject({ resultado: "ok" });
  expect(run.estado).toBe("PRONTO");
  expect(rejeicoesTardias).toEqual([]);
  expect(process.listenerCount("unhandledRejection")).toBe(anterior);
});
