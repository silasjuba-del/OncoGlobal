// ADV-012 · prova cross-boundary sobre DOMINIO@53a2c59 (SHA-256 integrado).
import { describe, expect, it } from "vitest";
import { hashCanonico } from "../../src/modules/tipos.js";
import { renderizarDocumento } from "../../src/modules/documentos/render.js";
import { hashConteudoExibido } from "../../src/server/sessao.js";

describe("ADV-012 · um hash canônico entre módulo, render e servidor", () => {
  it("positivo: chaves reordenadas e conteúdo igual geram mesmo SHA-256 nas duas fronteiras", () => {
    const a = { b: 1, a: { d: true, c: "ação sintética" }, arr: [2, "y", null] };
    const b = { arr: [2, "y", null], a: { c: "ação sintética", d: true }, b: 1 };
    expect(hashConteudoExibido(a)).toBe(hashCanonico(a));
    expect(hashConteudoExibido(b)).toBe(hashCanonico(b));
    expect(hashConteudoExibido(a)).toBe(hashConteudoExibido(b));
    expect(hashConteudoExibido(a)).toMatch(/^[0-9a-f]{64}$/);
  });

  it("negativo: alteração de conteúdo e ordem de array não colidem", () => {
    expect(hashConteudoExibido({ texto: "sintético 1" }))
      .not.toBe(hashConteudoExibido({ texto: "sintético 2" }));
    expect(hashConteudoExibido([1, 2])).not.toBe(hashConteudoExibido([2, 1]));
  });

  it("borda: undefined é null no canon aprovado, inclusive dentro de objeto e array", () => {
    for (const valor of [{ ausente: undefined }, [undefined], { presente: 1, ausente: undefined }]) {
      expect(hashConteudoExibido(valor)).toBe(hashCanonico(valor));
    }
  });

  it("borda: bigint é serializado pelo canon aprovado sem exceção", () => {
    expect(hashConteudoExibido(10n)).toBe(hashCanonico(10n));
    expect(hashConteudoExibido({ valor: 10n })).toBe(hashCanonico({ valor: 10n }));
  });

  it("borda: chaves numéricas preservam a ordenação lexicográfica do canon", () => {
    const valor = { "10": "dez", "2": "dois" };
    expect(hashConteudoExibido(valor)).toBe(hashCanonico(valor));
    expect(hashConteudoExibido({ "2": "dois", "10": "dez" })).toBe(hashCanonico(valor));
  });

  it("render e servidor usam o mesmo hash para o mesmo material canônico", () => {
    const render = renderizarDocumento({
      template: { templateId: "evolucao", versao: "1.0.0", campos: ["queixa", "conduta"],
        proibidoConter: ["ALERTA", "CORRECAO_IA"] },
      fatos: [
        { campo: "queixa", valor: "tosse sintética", revisao: "CONFIRMADO", origem: "FATO_CONFIRMADO" },
        { campo: "conduta", valor: "retorno sintético", revisao: "ASSINADO", origem: "DECISAO_MEDICA" },
      ],
    });
    const material = {
      templateId: "evolucao", versao: "1.0.0",
      campos: [["queixa", "tosse sintética"], ["conduta", "retorno sintético"]],
    };
    expect(hashConteudoExibido(material)).toBe(render.hash);
  });
});
