import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { deflateRawSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { converterEntradaLocal } from "../../src/leitura/caixa-unica.js";

const recebidoEm = "2026-10-06T09:00:00-03:00";
function docx(xml: string): Buffer {
  const name = Buffer.from("word/document.xml");
  const compressed = deflateRawSync(Buffer.from(xml));
  const local = Buffer.alloc(30);
  local.writeUInt32LE(0x04034b50);
  local.writeUInt16LE(8, 8);
  local.writeUInt32LE(compressed.length, 18);
  local.writeUInt32LE(Buffer.byteLength(xml), 22);
  local.writeUInt16LE(name.length, 26);
  const directory = Buffer.alloc(46);
  directory.writeUInt32LE(0x02014b50);
  directory.writeUInt16LE(8, 10);
  directory.writeUInt32LE(compressed.length, 20);
  directory.writeUInt32LE(Buffer.byteLength(xml), 24);
  directory.writeUInt16LE(name.length, 28);
  const start = Buffer.concat([local, name, compressed]);
  const central = Buffer.concat([directory, name]);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50);
  end.writeUInt16LE(1, 8);
  end.writeUInt16LE(1, 10);
  end.writeUInt32LE(central.length, 12);
  end.writeUInt32LE(start.length, 16);
  return Buffer.concat([start, central, end]);
}

describe("FUGU-02 · conversão local (parcial: PDF digital depende de parser)", () => {
  it("preserva texto sintético da fixture, hash dos bytes e origem", () => {
    const bytes = readFileSync(new URL("../fixtures/caso07/06-rm-prostata.txt", import.meta.url));
    const result = converterEntradaLocal({ id: "doc-teste-07", tipo: "TEXT", conteudo: bytes, recebidoEm });
    expect(result.status).toBe("PENDENTE");
    expect(result.documento.hash).toBe(createHash("sha256").update(bytes).digest("hex"));
    expect(result.documento.paginas[0]?.texto).toContain("PACIENTE TESTE 07");
    expect(result.documento.paginas[0]?.texto).toContain("[RISCADO]");
    expect(result.documento.recebidoEm).toBe(recebidoEm);
    expect(Object.isFrozen(result.documento.paginas)).toBe(true);
  });

  it("converte DOCX sintético compactado com XML e entidade", () => {
    const bytes = docx('<w:document><w:body><w:p><w:r><w:t>Paciente Teste 07 &amp; exame</w:t></w:r></w:p></w:body></w:document>');
    const result = converterEntradaLocal({ id: "word-teste", tipo: "DOCX", conteudo: bytes, recebidoEm });
    expect(result.status).toBe("PRONTO");
    expect(result.documento.paginas).toEqual([{ n: 1, texto: "Paciente Teste 07 & exame" }]);
  });

  it("rasura Word exige revisão, não promove texto", () => {
    const bytes = docx('<w:document><w:body><w:p><w:r><w:rPr><w:strike/></w:rPr><w:t>rasurado</w:t></w:r></w:p></w:body></w:document>');
    const result = converterEntradaLocal({ id: "word-riscado", tipo: "DOCX", conteudo: bytes, recebidoEm });
    expect(result.status).toBe("PENDENTE");
    expect(result.documento.paginas[0]?.texto).toBe("rasurado");
  });

  it("PDF digital e imagem não são lidos por heurística nem enviados a OCR externo", () => {
    for (const tipo of ["PDF_DIGITAL", "PDF_ESCANEADO", "IMAGEM"] as const) {
      const result = converterEntradaLocal({ id: `doc-${tipo}`, tipo, conteudo: Buffer.from("%PDF-sintetico"), recebidoEm });
      expect(result.status).toBe("PENDENTE");
      expect(result.documento.paginas).toEqual([]);
    }
  });

  it("não infere conteúdo do DOCX malformado nem de entrada vazia", () => {
    expect(converterEntradaLocal({ id: "doc-x", tipo: "DOCX", conteudo: Buffer.from("bad"), recebidoEm }).status)
      .toBe("PENDENTE");
    expect(converterEntradaLocal({ id: "doc-y", tipo: "TEXT", conteudo: "", recebidoEm }).status)
      .toBe("PENDENTE");
  });
});
