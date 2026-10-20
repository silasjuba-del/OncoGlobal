// S-F2-01 (C) · Adaptador IMAP puro e separado do webhook.
// Checkpoint por conta + mailbox + UIDVALIDITY + UID (nunca timestamp, sequência ou Message-ID isolado).
// Mudança de UIDVALIDITY exige reconciliação explícita.
// Autenticação da caixa postal não confirma identidade clínica declarada no From.
import { createHash } from "node:crypto";
import { Instante } from "../../contracts/base.js";
import { CheckpointImapCanal, type EstadoReconciliacaoImap } from "../../contracts/f2/canalEntrada.js";
import { admitirConteudo, hashEstavelEventoCanal, type ConteudoCanal } from "./ingresso.js";

export interface MensagemImapEntrada {
  uidValidity: number;
  uid: number;
  seqno?: number;
  messageIdHeader?: string | null;
  fromAddress: string;
  fromDisplayName?: string | null;
  sentAt: string | null;
  rawBytes: Uint8Array;
  conteudo: ConteudoCanal;
}

export interface MensagemImapNormalizada {
  providerMessageId: string;
  uidValidity: number;
  uid: number;
  senderRef: string;
  fromDisplayNameIgnoradoNaIdentidade: string | null;
  providerSentAt: string | null;
  rawBytesSha256: string;
  eventoSha256: string;
  conteudo: ConteudoCanal;
}

export type DecisaoCheckpointImap =
  | {
    ok: true;
    tipo: "PROCESSAR_LOTE";
    mensagensAdmitidas: MensagemImapNormalizada[];
    uidsJaCheckpointados: number[];
    novoLastUid: number;
  }
  | {
    ok: false;
    codigo:
      | "UIDVALIDITY_ALTERADO_RECONCILIACAO_EXIGIDA"
      | "CHECKPOINT_EM_RECONCILIACAO"
      | "CHECKPOINT_INVALIDO"
      | "MENSAGEM_IMAP_INVALIDA"
      | "ORDEM_UID_INVALIDA";
    uidValidityAnterior?: number;
    uidValidityRecebido?: number;
  };

export function idMensagemImap(mailbox: string, uidValidity: number, uid: number): string {
  return `imap:${mailbox.trim()}:${uidValidity}:${uid}`;
}

/**
 * Rejeita qualquer tentativa de checkpoint por timestamp, número de sequência (seqno) ou Message-ID isolado.
 * Valida conta + mailbox + UIDVALIDITY + lastUid.
 */
export function validarCheckpointImap(candidato: unknown): { ok: true; checkpoint: CheckpointImapCanal } | { ok: false; codigo: "CHECKPOINT_INVALIDO" } {
  const parsed = CheckpointImapCanal.safeParse(candidato);
  if (!parsed.success) return { ok: false, codigo: "CHECKPOINT_INVALIDO" };
  return { ok: true, checkpoint: parsed.data };
}

/**
 * Normaliza e valida um lote de mensagens IMAP contra o checkpoint persistido da caixa.
 * Não apaga, não expurga e não marca como processado antes da persistência local.
 * O From display name nunca é usado como endereço/identificador clínico.
 */
export function prepararLoteImap(entrada: {
  accountId: string;
  mailbox: string;
  uidValiditySessao: number;
  checkpointAtual: CheckpointImapCanal | null;
  mensagens: readonly MensagemImapEntrada[];
  verificadoEm: string;
}): DecisaoCheckpointImap {
  if (!idValido(entrada.accountId) || !idValido(entrada.mailbox)
    || !Number.isInteger(entrada.uidValiditySessao) || entrada.uidValiditySessao <= 0
    || !Instante.safeParse(entrada.verificadoEm).success) {
    return { ok: false, codigo: "CHECKPOINT_INVALIDO" };
  }

  if (entrada.checkpointAtual !== null) {
    const validado = validarCheckpointImap(entrada.checkpointAtual);
    if (!validado.ok
      || validado.checkpoint.accountId !== entrada.accountId
      || validado.checkpoint.mailbox !== entrada.mailbox) {
      return { ok: false, codigo: "CHECKPOINT_INVALIDO" };
    }
    if (validado.checkpoint.estadoReconciliacao === "RECONCILIACAO_UIDVALIDITY_NECESSARIA") {
      return {
        ok: false,
        codigo: "CHECKPOINT_EM_RECONCILIACAO",
        uidValidityAnterior: validado.checkpoint.uidValidity,
        uidValidityRecebido: entrada.uidValiditySessao,
      };
    }
    if (validado.checkpoint.uidValidity !== entrada.uidValiditySessao) {
      return {
        ok: false,
        codigo: "UIDVALIDITY_ALTERADO_RECONCILIACAO_EXIGIDA",
        uidValidityAnterior: validado.checkpoint.uidValidity,
        uidValidityRecebido: entrada.uidValiditySessao,
      };
    }
  }

  const lastUidBase = entrada.checkpointAtual?.lastUid ?? 0;
  let ultimoUidLote = 0;
  const mensagensAdmitidas: MensagemImapNormalizada[] = [];
  const uidsJaCheckpointados: number[] = [];

  for (const msg of entrada.mensagens) {
    if (!Number.isInteger(msg.uidValidity) || msg.uidValidity !== entrada.uidValiditySessao) {
      return {
        ok: false,
        codigo: "UIDVALIDITY_ALTERADO_RECONCILIACAO_EXIGIDA",
        uidValidityAnterior: entrada.uidValiditySessao,
        uidValidityRecebido: msg.uidValidity,
      };
    }
    if (!Number.isInteger(msg.uid) || msg.uid <= 0) {
      return { ok: false, codigo: "MENSAGEM_IMAP_INVALIDA" };
    }
    if (msg.uid <= ultimoUidLote) {
      return { ok: false, codigo: "ORDEM_UID_INVALIDA" };
    }
    ultimoUidLote = msg.uid;

    const enderecoEmail = extrairEnderecoEmailPuro(msg.fromAddress);
    if (!enderecoEmail) return { ok: false, codigo: "MENSAGEM_IMAP_INVALIDA" };
    if (msg.sentAt !== null && !Instante.safeParse(msg.sentAt).success) {
      return { ok: false, codigo: "MENSAGEM_IMAP_INVALIDA" };
    }
    if (!(msg.rawBytes instanceof Uint8Array) || msg.rawBytes.byteLength === 0 || msg.rawBytes.byteLength > 25_000_000) {
      return { ok: false, codigo: "MENSAGEM_IMAP_INVALIDA" };
    }
    const conteudo = admitirConteudo(msg.conteudo);
    if (!conteudo) return { ok: false, codigo: "MENSAGEM_IMAP_INVALIDA" };

    if (msg.uid <= lastUidBase) {
      uidsJaCheckpointados.push(msg.uid);
    }

    const providerMessageId = idMensagemImap(entrada.mailbox, msg.uidValidity, msg.uid);
    const rawBytesSha256 = createHash("sha256").update(msg.rawBytes).digest("hex");
    const eventoSha256 = hashEstavelEventoCanal({
      canal: "EMAIL",
      providerMessageId,
      senderRef: enderecoEmail,
      providerSentAt: msg.sentAt,
      conteudo,
    });

    mensagensAdmitidas.push({
      providerMessageId,
      uidValidity: msg.uidValidity,
      uid: msg.uid,
      senderRef: enderecoEmail,
      fromDisplayNameIgnoradoNaIdentidade: typeof msg.fromDisplayName === "string" && msg.fromDisplayName.trim()
        ? msg.fromDisplayName.trim().slice(0, 250)
        : null,
      providerSentAt: msg.sentAt,
      rawBytesSha256,
      eventoSha256,
      conteudo,
    });
  }

  const novoLastUid = Math.max(lastUidBase, ultimoUidLote);
  return {
    ok: true,
    tipo: "PROCESSAR_LOTE",
    mensagensAdmitidas,
    uidsJaCheckpointados,
    novoLastUid,
  };
}

/**
 * Extrai apenas o endereço de e-mail normalizado em minúsculas.
 * Se vier `"Nome Declarado <endereco-local>"`, extrai apenas a parte entre `<...>` em minúsculas e descarta o nome declaratório.
 */
export function extrairEnderecoEmailPuro(fromRaw: string): string | null {
  if (typeof fromRaw !== "string") return null;
  const limpo = fromRaw.trim();
  if (limpo.length === 0 || limpo.length > 250 || /[\u0000-\u001f]/.test(limpo)) return null;
  const angulo = /<([^<>@\s]+@[^<>@\s]+\.[^<>@\s]+)>$/.exec(limpo);
  const candidato = (angulo ? angulo[1]! : limpo).trim().toLowerCase();
  if (!/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(candidato)) return null;
  return candidato;
}

export function criarCheckpointReconciliado(entrada: {
  accountId: string;
  mailbox: string;
  novoUidValidity: number;
  lastUidReconciliado: number;
  estadoReconciliacao?: EstadoReconciliacaoImap;
  atualizadoEm: string;
}): CheckpointImapCanal {
  return CheckpointImapCanal.parse({
    accountId: entrada.accountId,
    mailbox: entrada.mailbox,
    uidValidity: entrada.novoUidValidity,
    lastUid: entrada.lastUidReconciliado,
    estadoReconciliacao: entrada.estadoReconciliacao ?? "INTEGRO",
    atualizadoEm: entrada.atualizadoEm,
  });
}

function idValido(valor: string): boolean {
  return typeof valor === "string" && valor.length > 0 && valor.length <= 250
    && valor === valor.trim() && !/[\u0000-\u001f]/.test(valor);
}
