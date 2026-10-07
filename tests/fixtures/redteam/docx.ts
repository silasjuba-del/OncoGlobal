// Montador minimalista de DOCX em memória (só o que src/leitura/caixa-unica.ts lê:
// diretório central + entrada local de cada arquivo, método 8 = deflate).
// CRC não é validado pelo leitor; escrevemos 0.
import { deflateRawSync } from "node:zlib";

export interface EntradaZip {
  readonly nome: string;
  readonly dados: Buffer;
}

const u16 = (v: number): Buffer => {
  const b = Buffer.alloc(2);
  b.writeUInt16LE(v & 0xffff);
  return b;
};
const u32 = (v: number): Buffer => {
  const b = Buffer.alloc(4);
  b.writeUInt32LE(v >>> 0);
  return b;
};

/** Monta bytes de um ZIP com as entradas dadas (compression: deflate bruto). */
export function montarZip(entradas: readonly EntradaZip[]): Buffer {
  const locais: Buffer[] = [];
  const centrais: Buffer[] = [];
  let offset = 0;
  for (const { nome, dados } of entradas) {
    const compactado = deflateRawSync(dados);
    const nomeB = Buffer.from(nome, "utf8");
    const local = Buffer.concat([
      Buffer.from([0x50, 0x4b, 0x03, 0x04]),
      u16(20), u16(0), u16(8), u16(0), u16(0),
      u32(0), u32(compactado.length), u32(dados.length),
      u16(nomeB.length), u16(0), nomeB, compactado,
    ]);
    const central = Buffer.concat([
      Buffer.from([0x50, 0x4b, 0x01, 0x02]),
      u16(20), u16(20), u16(0), u16(8), u16(0), u16(0),
      u32(0), u32(compactado.length), u32(dados.length),
      u16(nomeB.length), u16(0), u16(0), u16(0), u16(0), u32(0), u32(offset), nomeB,
    ]);
    locais.push(local);
    centrais.push(central);
    offset += local.length;
  }
  const diretorio = Buffer.concat(centrais);
  const eocd = Buffer.concat([
    Buffer.from([0x50, 0x4b, 0x05, 0x06]),
    u16(0), u16(0), u16(entradas.length), u16(entradas.length),
    u32(diretorio.length), u32(offset), u16(0),
  ]);
  return Buffer.concat([...locais, diretorio, eocd]);
}

const xmlDocumento = (paragrafos: readonly string[]): string =>
  `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
  `<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>` +
  paragrafos.map((p) => `<w:p><w:r><w:t xml:space="preserve">${p}</w:t></w:r></w:p>`).join("") +
  `</w:body></w:document>`;

/** DOCX válido com os parágrafos dados (word/document.xml UTF-8). */
export function montarDocx(paragrafos: readonly string[], extras: readonly EntradaZip[] = []): Buffer {
  return montarZip([
    { nome: "[Content_Types].xml", dados: Buffer.from("<Types/>", "utf8") },
    { nome: "word/document.xml", dados: Buffer.from(xmlDocumento(paragrafos), "utf8") },
    ...extras,
  ]);
}

/** DOCX cujo word/document.xml está codificado em Latin-1 (inválido; DOCX é UTF-8). */
export function montarDocxLatin1(paragrafos: readonly string[]): Buffer {
  return montarZip([{ nome: "word/document.xml", dados: Buffer.from(xmlDocumento(paragrafos), "latin1") }]);
}

/** "Zip bomb" controlado: declara 9 MB expandidos no cabeçalho, conteúdo mínimo. */
export function montarDocxBomba(): Buffer {
  const nomeB = Buffer.from("word/document.xml", "utf8");
  const compactado = deflateRawSync(Buffer.from("<w:document></w:document>", "utf8"));
  const EXPANSIDO_MENTIROSO = 9 * 1024 * 1024; // > MAX_XML (8 MB) do leitor
  const local = Buffer.concat([
    Buffer.from([0x50, 0x4b, 0x03, 0x04]),
    u16(20), u16(0), u16(8), u16(0), u16(0),
    u32(0), u32(compactado.length), u32(EXPANSIDO_MENTIROSO),
    u16(nomeB.length), u16(0), nomeB, compactado,
  ]);
  const central = Buffer.concat([
    Buffer.from([0x50, 0x4b, 0x01, 0x02]),
    u16(20), u16(20), u16(0), u16(8), u16(0), u16(0),
    u32(0), u32(compactado.length), u32(EXPANSIDO_MENTIROSO),
    u16(nomeB.length), u16(0), u16(0), u16(0), u16(0), u32(0), u32(0), nomeB,
  ]);
  const eocd = Buffer.concat([
    Buffer.from([0x50, 0x4b, 0x05, 0x06]),
    u16(0), u16(0), u16(1), u16(1),
    u32(central.length), u32(local.length), u16(0),
  ]);
  return Buffer.concat([local, central, eocd]);
}
