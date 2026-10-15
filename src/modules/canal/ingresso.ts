// Decisões do ingresso. Não grava, não autentica HMAC e não lê nome como identidade.
import { createHash } from "node:crypto";
import { Instante } from "../../contracts/base.js";
import { hashCanonico } from "../hash.js";
import {
  resolverVinculo, type CadastroVinculo, type TipoIdentificador,
} from "./vinculo.js";

const LIMITE_ID = 250;
const LIMITE_TEXTO_BYTES = 250_000;
const LIMITE_MIDIA_BYTES = 25_000_000;
const CHAVES_TEXTO = ["providerMessageId", "providerSentAt", "senderRef", "texto", "tipoConteudo"];
const CHAVES_MIDIA = ["media", "providerMessageId", "providerSentAt", "senderRef", "tipoConteudo"];
const CHAVES_MEDIA = ["mimeType", "providerMediaId", "sizeBytes"];

export type CanalIngresso = "WHATSAPP_SERVICO" | "EMAIL";
export type ClasseRemetente = "CONHECIDO" | "DESCONHECIDO" | "AMBIGUO";

export type ConteudoCanal =
  | { tipo: "TEXT"; texto: string; contentSha256: string }
  | {
    tipo: "MEDIA_UNPROCESSED";
    processamento: "NAO_PROCESSADA";
    providerMediaId: string;
    mimeType: string | null;
    sizeBytes: number | null;
    contentSha256: null;
  };

export type CorpoWebhook = {
  providerMessageId: string;
  senderRef: string;
  providerSentAt: string | null;
  conteudo: ConteudoCanal;
};

export type VinculoIngresso = {
  classe: ClasseRemetente;
  patientId: string | null;
  motivo: string;
};

export function idMensagem(accountId: string, providerMessageId: string): string {
  const digest = createHash("sha256").update(`${accountId}\u0000${providerMessageId}`).digest("hex").slice(0, 32);
  return `canal-${digest}`;
}

export function hashEntradaSintetica(entrada: {
  canal: CanalIngresso;
  providerMessageId: string;
  senderRef: string;
  providerSentAt: string | null;
  conteudo: ConteudoCanal;
}): string {
  return hashCanonico({
    canal: entrada.canal,
    providerMessageId: entrada.providerMessageId,
    senderRef: entrada.senderRef,
    providerSentAt: entrada.providerSentAt,
    conteudo: entrada.conteudo,
  });
}

/** Allowlist do corpo já autenticado. Texto malicioso permanece texto. Mídia não é lida. */
export function interpretarCorpoWebhook(bytes: Uint8Array): { ok: true; corpo: CorpoWebhook } | { ok: false; codigo: "PAYLOAD_MALFORMADO" } {
  let json: unknown;
  try {
    json = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
  } catch {
    return { ok: false, codigo: "PAYLOAD_MALFORMADO" };
  }
  if (!json || typeof json !== "object" || Array.isArray(json)) return { ok: false, codigo: "PAYLOAD_MALFORMADO" };
  const registro = json as Record<string, unknown>;
  const chaves = Object.keys(registro).sort();
  const comum = lerComum(registro);
  if (!comum) return { ok: false, codigo: "PAYLOAD_MALFORMADO" };
  if (registro.tipoConteudo === "TEXT" && mesmaLista(chaves, CHAVES_TEXTO)) {
    if (typeof registro.texto !== "string" || registro.texto.length === 0) return { ok: false, codigo: "PAYLOAD_MALFORMADO" };
    if (new TextEncoder().encode(registro.texto).byteLength > LIMITE_TEXTO_BYTES) return { ok: false, codigo: "PAYLOAD_MALFORMADO" };
    return {
      ok: true,
      corpo: {
        ...comum,
        conteudo: { tipo: "TEXT", texto: registro.texto, contentSha256: sha256Texto(registro.texto) },
      },
    };
  }
  if (registro.tipoConteudo === "MEDIA" && mesmaLista(chaves, CHAVES_MIDIA)) {
    const midia = lerMidia(registro.media);
    if (!midia) return { ok: false, codigo: "PAYLOAD_MALFORMADO" };
    return { ok: true, corpo: { ...comum, conteudo: midia } };
  }
  return { ok: false, codigo: "PAYLOAD_MALFORMADO" };
}

/** Nome não entra. O resultado é o de resolverVinculo, sem eleger paciente ambíguo. */
export function classificarRemetente(
  endereco: string,
  tipo: TipoIdentificador,
  cadastros: readonly CadastroVinculo[],
): VinculoIngresso {
  const resultado = resolverVinculo({
    contatoId: endereco,
    tipo,
    endereco,
    nomeInformado: null,
    chaveDemografica: null,
    consentimentoRegistrado: false,
  }, cadastros);
  if (resultado.classe === "VINCULO" && resultado.patientId) {
    return { classe: "CONHECIDO", patientId: resultado.patientId, motivo: resultado.motivo };
  }
  if (resultado.classe === "CANDIDATO" || resultado.patientIds.length > 0
    || /compartilhado|mais de um cadastro/.test(resultado.motivo)) {
    return { classe: "AMBIGUO", patientId: null, motivo: resultado.motivo };
  }
  return { classe: "DESCONHECIDO", patientId: null, motivo: resultado.motivo };
}

export function tipoIdentificadorDoCanal(canal: CanalIngresso): TipoIdentificador {
  return canal === "EMAIL" ? "EMAIL" : "TELEFONE";
}

/** Aceita só o conteúdo conhecido. Campo clínico extra não entra e não é apagado em silêncio. */
export function admitirConteudo(valor: unknown): ConteudoCanal | null {
  if (!valor || typeof valor !== "object" || Array.isArray(valor)) return null;
  const registro = valor as Record<string, unknown>;
  const chaves = Object.keys(registro).sort();
  if (registro.tipo === "TEXT" && mesmaLista(chaves, ["contentSha256", "texto", "tipo"])) {
    if (typeof registro.texto !== "string" || registro.texto.length === 0) return null;
    if (new TextEncoder().encode(registro.texto).byteLength > LIMITE_TEXTO_BYTES) return null;
    const contentSha256 = sha256Texto(registro.texto);
    if (registro.contentSha256 !== contentSha256) return null;
    return { tipo: "TEXT", texto: registro.texto, contentSha256 };
  }
  if (registro.tipo === "MEDIA_UNPROCESSED"
    && mesmaLista(chaves, ["contentSha256", "mimeType", "processamento", "providerMediaId", "sizeBytes", "tipo"])) {
    const mimeType = registro.mimeType;
    const sizeBytes = registro.sizeBytes;
    if (registro.processamento !== "NAO_PROCESSADA" || registro.contentSha256 !== null) return null;
    if (!idValido(registro.providerMediaId)) return null;
    if (mimeType !== null && (typeof mimeType !== "string" || mimeType.length === 0 || mimeType.length > 120)) return null;
    if (sizeBytes !== null && (typeof sizeBytes !== "number" || !Number.isInteger(sizeBytes) || sizeBytes < 0 || sizeBytes > LIMITE_MIDIA_BYTES)) return null;
    return {
      tipo: "MEDIA_UNPROCESSED",
      processamento: "NAO_PROCESSADA",
      providerMediaId: registro.providerMediaId,
      mimeType,
      sizeBytes,
      contentSha256: null,
    };
  }
  return null;
}

export function decidirIdempotencia(
  existente: { mensagemId: string; payloadSha256: string } | null,
  recebido: { payloadSha256: string },
): { tipo: "NOVA" } | { tipo: "REPLAY"; mensagemId: string; payloadSha256: string } | {
  tipo: "CONFLITO";
  mensagemId: string;
  payloadSha256Recebido: string;
  payloadSha256Persistido: string;
} {
  if (!existente) return { tipo: "NOVA" };
  if (existente.payloadSha256 === recebido.payloadSha256) {
    return { tipo: "REPLAY", mensagemId: existente.mensagemId, payloadSha256: existente.payloadSha256 };
  }
  return {
    tipo: "CONFLITO",
    mensagemId: existente.mensagemId,
    payloadSha256Recebido: recebido.payloadSha256,
    payloadSha256Persistido: existente.payloadSha256,
  };
}

function lerComum(registro: Record<string, unknown>): Omit<CorpoWebhook, "conteudo"> | null {
  if (!idValido(registro.providerMessageId) || !idValido(registro.senderRef)) return null;
  if (registro.providerSentAt !== null && !instanteValido(registro.providerSentAt)) return null;
  return {
    providerMessageId: registro.providerMessageId,
    senderRef: registro.senderRef,
    providerSentAt: registro.providerSentAt,
  };
}

function lerMidia(valor: unknown): ConteudoCanal | null {
  if (!valor || typeof valor !== "object" || Array.isArray(valor)) return null;
  const media = valor as Record<string, unknown>;
  if (!mesmaLista(Object.keys(media).sort(), CHAVES_MEDIA)) return null;
  const mimeType = media.mimeType;
  const sizeBytes = media.sizeBytes;
  if (!idValido(media.providerMediaId)) return null;
  if (mimeType !== null && (typeof mimeType !== "string" || mimeType.length === 0 || mimeType.length > 120)) return null;
  if (sizeBytes !== null && (typeof sizeBytes !== "number" || !Number.isInteger(sizeBytes) || sizeBytes < 0 || sizeBytes > LIMITE_MIDIA_BYTES)) return null;
  return {
    tipo: "MEDIA_UNPROCESSED",
    processamento: "NAO_PROCESSADA",
    providerMediaId: media.providerMediaId,
    mimeType,
    sizeBytes,
    contentSha256: null,
  };
}

function idValido(valor: unknown): valor is string {
  return typeof valor === "string" && valor.length > 0 && valor.length <= LIMITE_ID && valor === valor.trim()
    && !/[\u0000-\u001f]/.test(valor);
}

function instanteValido(valor: unknown): valor is string {
  return typeof valor === "string" && Instante.safeParse(valor).success;
}

function mesmaLista(recebidas: string[], esperadas: readonly string[]): boolean {
  return recebidas.length === esperadas.length && recebidas.every((chave, indice) => chave === esperadas[indice]);
}

function sha256Texto(texto: string): string {
  return createHash("sha256").update(texto).digest("hex");
}
