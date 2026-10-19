// Decisões do ingresso. Não grava, não autentica HMAC e não lê nome como identidade.
import { createHash } from "node:crypto";
import { Instante } from "../../contracts/base.js";
import type { StatusReciboTecnico } from "../../contracts/f2/canalEntrada.js";
import { hashCanonico } from "../hash.js";
import {
  resolverVinculo, type CadastroVinculo, type TipoIdentificador,
} from "./vinculo.js";

const LIMITE_ID = 250;
const LIMITE_TEXTO_BYTES = 250_000;
const LIMITE_MIDIA_BYTES = 25_000_000;
const LIMITE_EVENTOS_ENVELOPE = 50;
const CHAVES_TEXTO = ["providerMessageId", "providerSentAt", "senderRef", "texto", "tipoConteudo"];
const CHAVES_MIDIA = ["media", "providerMessageId", "providerSentAt", "senderRef", "tipoConteudo"];
const CHAVES_MEDIA = ["mimeType", "providerMediaId", "sizeBytes"];
const STATUS_RECIBO_VALIDOS = new Set<StatusReciboTecnico>(["ENVIADA", "ENTREGUE", "LIDA", "FALHOU"]);

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

export type ReciboTecnicoWebhook = {
  providerMessageId: string;
  statusRecibo: StatusReciboTecnico;
  ocorreuEm: string;
  recipientRef: string | null;
  eventoSha256: string;
};

export type OutroEventoWebhook = {
  eventoId: string;
  tipoEvento: string;
  ocorreuEm: string | null;
};

export type EventoEnvelopeWebhook =
  | { categoriaEvento: "MENSAGEM"; mensagem: CorpoWebhook; eventoSha256: string }
  | { categoriaEvento: "RECIBO_TECNICO"; recibo: ReciboTecnicoWebhook }
  | { categoriaEvento: "OUTRO_EVENTO"; outro: OutroEventoWebhook };

export type EnvelopeWebhookInterpretado = {
  envelopeId: string;
  enviadoEm: string | null;
  accountRef: string | null;
  envelopeBytesSha256: string;
  eventos: EventoEnvelopeWebhook[];
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

/**
 * Hash estável do evento individual de mensagem.
 * Metadados variáveis do envelope externo (envelopeId, enviadoEm, tentativa) não entram aqui,
 * evitando falso conflito quando o mesmo evento é reentregue em outro envelope.
 */
export function hashEstavelEventoCanal(entrada: {
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

export function hashEntradaSintetica(entrada: {
  canal: CanalIngresso;
  providerMessageId: string;
  senderRef: string;
  providerSentAt: string | null;
  conteudo: ConteudoCanal;
}): string {
  return hashEstavelEventoCanal(entrada);
}

/** Allowlist do corpo já autenticado. Texto malicioso permanece texto. Mídia não é lida. */
export function interpretarCorpoWebhook(bytes: Uint8Array): { ok: true; corpo: CorpoWebhook } | { ok: false; codigo: "PAYLOAD_MALFORMADO" } {
  let json: unknown;
  try {
    json = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
  } catch {
    return { ok: false, codigo: "PAYLOAD_MALFORMADO" };
  }
  return interpretarObjetoMensagem(json);
}

/**
 * Interpreta um envelope com múltiplos eventos (mensagens, recibos técnicos e outros eventos)
 * ou um corpo de mensagem única. Separa o hash dos bytes crus do envelope do hash estável de cada evento.
 */
export function interpretarEnvelopeWebhook(
  bytes: Uint8Array,
  canal: CanalIngresso = "WHATSAPP_SERVICO",
): { ok: true; envelope: EnvelopeWebhookInterpretado } | { ok: false; codigo: "PAYLOAD_MALFORMADO" } {
  let json: unknown;
  try {
    json = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
  } catch {
    return { ok: false, codigo: "PAYLOAD_MALFORMADO" };
  }
  if (!json || typeof json !== "object" || Array.isArray(json)) return { ok: false, codigo: "PAYLOAD_MALFORMADO" };
  const envelopeBytesSha256 = createHash("sha256").update(bytes).digest("hex");
  const registro = json as Record<string, unknown>;

  // Caso 1: envelope explícito com lista de eventos
  if ("eventos" in registro) {
    const chavesPermitidas = new Set(["envelopeId", "enviadoEm", "accountRef", "eventos"]);
    const chaves = Object.keys(registro);
    if (chaves.some((c) => !chavesPermitidas.has(c))) return { ok: false, codigo: "PAYLOAD_MALFORMADO" };
    if (!idValido(registro.envelopeId)) return { ok: false, codigo: "PAYLOAD_MALFORMADO" };
    if (registro.enviadoEm !== null && registro.enviadoEm !== undefined && !instanteValido(registro.enviadoEm)) {
      return { ok: false, codigo: "PAYLOAD_MALFORMADO" };
    }
    if (registro.accountRef !== undefined && registro.accountRef !== null && !idValido(registro.accountRef)) {
      return { ok: false, codigo: "PAYLOAD_MALFORMADO" };
    }
    if (!Array.isArray(registro.eventos) || registro.eventos.length === 0 || registro.eventos.length > LIMITE_EVENTOS_ENVELOPE) {
      return { ok: false, codigo: "PAYLOAD_MALFORMADO" };
    }
    const eventos: EventoEnvelopeWebhook[] = [];
    for (const bruto of registro.eventos) {
      const ev = interpretarItemEnvelope(bruto, canal);
      if (!ev) return { ok: false, codigo: "PAYLOAD_MALFORMADO" };
      eventos.push(ev);
    }
    return {
      ok: true,
      envelope: {
        envelopeId: registro.envelopeId,
        enviadoEm: (registro.enviadoEm as string | null | undefined) ?? null,
        accountRef: (registro.accountRef as string | null | undefined) ?? null,
        envelopeBytesSha256,
        eventos,
      },
    };
  }

  // Caso 2: mensagem única direta (compatível com receberWebhookCanal legado)
  const unica = interpretarObjetoMensagem(json);
  if (!unica.ok) return unica;
  const eventoSha256 = hashEstavelEventoCanal({ canal, ...unica.corpo });
  return {
    ok: true,
    envelope: {
      envelopeId: `single-${unica.corpo.providerMessageId}`,
      enviadoEm: unica.corpo.providerSentAt,
      accountRef: null,
      envelopeBytesSha256,
      eventos: [{ categoriaEvento: "MENSAGEM", mensagem: unica.corpo, eventoSha256 }],
    },
  };
}

function interpretarItemEnvelope(valor: unknown, canal: CanalIngresso): EventoEnvelopeWebhook | null {
  if (!valor || typeof valor !== "object" || Array.isArray(valor)) return null;
  const item = valor as Record<string, unknown>;
  const chaves = Object.keys(item).sort();
  if (item.categoriaEvento === "MENSAGEM" && mesmaLista(chaves, ["categoriaEvento", "mensagem"])) {
    const msg = interpretarObjetoMensagem(item.mensagem);
    if (!msg.ok) return null;
    return {
      categoriaEvento: "MENSAGEM",
      mensagem: msg.corpo,
      eventoSha256: hashEstavelEventoCanal({ canal, ...msg.corpo }),
    };
  }
  if (item.categoriaEvento === "RECIBO_TECNICO"
    && mesmaLista(chaves, ["categoriaEvento", "ocorreuEm", "providerMessageId", "recipientRef", "statusRecibo"])) {
    if (!idValido(item.providerMessageId) || !instanteValido(item.ocorreuEm)) return null;
    if (typeof item.statusRecibo !== "string" || !STATUS_RECIBO_VALIDOS.has(item.statusRecibo as StatusReciboTecnico)) return null;
    if (item.recipientRef !== null && !idValido(item.recipientRef)) return null;
    const statusRecibo = item.statusRecibo as StatusReciboTecnico;
    const eventoSha256 = hashCanonico({
      categoriaEvento: "RECIBO_TECNICO",
      providerMessageId: item.providerMessageId,
      statusRecibo,
      ocorreuEm: item.ocorreuEm,
      recipientRef: item.recipientRef,
    });
    return {
      categoriaEvento: "RECIBO_TECNICO",
      recibo: {
        providerMessageId: item.providerMessageId,
        statusRecibo,
        ocorreuEm: item.ocorreuEm,
        recipientRef: item.recipientRef as string | null,
        eventoSha256,
      },
    };
  }
  if (item.categoriaEvento === "OUTRO_EVENTO"
    && mesmaLista(chaves, ["categoriaEvento", "eventoId", "ocorreuEm", "tipoEvento"])) {
    if (!idValido(item.eventoId) || !idValido(item.tipoEvento)) return null;
    if (item.ocorreuEm !== null && !instanteValido(item.ocorreuEm)) return null;
    return {
      categoriaEvento: "OUTRO_EVENTO",
      outro: {
        eventoId: item.eventoId,
        tipoEvento: item.tipoEvento,
        ocorreuEm: item.ocorreuEm as string | null,
      },
    };
  }
  return null;
}

function interpretarObjetoMensagem(json: unknown): { ok: true; corpo: CorpoWebhook } | { ok: false; codigo: "PAYLOAD_MALFORMADO" } {
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
  if ((registro.tipoConteudo === "MEDIA" || registro.tipoConteudo === "MEDIA_UNPROCESSED") && mesmaLista(chaves, CHAVES_MIDIA)) {
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
  const chaves = Object.keys(media).sort();
  const aceitaSha = mesmaLista(chaves, ["mimeType", "providerMediaId", "sha256", "sizeBytes"]);
  if (!mesmaLista(chaves, CHAVES_MEDIA) && !aceitaSha) return null;
  if (aceitaSha && media.sha256 !== null) return null;
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
