import { describe, expect, it } from "vitest";
import type { Alerta } from "../../src/contracts/operacao.js";
import { renderizarDocumento } from "../../src/modules/documentos/render.js";
import type { EntradaRender } from "../../src/modules/documentos/render.js";

type RecusaAlerta = Alerta extends EntradaRender ? never : true;
type SemChaveDeAlerta = "alertaId" extends keyof EntradaRender ? never : true;
type ParametroRecusaAlerta = Alerta extends Parameters<typeof renderizarDocumento>[0] ? never : true;
const inv09: RecusaAlerta & SemChaveDeAlerta & ParametroRecusaAlerta = true;

const template = {
  templateId: "evolucao", versao: "1.0.0",
  campos: ["queixa", "conduta", "queixa"] as const,
  proibidoConter: ["ALERTA", "CORRECAO_IA"] as const,
};

describe("GRK-04 render", () => {
  it("INV-09: a entrada do render não é um Alerta", () => {
    expect(inv09).toBe(true);
  });

  it("positivo: fato confirmado preenche o campo e o hash é estável", () => {
    const entrada: EntradaRender = {
      template,
      fatos: [
        { campo: "queixa", valor: "tosse", revisao: "CONFIRMADO", origem: "FATO_CONFIRMADO" },
        { campo: "conduta", valor: "retorno", revisao: "ASSINADO", origem: "DECISAO_MEDICA" },
      ],
    };
    const a = renderizarDocumento(entrada);
    const b = renderizarDocumento(entrada);
    expect(a.campos).toEqual({ queixa: "tosse", conduta: "retorno" });
    expect(a.camposVazios).toEqual([]);
    expect(a.templateId).toBe("evolucao");
    expect(a.versao).toBe("1.0.0");
    expect(a.hash).toBe(b.hash);
    expect(a.hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("negativo: campo sem fato fica vazio e listado; fato fora do template não entra", () => {
    const doc = renderizarDocumento({
      template,
      fatos: [{ campo: "alergia", valor: "nenhuma", revisao: "CONFIRMADO", origem: "FATO_CONFIRMADO" }],
    });
    expect(doc.campos).toEqual({ queixa: "", conduta: "" });
    expect(doc.camposVazios).toEqual(["queixa", "conduta"]);
    expect(doc.campos).not.toHaveProperty("alergia");
  });

  it("borda: conflito não elege valor; RAW não preenche; hash muda com o fato", () => {
    const conflito = renderizarDocumento({
      template,
      fatos: [
        { campo: "queixa", valor: "tosse", revisao: "CONFIRMADO", origem: "FATO_CONFIRMADO" },
        { campo: "queixa", valor: "dor", revisao: "ASSINADO", origem: "FATO_CONFIRMADO" },
        { campo: "conduta", valor: "CONFLITO", revisao: "CONFIRMADO", origem: "FATO_CONFIRMADO" },
      ],
    });
    expect(conflito.campos.queixa).toBe("");
    expect(conflito.campos.conduta).toBe("CONFLITO");
    expect(conflito.camposVazios).toEqual(["queixa"]);
    expect(conflito.conflitos).toEqual(["queixa"]);

    const bruto = renderizarDocumento({
      template,
      fatos: [{ campo: "queixa", valor: "tosse", revisao: "RAW" as "CONFIRMADO", origem: "FATO_CONFIRMADO" }],
    });
    expect(bruto.campos.queixa).toBe("");
    expect(bruto.camposVazios).toContain("queixa");

    const vazio = renderizarDocumento({ template, fatos: [] });
    const preenchido = renderizarDocumento({
      template,
      fatos: [{ campo: "queixa", valor: "tosse", revisao: "CONFIRMADO", origem: "FATO_CONFIRMADO" }],
    });
    expect(vazio.hash).not.toBe(preenchido.hash);
  });
});
