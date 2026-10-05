import { describe, expect, it } from "vitest";
import { BUNDLES, montarBundle } from "../../src/modules/consulta/bundles.js";
import type { PackConsulta } from "../../src/modules/consulta/bundles.js";

const PACK: PackConsulta = {
  id: "pack-teste",
  versao: "1",
  fonte: "corpus/packs/teste",
  bundles: [
    {
      bundleId: "RETORNO_QT",
      itens: [
        { documento: "evolucao", preMarcado: true },
        { documento: "receita", preMarcado: false },
      ],
    },
    { bundleId: "FIM_PRIMEIRA_CONSULTA", itens: [] },
  ],
};

describe("GRK-02 bundles", () => {
  it("declara os quatro bundles da decisão", () => {
    expect([...BUNDLES]).toEqual([
      "FIM_PRIMEIRA_CONSULTA",
      "RETORNO_QT",
      "AVALIACAO_RESPOSTA",
      "RENOVACAO_APAC",
    ]);
  });

  it("positivo: copia o manifesto pré-marcado, sem acrescentar documento", () => {
    const bundle = montarBundle(PACK, "RETORNO_QT");
    expect(bundle.estado).toBe("VERDE");
    expect(bundle.itens).toEqual([
      { documento: "evolucao", preMarcado: true },
      { documento: "receita", preMarcado: false },
    ]);
    expect(bundle.itens).not.toBe(PACK.bundles[0]?.itens);
  });

  it("negativo: pack sem o bundle, pack nulo ou id desconhecido → vazio e PENDENTE", () => {
    expect(montarBundle(PACK, "RENOVACAO_APAC")).toMatchObject({ itens: [], estado: "PENDENTE" });
    expect(montarBundle(null, "RETORNO_QT")).toMatchObject({ itens: [], estado: "PENDENTE", motivo: "pack ausente" });
    expect(montarBundle(PACK, "LAUDO_JUDICIAL")).toMatchObject({ itens: [], estado: "PENDENTE", motivo: "bundle desconhecido" });
  });

  it("borda: pack sem fonte não entrega itens; bundle repetido não elege; lista vazia declarada permanece vazia", () => {
    const semFonte = montarBundle({ ...PACK, fonte: " " }, "RETORNO_QT");
    expect(semFonte.estado).toBe("PENDENTE");
    expect(semFonte.itens).toEqual([]);
    expect(semFonte.motivo).toContain("[VERIFICAR]");

    const repetido = montarBundle({
      ...PACK,
      bundles: [...PACK.bundles, { bundleId: "RETORNO_QT", itens: [{ documento: "outro", preMarcado: true }] }],
    }, "RETORNO_QT");
    expect(repetido).toMatchObject({ estado: "PENDENTE", itens: [] });

    expect(montarBundle(PACK, "FIM_PRIMEIRA_CONSULTA")).toMatchObject({ estado: "VERDE", itens: [] });
  });
});
