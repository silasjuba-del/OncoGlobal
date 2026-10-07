import { describe, expect, it } from "vitest";
import { consultarGrafoDeTextos, consultarGrafoLocal } from "../../src/app/pesquisa/conhecimento.js";

describe("W10 · consulta local do grafo de conhecimento", () => {
  it("consulta texto real não PHI e devolve somente referências lexicalmente ranqueadas", async () => {
    const result = await consultarGrafoLocal({
      query: "TEOC",
      tipos: ["tema"],
      status: ["NAO_VERIFICADO"],
      proveniencia: { modulo: "01" },
      topK: 3,
    });
    expect(result.status).toBe("OK");
    if (result.status !== "OK") return;
    expect(result.modo).toBe("LEXICAL");
    expect(result.vetorial.status).toBe("NOT_IMPLEMENTED");
    expect(result.resultados.length).toBeGreaterThan(0);
    expect(result.resultados.length).toBeLessThanOrEqual(3);
    expect(result.corpus.arquivos.map((file) => file.sha256)).toEqual([expect.stringMatching(/^[a-f\d]{64}$/u), expect.stringMatching(/^[a-f\d]{64}$/u)]);
    expect(result.resultados[0]?.referencia).toMatchObject({
      classificacao: "REFERENCIA", usavelComoRegra: false, usavelComoFicha: false, status: "NAO_VERIFICADO",
    });
  });

  it("recusa corpus inválido em vez de consultar o subconjunto silenciosamente aceito pelo loader", () => {
    const result = consultarGrafoDeTextos({ query: "TEOC" }, {
      nosJsonl: JSON.stringify({ id: "no.sem-status", tipo: "tema", nome: "TEOC" }),
      arestasJsonl: "",
      arquivos: [],
    });
    expect(result).toMatchObject({ status: "RECUSADA", codigo: "GRAFO_INVALIDO" });
  });
});
