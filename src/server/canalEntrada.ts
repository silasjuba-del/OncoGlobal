// Ingresso local do canal (S-F2-01).
// - WhatsApp Business: verificação GET challenge separada do recebimento POST autenticado por HMAC-SHA256
//   sobre os bytes crus. Conta e canal vêm da configuração autenticada do servidor.
// - E-mail: adaptador IMAP separado do webhook, com checkpoint por conta + mailbox + UIDVALIDITY + UID.
// - Idempotência por (accountId, providerMessageId), separando hash dos bytes crus do envelope e hash estável do evento.
// - Persistência de mensagem e pendência durável na mesma transação ANTES do ACK.
// - Quarentena durável de conflitos, retomada após reinício, consentimento separado e bloqueio de saída preservado.
import { createHash, randomUUID } from "node:crypto";
import type { DatabaseSync } from "node:sqlite";
import { Instante, Sessao } from "../contracts/base.js";
import {
  CheckpointImapCanal,
  ConsentimentoCanal,
  JanelaIndisponibilidadeCanal,
  type EstadoConsentimentoCanal,
  type FinalidadeConsentimentoCanal,
  type OrigemConsentimentoCanal,
  type ResultadoIdempotenciaCanal,
  type StatusReciboTecnico,
} from "../contracts/f2/canalEntrada.js";
import {
  admitirConteudo, classificarRemetente, decidirIdempotencia, hashEntradaSintetica, hashEstavelEventoCanal,
  idMensagem, interpretarCorpoWebhook, interpretarEnvelopeWebhook, tipoIdentificadorDoCanal,
  type CanalIngresso, type ConteudoCanal, type VinculoIngresso,
} from "../modules/canal/ingresso.js";
import {
  criarCheckpointReconciliado, prepararLoteImap, type MensagemImapEntrada,
} from "../modules/canal/imapIngresso.js";
import type { CadastroVinculo } from "../modules/canal/vinculo.js";
import {
  autenticarWebhookHmac, resolverContaWebhookConfigurada, verificarDesafioWebhookWhatsApp,
  type ContaWebhookConfigurada, type PedidoWebhook, type RecusaWebhook, type ResultadoDesafioWebhook, type ResultadoWebhook,
} from "../modules/canal/autenticarWebhook.js";
import { transacao } from "../kernel/ledger/db.js";
import type { GerenciadorSessao } from "./sessao.js";

export type {
  ResultadoWebhook, ProvaWebhook, WebhookAutenticado, RecusaWebhook,
  ResultadoDesafioWebhook, ContaWebhookConfigurada,
} from "../modules/canal/autenticarWebhook.js";
export {
  LIMITE_BYTES_CORPO_WEBHOOK, verificarDesafioWebhookWhatsApp, resolverContaWebhookConfigurada,
} from "../modules/canal/autenticarWebhook.js";
export type { MensagemImapEntrada } from "../modules/canal/imapIngresso.js";

export type PedidoEntradaWebhook = Omit<PedidoWebhook, "assinatura"> & {
  /** Valor de X-Hub-Signature-256. Vários valores no mesmo pedido são assinatura inválida. */
  assinatura: string | readonly string[] | null | undefined;
};

export type ChaveCanal = { accountId: string; providerMessageId: string };

export type AckCanal =
  | {
    ok: true;
    resultado: "RECEBIDA" | "REPLAY";
    classificacaoIdempotencia?: "NOVA" | "REPLAY";
    persistida: true;
    reciboId: string;
    chave: ChaveCanal;
    payloadSha256: string;
    eventoSha256?: string;
  }
  | {
    ok: false;
    resultado: "CONFLITO_REPLAY";
    classificacaoIdempotencia?: "CONFLITO";
    persistida: false;
    quarentenada?: boolean;
    conflitoId?: string;
    reciboId: string;
    chave: ChaveCanal;
    payloadSha256Recebido: string;
    payloadSha256Persistido: string;
    eventoSha256Recebido?: string;
    eventoSha256Persistido?: string;
  };

export type FalhaArmazenamento = {
  ok: false;
  codigo: "ARMAZENAMENTO_INDISPONIVEL";
  classificacaoIdempotencia?: "FALHA_DE_PERSISTENCIA";
  recuperavel: true;
  persistida: false;
};
export type RecusaEntrada = { ok: false; codigo: "ENTRADA_INVALIDA" | "PAYLOAD_MALFORMADO" | "CONTA_INCORRETA"; persistida: false };

export type AcessoCanal = { sessoes: GerenciadorSessao; token: string; agora: string };

export type ItemCaixa = {
  mensagemId: string;
  accountId: string;
  canal: CanalIngresso;
  providerMessageId: string;
  senderRef: string;
  providerSentAt: string | null;
  ingestedAt: string;
  payloadSha256: string;
  reciboTecnico: "RECEBIDA";
  vinculo: VinculoIngresso;
  conteudo: ConteudoCanal;
  decisaoClinica: null;
  evolucaoIncorporada: false;
  prescricao: false;
  assinatura: false;
  envioAutorizado: false;
};

export type ItemPendenciaCanal = {
  pendenciaId: string;
  mensagemId: string;
  accountId: string;
  criadoEm: string;
  estado: "PENDENTE_PROCESSAMENTO" | "PROCESSADA";
  resolvidoEm: string | null;
};

export type ItemConflitoQuarentena = {
  conflitoId: string;
  accountId: string;
  providerMessageId: string;
  mensagemIdOriginal: string;
  payloadSha256Persistido: string;
  payloadSha256Recebido: string;
  eventoSha256Persistido: string;
  eventoSha256Recebido: string;
  registradoEm: string;
};

export type ItemReciboTecnico = {
  reciboTecnicoId: string;
  accountId: string;
  providerMessageId: string;
  statusRecibo: StatusReciboTecnico;
  ocorreuEm: string;
  ingestedAt: string;
};

export type ResultadoEnvelopeWebhook =
  | RecusaWebhook
  | RecusaEntrada
  | FalhaArmazenamento
  | {
    ok: true;
    envelopeId: string;
    accountId: string;
    ackAutorizado: true;
    mensagens: Array<{
      providerMessageId: string;
      classificacao: ResultadoIdempotenciaCanal;
      reciboId: string;
      quarentenada: boolean;
    }>;
    recibosTecnicosPersistidos: number;
    outrosEventosIgnorados: number;
  }
  | {
    ok: false;
    codigo: "CONFLITO_ENVELOPE" | "CONFLITO_REPLAY";
    envelopeId: string;
    accountId: string;
    ackAutorizado: false;
    conflitos: ItemConflitoQuarentena[];
  };

export type LogCanal = (evento: { codigo: string; accountId: string; providerMessageId: string | null }) => void;

type Linha = {
  mensagemId: string;
  accountId: string;
  providerMessageId: string;
  canal: string;
  senderRef: string;
  providerSentAt: string | null;
  ingestedAt: string;
  payloadSha256: string;
  conteudo: string;
  vinculoClasse: string;
  vinculoPatientId: string | null;
  vinculoMotivo: string;
  provaMetodo: string;
};

const LIMITE_CAIXA = 500;

export function autenticarEntradaWebhook(pedido: PedidoEntradaWebhook): ResultadoWebhook {
  const assinatura = umaAssinatura(pedido.assinatura);
  if (assinatura === "varias") return { ok: false, codigo: "ASSINATURA_INVALIDA" };
  return autenticarWebhookHmac({
    bytes: pedido.bytes, segredo: pedido.segredo, keyId: pedido.keyId,
    verificadoEm: pedido.verificadoEm, assinatura,
  });
}

/** Verifica PRAGMAs de durabilidade do SQLite local antes de aceitar ingresso. */
export function verificarDurabilidadeSqlite(db: DatabaseSync): {
  ok: boolean;
  journalMode: string;
  synchronous: number;
  queryOnly: number;
} {
  try {
    db.exec("PRAGMA foreign_keys = ON; PRAGMA synchronous = FULL;");
    const jm = db.prepare("PRAGMA journal_mode").get() as { journal_mode?: string } | undefined;
    const sync = db.prepare("PRAGMA synchronous").get() as { synchronous?: number } | undefined;
    const qo = db.prepare("PRAGMA query_only").get() as { query_only?: number } | undefined;
    const journalMode = String(jm?.journal_mode ?? "").toLowerCase();
    const synchronous = Number(sync?.synchronous ?? -1);
    const queryOnly = Number(qo?.query_only ?? 0);
    return {
      ok: (journalMode === "wal" || journalMode === "memory") && synchronous >= 1 && queryOnly === 0,
      journalMode,
      synchronous,
      queryOnly,
    };
  } catch {
    return { ok: false, journalMode: "erro", synchronous: -1, queryOnly: 1 };
  }
}

/** HMAC, depois gravação + pendência durável, e só então o ACK. Falha de autenticação não grava. */
export function receberWebhookCanal(
  db: DatabaseSync,
  pedido: PedidoEntradaWebhook,
  contexto: {
    accountId: string;
    canal: CanalIngresso;
    cadastros: readonly CadastroVinculo[];
    log?: LogCanal;
    quarentenarConflito?: boolean;
  },
): RecusaWebhook | RecusaEntrada | AckCanal | FalhaArmazenamento {
  const autenticado = autenticarEntradaWebhook(pedido);
  if (!autenticado.ok) {
    contexto.log?.({ codigo: autenticado.codigo, accountId: contexto.accountId, providerMessageId: null });
    return autenticado;
  }
  const corpo = interpretarCorpoWebhook(autenticado.bytes);
  if (!corpo.ok) {
    contexto.log?.({ codigo: corpo.codigo, accountId: contexto.accountId, providerMessageId: null });
    return { ...corpo, persistida: false };
  }
  const eventoSha256 = hashEstavelEventoCanal({
    canal: contexto.canal,
    ...corpo.corpo,
  });
  const gravado = persistirEntrada(db, {
    accountId: contexto.accountId,
    canal: contexto.canal,
    providerMessageId: corpo.corpo.providerMessageId,
    senderRef: corpo.corpo.senderRef,
    providerSentAt: corpo.corpo.providerSentAt,
    ingestedAt: pedido.verificadoEm,
    payloadSha256: autenticado.prova.payloadSha256,
    eventoSha256,
    compararPorEventoEstavel: false,
    quarentenarConflito: contexto.quarentenarConflito === true,
    conteudo: corpo.corpo.conteudo,
    cadastros: contexto.cadastros,
    provaMetodo: autenticado.prova.metodo,
    provaKeyId: autenticado.prova.keyId,
  });
  contexto.log?.({
    codigo: gravado.ok ? gravado.resultado : "resultado" in gravado ? gravado.resultado : gravado.codigo,
    accountId: contexto.accountId,
    providerMessageId: corpo.corpo.providerMessageId,
  });
  return gravado;
}

/**
 * Recebe um envelope de webhook com 1..N eventos (mensagens, recibos técnicos, outros eventos),
 * resolvendo a conta pela configuração autenticada do servidor.
 * Metadados variáveis do envelope não geram conflito falso para o mesmo evento individual.
 * Só confirma (ok: true) após tratamento durável de TODOS os eventos admitidos.
 */
export function receberEnvelopeWebhookCanal(
  db: DatabaseSync,
  pedido: Omit<PedidoEntradaWebhook, "segredo">,
  contexto: {
    contasConfiguradas: readonly ContaWebhookConfigurada[];
    cadastros: readonly CadastroVinculo[];
    quarentenarConflito?: boolean;
    autorizarAckConflitoQuarentenado?: boolean;
    log?: LogCanal;
    falharAntesDoCommitTeste?: boolean;
  },
): ResultadoEnvelopeWebhook {
  try { if (db.isTransaction) return falhaArmazenamento(); } catch { return falhaArmazenamento(); }
  const contaResolvida = resolverContaWebhookConfigurada(pedido.keyId, contexto.contasConfiguradas);
  if (!contaResolvida.ok) {
    contexto.log?.({ codigo: contaResolvida.codigo, accountId: "desconhecida", providerMessageId: null });
    return { ok: false, codigo: contaResolvida.codigo, persistida: false };
  }
  const conta = contaResolvida.conta;
  const autenticado = autenticarEntradaWebhook({ ...pedido, segredo: conta.segredo });
  if (!autenticado.ok) {
    contexto.log?.({ codigo: autenticado.codigo, accountId: conta.accountId, providerMessageId: null });
    return autenticado;
  }
  const interpretado = interpretarEnvelopeWebhook(autenticado.bytes, conta.canal);
  if (!interpretado.ok) {
    contexto.log?.({ codigo: interpretado.codigo, accountId: conta.accountId, providerMessageId: null });
    return { ok: false, codigo: "PAYLOAD_MALFORMADO", persistida: false };
  }
  const { envelope } = interpretado;
  const segredoCompartilhado = contexto.contasConfiguradas.some(
    (outra) => outra.accountId !== conta.accountId
      && createHash("sha256").update(outra.segredo).digest("hex") === createHash("sha256").update(conta.segredo).digest("hex"),
  );
  // O parser Meta usa accountRef para o phone_number_id. O envelope sintético
  // usa accountRef lógico. O formato é identificado nos bytes já autenticados.
  let nativoMeta: boolean;
  try {
    // Mesmo decoder dos autenticadores/parser: aceita BOM UTF-8 e recusa bytes inválidos.
    nativoMeta = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(autenticado.bytes)).object === "whatsapp_business_account";
  } catch {
    contexto.log?.({ codigo: "PAYLOAD_MALFORMADO", accountId: conta.accountId, providerMessageId: null });
    return { ok: false, codigo: "PAYLOAD_MALFORMADO", persistida: false };
  }
  const referenciaResolvida = resolverContaWebhookConfigurada(pedido.keyId, contexto.contasConfiguradas,
    envelope.accountRef ?? undefined, nativoMeta ? "PHONE_NUMBER_ID" : "ACCOUNT_ID");
  if (!referenciaResolvida.ok) {
    contexto.log?.({ codigo: referenciaResolvida.codigo, accountId: conta.accountId, providerMessageId: null });
    return { ok: false, codigo: referenciaResolvida.codigo, persistida: false };
  }
  if (segredoCompartilhado && envelope.accountRef === null) {
    contexto.log?.({ codigo: "CONTA_INCORRETA", accountId: conta.accountId, providerMessageId: null });
    return { ok: false, codigo: "CONTA_INCORRETA", persistida: false };
  }

  try {
    garantirSchema(db);
    return transacao(db, () => {
      const mensagens: Array<{
        providerMessageId: string;
        classificacao: ResultadoIdempotenciaCanal;
        reciboId: string;
        quarentenada: boolean;
      }> = [];
      const conflitos: ItemConflitoQuarentena[] = [];
      let recibosTecnicosPersistidos = 0;
      let outrosEventosIgnorados = 0;

      for (const ev of envelope.eventos) {
        if (ev.categoriaEvento === "OUTRO_EVENTO") {
          outrosEventosIgnorados += 1;
          continue;
        }
        if (ev.categoriaEvento === "RECIBO_TECNICO") {
          const reciboId = `recibo-tec-${createHash("sha256").update(`${conta.accountId}\u0000${ev.recibo.eventoSha256}`).digest("hex").slice(0, 32)}`;
          const ins = db.prepare(`
            INSERT INTO canal_recibo_tecnico (
              reciboTecnicoId, accountId, providerMessageId, statusRecibo, ocorreuEm, ingestedAt, payloadSha256
            ) VALUES (?,?,?,?,?,?,?)
            ON CONFLICT(accountId, providerMessageId, statusRecibo, ocorreuEm) DO NOTHING
          `).run(
            reciboId, conta.accountId, ev.recibo.providerMessageId, ev.recibo.statusRecibo,
            ev.recibo.ocorreuEm, pedido.verificadoEm, envelope.envelopeBytesSha256,
          );
          if (Number(ins.changes) === 1) recibosTecnicosPersistidos += 1;
          continue;
        }

        // Evento de mensagem individual dentro do envelope
        const r = persistirEntradaNaTransacao(db, {
          accountId: conta.accountId,
          canal: conta.canal,
          providerMessageId: ev.mensagem.providerMessageId,
          senderRef: ev.mensagem.senderRef,
          providerSentAt: ev.mensagem.providerSentAt,
          ingestedAt: pedido.verificadoEm,
          payloadSha256: envelope.envelopeBytesSha256,
          eventoSha256: ev.eventoSha256,
          envelopeId: envelope.envelopeId,
          compararPorEventoEstavel: true,
          quarentenarConflito: contexto.quarentenarConflito !== false,
          conteudo: ev.mensagem.conteudo,
          cadastros: contexto.cadastros,
          provaMetodo: autenticado.prova.metodo,
          provaKeyId: autenticado.prova.keyId,
        });
        if (!r.ok && "codigo" in r) {
          throw new Error(r.codigo);
        }
        if (r.ok) {
          mensagens.push({
            providerMessageId: ev.mensagem.providerMessageId,
            classificacao: r.resultado === "RECEBIDA" ? "NOVA" : "REPLAY",
            reciboId: r.reciboId,
            quarentenada: false,
          });
        } else {
          const itemConflito: ItemConflitoQuarentena = {
            conflitoId: r.conflitoId ?? `conflito-${r.reciboId}`,
            accountId: conta.accountId,
            providerMessageId: ev.mensagem.providerMessageId,
            mensagemIdOriginal: r.reciboId,
            payloadSha256Persistido: r.payloadSha256Persistido,
            payloadSha256Recebido: r.payloadSha256Recebido,
            eventoSha256Persistido: r.eventoSha256Persistido ?? r.payloadSha256Persistido,
            eventoSha256Recebido: r.eventoSha256Recebido ?? ev.eventoSha256,
            registradoEm: pedido.verificadoEm,
          };
          conflitos.push(itemConflito);
          mensagens.push({
            providerMessageId: ev.mensagem.providerMessageId,
            classificacao: "CONFLITO",
            reciboId: r.reciboId,
            quarentenada: r.quarentenada === true,
          });
        }
      }

      if (contexto.falharAntesDoCommitTeste) {
        throw new Error("FALHA_INJETADA_ANTES_DO_COMMIT");
      }

      if (mensagens.some((m) => m.classificacao === "CONFLITO" && !m.quarentenada)) {
        throw new Error("CONFLITO_NAO_QUARENTENADO");
      }
      if (conflitos.length > 0 && !contexto.autorizarAckConflitoQuarentenado) {
        return {
          ok: false as const,
          codigo: "CONFLITO_ENVELOPE" as const,
          envelopeId: envelope.envelopeId,
          accountId: conta.accountId,
          ackAutorizado: false as const,
          conflitos,
        };
      }

      return {
        ok: true as const,
        envelopeId: envelope.envelopeId,
        accountId: conta.accountId,
        ackAutorizado: true as const,
        mensagens,
        recibosTecnicosPersistidos,
        outrosEventosIgnorados,
      };
    });
  } catch (err) {
    if (err instanceof Error && err.message === "ENTRADA_INVALIDA") {
      return { ok: false, codigo: "ENTRADA_INVALIDA", persistida: false };
    }
    return falhaArmazenamento();
  }
}

/**
 * S-F2-01 (C) · Ingresso IMAP com checkpoint por conta + mailbox + UIDVALIDITY + UID.
 * Persiste mensagens e pendências ANTES de atualizar o checkpoint e retornar confirmação.
 * Se UIDVALIDITY mudar, marca o checkpoint como RECONCILIACAO_UIDVALIDITY_NECESSARIA e recusa avanço automático.
 */
export async function ingerirLoteImapCanal(
  db: DatabaseSync,
  entrada: {
    accountId: string;
    mailbox: string;
    uidValiditySessao: number;
    mensagens: readonly MensagemImapEntrada[];
    cadastros: readonly CadastroVinculo[];
    ingestedAt: string;
    marcarProcessadoNoServidorImap?: (uidsPersistidos: readonly number[]) => void | Promise<void>;
  },
): Promise<
  | FalhaArmazenamento
  | {
    ok: false;
    codigo:
      | "UIDVALIDITY_ALTERADO_RECONCILIACAO_EXIGIDA"
      | "CHECKPOINT_EM_RECONCILIACAO"
      | "CHECKPOINT_INVALIDO"
      | "MENSAGEM_IMAP_INVALIDA"
      | "ORDEM_UID_INVALIDA";
    persistida: false;
    uidValidityAnterior?: number;
    uidValidityRecebido?: number;
  }
  | {
    ok: true;
    checkpoint: CheckpointImapCanal;
    persistida: true;
    marcacaoRemota: "NAO_SOLICITADA" | "PENDENTE" | "CONFIRMADA";
    resultados: Array<{ uid: number; providerMessageId: string; classificacao: "NOVA" | "REPLAY" | "CONFLITO"; reciboId: string }>;
  }> {
  // Não tratar SAVEPOINT como commit durável, nem marcar a caixa antes de um commit externo.
  try {
    if (db.isTransaction) return falhaArmazenamento();
    garantirSchema(db);
    const gravado = transacao(db, () => {
      const checkpointAtual = lerCheckpointImapCanal(db, entrada.accountId, entrada.mailbox);
      const decisao = prepararLoteImap({
        accountId: entrada.accountId,
        mailbox: entrada.mailbox,
        uidValiditySessao: entrada.uidValiditySessao,
        checkpointAtual,
        mensagens: entrada.mensagens,
        verificadoEm: entrada.ingestedAt,
      });

      if (!decisao.ok) {
        if (decisao.codigo === "UIDVALIDITY_ALTERADO_RECONCILIACAO_EXIGIDA" && checkpointAtual) {
            db.prepare(`
              UPDATE canal_imap_checkpoint
              SET estadoReconciliacao = 'RECONCILIACAO_UIDVALIDITY_NECESSARIA', atualizadoEm = ?
              WHERE accountId = ? AND mailbox = ?
            `).run(entrada.ingestedAt, entrada.accountId, entrada.mailbox);
        }
        return {
          ok: false as const,
          codigo: decisao.codigo,
          persistida: false as const,
          ...(decisao.uidValidityAnterior !== undefined ? { uidValidityAnterior: decisao.uidValidityAnterior } : {}),
          ...(decisao.uidValidityRecebido !== undefined ? { uidValidityRecebido: decisao.uidValidityRecebido } : {}),
        };
      }

      const resultados: Array<{ uid: number; providerMessageId: string; classificacao: "NOVA" | "REPLAY" | "CONFLITO"; reciboId: string }> = [];
      for (const msg of decisao.mensagensAdmitidas) {
        const ack = persistirEntradaNaTransacao(db, {
          accountId: entrada.accountId,
          canal: "EMAIL",
          providerMessageId: msg.providerMessageId,
          senderRef: msg.senderRef,
          providerSentAt: msg.providerSentAt,
          ingestedAt: entrada.ingestedAt,
          payloadSha256: msg.rawBytesSha256,
          eventoSha256: msg.eventoSha256,
          compararPorEventoEstavel: true,
          quarentenarConflito: true,
          conteudo: msg.conteudo,
          cadastros: entrada.cadastros,
          provaMetodo: "IMAP_CONTA_LOCAL",
          provaKeyId: entrada.mailbox,
        });
        if (!ack.ok && "codigo" in ack) throw new Error(ack.codigo);
        resultados.push({
          uid: msg.uid,
          providerMessageId: msg.providerMessageId,
          classificacao: ack.ok ? (ack.resultado === "RECEBIDA" ? "NOVA" : "REPLAY") : "CONFLITO",
          reciboId: ack.reciboId,
        });
        if (entrada.marcarProcessadoNoServidorImap) {
          db.prepare(`
            INSERT INTO canal_imap_marcacao (accountId, mailbox, uidValidity, uid, confirmadoEm)
            VALUES (?, ?, ?, ?, NULL) ON CONFLICT DO NOTHING
          `).run(entrada.accountId, entrada.mailbox, entrada.uidValiditySessao, msg.uid);
        }
      }

      const novoCheckpoint = criarCheckpointReconciliado({
        accountId: entrada.accountId,
        mailbox: entrada.mailbox,
        novoUidValidity: entrada.uidValiditySessao,
        lastUidReconciliado: decisao.novoLastUid,
        estadoReconciliacao: "INTEGRO",
        atualizadoEm: entrada.ingestedAt,
      });

      db.prepare(`
        INSERT INTO canal_imap_checkpoint (accountId, mailbox, uidValidity, lastUid, estadoReconciliacao, atualizadoEm)
        VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT(accountId, mailbox) DO UPDATE SET
          uidValidity = excluded.uidValidity,
          lastUid = excluded.lastUid,
          estadoReconciliacao = excluded.estadoReconciliacao,
          atualizadoEm = excluded.atualizadoEm
      `).run(
        novoCheckpoint.accountId,
        novoCheckpoint.mailbox,
        novoCheckpoint.uidValidity,
        novoCheckpoint.lastUid,
        novoCheckpoint.estadoReconciliacao,
        novoCheckpoint.atualizadoEm,
      );

      return { ok: true as const, checkpoint: novoCheckpoint, resultados };
    });

    if (!gravado.ok) return gravado;
    // A marcação remota é idempotente e tem pendência durável, separada do commit local.
    // Falha no callback NÃO apaga a persistência nem faz o checkpoint perder a tentativa.
    let marcacaoRemota: "NAO_SOLICITADA" | "PENDENTE" | "CONFIRMADA" = "NAO_SOLICITADA";
    if (entrada.marcarProcessadoNoServidorImap) {
      marcacaoRemota = "PENDENTE";
      try {
        const pendentes = db.prepare(`
          SELECT uid FROM canal_imap_marcacao
          WHERE accountId = ? AND mailbox = ? AND uidValidity = ? AND confirmadoEm IS NULL ORDER BY uid
        `).all(entrada.accountId, entrada.mailbox, entrada.uidValiditySessao) as Array<{ uid: number }>;
        const uids = pendentes.map((p) => Number(p.uid));
        if (uids.length > 0) {
          await entrada.marcarProcessadoNoServidorImap(uids);
          transacao(db, () => {
            const confirmar = db.prepare(`UPDATE canal_imap_marcacao SET confirmadoEm = ?
              WHERE accountId = ? AND mailbox = ? AND uidValidity = ? AND uid = ? AND confirmadoEm IS NULL`);
            for (const uid of uids) confirmar.run(entrada.ingestedAt, entrada.accountId, entrada.mailbox, entrada.uidValiditySessao, uid);
          });
        }
        marcacaoRemota = "CONFIRMADA";
      } catch {
        // Próxima chamada, inclusive lote vazio, retoma os UIDs pendentes desta época.
      }
    }
    return { ...gravado, persistida: true, marcacaoRemota };
  } catch {
    return falhaArmazenamento();
  }
}

export function lerCheckpointImapCanal(
  db: DatabaseSync,
  accountId: string,
  mailbox: string,
): CheckpointImapCanal | null {
  garantirSchema(db);
  const row = db.prepare(`
    SELECT accountId, mailbox, uidValidity, lastUid, estadoReconciliacao, atualizadoEm
    FROM canal_imap_checkpoint WHERE accountId = ? AND mailbox = ?
  `).get(accountId, mailbox) as Record<string, unknown> | undefined;
  if (!row) return null;
  return CheckpointImapCanal.parse({
    accountId: String(row.accountId),
    mailbox: String(row.mailbox),
    uidValidity: Number(row.uidValidity),
    lastUid: Number(row.lastUid),
    estadoReconciliacao: String(row.estadoReconciliacao),
    atualizadoEm: String(row.atualizadoEm),
  });
}

/** Reconciliação explícita de mudança de UIDVALIDITY após verificação administrativa/técnica. */
export function reconciliarUidValidityImapCanal(
  db: DatabaseSync,
  entrada: {
    accountId: string;
    mailbox: string;
    novoUidValidity: number;
    lastUidReconciliado: number;
    reconciliadoEm: string;
  },
): { ok: true; checkpoint: CheckpointImapCanal } | FalhaArmazenamento {
  try {
    return transacao(db, () => {
      garantirSchema(db);
      const checkpoint = criarCheckpointReconciliado({
        accountId: entrada.accountId,
        mailbox: entrada.mailbox,
        novoUidValidity: entrada.novoUidValidity,
        lastUidReconciliado: entrada.lastUidReconciliado,
        estadoReconciliacao: "INTEGRO",
        atualizadoEm: entrada.reconciliadoEm,
      });
      db.prepare(`
        INSERT INTO canal_imap_checkpoint (accountId, mailbox, uidValidity, lastUid, estadoReconciliacao, atualizadoEm)
        VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT(accountId, mailbox) DO UPDATE SET
          uidValidity = excluded.uidValidity,
          lastUid = excluded.lastUid,
          estadoReconciliacao = excluded.estadoReconciliacao,
          atualizadoEm = excluded.atualizadoEm
      `).run(
        checkpoint.accountId,
        checkpoint.mailbox,
        checkpoint.uidValidity,
        checkpoint.lastUid,
        checkpoint.estadoReconciliacao,
        checkpoint.atualizadoEm,
      );
      return { ok: true, checkpoint };
    });
  } catch {
    return falhaArmazenamento();
  }
}

/** Adaptador sem rede. A conta autenticada é argumento do servidor, não um campo do remetente. */
export function receberTransporteSintetico(
  db: DatabaseSync,
  entrada: {
    accountId: string;
    canal: CanalIngresso;
    providerMessageId: string;
    senderRef: string;
    providerSentAt: string | null;
    ingestedAt: string;
    conteudo: ConteudoCanal;
    cadastros: readonly CadastroVinculo[];
    quarentenarConflito?: boolean;
  },
): RecusaEntrada | AckCanal | FalhaArmazenamento {
  const conteudo = admitirConteudo(entrada.conteudo);
  if (!conteudo) return { ok: false, codigo: "ENTRADA_INVALIDA", persistida: false };
  const limpa = { ...entrada, conteudo };
  const hash = hashEntradaSintetica(limpa);
  return persistirEntrada(db, {
    ...limpa,
    payloadSha256: hash,
    eventoSha256: hash,
    compararPorEventoEstavel: false,
    quarentenarConflito: entrada.quarentenarConflito === true,
    provaMetodo: "TRANSPORTE_SINTETICO",
    provaKeyId: "sintetico",
  });
}

/**
 * S-F2-01 (E) · Retoma e processa todas as pendências duráveis após reinício do servidor/processo.
 * Como a pendência é gravada na mesma transação do recebimento antes do ACK, uma queda pós-ACK/pré-processamento
 * nunca perde mensagens pendentes.
 */
export function retomarPendenciasCanal(
  db: DatabaseSync,
  opcoes: {
    agora: string;
    processador?: (mensagem: ItemCaixa) => Record<string, unknown>;
  },
): { ok: true; retomadas: number; pendentesRestantes: number; processadasIds: string[] } | FalhaArmazenamento {
  if (!Instante.safeParse(opcoes.agora).success) return falhaArmazenamento();
  try {
    return transacao(db, () => {
      garantirSchema(db);
      const pendentes = db.prepare(`
        SELECT p.pendenciaId, p.mensagemId, m.accountId, m.providerMessageId, m.canal, m.senderRef,
               m.providerSentAt, m.ingestedAt, m.payloadSha256, m.conteudo,
               m.vinculoClasse, m.vinculoPatientId, m.vinculoMotivo, m.provaMetodo
        FROM canal_pendencia p
        JOIN canal_mensagem m ON m.mensagemId = p.mensagemId
        LEFT JOIN canal_pendencia_resolucao r ON r.mensagemId = p.mensagemId
        WHERE r.mensagemId IS NULL
        ORDER BY p.criadoEm, p.mensagemId
      `).all() as Array<Linha & { pendenciaId: string }>;

      const processadasIds: string[] = [];
      const insertResolucao = db.prepare(`
        INSERT INTO canal_pendencia_resolucao (mensagemId, resolvidoEm, resultadoJson)
        VALUES (?, ?, ?)
        ON CONFLICT(mensagemId) DO NOTHING
      `);

      for (const row of pendentes) {
        if (!opcoes.processador) break;
        const item = itemDeLinha(row);
        const resultado = opcoes.processador(item);
        insertResolucao.run(row.mensagemId, opcoes.agora, JSON.stringify(resultado));
        processadasIds.push(row.mensagemId);
      }

      const restantes = db.prepare(`
        SELECT COUNT(*) AS n
        FROM canal_pendencia p
        LEFT JOIN canal_pendencia_resolucao r ON r.mensagemId = p.mensagemId
        WHERE r.mensagemId IS NULL
      `).get() as { n: number };

      return {
        ok: true,
        retomadas: processadasIds.length,
        pendentesRestantes: Number(restantes.n),
        processadasIds,
      };
    });
  } catch {
    return falhaArmazenamento();
  }
}

export function listarPendenciasCanal(db: DatabaseSync): ItemPendenciaCanal[] {
  garantirSchema(db);
  const rows = db.prepare(`
    SELECT p.pendenciaId, p.mensagemId, p.accountId, p.criadoEm, r.resolvidoEm
    FROM canal_pendencia p
    LEFT JOIN canal_pendencia_resolucao r ON r.mensagemId = p.mensagemId
    ORDER BY p.criadoEm, p.mensagemId
  `).all() as Array<{ pendenciaId: string; mensagemId: string; accountId: string; criadoEm: string; resolvidoEm: string | null }>;
  return rows.map((r) => ({
    pendenciaId: r.pendenciaId,
    mensagemId: r.mensagemId,
    accountId: r.accountId,
    criadoEm: r.criadoEm,
    estado: r.resolvidoEm ? "PROCESSADA" : "PENDENTE_PROCESSAMENTO",
    resolvidoEm: r.resolvidoEm ?? null,
  }));
}

export function listarQuarentenaConflitosCanal(db: DatabaseSync): ItemConflitoQuarentena[] {
  garantirSchema(db);
  const rows = db.prepare(`
    SELECT conflitoId, accountId, providerMessageId, mensagemIdOriginal,
           payloadSha256Persistido, payloadSha256Recebido,
           eventoSha256Persistido, eventoSha256Recebido, registradoEm
    FROM canal_conflito_quarentena
    ORDER BY registradoEm, conflitoId
  `).all() as ItemConflitoQuarentena[];
  return rows;
}

export function listarRecibosTecnicosCanal(db: DatabaseSync, accountId?: string): ItemReciboTecnico[] {
  garantirSchema(db);
  const rows = (accountId
    ? db.prepare(`SELECT reciboTecnicoId, accountId, providerMessageId, statusRecibo, ocorreuEm, ingestedAt
                  FROM canal_recibo_tecnico WHERE accountId = ? ORDER BY ingestedAt, reciboTecnicoId`).all(accountId)
    : db.prepare(`SELECT reciboTecnicoId, accountId, providerMessageId, statusRecibo, ocorreuEm, ingestedAt
                  FROM canal_recibo_tecnico ORDER BY ingestedAt, reciboTecnicoId`).all()) as ItemReciboTecnico[];
  return rows;
}

/**
 * S-F2-01 (F) · Consentimento explícito do canal (separado de recebimento e de vínculo).
 * O recebimento de uma mensagem NUNCA cria TERMO_ACEITO automaticamente: sem registro explícito,
 * o estado do contato é sempre NAO_AVALIADO.
 */
export function consultarConsentimentoCanal(
  db: DatabaseSync,
  contatoId: string,
): ConsentimentoCanal {
  garantirSchema(db);
  const rows = db.prepare(`
    SELECT eventoId, contatoId, patientId, estado, referenciaTermo, versaoTermo,
           finalidadesJson, origem, atorId, registradoEm
    FROM canal_consentimento_evento
    WHERE contatoId = ?
    ORDER BY rowid ASC
  `).all(contatoId) as Array<{
    eventoId: string;
    contatoId: string;
    patientId: string | null;
    estado: EstadoConsentimentoCanal;
    referenciaTermo: string | null;
    versaoTermo: string | null;
    finalidadesJson: string;
    origem: OrigemConsentimentoCanal;
    atorId: string;
    registradoEm: string;
  }>;

  if (rows.length === 0) {
    return ConsentimentoCanal.parse({
      contatoId,
      patientId: null,
      estado: "NAO_AVALIADO",
      referenciaTermo: null,
      versaoTermo: null,
      registradoEm: null,
      revogadoEm: null,
      finalidade: [],
      origem: null,
      ator: null,
    });
  }

  const ultimo = rows.at(-1)!;
  const ultimoAceite = [...rows].reverse().find((r) => r.estado === "TERMO_ACEITO") ?? null;
  if (ultimo.estado === "REVOGADO") {
    return ConsentimentoCanal.parse({
      contatoId,
      patientId: ultimo.patientId ?? ultimoAceite?.patientId ?? null,
      estado: "REVOGADO",
      referenciaTermo: ultimoAceite?.referenciaTermo ?? null,
      versaoTermo: ultimoAceite?.versaoTermo ?? null,
      registradoEm: ultimoAceite?.registradoEm ?? null,
      revogadoEm: ultimo.registradoEm,
      finalidade: ultimoAceite ? JSON.parse(ultimoAceite.finalidadesJson) as FinalidadeConsentimentoCanal[] : [],
      origem: ultimo.origem,
      ator: { tipo: "SESSAO", id: ultimo.atorId },
    });
  }

  return ConsentimentoCanal.parse({
    contatoId,
    patientId: ultimo.patientId,
    estado: "TERMO_ACEITO",
    referenciaTermo: ultimo.referenciaTermo,
    versaoTermo: ultimo.versaoTermo,
    registradoEm: ultimo.registradoEm,
    revogadoEm: null,
    finalidade: JSON.parse(ultimo.finalidadesJson) as FinalidadeConsentimentoCanal[],
    origem: ultimo.origem,
    ator: { tipo: "SESSAO", id: ultimo.atorId },
  });
}

export function registrarConsentimentoCanal(
  db: DatabaseSync,
  acesso: AcessoCanal,
  entrada: {
    contatoId: string;
    patientId: string | null;
    referenciaTermo: string;
    versaoTermo: string;
    finalidade: readonly FinalidadeConsentimentoCanal[];
    origem: "PRESENCIAL_CONSULTORIO" | "TERMO_ASSINADO_LOCAL";
  },
): { ok: false; codigo: "SESSAO_INVALIDA" | "CONSENTIMENTO_INVALIDO" } | FalhaArmazenamento | { ok: true; consentimento: ConsentimentoCanal } {
  const sessao = obterSessaoValida(acesso);
  if (!sessao) return { ok: false, codigo: "SESSAO_INVALIDA" };
  const validado = ConsentimentoCanal.safeParse({
    contatoId: entrada.contatoId,
    patientId: entrada.patientId,
    estado: "TERMO_ACEITO",
    referenciaTermo: entrada.referenciaTermo,
    versaoTermo: entrada.versaoTermo,
    registradoEm: acesso.agora,
    revogadoEm: null,
    finalidade: [...entrada.finalidade],
    origem: entrada.origem,
    ator: { tipo: "SESSAO", id: sessao.medicoId },
  });
  if (!validado.success) return { ok: false, codigo: "CONSENTIMENTO_INVALIDO" };
  try {
    return transacao(db, () => {
      garantirSchema(db);
      db.prepare(`
        INSERT INTO canal_consentimento_evento (
          eventoId, contatoId, patientId, estado, referenciaTermo, versaoTermo,
          finalidadesJson, origem, atorId, registradoEm
        ) VALUES (?, ?, ?, 'TERMO_ACEITO', ?, ?, ?, ?, ?, ?)
      `).run(
        `consent-${randomUUID()}`,
        validado.data.contatoId,
        validado.data.patientId,
        validado.data.referenciaTermo,
        validado.data.versaoTermo,
        JSON.stringify(validado.data.finalidade),
        validado.data.origem,
        sessao.medicoId,
        acesso.agora,
      );
      return { ok: true, consentimento: consultarConsentimentoCanal(db, entrada.contatoId) };
    });
  } catch {
    return falhaArmazenamento();
  }
}

export function revogarConsentimentoCanal(
  db: DatabaseSync,
  acesso: AcessoCanal,
  entrada: {
    contatoId: string;
    patientId: string | null;
    origem: "REVOGACAO_PACIENTE" | "REVOGACAO_MEDICO";
  },
): { ok: false; codigo: "SESSAO_INVALIDA" | "CONSENTIMENTO_INVALIDO" } | FalhaArmazenamento | { ok: true; consentimento: ConsentimentoCanal } {
  const sessao = obterSessaoValida(acesso);
  if (!sessao) return { ok: false, codigo: "SESSAO_INVALIDA" };
  const validado = ConsentimentoCanal.safeParse({
    contatoId: entrada.contatoId,
    patientId: entrada.patientId,
    estado: "REVOGADO",
    referenciaTermo: null,
    versaoTermo: null,
    registradoEm: null,
    revogadoEm: acesso.agora,
    finalidade: [],
    origem: entrada.origem,
    ator: { tipo: "SESSAO", id: sessao.medicoId },
  });
  if (!validado.success) return { ok: false, codigo: "CONSENTIMENTO_INVALIDO" };
  try {
    return transacao(db, () => {
      garantirSchema(db);
      db.prepare(`
        INSERT INTO canal_consentimento_evento (
          eventoId, contatoId, patientId, estado, referenciaTermo, versaoTermo,
          finalidadesJson, origem, atorId, registradoEm
        ) VALUES (?, ?, ?, 'REVOGADO', NULL, NULL, '[]', ?, ?, ?)
      `).run(
        `consent-rev-${randomUUID()}`,
        entrada.contatoId,
        entrada.patientId,
        entrada.origem,
        sessao.medicoId,
        acesso.agora,
      );
      return { ok: true, consentimento: consultarConsentimentoCanal(db, entrada.contatoId) };
    });
  } catch {
    return falhaArmazenamento();
  }
}

/** S-F2-01 (E) · Registro explícito de períodos sem cobertura local (sem inventar mensagens perdidas). */
export function registrarJanelaIndisponibilidadeCanal(
  db: DatabaseSync,
  entrada: {
    janelaId?: string;
    accountId: string;
    inicioEm: string;
    fimEm: string | null;
    motivo: string;
    registradoEm: string;
  },
): { ok: true; janela: JanelaIndisponibilidadeCanal } | { ok: false; codigo: "JANELA_INVALIDA" } | FalhaArmazenamento {
  const parsed = JanelaIndisponibilidadeCanal.safeParse({
    janelaId: entrada.janelaId ?? `janela-${randomUUID()}`,
    accountId: entrada.accountId,
    inicioEm: entrada.inicioEm,
    fimEm: entrada.fimEm,
    motivo: entrada.motivo,
    registradoEm: entrada.registradoEm,
    mensagensPerdidasInventadas: 0,
  });
  if (!parsed.success) return { ok: false, codigo: "JANELA_INVALIDA" };
  try {
    return transacao(db, () => {
      garantirSchema(db);
      db.prepare(`
        INSERT INTO canal_janela_cobertura (
          janelaId, accountId, inicioEm, fimEm, motivo, registradoEm, mensagensPerdidasInventadas
        ) VALUES (?, ?, ?, ?, ?, ?, 0)
      `).run(
        parsed.data.janelaId,
        parsed.data.accountId,
        parsed.data.inicioEm,
        parsed.data.fimEm,
        parsed.data.motivo,
        parsed.data.registradoEm,
      );
      return { ok: true, janela: parsed.data };
    });
  } catch {
    return falhaArmazenamento();
  }
}

export function listarJanelasIndisponibilidadeCanal(db: DatabaseSync, accountId?: string): JanelaIndisponibilidadeCanal[] {
  garantirSchema(db);
  const rows = (accountId
    ? db.prepare(`SELECT janelaId, accountId, inicioEm, fimEm, motivo, registradoEm, mensagensPerdidasInventadas
                  FROM canal_janela_cobertura WHERE accountId = ? ORDER BY inicioEm, janelaId`).all(accountId)
    : db.prepare(`SELECT janelaId, accountId, inicioEm, fimEm, motivo, registradoEm, mensagensPerdidasInventadas
                  FROM canal_janela_cobertura ORDER BY inicioEm, janelaId`).all()) as Array<Record<string, unknown>>;
  return rows.map((r) => JanelaIndisponibilidadeCanal.parse({
    janelaId: String(r.janelaId),
    accountId: String(r.accountId),
    inicioEm: String(r.inicioEm),
    fimEm: r.fimEm === null ? null : String(r.fimEm),
    motivo: String(r.motivo),
    registradoEm: String(r.registradoEm),
    mensagensPerdidasInventadas: Number(r.mensagensPerdidasInventadas),
  }));
}

type LinhaPaginada = Linha & { cursorRowid: number };

function paginaCaixaCanal(db: DatabaseSync, antes?: { ingestedAt: string; rowid: number },
  filtro?: { patientId: string; enderecos: readonly string[] }): LinhaPaginada[] {
  const colunas = `rowid AS cursorRowid, mensagemId, accountId, providerMessageId, canal, senderRef,
    providerSentAt, ingestedAt, payloadSha256, conteudo, vinculoClasse, vinculoPatientId,
    vinculoMotivo, provaMetodo`;
  const condicoes: string[] = [];
  const parametros: (string | number)[] = [];
  if (filtro) {
    const enderecos = [...new Set(filtro.enderecos)];
    condicoes.push(enderecos.length
      ? `((canal = 'WHATSAPP_SERVICO' AND senderRef IN (${enderecos.map(() => "?").join(",")})) OR vinculoPatientId = ?)`
      : "vinculoPatientId = ?");
    parametros.push(...enderecos, filtro.patientId);
  }
  if (antes) {
    condicoes.push("(ingestedAt < ? OR (ingestedAt = ? AND rowid < ?))");
    parametros.push(antes.ingestedAt, antes.ingestedAt, antes.rowid);
  }
  const where = condicoes.length ? ` WHERE ${condicoes.join(" AND ")}` : "";
  return db.prepare(`SELECT ${colunas} FROM canal_mensagem${where}
    ORDER BY ingestedAt DESC, rowid DESC LIMIT ?`)
    .all(...parametros, LIMITE_CAIXA) as LinhaPaginada[];
}

export function consultarCaixaCanal(
  db: DatabaseSync,
  acesso: AcessoCanal,
): { ok: false; codigo: "SESSAO_INVALIDA" } | FalhaArmazenamento | { ok: true; mensagens: ItemCaixa[] } {
  if (!sessaoValida(acesso)) return { ok: false, codigo: "SESSAO_INVALIDA" };
  try {
    garantirSchema(db);
    const linhas = paginaCaixaCanal(db);
    return { ok: true, mensagens: linhas.reverse().map(itemDeLinha) };
  } catch {
    return falhaArmazenamento();
  }
}

/** Histórico do contato atual ou de vínculo prévio de ingresso com o paciente.
 * Não lê mensagens dos demais remetentes; pagina sem truncar relatos antigos. */
export function consultarHistoricoCanalPaciente(
  db: DatabaseSync,
  acesso: AcessoCanal,
  patientId: string,
  enderecos: readonly string[],
): { ok: false; codigo: "SESSAO_INVALIDA" } | FalhaArmazenamento | { ok: true; mensagens: ItemCaixa[] } {
  if (!sessaoValida(acesso)) return { ok: false, codigo: "SESSAO_INVALIDA" };
  try {
    garantirSchema(db);
    const mensagens: ItemCaixa[] = [];
    let antes: { ingestedAt: string; rowid: number } | undefined;
    while (true) {
      if (!sessaoValida(acesso)) return { ok: false, codigo: "SESSAO_INVALIDA" };
      const linhas = paginaCaixaCanal(db, antes, { patientId, enderecos });
      if (!linhas.length) break;
      mensagens.push(...linhas.map(itemDeLinha));
      const ultima = linhas[linhas.length - 1]!;
      if (!Number.isSafeInteger(ultima.cursorRowid)) throw new Error("CURSOR_CAIXA_INVALIDO");
      antes = { ingestedAt: ultima.ingestedAt, rowid: ultima.cursorRowid };
      if (linhas.length < LIMITE_CAIXA) break;
    }
    return { ok: true, mensagens: mensagens.reverse() };
  } catch {
    return falhaArmazenamento();
  }
}

export function detalheMensagemCanal(
  db: DatabaseSync,
  acesso: AcessoCanal,
  mensagemId: string,
): { ok: false; codigo: "SESSAO_INVALIDA" | "MENSAGEM_AUSENTE" } | FalhaArmazenamento | { ok: true; mensagem: ItemCaixa } {
  if (!sessaoValida(acesso)) return { ok: false, codigo: "SESSAO_INVALIDA" };
  return lerMensagemIngressoLocal(db, mensagemId);
}

/** Leitura interna do processador local; não é uma porta HTTP nem concede autoridade clínica. */
export function lerMensagemIngressoLocal(db: DatabaseSync, mensagemId: string):
  { ok: false; codigo: "MENSAGEM_AUSENTE" } | FalhaArmazenamento | { ok: true; mensagem: ItemCaixa } {
  try {
    garantirSchema(db);
    const linha = db.prepare(
      `SELECT mensagemId, accountId, providerMessageId, canal, senderRef, providerSentAt, ingestedAt,
        payloadSha256, conteudo, vinculoClasse, vinculoPatientId, vinculoMotivo, provaMetodo
       FROM canal_mensagem WHERE mensagemId=?`,
    ).get(mensagemId) as Linha | undefined;
    if (!linha) return { ok: false, codigo: "MENSAGEM_AUSENTE" };
    return { ok: true, mensagem: itemDeLinha(linha) };
  } catch {
    return falhaArmazenamento();
  }
}

/** Nenhum envio real em S-F2-01/S-F2-02. O código acompanha autorizarSaida. */
export function enviarParaForaCanal(): { ok: false; codigo: "CANAL_EXTERNO_NAO_HABILITADO"; enviou: false } {
  return { ok: false, codigo: "CANAL_EXTERNO_NAO_HABILITADO", enviou: false };
}

function persistirEntrada(db: DatabaseSync, entrada: {
  accountId: string;
  canal: CanalIngresso;
  providerMessageId: string;
  senderRef: string;
  providerSentAt: string | null;
  ingestedAt: string;
  payloadSha256: string;
  eventoSha256: string;
  envelopeId?: string;
  compararPorEventoEstavel: boolean;
  quarentenarConflito: boolean;
  conteudo: ConteudoCanal;
  cadastros: readonly CadastroVinculo[];
  provaMetodo: string;
  provaKeyId: string;
}): RecusaEntrada | AckCanal | FalhaArmazenamento {
  const conteudo = admitirConteudo(entrada.conteudo);
  if (!conteudo || !entradaCoerente({ ...entrada, conteudo })) return { ok: false, codigo: "ENTRADA_INVALIDA", persistida: false };
  try {
    if (db.isTransaction) return falhaArmazenamento();
    garantirSchema(db);
    return transacao(db, () => {
      return persistirEntradaNaTransacao(db, { ...entrada, conteudo });
    });
  } catch {
    return { ok: false, codigo: "ARMAZENAMENTO_INDISPONIVEL", recuperavel: true, persistida: false };
  }
}

function persistirEntradaNaTransacao(db: DatabaseSync, entrada: {
  accountId: string;
  canal: CanalIngresso;
  providerMessageId: string;
  senderRef: string;
  providerSentAt: string | null;
  ingestedAt: string;
  payloadSha256: string;
  eventoSha256: string;
  envelopeId?: string;
  compararPorEventoEstavel: boolean;
  quarentenarConflito: boolean;
  conteudo: ConteudoCanal;
  cadastros: readonly CadastroVinculo[];
  provaMetodo: string;
  provaKeyId: string;
}): RecusaEntrada | AckCanal {
  const conteudo = admitirConteudo(entrada.conteudo);
  if (!conteudo || !entradaCoerente({ ...entrada, conteudo })) {
    return { ok: false, codigo: "ENTRADA_INVALIDA", persistida: false };
  }
  // A autenticação da caixa IMAP não autentica o remetente do campo From.
  const vinculo = entrada.provaMetodo === "IMAP_CONTA_LOCAL"
    ? { classe: "DESCONHECIDO" as const, patientId: null, motivo: "REMETENTE_EMAIL_NAO_AUTENTICADO_REQUER_REVISAO" }
    : classificarRemetente(entrada.senderRef, tipoIdentificadorDoCanal(entrada.canal), entrada.cadastros);
  const mensagemId = idMensagem(entrada.accountId, entrada.providerMessageId);
  const chave = { accountId: entrada.accountId, providerMessageId: entrada.providerMessageId };

  const insert = db.prepare(
    `INSERT INTO canal_mensagem (
      mensagemId, accountId, providerMessageId, canal, senderRef, providerSentAt, ingestedAt,
      payloadSha256, conteudo, vinculoClasse, vinculoPatientId, vinculoMotivo, provaMetodo, provaKeyId
    ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    ON CONFLICT(accountId, providerMessageId) DO NOTHING`,
  ).run(
    mensagemId, entrada.accountId, entrada.providerMessageId, entrada.canal, entrada.senderRef,
    entrada.providerSentAt, entrada.ingestedAt, entrada.payloadSha256, JSON.stringify(conteudo),
    vinculo.classe, vinculo.patientId, vinculo.motivo, entrada.provaMetodo, entrada.provaKeyId,
  );

  if (Number(insert.changes) === 1) {
    db.prepare(`
      INSERT INTO canal_evento_meta (mensagemId, eventoSha256, envelopeSha256, envelopeId)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(mensagemId) DO NOTHING
    `).run(mensagemId, entrada.eventoSha256, entrada.payloadSha256, entrada.envelopeId ?? null);

    // Persiste a pendência durável na mesma transação ANTES do ACK.
    db.prepare(`
      INSERT INTO canal_pendencia (pendenciaId, mensagemId, accountId, criadoEm)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(mensagemId) DO NOTHING
    `).run(`pend-${mensagemId}`, mensagemId, entrada.accountId, entrada.ingestedAt);

    return {
      ok: true as const,
      resultado: "RECEBIDA" as const,
      persistida: true as const,
      reciboId: mensagemId,
      chave,
      payloadSha256: entrada.payloadSha256,
    };
  }

  const existente = db.prepare(
    "SELECT mensagemId, payloadSha256 FROM canal_mensagem WHERE accountId=? AND providerMessageId=?",
  ).get(entrada.accountId, entrada.providerMessageId) as { mensagemId: string; payloadSha256: string } | undefined;
  if (!existente) throw new Error("CANAL_LINHA_AUSENTE");

  const metaExistente = db.prepare(
    "SELECT eventoSha256, envelopeSha256 FROM canal_evento_meta WHERE mensagemId=?",
  ).get(existente.mensagemId) as { eventoSha256: string; envelopeSha256: string } | undefined;

  const hashPersistidoParaComparacao = entrada.compararPorEventoEstavel && metaExistente
    ? metaExistente.eventoSha256
    : existente.payloadSha256;
  const hashRecebidoParaComparacao = entrada.compararPorEventoEstavel
    ? entrada.eventoSha256
    : entrada.payloadSha256;

  const decisao = decidirIdempotencia(
    { mensagemId: existente.mensagemId, payloadSha256: hashPersistidoParaComparacao },
    { payloadSha256: hashRecebidoParaComparacao },
  );

  if (decisao.tipo === "REPLAY") {
    return {
      ok: true as const,
      resultado: "REPLAY" as const,
      persistida: true as const,
      reciboId: existente.mensagemId,
      chave,
      payloadSha256: existente.payloadSha256,
    };
  }

  let conflitoId: string | undefined;
  if (entrada.quarentenarConflito) {
    conflitoId = `conflito-${createHash("sha256").update(`${entrada.accountId}\u0000${entrada.providerMessageId}\u0000${entrada.payloadSha256}\u0000${entrada.eventoSha256}`).digest("hex").slice(0, 32)}`;
    db.prepare(`
      INSERT INTO canal_conflito_quarentena (
        conflitoId, accountId, providerMessageId, mensagemIdOriginal,
        payloadSha256Persistido, payloadSha256Recebido,
        eventoSha256Persistido, eventoSha256Recebido,
        conteudoRecebido, registradoEm
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(conflitoId) DO NOTHING
    `).run(
      conflitoId,
      entrada.accountId,
      entrada.providerMessageId,
      existente.mensagemId,
      existente.payloadSha256,
      entrada.payloadSha256,
      metaExistente?.eventoSha256 ?? existente.payloadSha256,
      entrada.eventoSha256,
      JSON.stringify(conteudo),
      entrada.ingestedAt,
    );
  }

  return {
    ok: false as const,
    resultado: "CONFLITO_REPLAY" as const,
    persistida: false as const,
    ...(entrada.quarentenarConflito ? {
      quarentenada: true,
      ...(conflitoId ? { conflitoId } : {}),
      eventoSha256Persistido: metaExistente?.eventoSha256 ?? existente.payloadSha256,
      eventoSha256Recebido: entrada.eventoSha256,
    } : {}),
    reciboId: existente.mensagemId,
    chave,
    payloadSha256Recebido: entrada.payloadSha256,
    payloadSha256Persistido: existente.payloadSha256,
  };
}

const schemasCanalProntos = new WeakSet<DatabaseSync>();
export function garantirSchema(db: DatabaseSync): void {
 if(schemasCanalProntos.has(db))return;
 const externa=db.isTransaction;
 if(!externa)db.exec('PRAGMA foreign_keys = ON; PRAGMA synchronous = FULL;');
 transacao(db,()=>prepararSchemaCanal(db));
 // Cache apenas depois de commit proprio; rollback do chamador nao pode deixar cache falso.
 if(!externa)schemasCanalProntos.add(db);
}
function prepararSchemaCanal(db: DatabaseSync): void {
  if (!db.isTransaction) {
    db.exec("PRAGMA foreign_keys = ON; PRAGMA synchronous = FULL;");
  }
  db.exec(`
    CREATE TABLE IF NOT EXISTS canal_mensagem (
      mensagemId TEXT PRIMARY KEY,
      accountId TEXT NOT NULL,
      providerMessageId TEXT NOT NULL,
      canal TEXT NOT NULL CHECK (canal IN ('WHATSAPP_SERVICO','EMAIL')),
      senderRef TEXT NOT NULL,
      providerSentAt TEXT,
      ingestedAt TEXT NOT NULL,
      payloadSha256 TEXT NOT NULL,
      conteudo TEXT NOT NULL,
      vinculoClasse TEXT NOT NULL CHECK (vinculoClasse IN ('CONHECIDO','DESCONHECIDO','AMBIGUO')),
      vinculoPatientId TEXT,
      vinculoMotivo TEXT NOT NULL,
      provaMetodo TEXT NOT NULL,
      provaKeyId TEXT NOT NULL,
      UNIQUE (accountId, providerMessageId)
    );
    CREATE INDEX IF NOT EXISTS idx_canal_mensagem_remetente ON canal_mensagem(canal, senderRef, ingestedAt DESC);
    CREATE INDEX IF NOT EXISTS idx_canal_mensagem_vinculo_ingresso ON canal_mensagem(vinculoPatientId, ingestedAt DESC);
    CREATE TRIGGER IF NOT EXISTS canal_mensagem_no_update BEFORE UPDATE ON canal_mensagem
      BEGIN SELECT RAISE(ABORT, 'canal_mensagem append-only'); END;
    CREATE TRIGGER IF NOT EXISTS canal_mensagem_no_delete BEFORE DELETE ON canal_mensagem
      BEGIN SELECT RAISE(ABORT, 'canal_mensagem append-only'); END;

    CREATE TABLE IF NOT EXISTS canal_evento_meta (
      mensagemId TEXT PRIMARY KEY REFERENCES canal_mensagem(mensagemId),
      eventoSha256 TEXT NOT NULL,
      envelopeSha256 TEXT NOT NULL,
      envelopeId TEXT
    );
    CREATE TRIGGER IF NOT EXISTS canal_evento_meta_no_update BEFORE UPDATE ON canal_evento_meta
      BEGIN SELECT RAISE(ABORT, 'canal_evento_meta append-only'); END;
    CREATE TRIGGER IF NOT EXISTS canal_evento_meta_no_delete BEFORE DELETE ON canal_evento_meta
      BEGIN SELECT RAISE(ABORT, 'canal_evento_meta append-only'); END;

    CREATE TABLE IF NOT EXISTS canal_pendencia (
      pendenciaId TEXT PRIMARY KEY,
      mensagemId TEXT NOT NULL UNIQUE REFERENCES canal_mensagem(mensagemId),
      accountId TEXT NOT NULL,
      criadoEm TEXT NOT NULL
    );
    CREATE TRIGGER IF NOT EXISTS canal_pendencia_no_update BEFORE UPDATE ON canal_pendencia
      BEGIN SELECT RAISE(ABORT, 'canal_pendencia append-only'); END;
    CREATE TRIGGER IF NOT EXISTS canal_pendencia_no_delete BEFORE DELETE ON canal_pendencia
      BEGIN SELECT RAISE(ABORT, 'canal_pendencia append-only'); END;

    CREATE TABLE IF NOT EXISTS canal_pendencia_resolucao (
      mensagemId TEXT PRIMARY KEY REFERENCES canal_mensagem(mensagemId),
      resolvidoEm TEXT NOT NULL,
      resultadoJson TEXT NOT NULL
    );
    CREATE TRIGGER IF NOT EXISTS canal_pendencia_resolucao_no_update BEFORE UPDATE ON canal_pendencia_resolucao
      BEGIN SELECT RAISE(ABORT, 'canal_pendencia_resolucao append-only'); END;
    CREATE TRIGGER IF NOT EXISTS canal_pendencia_resolucao_no_delete BEFORE DELETE ON canal_pendencia_resolucao
      BEGIN SELECT RAISE(ABORT, 'canal_pendencia_resolucao append-only'); END;

    CREATE TABLE IF NOT EXISTS canal_conflito_quarentena (
      conflitoId TEXT PRIMARY KEY,
      accountId TEXT NOT NULL,
      providerMessageId TEXT NOT NULL,
      mensagemIdOriginal TEXT NOT NULL REFERENCES canal_mensagem(mensagemId),
      payloadSha256Persistido TEXT NOT NULL,
      payloadSha256Recebido TEXT NOT NULL,
      eventoSha256Persistido TEXT NOT NULL,
      eventoSha256Recebido TEXT NOT NULL,
      conteudoRecebido TEXT NOT NULL,
      registradoEm TEXT NOT NULL
    );
    CREATE TRIGGER IF NOT EXISTS canal_conflito_quarentena_no_update BEFORE UPDATE ON canal_conflito_quarentena
      BEGIN SELECT RAISE(ABORT, 'canal_conflito_quarentena append-only'); END;
    CREATE TRIGGER IF NOT EXISTS canal_conflito_quarentena_no_delete BEFORE DELETE ON canal_conflito_quarentena
      BEGIN SELECT RAISE(ABORT, 'canal_conflito_quarentena append-only'); END;

    CREATE TABLE IF NOT EXISTS canal_recibo_tecnico (
      reciboTecnicoId TEXT PRIMARY KEY,
      accountId TEXT NOT NULL,
      providerMessageId TEXT NOT NULL,
      statusRecibo TEXT NOT NULL CHECK (statusRecibo IN ('ENVIADA','ENTREGUE','LIDA','FALHOU')),
      ocorreuEm TEXT NOT NULL,
      ingestedAt TEXT NOT NULL,
      payloadSha256 TEXT NOT NULL,
      UNIQUE (accountId, providerMessageId, statusRecibo, ocorreuEm)
    );
    CREATE TRIGGER IF NOT EXISTS canal_recibo_tecnico_no_update BEFORE UPDATE ON canal_recibo_tecnico
      BEGIN SELECT RAISE(ABORT, 'canal_recibo_tecnico append-only'); END;
    CREATE TRIGGER IF NOT EXISTS canal_recibo_tecnico_no_delete BEFORE DELETE ON canal_recibo_tecnico
      BEGIN SELECT RAISE(ABORT, 'canal_recibo_tecnico append-only'); END;

    CREATE TABLE IF NOT EXISTS canal_imap_checkpoint (
      accountId TEXT NOT NULL,
      mailbox TEXT NOT NULL,
      uidValidity INTEGER NOT NULL CHECK (uidValidity > 0),
      lastUid INTEGER NOT NULL CHECK (lastUid >= 0),
      estadoReconciliacao TEXT NOT NULL CHECK (estadoReconciliacao IN ('INTEGRO','RECONCILIACAO_UIDVALIDITY_NECESSARIA')),
      atualizadoEm TEXT NOT NULL,
      PRIMARY KEY (accountId, mailbox)
    );

    CREATE TABLE IF NOT EXISTS canal_imap_marcacao (
      accountId TEXT NOT NULL,
      mailbox TEXT NOT NULL,
      uidValidity INTEGER NOT NULL CHECK (uidValidity > 0),
      uid INTEGER NOT NULL CHECK (uid > 0),
      confirmadoEm TEXT,
      PRIMARY KEY (accountId, mailbox, uidValidity, uid)
    );

    CREATE TABLE IF NOT EXISTS canal_consentimento_evento (
      eventoId TEXT PRIMARY KEY,
      contatoId TEXT NOT NULL,
      patientId TEXT,
      estado TEXT NOT NULL CHECK (estado IN ('TERMO_ACEITO','REVOGADO')),
      referenciaTermo TEXT,
      versaoTermo TEXT,
      finalidadesJson TEXT NOT NULL,
      origem TEXT NOT NULL,
      atorId TEXT NOT NULL,
      registradoEm TEXT NOT NULL
    );
    CREATE TRIGGER IF NOT EXISTS canal_consentimento_no_update BEFORE UPDATE ON canal_consentimento_evento
      BEGIN SELECT RAISE(ABORT, 'canal_consentimento_evento append-only'); END;
    CREATE TRIGGER IF NOT EXISTS canal_consentimento_no_delete BEFORE DELETE ON canal_consentimento_evento
      BEGIN SELECT RAISE(ABORT, 'canal_consentimento_evento append-only'); END;

    CREATE TABLE IF NOT EXISTS canal_janela_cobertura (
      janelaId TEXT PRIMARY KEY,
      accountId TEXT NOT NULL,
      inicioEm TEXT NOT NULL,
      fimEm TEXT,
      motivo TEXT NOT NULL,
      registradoEm TEXT NOT NULL,
      mensagensPerdidasInventadas INTEGER NOT NULL CHECK (mensagensPerdidasInventadas = 0)
    );
    CREATE TRIGGER IF NOT EXISTS canal_janela_cobertura_no_update BEFORE UPDATE ON canal_janela_cobertura
      BEGIN SELECT RAISE(ABORT, 'canal_janela_cobertura append-only'); END;
    CREATE TRIGGER IF NOT EXISTS canal_janela_cobertura_no_delete BEFORE DELETE ON canal_janela_cobertura
      BEGIN SELECT RAISE(ABORT, 'canal_janela_cobertura append-only'); END;
  `);
}

function entradaCoerente(entrada: {
  accountId: string;
  providerMessageId: string;
  senderRef: string;
  providerSentAt: string | null;
  ingestedAt: string;
  payloadSha256: string;
  conteudo: ConteudoCanal;
}): boolean {
  const id = (valor: string) => valor.length > 0 && valor.length <= 250 && valor === valor.trim() && !/[\u0000-\u001f]/.test(valor);
  if (!id(entrada.accountId) || !id(entrada.providerMessageId) || !id(entrada.senderRef)) return false;
  if (!/^[a-f0-9]{64}$/.test(entrada.payloadSha256)) return false;
  if (!Instante.safeParse(entrada.ingestedAt).success) return false;
  if (entrada.providerSentAt !== null && !Instante.safeParse(entrada.providerSentAt).success) return false;
  if (entrada.conteudo.tipo === "TEXT") return entrada.conteudo.texto.length > 0 && entrada.conteudo.contentSha256.length === 64;
  return entrada.conteudo.processamento === "NAO_PROCESSADA" && entrada.conteudo.tipo === "MEDIA_UNPROCESSED";
}

function falhaArmazenamento(): FalhaArmazenamento {
  return { ok: false, codigo: "ARMAZENAMENTO_INDISPONIVEL", recuperavel: true, persistida: false };
}

function obterSessaoValida(acesso: AcessoCanal): Sessao | null {
  const sessao = Sessao.safeParse(acesso.sessoes.obter(acesso.token));
  if (!sessao.success || !Instante.safeParse(acesso.agora).success) return null;
  return Date.parse(sessao.data.expiraEm) > Date.parse(acesso.agora) ? sessao.data : null;
}

function sessaoValida(acesso: AcessoCanal): boolean {
  return obterSessaoValida(acesso) !== null;
}

function itemDeLinha(linha: Linha): ItemCaixa {
  const conteudo = admitirConteudo(JSON.parse(linha.conteudo));
  if (!conteudo) throw new Error("CANAL_CONTEUDO_ILEGIVEL");
  return {
    mensagemId: linha.mensagemId,
    accountId: linha.accountId,
    canal: linha.canal as CanalIngresso,
    providerMessageId: linha.providerMessageId,
    senderRef: linha.senderRef,
    providerSentAt: linha.providerSentAt,
    ingestedAt: linha.ingestedAt,
    payloadSha256: linha.payloadSha256,
    reciboTecnico: "RECEBIDA",
    vinculo: linha.provaMetodo === "IMAP_CONTA_LOCAL"
      ? { classe: "DESCONHECIDO", patientId: null, motivo: "REMETENTE_EMAIL_NAO_AUTENTICADO_REQUER_REVISAO" }
      : {
      classe: linha.vinculoClasse as VinculoIngresso["classe"],
      patientId: linha.vinculoPatientId,
      motivo: linha.vinculoMotivo,
    },
    conteudo,
    decisaoClinica: null,
    evolucaoIncorporada: false,
    prescricao: false,
    assinatura: false,
    envioAutorizado: false,
  };
}

function umaAssinatura(valor: PedidoEntradaWebhook["assinatura"]): string | null | "varias" {
  if (typeof valor === "string") return valor;
  if (valor == null) return null;
  const unica = valor.length === 1 ? valor[0] : undefined;
  return typeof unica === "string" ? unica : "varias";
}
