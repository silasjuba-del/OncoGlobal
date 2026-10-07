// RT-13 · Caixa única e conversão (S1/S3) — provas de DEFESA do conversor local:
// PDF/imagem ficam PENDENTE sem pedir nova foto (D-W9-09); DOCX ilegível/corrompido/bomba
// nunca vira extração clínica; texto é dado (macro/script nunca executa); vazio é PENDENTE.
import { describe, expect, it } from "vitest";
import { converterEntradaLocal } from "../../src/leitura/caixa-unica.js";
import { montarDocx, montarDocxBomba, montarZip } from "../fixtures/redteam/docx.js";

const ENTRADA_EM = "2030-01-01T09:00:00-03:00";
const leitura = (tipo: Parameters<typeof converterEntradaLocal>[0]["tipo"], conteudo: string | Uint8Array, id = "doc-rt13") =>
  converterEntradaLocal({ id, tipo, conteudo, recebidoEm: ENTRADA_EM });

describe("RT-13 · PDF/imagem: PENDENTE, nunca OCR nem pedido de foto", () => {
  it.each(["PDF_DIGITAL", "PDF_ESCANEADO", "IMAGEM"] as const)("%s ⇒ PENDENTE 'não solicitar nova foto'", (tipo) => {
    const saida = leitura(tipo, new Uint8Array([0x25, 0x50, 0x44, 0x46]));
    expect(saida).toMatchObject({ status: "PENDENTE", motivo: expect.stringContaining("não solicitar nova foto") });
    expect(saida.documento.paginas).toEqual([]); // nada é extraído
  });
});

describe("RT-13 · DOCX hostil: ilegível, bomba e macro", () => {
  it("DOCX válido extrai só o texto dos w:t (parágrafos)", () => {
    const saida = leitura("DOCX", montarDocx(["Creatinina 1,4 mg/dL", "Paciente Teste 08"]));
    expect(saida.status).toBe("PRONTO");
    expect(saida.documento.paginas[0]?.texto).toContain("Creatinina 1,4 mg/dL");
  });

  it("DOCX corrompido (não é ZIP) ⇒ PENDENTE 'DOCX ilegível', sem extração", () => {
    const saida = leitura("DOCX", new Uint8Array([0x00, 0x01, 0x02, 0x03, 0x04]));
    expect(saida).toMatchObject({ status: "PENDENTE", motivo: expect.stringContaining("DOCX ilegível") });
    expect(saida.documento.paginas).toEqual([]);
  });

  it("zip bomba controlada (declara 9 MB) ⇒ PENDENTE, sem alocar memória", () => {
    const saida = leitura("DOCX", montarDocxBomba());
    expect(saida.status).toBe("PENDENTE");
    expect(saida.documento.paginas).toEqual([]);
  });

  it("DOCX com macro (vbaProject.bin) extrai só o texto; bytes da macro nunca aparecem", () => {
    const macro = new Uint8Array([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1, 0x00, 0x01]);
    const saida = leitura("DOCX", montarDocx(
      ["laudo sintético sem macro executada"], [{ nome: "word/vbaProject.bin", dados: Buffer.from(macro) }]));
    expect(saida.status).toBe("PRONTO");
    const texto = saida.documento.paginas[0]?.texto ?? "";
    expect(texto).toContain("laudo sintético");
    expect(texto).not.toMatch(/d0cf11e0|vbaProject/iu);
  });
});

describe("RT-13 · extensão falsa, vazio e encoding declarado", () => {
  it("conteúdo binário rotulado TEXT é tratado como DADO (hash estável, nada executa)", () => {
    const lixo = "MZ\u0000\u0001\u0004\u0000\u0090\u0090 executável fingido";
    const a = leitura("TEXT", lixo);
    const b = leitura("TEXT", lixo);
    expect(a.status).toBe("PRONTO");
    expect(a.documento.hash).toBe(b.documento.hash);
    expect(a.documento.paginas[0]?.texto).toBe(lixo);
  });

  it("id ausente é recusado antes de qualquer conversão", () => {
    expect(() => converterEntradaLocal({ id: "  ", tipo: "TEXT", conteudo: "x", recebidoEm: ENTRADA_EM }))
      .toThrow(/ID e recebidoEm obrigatórios/);
  });

  it.each([
    ["texto vazio", ""],
    ["só espaços", "   \n\t  "],
  ])("%s ⇒ PENDENTE 'sem texto legível'", (_nome, conteudo) => {
    const saida = leitura("TEXT", conteudo);
    expect(saida).toMatchObject({ status: "PENDENTE", motivo: expect.stringContaining("sem texto legível") });
  });

  it("UTF-8 com acentos e BOM: texto preservado sem corrupção", () => {
    const comBom = "\uFEFFHb de 9,8 g/dL — crea de 1,4";
    const saida = leitura("TEXT", comBom);
    expect(saida.status).toBe("PRONTO");
    expect(saida.documento.paginas[0]?.texto).toContain("Hb de 9,8 g/dL — crea de 1,4");
  });

  it("CRLF é preservado como dado (nada normaliza em silêncio o que o médico escreveu)", () => {
    const saida = leitura("TEXT", "linha 1\r\nlinha 2");
    expect(saida.documento.paginas[0]?.texto).toContain("\r\n");
  });

  it("[RISCADO] no texto vira PENDENTE de revisão (rasura nunca é extraída como fato)", () => {
    const saida = leitura("TEXT", "diagnóstico: [RISCADO]carcinoma[/RISCADO] indeterminado");
    expect(saida.status).toBe("PENDENTE");
  });
});
