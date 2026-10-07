// FN-24b · Sanitizador de artefato ANTES de qualquer saída externa (G-27, N25, INV-12). Puro: sem I/O, sem dependência.
// Escopo real: PDF (metadado /Info + pacote XMP). TEXTO só confere PHI via detector injetado (FN-24 faz a troca).
// IMAGEM/DICOM/pixel NÃO são tratados: devolvem riscoResidual ALTO com [VERIFICAR] explícito — nada é fingido.

export const VERSAO_SANITIZADOR = "1.0.0";

export type TipoArtefato = "TEXTO" | "PDF" | "IMAGEM" | "DICOM";

/** Forma de SanitizationReport (contrato C-21, src/contracts/agentes.ts), sem importar o contrato. */
export interface RelatorioSanitizacao {
  artefatoId: string;
  tipo: TipoArtefato;
  removidos: string[];
  mantidos: string[];
  transformacoes: string[];
  riscoResidual: "BAIXO" | "ALTO";
  versaoSanitizador: string;
  em: string;
}

export interface EntradaSanitizacao {
  artefatoId: string;
  tipo: TipoArtefato;
  bytes?: Uint8Array;
  texto?: string;
  /** ISO-8601 com offset (ex.: 2026-10-07T10:00:00-03:00). Injetado para manter a função pura. */
  em?: string;
  /** true = ainda há PHI no conteúdo (ex.: contemPhiResidual com o dicionário do paciente). */
  detectorPhi?: (conteudo: string) => boolean;
}

export interface ResultadoSanitizacao {
  bytes?: Uint8Array;
  texto?: string;
  report: RelatorioSanitizacao;
}

/** Chaves do dicionário /Info do PDF que podem identificar autor, paciente ou estação (tabela isolada para curadoria). */
export const CHAVES_INFO_PDF: readonly string[] = [
  "Author", "Title", "Subject", "Keywords", "Creator", "Producer", "CreationDate", "ModDate", "Company", "Manager", "LastModifiedBy",
];

const VALOR_PDF = String.raw`(\((?:[^()\\]|\\[\s\S]|\((?:[^()\\]|\\[\s\S])*\))*\)|<[0-9A-Fa-f\s]*>)`;
const reInfo = () => new RegExp(String.raw`/(${CHAVES_INFO_PDF.join("|")})(\s*)${VALOR_PDF}`, "g");
const reXmp = () => /<\?xpacket begin[\s\S]*?<\?xpacket end[^>]*\?>/g;

const brancos = (n: number) => " ".repeat(n);
const paraLatin1 = (b: Uint8Array) => Buffer.from(b).toString("latin1");
const deLatin1 = (s: string) => new Uint8Array(Buffer.from(s, "latin1"));
const valorVazio = (v: string) => v.slice(1, -1).replace(/\s/g, "") === "";

/** Metadados de identificação ainda presentes no PDF (para alimentar G-27). Vazio = nada legível encontrado. */
export function extrairMetadadosPdf(bytes: Uint8Array): Record<string, string> {
  const s = paraLatin1(bytes);
  const out: Record<string, string> = {};
  for (const m of s.matchAll(reInfo())) if (!valorVazio(m[3] ?? "()")) out[m[1] ?? "?"] = (m[3] ?? "").slice(1, -1);
  if (reXmp().test(s)) out["XMP"] = "presente";
  return out;
}

function sanitizarPdf(e: EntradaSanitizacao, base: RelatorioSanitizacao): ResultadoSanitizacao {
  if (!e.bytes || e.bytes.length < 5) return { report: { ...base, mantidos: ["conteúdo ausente"], transformacoes: ["nada a sanitizar: bytes ausentes"], riscoResidual: "ALTO" } };
  const original = paraLatin1(e.bytes);
  if (!original.startsWith("%PDF-"))
    return { report: { ...base, mantidos: ["bytes inteiros"], transformacoes: ["não é PDF (sem cabeçalho %PDF-): nada alterado"], riscoResidual: "ALTO" } };
  const removidos: string[] = [];
  let s = original.replace(reInfo(), (m, chave: string, sp: string, valor: string) => {
    if (valorVazio(valor)) return m;
    removidos.push(`Info/${chave}`);
    return `/${chave}${sp}(${brancos(valor.length - 2)})`;
  });
  s = s.replace(reXmp(), (m) => {
    removidos.push("XMP");
    return brancos(m.length);
  });
  const mantidos = ["conteúdo das páginas (texto/imagens) — não alterado; passe pela FN-24 antes"];
  const transformacoes = ["valores de metadado substituídos por espaços (tamanho e offsets preservados)"];
  let risco: "BAIXO" | "ALTO" = "BAIXO";
  if (/\/ObjStm\b/.test(s)) {
    risco = "ALTO";
    mantidos.push("fluxos de objetos comprimidos (/ObjStm) não inspecionados");
    transformacoes.push("[VERIFICAR] metadado dentro de /ObjStm exige descompressão (não implementada)");
  }
  if (/\/Encrypt\b/.test(s)) {
    risco = "ALTO";
    transformacoes.push("[VERIFICAR] PDF criptografado: metadado não inspecionável");
  }
  if (e.detectorPhi?.(s)) {
    risco = "ALTO";
    mantidos.push("PHI detectado no conteúdo do PDF");
  }
  return { bytes: deLatin1(s), report: { ...base, removidos: [...new Set(removidos)], mantidos, transformacoes, riscoResidual: risco } };
}

/** Sanitiza o artefato e devolve SanitizationReport. Sem relatório BAIXO, G-27 não deixa o artefato sair. */
export function sanitizarArtefato(e: EntradaSanitizacao): ResultadoSanitizacao {
  const base: RelatorioSanitizacao = {
    artefatoId: e.artefatoId, tipo: e.tipo, removidos: [], mantidos: [], transformacoes: [],
    riscoResidual: "ALTO", versaoSanitizador: VERSAO_SANITIZADOR, em: e.em ?? new Date().toISOString(),
  };
  switch (e.tipo) {
    case "PDF":
      return sanitizarPdf(e, base);
    case "TEXTO": {
      const texto = e.texto ?? "";
      const phi = e.detectorPhi ? e.detectorPhi(texto) : true; // sem detector não há prova de limpeza
      return { texto, report: { ...base, mantidos: ["texto inalterado (use FN-24 para desidentificar)"], transformacoes: [e.detectorPhi ? "PHI residual verificado" : "[VERIFICAR] sem detector de PHI informado"], riscoResidual: phi ? "ALTO" : "BAIXO" } };
    }
    default:
      return { report: { ...base, mantidos: ["artefato inteiro"], transformacoes: [`[VERIFICAR] sanitização de ${e.tipo} (metadado/DICOM/pixel) não implementada`], riscoResidual: "ALTO" } };
  }
}
