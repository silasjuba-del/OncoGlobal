import { describe, expect, it } from "vitest";
import { EstadoConversa } from "../../../src/contracts/estados.js";
import { CanalInbox, CanalInboxItem, ContactSummary } from "../../../src/contracts/api/canalEntrada.js";
import {
  AckCanalPersistido, CanalContaAutenticada, CanalEnvelopeWebhookBruto, CanalMensagemEntrada,
  CanalWebhookBruto, CanalEntradaAutenticada, ChaveIdempotenciaCanal, CheckpointImapCanal,
  ConsentimentoCanal, DesafioWebhookWhatsApp, EstadoReciboCanal, JanelaIndisponibilidadeCanal,
} from "../../../src/contracts/f2/canalEntrada.js";

const EM = "2026-10-14T12:00:00Z";
const HASH_A = "a".repeat(64);
const HASH_B = "b".repeat(64);

const brutoTexto = () => ({ tipoConteudo: "TEXT", providerMessageId: "prov-msg-1", senderRef: "sender-ext-1",
  providerSentAt: EM, texto: "Relato sintético para contrato." });
const provaWhatsapp = () => ({ metodo: "WEBHOOK_HMAC_SHA256", verificada: true, keyId: "key-configurada-no-servidor",
  payloadSha256: HASH_A, verificadoEm: EM });
const mensagem = () => ({ schema: "CanalMensagemEntrada@1", accountId: "conta-local-1", canal: "WHATSAPP_SERVICO",
  providerMessageId: "prov-msg-1", senderRef: "sender-ext-1", providerSentAt: EM, ingestedAt: EM,
  payloadSha256: HASH_A, autenticacao: provaWhatsapp(),
  vinculoContato: { estado: "PENDENTE", contatoId: null, candidatosContatoId: [] },
  conteudo: { tipo: "TEXT", texto: "Relato sintético para contrato.", contentSha256: HASH_A } });

describe("F2 · contratos estritos de ingresso local de canal", () => {
  it("DTO bruto não aceita accountId forjado, autoridade, patientId ou redFlag", () => {
    expect(CanalWebhookBruto.safeParse(brutoTexto()).success).toBe(true);
    for (const extra of [{ accountId: "outra-conta" }, { autenticacao: provaWhatsapp() },
      { patientId: "paciente-sintetico" }, { redFlag: false }]) {
      expect(CanalWebhookBruto.safeParse({ ...brutoTexto(), ...extra }).success).toBe(false);
    }
  });

  it("contexto autenticado exige método coerente com fonte e não confia em conta do DTO", () => {
    expect(CanalContaAutenticada.safeParse({ accountId: "conta-local-1", canal: "WHATSAPP_SERVICO",
      autenticacao: provaWhatsapp() }).success).toBe(true);
    expect(CanalContaAutenticada.safeParse({ accountId: "conta-local-1", canal: "WHATSAPP_SERVICO",
      autenticacao: { metodo: "IMAP_CONTA_LOCAL", verificada: true, mailboxId: "mailbox-1", snapshotSha256: HASH_A, verificadoEm: EM } }).success).toBe(false);
    expect(CanalContaAutenticada.safeParse({ accountId: "conta-local-1", canal: "EMAIL",
      autenticacao: { metodo: "IMAP_CONTA_LOCAL", verificada: true, mailboxId: "mailbox-1", snapshotSha256: HASH_A, verificadoEm: EM } }).success).toBe(true);
    expect(CanalEntradaAutenticada.safeParse({ conta: { accountId: "conta-local-1", canal: "WHATSAPP_SERVICO",
      autenticacao: provaWhatsapp() }, mensagem: brutoTexto(), ingestedAt: EM }).success).toBe(true);
  });

  it("normaliza mensagem pendente sem patientId nem resultado clínico inferido", () => {
    expect(CanalMensagemEntrada.safeParse(mensagem()).success).toBe(true);
    expect(CanalMensagemEntrada.safeParse({ ...mensagem(), patientId: "paciente-sintetico" }).success).toBe(false);
    expect(CanalMensagemEntrada.safeParse({ ...mensagem(), redFlag: false }).success).toBe(false);
    expect(CanalMensagemEntrada.safeParse({ ...mensagem(), autenticacao: { ...provaWhatsapp(), metodo: "IMAP_CONTA_LOCAL" } }).success).toBe(false);
    expect(CanalMensagemEntrada.safeParse({ ...mensagem(), providerSentAt: "não é data" }).success).toBe(false);
  });

  it("mídia conserva referência e metadados com processamento explicitamente não executado", () => {
    const raw = { tipoConteudo: "MEDIA_UNPROCESSED", providerMessageId: "prov-media-1", senderRef: "sender-ext-1",
      providerSentAt: null, media: { providerMediaId: "media-opaque-1", mimeType: "image/jpeg", sizeBytes: 512, sha256: null } };
    expect(CanalWebhookBruto.safeParse(raw).success).toBe(true);
    const item = { ...mensagem(), providerMessageId: "prov-media-1", providerSentAt: null,
      conteudo: { tipo: "MEDIA_UNPROCESSED", processamento: "NAO_PROCESSADA", providerMediaId: "media-opaque-1",
        mimeType: "image/jpeg", sizeBytes: 512, contentSha256: null } };
    expect(CanalMensagemEntrada.safeParse(item).success).toBe(true);
    expect(CanalMensagemEntrada.safeParse({ ...item, conteudo: { ...item.conteudo, processamento: "PROCESSADA" } }).success).toBe(false);
    expect(CanalWebhookBruto.safeParse({ ...raw, media: { ...raw.media, sizeBytes: 25_000_001 } }).success).toBe(false);
  });

  it("aplica limites de bytes UTF-8 e exige hashes SHA-256 hexadecimais", () => {
    const oversized = "😀".repeat(100_000);
    expect(CanalWebhookBruto.safeParse({ ...brutoTexto(), texto: oversized }).success).toBe(false);
    expect(CanalMensagemEntrada.safeParse({ ...mensagem(), payloadSha256: "g".repeat(64) }).success).toBe(false);
  });

  it("a chave de idempotência é accountId + providerMessageId", () => {
    const a = ChaveIdempotenciaCanal.parse({ accountId: "conta-a", providerMessageId: "mesmo-id" });
    const b = ChaveIdempotenciaCanal.parse({ accountId: "conta-b", providerMessageId: "mesmo-id" });
    expect(a).not.toEqual(b);
    expect(ChaveIdempotenciaCanal.safeParse({ ...a, providerMessageId: "" }).success).toBe(false);
    expect(ChaveIdempotenciaCanal.safeParse({ ...a, patientId: "paciente-sintetico" }).success).toBe(false);
  });

  it("ACK só admite nova persistência/replay persistidos; divergência leva hashes de ambos os payloads", () => {
    const chave = { accountId: "conta-a", providerMessageId: "msg-1" };
    expect(AckCanalPersistido.safeParse({ resultado: "RECEBIDA", persistida: true, reciboId: "recibo-1", chave, payloadSha256: HASH_A }).success).toBe(true);
    expect(AckCanalPersistido.safeParse({ resultado: "REPLAY", persistida: true, reciboId: "recibo-1", chave, payloadSha256: HASH_A }).success).toBe(true);
    expect(AckCanalPersistido.safeParse({ resultado: "RECEBIDA", persistida: false, reciboId: "recibo-1", chave, payloadSha256: HASH_A }).success).toBe(false);
    expect(AckCanalPersistido.safeParse({ resultado: "CONFLITO_REPLAY", persistida: false, reciboId: "recibo-1", chave,
      payloadSha256Recebido: HASH_B, payloadSha256Persistido: HASH_A }).success).toBe(true);
    expect(AckCanalPersistido.safeParse({ resultado: "CONFLITO_REPLAY", persistida: false, reciboId: "recibo-1", chave,
      payloadSha256Recebido: HASH_A, payloadSha256Persistido: HASH_A }).success).toBe(false);
  });

  it("recibos de transporte permanecem distintos dos estados D8", () => {
    expect(EstadoReciboCanal.parse("RECEBIDA")).toBe("RECEBIDA");
    expect(CanalInboxItem.safeParse({ mensagemId: "local-msg-1", accountId: "conta-local-1", canal: "WHATSAPP_SERVICO",
      providerMessageId: "prov-msg-1", senderRef: "sender-ext-1", providerSentAt: EM, ingestedAt: EM,
      payloadSha256: HASH_A, reciboTransporte: "ENVIADA", estadoConversa: "NOVA",
      vinculoContato: { estado: "PENDENTE", contatoId: null, candidatosContatoId: [] }, avaliacao: "PENDENTE",
      conteudo: { tipo: "TEXT", texto: "Relato sintético.", contentSha256: HASH_A } }).success).toBe(false);
    expect(EstadoConversa.parse("NOVA")).toBe("NOVA");
    expect(EstadoConversa.safeParse("RECEBIDA").success).toBe(false);
  });

  it("Inbox e ContactSummary expõem só conteúdo não confirmado e sem redFlag/patientId", () => {
    const item = { mensagemId: "local-msg-1", accountId: "conta-local-1", canal: "WHATSAPP_SERVICO",
      providerMessageId: "prov-msg-1", senderRef: "sender-ext-1", providerSentAt: EM, ingestedAt: EM,
      payloadSha256: HASH_A, reciboTransporte: "RECEBIDA", estadoConversa: "NOVA",
      vinculoContato: { estado: "PENDENTE", contatoId: null, candidatosContatoId: [] }, avaliacao: "PENDENTE",
      conteudo: { tipo: "TEXT", texto: "Relato sintético.", contentSha256: HASH_A } };
    expect(CanalInboxItem.safeParse(item).success).toBe(true);
    expect(CanalInboxItem.safeParse({ ...item, patientId: "paciente-sintetico" }).success).toBe(false);
    expect(CanalInboxItem.safeParse({ ...item, redFlag: false }).success).toBe(false);
    expect(CanalInbox.safeParse({ estado: "DISPONIVEL", mensagens: [item], contatos: [{ contatoId: null,
      canal: "WHATSAPP_SERVICO", quantidadeMensagens: 1, ultimaMensagemEm: EM, estadoVinculo: "PENDENTE", avaliacao: "PENDENTE" }] }).success).toBe(true);
    expect(ContactSummary.safeParse({ contatoId: null, canal: "WHATSAPP_SERVICO", quantidadeMensagens: 1,
      ultimaMensagemEm: EM, estadoVinculo: "PENDENTE", avaliacao: "PENDENTE", patientId: "paciente-sintetico" }).success).toBe(false);
    expect(ContactSummary.safeParse({ contatoId: "contato-1", canal: "WHATSAPP_SERVICO", quantidadeMensagens: 1,
      ultimaMensagemEm: EM, estadoVinculo: "CONTATO_EXATO", avaliacao: "PENDENTE", redFlag: false }).success).toBe(false);
  });

  it("valida desafio GET, envelope multi-evento, checkpoint IMAP, consentimento e janela sem cobertura", () => {
    expect(DesafioWebhookWhatsApp.safeParse({
      "hub.mode": "subscribe",
      "hub.verify_token": "tok-1",
      "hub.challenge": "ch-123",
    }).success).toBe(true);
    expect(DesafioWebhookWhatsApp.safeParse({
      "hub.mode": "other",
      "hub.verify_token": "tok-1",
      "hub.challenge": "ch-123",
    }).success).toBe(false);

    expect(CanalEnvelopeWebhookBruto.safeParse({
      envelopeId: "env-1",
      enviadoEm: EM,
      eventos: [
        { categoriaEvento: "MENSAGEM", mensagem: brutoTexto() },
        { categoriaEvento: "RECIBO_TECNICO", providerMessageId: "prov-msg-1", statusRecibo: "ENTREGUE", ocorreuEm: EM, recipientRef: null },
        { categoriaEvento: "OUTRO_EVENTO", eventoId: "ev-2", tipoEvento: "account_update", ocorreuEm: null },
      ],
    }).success).toBe(true);

    expect(CheckpointImapCanal.safeParse({
      accountId: "imap-conta-1",
      mailbox: "INBOX",
      uidValidity: 1001,
      lastUid: 42,
      estadoReconciliacao: "INTEGRO",
      atualizadoEm: EM,
    }).success).toBe(true);
    expect(CheckpointImapCanal.safeParse({
      accountId: "imap-conta-1",
      mailbox: "INBOX",
      uidValidity: 0,
      lastUid: 42,
      estadoReconciliacao: "INTEGRO",
      atualizadoEm: EM,
    }).success).toBe(false);

    expect(ConsentimentoCanal.safeParse({
      contatoId: "ct-1",
      patientId: null,
      estado: "NAO_AVALIADO",
      referenciaTermo: null,
      versaoTermo: null,
      registradoEm: null,
      revogadoEm: null,
      finalidade: [],
      origem: null,
      ator: null,
    }).success).toBe(true);
    expect(ConsentimentoCanal.safeParse({
      contatoId: "ct-1",
      patientId: "pt-1",
      estado: "TERMO_ACEITO",
      referenciaTermo: null,
      versaoTermo: "v1",
      registradoEm: EM,
      revogadoEm: null,
      finalidade: ["COMUNICACAO_CLINICA"],
      origem: "PRESENCIAL_CONSULTORIO",
      ator: { tipo: "SESSAO", id: "med-1" },
    }).success).toBe(false);

    expect(JanelaIndisponibilidadeCanal.safeParse({
      janelaId: "jan-1",
      accountId: "conta-1",
      inicioEm: EM,
      fimEm: "2026-10-14T14:00:00Z",
      motivo: "PC desligado durante manutenção",
      registradoEm: "2026-10-14T14:05:00Z",
      mensagensPerdidasInventadas: 0,
    }).success).toBe(true);
  });
});
