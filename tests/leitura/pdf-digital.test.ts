import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { converterEntradaLocal, converterEntradaLocalAsync } from "../../src/leitura/caixa-unica.js";

const recebidoEm = "2026-10-07T09:00:00-03:00";

/** PDF sintético válido montado à mão (xref correto), com texto por página. */
function pdf(paginas: readonly (readonly string[])[]): Buffer {
  const enc = (s: string) => Buffer.from(s, "latin1");
  const conteudos = paginas.map((linhas) => {
    const ops = linhas.map((linha, i) => `${i === 0 ? "" : "0 -18 Td "}(${linha}) Tj`).join(" ");
    return `BT /F1 12 Tf 72 720 Td ${ops} ET`;
  });
  const total = paginas.length;
  const fonte = 3 + total * 2;
  const objs: string[] = [];
  objs[1] = "<< /Type /Catalog /Pages 2 0 R >>";
  objs[2] = `<< /Type /Pages /Kids [${paginas.map((_, i) => `${3 + i * 2} 0 R`).join(" ")}] /Count ${total} >>`;
  for (let i = 0; i < total; i++) {
    const pagina = 3 + i * 2;
    objs[pagina] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 ${fonte} 0 R >> >> /Contents ${pagina + 1} 0 R >>`;
    const conteudo = conteudos[i]!;
    objs[pagina + 1] = `<< /Length ${Buffer.byteLength(conteudo)} >>\nstream\n${conteudo}\nendstream`;
  }
  objs[fonte] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>";
  let saida = enc("%PDF-1.4\n");
  const offsets: number[] = [];
  for (let i = 1; i < objs.length; i++) {
    offsets[i] = saida.length;
    saida = Buffer.concat([saida, enc(`${i} 0 obj\n${objs[i]}\nendobj\n`)]);
  }
  const xref = saida.length;
  let tabela = `xref\n0 ${objs.length}\n0000000000 65535 f \n`;
  for (let i = 1; i < objs.length; i++) tabela += `${String(offsets[i]).padStart(10, "0")} 00000 n \n`;
  saida = Buffer.concat([saida, enc(tabela)]);
  return Buffer.concat([saida, enc(`trailer\n<< /Size ${objs.length} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`)]);
}

describe("FUGU-02 · PDF digital local (pdfjs-dist aprovado em D-W9-58)", () => {
  it("extrai o texto por página com hash dos bytes, sem rede", async () => {
    const bytes = pdf([["PACIENTE TESTE 07 - RM PROSTATA", "Lesao em L5 medindo 24 mm a esquerda."]]);
    const result = await converterEntradaLocalAsync({ id: "pdf-1", tipo: "PDF_DIGITAL", conteudo: bytes, recebidoEm });
    expect(result.status).toBe("PRONTO");
    expect(result.documento.hash).toBe(createHash("sha256").update(bytes).digest("hex"));
    expect(result.documento.paginas).toHaveLength(1);
    expect(result.documento.paginas[0]!.texto).toContain("PACIENTE TESTE 07");
    expect(result.documento.paginas[0]!.texto).toContain("L5");
    expect(Object.isFrozen(result.documento.paginas)).toBe(true);
    expect(result.documento.recebidoEm).toBe(recebidoEm);
  });

  it("mantém uma página por folha do PDF", async () => {
    const bytes = pdf([["Paciente Teste 08 - pagina um"], ["Paciente Teste 08 - pagina dois"]]);
    const result = await converterEntradaLocalAsync({ id: "pdf-2", tipo: "PDF_DIGITAL", conteudo: bytes, recebidoEm });
    expect(result.status).toBe("PRONTO");
    expect(result.documento.paginas.map((p) => p.n)).toEqual([1, 2]);
    expect(result.documento.paginas[1]!.texto).toContain("pagina dois");
  });

  it("PDF digital sem texto legível (escaneado) fica PENDENTE e não pede foto nova", async () => {
    const bytes = pdf([[""]]);
    const result = await converterEntradaLocalAsync({ id: "pdf-3", tipo: "PDF_DIGITAL", conteudo: bytes, recebidoEm });
    if (result.status !== "PENDENTE") throw new Error(`esperava PENDENTE, veio ${result.status}`);
    expect(result.motivo).toContain("escaneado");
    expect(result.documento.paginas).toEqual([]);
  });

  it("PDF ilegível fica PENDENTE sem extração clínica", async () => {
    const result = await converterEntradaLocalAsync({
      id: "pdf-4", tipo: "PDF_DIGITAL", conteudo: Buffer.from("%PDF-sintetico"), recebidoEm,
    });
    expect(result.status).toBe("PENDENTE");
    expect(result.documento.paginas).toEqual([]);
  });

  it("o caminho síncrono não lê PDF digital: aponta para a conversão assíncrona", () => {
    const result = converterEntradaLocal({ id: "pdf-5", tipo: "PDF_DIGITAL", conteudo: Buffer.from("%PDF-sintetico"), recebidoEm });
    if (result.status !== "PENDENTE") throw new Error(`esperava PENDENTE, veio ${result.status}`);
    expect(result.motivo).toContain("converterEntradaLocalAsync");
  });

  it("PDF escaneado e imagem continuam PENDENTE (D-W9-09) e delegam no caminho assíncrono", async () => {
    for (const tipo of ["PDF_ESCANEADO", "IMAGEM"] as const) {
      const result = await converterEntradaLocalAsync({ id: `doc-${tipo}`, tipo, conteudo: Buffer.from("%PDF-sintetico"), recebidoEm });
      expect(result.status).toBe("PENDENTE");
      expect(result.documento.paginas).toEqual([]);
    }
  });

  it("texto e DOCX seguem pelo caminho síncrono quando chamados pelo assíncrono", async () => {
    const result = await converterEntradaLocalAsync({ id: "txt-1", tipo: "TEXT", conteudo: "Paciente Teste 07", recebidoEm });
    expect(result.status).toBe("PRONTO");
    expect(result.documento.paginas[0]!.texto).toBe("Paciente Teste 07");
  });
});
