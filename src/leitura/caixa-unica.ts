import { createHash } from "node:crypto";
import { inflateRawSync } from "node:zlib";
import { avaliarRasuraEConfianca } from "../rules/w8/rasura.js";
import { lerPdfDigital, type PaginaTexto } from "./pdf-digital.js";

export type TipoDocumento = "TEXT" | "DOCX" | "PDF_DIGITAL" | "PDF_ESCANEADO" | "IMAGEM";

export interface DocumentoBruto {
  readonly id: string;
  readonly tipo: TipoDocumento;
  readonly paginas: readonly Readonly<{ n: number; texto: string }>[];
  readonly hash: string;
  readonly recebidoEm: string;
}

export type ResultadoLeitura =
  | Readonly<{ status: "PRONTO"; documento: DocumentoBruto }>
  | Readonly<{ status: "PENDENTE"; documento: DocumentoBruto; motivo: string }>;

export interface EntradaLeitura {
  readonly id: string;
  readonly tipo: TipoDocumento;
  readonly conteudo: string | Uint8Array;
  readonly recebidoEm: string;
}

function lerZipDocx(bytes: Buffer): { text: string; rasurado: boolean } {
  // Diretório central e limites de tamanho são checados antes de usar XML; não valida CRC.
  const eocd = bytes.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  if (eocd < 0 || eocd + 22 > bytes.length) throw new Error("DOCX sem diretório ZIP");
  const n = bytes.readUInt16LE(eocd + 10);
  let pos = bytes.readUInt32LE(eocd + 16);
  let total = 0;
  const MAX_XML = 8 * 1024 * 1024;
  for (let i = 0; i < n; i++) {
    if (pos + 46 > eocd || bytes.readUInt32LE(pos) !== 0x02014b50) {
      throw new Error("Diretório ZIP inválido");
    }
    const flags = bytes.readUInt16LE(pos + 8);
    const method = bytes.readUInt16LE(pos + 10);
    const size = bytes.readUInt32LE(pos + 20);
    const expanded = bytes.readUInt32LE(pos + 24);
    const nameLength = bytes.readUInt16LE(pos + 28);
    const extraLength = bytes.readUInt16LE(pos + 30);
    const commentLength = bytes.readUInt16LE(pos + 32);
    const offset = bytes.readUInt32LE(pos + 42);
    const end = pos + 46 + nameLength + extraLength + commentLength;
    if (end > eocd) throw new Error("Nome ZIP truncado");
    const name = bytes.toString("utf8", pos + 46, pos + 46 + nameLength);
    pos = end;
    if (name !== "word/document.xml") continue;
    if (flags & 1 || (method !== 0 && method !== 8) || expanded > MAX_XML ||
        size > MAX_XML || offset + 30 > bytes.length ||
        bytes.readUInt32LE(offset) !== 0x04034b50) {
      throw new Error("DOCX compactado ilegível ou inseguro");
    }
    const dataStart = offset + 30 + bytes.readUInt16LE(offset + 26) + bytes.readUInt16LE(offset + 28);
    if (dataStart + size > bytes.length) throw new Error("DOCX truncado");
    const compressed = bytes.subarray(dataStart, dataStart + size);
    const xml = method === 0 ? compressed : inflateRawSync(compressed, { maxOutputLength: MAX_XML });
    total += xml.length;
    if (total > MAX_XML || xml.length !== expanded) throw new Error("Tamanho DOCX inconsistente");
    const markup = xml.toString("utf8");
    if (markup.includes("\uFFFD")) throw new Error("XML DOCX não está codificado em UTF-8");
    if (!markup.includes("<w:document")) throw new Error("XML Word inválido");
    // Somente texto dentro de w:t; nenhum HTML/script é interpretado. Texto riscado não é confiável.
    const paras = [...markup.matchAll(/<w:p(?:\s[^>]*)?>([\s\S]*?)<\/w:p>/g)];
    const decodificar = (value: string) => value.replace(/&(#x[0-9a-f]+|#[0-9]+|amp|lt|gt|quot|apos);/gi, (_, entity: string) => {
      const named: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };
      if (entity.startsWith("#")) {
        const cp = entity[1]?.toLowerCase() === "x"
          ? Number.parseInt(entity.slice(2), 16) : Number.parseInt(entity.slice(1), 10);
        return cp > 0 && cp <= 0x10ffff ? String.fromCodePoint(cp) : "ï¿½";
      }
      return named[entity.toLowerCase()] ?? "ï¿½";
    });
    const text = paras.map((p) => {
      const contents = p[1] ?? "";
      return [...contents.matchAll(/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/g)]
        .map((m) => decodificar(m[1] ?? "")).join("");
    }).join("\n").trim();
    return { text, rasurado: /<w:strike(?:\s|\/|>)/.test(markup) };
  }
  throw new Error("DOCX sem word/document.xml");
}

function montarDocumento(
  entrada: EntradaLeitura,
  hash: string,
  paginas: readonly PaginaTexto[],
  pending: string | null,
): ResultadoLeitura {
  const documento: DocumentoBruto = Object.freeze({
    id: entrada.id,
    tipo: entrada.tipo,
    paginas: Object.freeze(paginas.filter((p) => p.texto).map((p) => Object.freeze({ n: p.n, texto: p.texto }))),
    hash,
    recebidoEm: entrada.recebidoEm,
  });
  const motivo = pending ?? (documento.paginas.length ? null : "Documento sem texto legível: PENDENTE");
  return motivo
    ? Object.freeze({ status: "PENDENTE", documento, motivo })
    : Object.freeze({ status: "PRONTO", documento });
}

/**
 * Conversão local síncrona: texto colado e .docx (zip+XML com `node:zlib`, sem dependência nova).
 * PDF digital exige o caminho assíncrono (`converterEntradaLocalAsync`), porque o parser
 * aprovado (`pdfjs-dist`) é assíncrono; PDF escaneado/imagem ficam PENDENTE (D-W9-09).
 */
export function converterEntradaLocal(entrada: EntradaLeitura): ResultadoLeitura {
  if (!entrada.id.trim() || !entrada.recebidoEm.trim()) throw new Error("ID e recebidoEm obrigatórios");
  const bytes = typeof entrada.conteudo === "string"
    ? Buffer.from(entrada.conteudo, "utf8") : Buffer.from(entrada.conteudo);
  const hash = createHash("sha256").update(bytes).digest("hex");
  let text = "";
  let pending: string | null = null;
  if (entrada.tipo === "TEXT") {
    text = typeof entrada.conteudo === "string" ? entrada.conteudo : bytes.toString("utf8");
    if (/\[\/?RISCADO\]/i.test(text)) {
      const rasura = avaliarRasuraEConfianca({ valor: text, riscado: true }, { limiarConfiancaMinima: 0 });
      if (rasura.pendenteRevisao) pending = rasura.motivo;
    }
  } else if (entrada.tipo === "DOCX") {
    try {
      const parsed = lerZipDocx(bytes);
      text = parsed.text;
      // Reaproveita a regra de rasura existente; não inventa limiar para OCR.
      if (parsed.rasurado) {
        const rasura = avaliarRasuraEConfianca({ valor: text, riscado: true }, { limiarConfiancaMinima: 0 });
        if (rasura.pendenteRevisao) pending = rasura.motivo;
      }
    } catch {
      pending = "DOCX ilegível: conferir localmente; nenhuma extração clínica";
    }
  } else if (entrada.tipo === "PDF_DIGITAL") {
    pending = "PDF digital: usar converterEntradaLocalAsync (pdfjs-dist aprovado em D-W9-58)";
  } else {
    // Imagem e PDF escaneado exigem OCR local aprovado; nada vai a serviço externo.
    pending = "PDF escaneado/imagem sem OCR local aprovado: PENDENTE (não solicitar nova foto)";
  }
  if (!text.trim() && pending === null) pending = "Documento sem texto legível: PENDENTE";
  return montarDocumento(entrada, hash, text ? [{ n: 1, texto: text }] : [], pending);
}

/** Conversão local assíncrona: PDF digital por página; demais tipos delegam ao caminho síncrono. */
export async function converterEntradaLocalAsync(entrada: EntradaLeitura): Promise<ResultadoLeitura> {
  if (entrada.tipo !== "PDF_DIGITAL") return converterEntradaLocal(entrada);
  if (!entrada.id.trim() || !entrada.recebidoEm.trim()) throw new Error("ID e recebidoEm obrigatórios");
  const bytes = typeof entrada.conteudo === "string"
    ? Buffer.from(entrada.conteudo, "utf8") : Buffer.from(entrada.conteudo);
  const hash = createHash("sha256").update(bytes).digest("hex");
  let paginas: readonly PaginaTexto[] = [];
  let pending: string | null = null;
  try {
    paginas = await lerPdfDigital(bytes);
  } catch {
    pending = "PDF ilegível: conferir localmente; nenhuma extração clínica";
  }
  if (pending === null && !paginas.some((p) => p.texto)) {
    pending = "PDF digital sem texto legível (escaneado): PENDENTE (não solicitar nova foto)";
  }
  return montarDocumento(entrada, hash, paginas, pending);
}
