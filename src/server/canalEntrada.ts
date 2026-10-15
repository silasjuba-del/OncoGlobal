// Ingresso local do canal.
// Transporte real ainda não conectado. Dependências para uma ligação posterior, nenhuma delas configurada aqui:
// - WhatsApp Business: segredo do aplicativo Meta fora do repositório, cabeçalho X-Hub-Signature-256
//   sobre os bytes crus, e um endpoint HTTPS que a Meta alcance. Este módulo não abre túnel nem envia mensagem.
// - E-mail: conta IMAP local, com credencial fora do repositório. Sem credencial, o adaptador sintético
//   prova só o fluxo neste SQLite.
// O segredo e o texto integral não entram em log. Envio externo permanece desligado.
import type { DatabaseSync } from "node:sqlite";
import { Instante, Sessao } from "../contracts/base.js";
import {
  admitirConteudo, classificarRemetente, decidirIdempotencia, hashEntradaSintetica, idMensagem,
  interpretarCorpoWebhook, tipoIdentificadorDoCanal,
  type CanalIngresso, type ConteudoCanal, type VinculoIngresso,
} from "../modules/canal/ingresso.js";
import type { CadastroVinculo } from "../modules/canal/vinculo.js";
import { autenticarWebhookHmac, type PedidoWebhook, type RecusaWebhook, type ResultadoWebhook } from "../modules/canal/autenticarWebhook.js";
import { transacao } from "../kernel/ledger/db.js";
import type { GerenciadorSessao } from "./sessao.js";

export type { ResultadoWebhook, ProvaWebhook, WebhookAutenticado, RecusaWebhook } from "../modules/canal/autenticarWebhook.js";
export { LIMITE_BYTES_CORPO_WEBHOOK } from "../modules/canal/autenticarWebhook.js";

export type PedidoEntradaWebhook = Omit<PedidoWebhook, "assinatura"> & {
  /** Valor de X-Hub-Signature-256. Vários valores no mesmo pedido são assinatura inválida. */
  assinatura: string | readonly string[] | null | undefined;
};

export type ChaveCanal = { accountId: string; providerMessageId: string };

export type AckCanal =
  | { ok: true; resultado: "RECEBIDA" | "REPLAY"; persistida: true; reciboId: string; chave: ChaveCanal; payloadSha256: string }
  | {
    ok: false;
    resultado: "CONFLITO_REPLAY";
    persistida: false;
    reciboId: string;
    chave: ChaveCanal;
    payloadSha256Recebido: string;
    payloadSha256Persistido: string;
  };

export type FalhaArmazenamento = { ok: false; codigo: "ARMAZENAMENTO_INDISPONIVEL"; recuperavel: true; persistida: false };
export type RecusaEntrada = { ok: false; codigo: "ENTRADA_INVALIDA" | "PAYLOAD_MALFORMADO"; persistida: false };

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

/** HMAC, depois gravação, e só então o ACK. Falha de autenticação não grava. */
export function receberWebhookCanal(
  db: DatabaseSync,
  pedido: PedidoEntradaWebhook,
  contexto: {
    accountId: string;
    canal: CanalIngresso;
    cadastros: readonly CadastroVinculo[];
    log?: LogCanal;
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
  const gravado = persistirEntrada(db, {
    accountId: contexto.accountId,
    canal: contexto.canal,
    providerMessageId: corpo.corpo.providerMessageId,
    senderRef: corpo.corpo.senderRef,
    providerSentAt: corpo.corpo.providerSentAt,
    ingestedAt: pedido.verificadoEm,
    payloadSha256: autenticado.prova.payloadSha256,
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
  },
): RecusaEntrada | AckCanal | FalhaArmazenamento {
  const conteudo = admitirConteudo(entrada.conteudo);
  if (!conteudo) return { ok: false, codigo: "ENTRADA_INVALIDA", persistida: false };
  const limpa = { ...entrada, conteudo };
  return persistirEntrada(db, {
    ...limpa,
    payloadSha256: hashEntradaSintetica(limpa),
    provaMetodo: "TRANSPORTE_SINTETICO",
    provaKeyId: "sintetico",
  });
}

export function consultarCaixaCanal(
  db: DatabaseSync,
  acesso: AcessoCanal,
): { ok: false; codigo: "SESSAO_INVALIDA" } | FalhaArmazenamento | { ok: true; mensagens: ItemCaixa[] } {
  if (!sessaoValida(acesso)) return { ok: false, codigo: "SESSAO_INVALIDA" };
  try {
    garantirSchema(db);
    const linhas = db.prepare(
      `SELECT mensagemId, accountId, providerMessageId, canal, senderRef, providerSentAt, ingestedAt,
        payloadSha256, conteudo, vinculoClasse, vinculoPatientId, vinculoMotivo
       FROM canal_mensagem ORDER BY ingestedAt, mensagemId LIMIT ?`,
    ).all(LIMITE_CAIXA) as Linha[];
    return { ok: true, mensagens: linhas.map(itemDeLinha) };
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
  try {
    garantirSchema(db);
    const linha = db.prepare(
      `SELECT mensagemId, accountId, providerMessageId, canal, senderRef, providerSentAt, ingestedAt,
        payloadSha256, conteudo, vinculoClasse, vinculoPatientId, vinculoMotivo
       FROM canal_mensagem WHERE mensagemId=?`,
    ).get(mensagemId) as Linha | undefined;
    if (!linha) return { ok: false, codigo: "MENSAGEM_AUSENTE" };
    return { ok: true, mensagem: itemDeLinha(linha) };
  } catch {
    return falhaArmazenamento();
  }
}

/** Nenhum envio real. O código acompanha autorizarSaida. */
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
  conteudo: ConteudoCanal;
  cadastros: readonly CadastroVinculo[];
  provaMetodo: string;
  provaKeyId: string;
}): RecusaEntrada | AckCanal | FalhaArmazenamento {
  const conteudo = admitirConteudo(entrada.conteudo);
  if (!conteudo || !entradaCoerente({ ...entrada, conteudo })) return { ok: false, codigo: "ENTRADA_INVALIDA", persistida: false };
  const vinculo = classificarRemetente(entrada.senderRef, tipoIdentificadorDoCanal(entrada.canal), entrada.cadastros);
  const mensagemId = idMensagem(entrada.accountId, entrada.providerMessageId);
  const chave = { accountId: entrada.accountId, providerMessageId: entrada.providerMessageId };
  try {
    return transacao(db, () => {
      garantirSchema(db);
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
      const existente = db.prepare(
        "SELECT mensagemId, payloadSha256 FROM canal_mensagem WHERE accountId=? AND providerMessageId=?",
      ).get(entrada.accountId, entrada.providerMessageId) as { mensagemId: string; payloadSha256: string } | undefined;
      if (!existente) throw new Error("CANAL_LINHA_AUSENTE");
      const decisao = decidirIdempotencia(Number(insert.changes) === 1 ? null : existente, entrada);
      if (decisao.tipo === "NOVA" || decisao.tipo === "REPLAY") {
        return {
          ok: true as const,
          resultado: decisao.tipo === "NOVA" ? "RECEBIDA" as const : "REPLAY" as const,
          persistida: true as const,
          reciboId: decisao.tipo === "NOVA" ? mensagemId : decisao.mensagemId,
          chave,
          payloadSha256: decisao.tipo === "NOVA" ? entrada.payloadSha256 : decisao.payloadSha256,
        };
      }
      return {
        ok: false as const,
        resultado: "CONFLITO_REPLAY" as const,
        persistida: false as const,
        reciboId: decisao.mensagemId,
        chave,
        payloadSha256Recebido: decisao.payloadSha256Recebido,
        payloadSha256Persistido: decisao.payloadSha256Persistido,
      };
    });
  } catch {
    return { ok: false, codigo: "ARMAZENAMENTO_INDISPONIVEL", recuperavel: true, persistida: false };
  }
}

function garantirSchema(db: DatabaseSync): void {
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
    CREATE TRIGGER IF NOT EXISTS canal_mensagem_no_update BEFORE UPDATE ON canal_mensagem
      BEGIN SELECT RAISE(ABORT, 'canal_mensagem append-only'); END;
    CREATE TRIGGER IF NOT EXISTS canal_mensagem_no_delete BEFORE DELETE ON canal_mensagem
      BEGIN SELECT RAISE(ABORT, 'canal_mensagem append-only'); END;
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

function sessaoValida(acesso: AcessoCanal): boolean {
  const sessao = Sessao.safeParse(acesso.sessoes.obter(acesso.token));
  if (!sessao.success || !Instante.safeParse(acesso.agora).success) return false;
  return Date.parse(sessao.data.expiraEm) > Date.parse(acesso.agora);
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
    vinculo: {
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
