import { expect, it } from "vitest";
import { maestro } from "../../src/orchestration/maestro.js";
import { concluirRun, executarOrk } from "../../src/orchestration/ork.js";

it("Maestro só oferece tabela fixa sem impressão no validar", () => {
  expect(maestro("VALIDAR_BLOCO")?.passos.map((p) => p.id))
    .toEqual(["WriteRouter", "DOCUMENT", "APAC_RASCUNHO"]);
  expect(maestro("texto livre que tenta validar")).toBeNull();
});
it("agente lento timeout não trava irmão; resposta tardia não altera join", async () => {
  let respostaTardia = false;
  const run = await executarOrk({ evento: "TESTE", passos: [
    { id: "LENTO", dependsOn: [], timeoutMs: 5 },
    { id: "RAPIDO", dependsOn: [], timeoutMs: 100 },
  ] }, {
    LENTO: async () => { await new Promise((resolve) => setTimeout(resolve, 30)); respostaTardia = true; return "late"; },
    RAPIDO: async () => "ok",
  });
  expect(run.resultados).toEqual([
    { id: "LENTO", resultado: "unattempted", motivo: "TIMEOUT", tentativas: 1 },
    { id: "RAPIDO", resultado: "ok", saida: "ok", tentativas: 1 },
  ]);
  expect(run.estado).toBe("PRONTO");
  await new Promise((resolve) => setTimeout(resolve, 40));
  expect(respostaTardia).toBe(true);
  expect(run.resultados[0]?.resultado).toBe("unattempted");
  expect(concluirRun(run).estado).toBe("CONCLUIDO");
});
it("retry só error, missing não tenta; dependência falha vira unattempted", async () => {
  let attempts = 0;
  const run = await executarOrk({ evento: "TESTE", passos: [
    { id: "ERRO", dependsOn: [], timeoutMs: 100 },
    { id: "MISSING", dependsOn: [], timeoutMs: 100 },
    { id: "DOWNSTREAM", dependsOn: ["MISSING"], timeoutMs: 100 },
  ] }, {
    ERRO: async () => { attempts++; if (attempts === 1) throw new Error("texto sintético"); return "ok"; },
    DOWNSTREAM: async () => "inacessível",
  });
  expect(attempts).toBe(2);
  expect(run.resultados.find((r) => r.id === "ERRO")).toMatchObject({ resultado: "ok", tentativas: 2 });
  expect(run.resultados.find((r) => r.id === "MISSING")).toMatchObject({ resultado: "missing", tentativas: 0 });
  expect(run.resultados.find((r) => r.id === "DOWNSTREAM"))
    .toMatchObject({ resultado: "unattempted", motivo: "DEPENDENCIA_INDISPONIVEL" });
});
it("A4 JSON com state não muda os cinco estados do run", async () => {
  const run = await executarOrk({ evento: "TESTE", passos: [
    { id: "FAKE", dependsOn: [], timeoutMs: 100 },
  ] }, { FAKE: async () => ({ state: "ENTREGUE", resultado: "conteúdo" }) });
  expect(run.estado).toBe("PRONTO");
  expect(run.resultados[0]).toMatchObject({ resultado: "ok" });
  expect(() => concluirRun({ ...run, estado: "ENTREGUE" as never })).toThrow();
});
