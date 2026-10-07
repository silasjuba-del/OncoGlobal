// GROK-14 · ficha inteira. Duas versões não se misturam. Trecho e versão desconhecida falham.
import { describe, expect, it } from "vitest";
import {
  ErroFicha,
  carregarFichaAprovada,
  identidadeFicha,
  type FichaAprovada,
} from "../../src/modules/documentos/biblioteca.js";

describe("GROK-14 carregarFichaAprovada", () => {
  it("carrega a ficha sintética inteira pedida pelo adv", () => {
    const ficha = carregarFichaAprovada({
      templateId: "ficha-teste",
      version: "2.0.0",
      hash: "sha256:esperado",
    });
    expect(ficha.templateId).toBe("ficha-teste");
    expect(ficha.versao).toBe("2.0.0");
    expect(ficha.hash).toBe("sha256:esperado");
    expect(identidadeFicha(ficha)).toBe(
      ["tumor-sintetico", "ficha-teste", "cenario-sintetico", "2.0.0"].join("\u001f"),
    );
  });

  it("duas versões devolvem uma ficha cada, sem misturar cenário nem hash", () => {
    const atual = carregarFichaAprovada({
      templateId: "ficha-teste", version: "2.0.0", hash: "sha256:esperado",
    });
    const anterior = carregarFichaAprovada({
      templateId: "ficha-teste", version: "1.0.0", hash: "sha256:anterior",
    });
    expect(atual.versao).toBe("2.0.0");
    expect(anterior.versao).toBe("1.0.0");
    expect(atual.cenario).not.toBe(anterior.cenario);
    expect(atual.hash).not.toBe(anterior.hash);
    expect(identidadeFicha(atual)).not.toBe(identidadeFicha(anterior));
  });

  it("dose remontada de trechos é recusada", () => {
    expect(() => carregarFichaAprovada({ trechos: ["dose 500mg", "d1-d8"], semFicha: true }))
      .toThrow(ErroFicha);
  });

  it("versão inexistente lança erro tipado e não devolve outra versão", () => {
    let erro: unknown;
    try {
      carregarFichaAprovada({ templateId: "ficha-teste", version: "9.9.9", hash: "x" });
    } catch (capturado) {
      erro = capturado;
    }
    expect(erro).toBeInstanceOf(ErroFicha);
    expect(erro).toMatchObject({ name: "ErroFicha", codigo: "VERSAO" });
  });

  it("hash diferente da versão pedida não entrega a ficha", () => {
    expect(() => carregarFichaAprovada({
      templateId: "ficha-teste", version: "2.0.0", hash: "sha256:outro",
    })).toThrow(ErroFicha);
  });

  it("catálogo injetado escolhe a versão sem usar a ficha padrão", () => {
    const catalogo: FichaAprovada[] = [
      { templateId: "outra", versao: "1.0.0", hash: "h1", tumor: "t", nome: "n", cenario: "c1" },
      { templateId: "outra", versao: "2.0.0", hash: "h2", tumor: "t", nome: "n", cenario: "c2" },
    ];
    const ficha = carregarFichaAprovada(
      { templateId: "outra", version: "2.0.0", hash: "h2" },
      catalogo,
    );
    expect(ficha).toEqual({
      templateId: "outra", versao: "2.0.0", hash: "h2", tumor: "t", nome: "n", cenario: "c2",
    });
    expect(() => carregarFichaAprovada(
      { templateId: "ficha-teste", version: "2.0.0", hash: "sha256:esperado" },
      catalogo,
    )).toThrow(ErroFicha);
  });
});
