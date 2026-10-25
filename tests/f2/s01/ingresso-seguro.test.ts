import { createHash, createHmac } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { DatabaseSync } from "node:sqlite";
import { afterEach, describe, expect, it } from "vitest";
import { abrirLedger } from "../../../src/kernel/ledger/db.js";
import type { CadastroVinculo } from "../../../src/modules/canal/vinculo.js";
import {
  consultarCaixaCanal,
  consultarConsentimentoCanal,
  enviarParaForaCanal,
  ingerirLoteImapCanal,
  lerCheckpointImapCanal,
  listarJanelasIndisponibilidadeCanal,
  listarPendenciasCanal,
  listarQuarentenaConflitosCanal,
  listarRecibosTecnicosCanal,
  receberEnvelopeWebhookCanal,
  reconciliarUidValidityImapCanal,
  registrarConsentimentoCanal,
  registrarJanelaIndisponibilidadeCanal,
  retomarPendenciasCanal,
  revogarConsentimentoCanal,
  verificarDesafioWebhookWhatsApp,
  verificarDurabilidadeSqlite,
  type ContaWebhookConfigurada,
} from "../../../src/server/canalEntrada.js";
import { criarGerenciadorSessao } from "../../../src/server/sessao.js";

const AGORA = "2026-10-15T12:00:00.000Z";
const ENVIADO = "2026-10-15T11:30:00.000Z";
const SEGREDO_A = "segredo-conta-whatsapp-a";
const SEGREDO_B = "segredo-conta-whatsapp-b";
const SENHA = "senha-sintetica-12";

const CONTAS: readonly ContaWebhookConfigurada[] = [
  { accountId: "wa-servico-principal", canal: "WHATSAPP_SERVICO", keyId: "key-wa-a", segredo: SEGREDO_A, verifyToken: "verify-tok-a" },
  { accountId: "wa-servico-secundario", canal: "WHATSAPP_SERVICO", keyId: "key-wa-b", segredo: SEGREDO_B, verifyToken: "verify-tok-b" },
];

const pastas: string[] = [];
const abertos: DatabaseSync[] = [];

function utf8(texto: string): Uint8Array {
  return new TextEncoder().encode(texto);
}

function assinar(bytes: Uint8Array, segredo = SEGREDO_A): string {
  return `sha256=${createHmac("sha256", segredo).update(bytes).digest("hex")}`;
}

function textoConteudo(texto: string) {
  return {
    tipo: "TEXT" as const,
    texto,
    contentSha256: createHash("sha256").update(texto).digest("hex"),
  };
}

function ledger(): { db: DatabaseSync; caminho: string } {
  const pasta = mkdtempSync(join(tmpdir(), "canal-s01-"));
  pastas.push(pasta);
  const caminho = join(pasta, "ledger.sqlite");
  const db = abrirLedger(caminho);
  abertos.push(db);
  return { db, caminho };
}

function reabrir(caminho: string): DatabaseSync {
  const db = abrirLedger(caminho);
  abertos.push(db);
  return db;
}

function sessao(agora = AGORA) {
  const sessoes = criarGerenciadorSessao({
    medicoId: "medico-sintetico-s01",
    crm: "CRM-PB-SINTETICO",
    senha: SENHA,
    duracaoMs: 60_000,
    agora: () => agora,
  });
  const login = sessoes.login(SENHA);
  if (!login) throw new Error("LOGIN_FALHOU");
  return { sessoes, token: login.token, agora };
}

afterEach(() => {
  for (const db of abertos.splice(0)) {
    try { db.close(); } catch { /* ja fechado */ }
  }
  for (const pasta of pastas.splice(0)) {
    rmSync(pasta, { recursive: true, force: true });
  }
});

describe("S-F2-01 · Ingresso seguro e recuperável (WhatsApp, IMAP, idempotência, recuperação e consentimento)", () => {
  it("B1 · separa verificação GET challenge do recebimento POST e valida token em tempo constante", () => {
    const ok = verificarDesafioWebhookWhatsApp({
      "hub.mode": "subscribe",
      "hub.verify_token": "verify-tok-a",
      "hub.challenge": "challenge-987654",
    }, "verify-tok-a");
    expect(ok).toEqual({ ok: true, challenge: "challenge-987654" });

    expect(verificarDesafioWebhookWhatsApp({
      "hub.mode": "subscribe",
      "hub.verify_token": "token-errado",
      "hub.challenge": "challenge-987654",
    }, "verify-tok-a")).toEqual({ ok: false, codigo: "TOKEN_VERIFICACAO_INVALIDO" });

    expect(verificarDesafioWebhookWhatsApp({
      "hub.mode": "unsubscribe",
      "hub.verify_token": "verify-tok-a",
      "hub.challenge": "challenge-987654",
    }, "verify-tok-a")).toEqual({ ok: false, codigo: "DESAFIO_INVALIDO" });

    expect(verificarDesafioWebhookWhatsApp({
      "hub.mode": "subscribe",
      "hub.verify_token": "verify-tok-a",
      "hub.challenge": "<script>alert(1)</script>",
    }, "verify-tok-a")).toEqual({ ok: false, codigo: "DESAFIO_INVALIDO" });
  });

  it("B2/D · trata envelopes com múltiplos eventos (mensagens, recibos técnicos e outros) e ignora variação de metadados do envelope no replay", () => {
    const { db } = ledger();
    const acesso = sessao();
    const durabilidade = verificarDurabilidadeSqlite(db);
    expect(durabilidade.ok).toBe(true);
    expect(durabilidade.journalMode).toBe("wal");

    const env1 = utf8(JSON.stringify({
      envelopeId: "env-entrega-1",
      enviadoEm: "2026-10-15T11:31:00.000Z",
      accountRef: "wa-servico-principal",
      eventos: [
        {
          categoriaEvento: "MENSAGEM",
          mensagem: {
            tipoConteudo: "TEXT",
            providerMessageId: "wamid-001",
            senderRef: ("+55" + "00000000001"),
            providerSentAt: ENVIADO,
            texto: "Paciente relata náusea leve hoje.",
          },
        },
        {
          categoriaEvento: "RECIBO_TECNICO",
          providerMessageId: "wamid-saida-anterior",
          statusRecibo: "ENTREGUE",
          ocorreuEm: "2026-10-15T11:30:30.000Z",
          recipientRef: ("+55" + "00000000001"),
        },
        {
          categoriaEvento: "OUTRO_EVENTO",
          eventoId: "ev-status-1",
          tipoEvento: " statuses_summary ",
          ocorreuEm: null,
        },
      ],
    }));

    // " statuses_summary " tem espaço nas bordas -> deve ser recusado por idValido
    expect(receberEnvelopeWebhookCanal(
      db,
      { bytes: env1, assinatura: assinar(env1), keyId: "key-wa-a", verificadoEm: AGORA },
      { contasConfiguradas: CONTAS, cadastros: [] },
    )).toEqual({ ok: false, codigo: "PAYLOAD_MALFORMADO", persistida: false });

    const envValido1 = utf8(JSON.stringify({
      envelopeId: "env-entrega-1",
      enviadoEm: "2026-10-15T11:31:00.000Z",
      accountRef: "wa-servico-principal",
      eventos: [
        {
          categoriaEvento: "MENSAGEM",
          mensagem: {
            tipoConteudo: "TEXT",
            providerMessageId: "wamid-001",
            senderRef: ("+55" + "00000000001"),
            providerSentAt: ENVIADO,
            texto: "Paciente relata náusea leve hoje.",
          },
        },
        {
          categoriaEvento: "MENSAGEM",
          mensagem: {
            tipoConteudo: "TEXT",
            providerMessageId: "wamid-002",
            senderRef: ("+55" + "00000000002"),
            providerSentAt: ENVIADO,
            texto: "Segunda mensagem no mesmo envelope.",
          },
        },
        {
          categoriaEvento: "RECIBO_TECNICO",
          providerMessageId: "wamid-saida-anterior",
          statusRecibo: "ENTREGUE",
          ocorreuEm: "2026-10-15T11:30:30.000Z",
          recipientRef: ("+55" + "00000000001"),
        },
        {
          categoriaEvento: "OUTRO_EVENTO",
          eventoId: "ev-status-1",
          tipoEvento: "statuses_summary",
          ocorreuEm: null,
        },
      ],
    }));

    const r1 = receberEnvelopeWebhookCanal(
      db,
      { bytes: envValido1, assinatura: assinar(envValido1), keyId: "key-wa-a", verificadoEm: AGORA },
      { contasConfiguradas: CONTAS, cadastros: [] },
    );
    expect(r1).toMatchObject({
      ok: true,
      envelopeId: "env-entrega-1",
      accountId: "wa-servico-principal",
      ackAutorizado: true,
      recibosTecnicosPersistidos: 1,
      outrosEventosIgnorados: 1,
    });
    if (!r1.ok) return;
    expect(r1.mensagens.map((m) => m.classificacao)).toEqual(["NOVA", "NOVA"]);

    // Segundo envelope com envelopeId e enviadoEm diferentes, mas o MESMO evento wamid-001 + uma nova wamid-003
    const envValido2 = utf8(JSON.stringify({
      envelopeId: "env-reentrega-2",
      enviadoEm: "2026-10-15T11:35:00.000Z",
      accountRef: "wa-servico-principal",
      eventos: [
        {
          categoriaEvento: "MENSAGEM",
          mensagem: {
            tipoConteudo: "TEXT",
            providerMessageId: "wamid-001",
            senderRef: ("+55" + "00000000001"),
            providerSentAt: ENVIADO,
            texto: "Paciente relata náusea leve hoje.",
          },
        },
        {
          categoriaEvento: "MENSAGEM",
          mensagem: {
            tipoConteudo: "TEXT",
            providerMessageId: "wamid-003",
            senderRef: ("+55" + "00000000003"),
            providerSentAt: ENVIADO,
            texto: "Terceira mensagem inédita.",
          },
        },
      ],
    }));

    const r2 = receberEnvelopeWebhookCanal(
      db,
      { bytes: envValido2, assinatura: assinar(envValido2), keyId: "key-wa-a", verificadoEm: AGORA },
      { contasConfiguradas: CONTAS, cadastros: [] },
    );
    expect(r2).toMatchObject({
      ok: true,
      envelopeId: "env-reentrega-2",
      ackAutorizado: true,
    });
    if (!r2.ok) return;
    expect(r2.mensagens.map((m) => ({ id: m.providerMessageId, c: m.classificacao }))).toEqual([
      { id: "wamid-001", c: "REPLAY" },
      { id: "wamid-003", c: "NOVA" },
    ]);

    // Recibos técnicos não viram mensagens clínicas na caixa
    const caixa = consultarCaixaCanal(db, acesso);
    expect(caixa.ok && caixa.mensagens.map((m) => m.providerMessageId).sort()).toEqual(["wamid-001", "wamid-002", "wamid-003"]);
    expect(listarRecibosTecnicosCanal(db, "wa-servico-principal")).toHaveLength(1);
    expect(listarPendenciasCanal(db)).toHaveLength(3);
  });

  it("B3/D · recusa conta incorreta e preserva conflito de conteúdo em quarentena sem descartar como replay", () => {
    const { db } = ledger();
    const envContaErrada = utf8(JSON.stringify({
      envelopeId: "env-conta-errada",
      enviadoEm: ENVIADO,
      accountRef: "wa-servico-secundario",
      eventos: [{
        categoriaEvento: "MENSAGEM",
        mensagem: {
          tipoConteudo: "TEXT",
          providerMessageId: "wamid-10",
          senderRef: ("+55" + "00000000010"),
          providerSentAt: ENVIADO,
          texto: "Texto original.",
        },
      }],
    }));
    // Assinado com a chave da conta A, mas declarando accountRef da conta B
    expect(receberEnvelopeWebhookCanal(
      db,
      { bytes: envContaErrada, assinatura: assinar(envContaErrada, SEGREDO_A), keyId: "key-wa-a", verificadoEm: AGORA },
      { contasConfiguradas: CONTAS, cadastros: [] },
    )).toEqual({ ok: false, codigo: "CONTA_INCORRETA", persistida: false });

    // Grava mensagem original na conta A
    const envOriginal = utf8(JSON.stringify({
      envelopeId: "env-orig",
      enviadoEm: ENVIADO,
      eventos: [{
        categoriaEvento: "MENSAGEM",
        mensagem: {
          tipoConteudo: "TEXT",
          providerMessageId: "wamid-conflito-1",
          senderRef: ("+55" + "00000000010"),
          providerSentAt: ENVIADO,
          texto: "Estou sem febre hoje.",
        },
      }],
    }));
    expect(receberEnvelopeWebhookCanal(
      db,
      { bytes: envOriginal, assinatura: assinar(envOriginal, SEGREDO_A), keyId: "key-wa-a", verificadoEm: AGORA },
      { contasConfiguradas: CONTAS, cadastros: [] },
    ).ok).toBe(true);

    // Mesmo providerMessageId na mesma conta, porém texto divergente -> CONFLITO preservado em quarentena
    const envDivergente = utf8(JSON.stringify({
      envelopeId: "env-div",
      enviadoEm: ENVIADO,
      eventos: [{
        categoriaEvento: "MENSAGEM",
        mensagem: {
          tipoConteudo: "TEXT",
          providerMessageId: "wamid-conflito-1",
          senderRef: ("+55" + "00000000010"),
          providerSentAt: ENVIADO,
          texto: "Estou com febre de 39 graus hoje.",
        },
      }],
    }));
    const conflitoSemAck = receberEnvelopeWebhookCanal(
      db,
      { bytes: envDivergente, assinatura: assinar(envDivergente, SEGREDO_A), keyId: "key-wa-a", verificadoEm: AGORA },
      { contasConfiguradas: CONTAS, cadastros: [], quarentenarConflito: true, autorizarAckConflitoQuarentenado: false },
    );
    expect(conflitoSemAck).toMatchObject({
      ok: false,
      codigo: "CONFLITO_ENVELOPE",
      ackAutorizado: false,
    });
    const quarentena = listarQuarentenaConflitosCanal(db);
    expect(quarentena).toHaveLength(1);
    expect(quarentena[0]!.providerMessageId).toBe("wamid-conflito-1");
    expect(quarentena[0]!.eventoSha256Persistido).not.toBe(quarentena[0]!.eventoSha256Recebido);
  });

  it("C · adaptador IMAP faz checkpoint por conta+mailbox+UIDVALIDITY+UID, exige reconciliação quando UIDVALIDITY muda e ignora nome do From", async () => {
    const { db } = ledger();
    const acesso = sessao();
    const emailReal = `${"maria.real"}${"@example.test"}`;
    const emailImpostor = `${"impostor"}${"@example.test"}`;
    const cadastros: CadastroVinculo[] = [
      {
        patientId: "paciente-maria",
        identificadores: [{ tipo: "EMAIL", valor: emailReal }],
        chaveDemografica: null,
        nome: "Maria Sintetica",
      },
    ];

    let marcadosNoServidorImap: readonly number[] = [];
    const lote1 = await ingerirLoteImapCanal(db, {
      accountId: "imap-clinica-1",
      mailbox: "INBOX",
      uidValiditySessao: 5001,
      ingestedAt: AGORA,
      cadastros,
      marcarProcessadoNoServidorImap: (uids) => { marcadosNoServidorImap = uids; },
      mensagens: [
        {
          uidValidity: 5001,
          uid: 10,
          fromAddress: `Maria Sintetica <${emailImpostor}>`,
          fromDisplayName: "Maria Sintetica",
          sentAt: ENVIADO,
          rawBytes: utf8(`From: Maria Sintetica <${emailImpostor}>\r\n\r\nRelato por email`),
          conteudo: textoConteudo("Relato por email de remetente desconhecido com nome igual."),
        },
        {
          uidValidity: 5001,
          uid: 12,
          fromAddress: `Maria Outra <${emailReal}>`,
          fromDisplayName: "Maria Outra",
          sentAt: ENVIADO,
          rawBytes: utf8(`From: Maria Outra <${emailReal}>\r\n\r\nRelato do email cadastrado.`),
          conteudo: textoConteudo("Relato do email cadastrado."),
        },
      ],
    });

    expect(lote1.ok).toBe(true);
    if (!lote1.ok) return;
    expect(lote1.checkpoint).toMatchObject({
      accountId: "imap-clinica-1",
      mailbox: "INBOX",
      uidValidity: 5001,
      lastUid: 12,
      estadoReconciliacao: "INTEGRO",
    });
    expect(marcadosNoServidorImap).toEqual([10, 12]);

    // Autenticar a caixa IMAP não autentica o From, nem quando coincide com o cadastro.
    const caixa = consultarCaixaCanal(db, acesso);
    expect(caixa.ok).toBe(true);
    if (!caixa.ok) return;
    const msgImpostor = caixa.mensagens.find((m) => m.providerMessageId === "imap:INBOX:5001:10")!;
    const msgReal = caixa.mensagens.find((m) => m.providerMessageId === "imap:INBOX:5001:12")!;
    expect(msgImpostor.vinculo).toMatchObject({ classe: "DESCONHECIDO", patientId: null });
    expect(msgReal.vinculo).toMatchObject({ classe: "DESCONHECIDO", patientId: null });

    // Mudança de UIDVALIDITY (5001 -> 5002) bloqueia ingestão automática e marca checkpoint para reconciliação
    const loteUidValidityMudou = await ingerirLoteImapCanal(db, {
      accountId: "imap-clinica-1",
      mailbox: "INBOX",
      uidValiditySessao: 5002,
      ingestedAt: "2026-10-15T12:05:00.000Z",
      cadastros,
      mensagens: [{
        uidValidity: 5002,
        uid: 1,
        fromAddress: emailReal,
        sentAt: ENVIADO,
        rawBytes: utf8("Nova caixa"),
        conteudo: textoConteudo("Mensagem após mudança de UIDVALIDITY."),
      }],
    });
    expect(loteUidValidityMudou).toEqual({
      ok: false,
      codigo: "UIDVALIDITY_ALTERADO_RECONCILIACAO_EXIGIDA",
      persistida: false,
      uidValidityAnterior: 5001,
      uidValidityRecebido: 5002,
    });
    expect(lerCheckpointImapCanal(db, "imap-clinica-1", "INBOX")?.estadoReconciliacao).toBe("RECONCILIACAO_UIDVALIDITY_NECESSARIA");

    // Enquanto não reconciliado, novas leituras recusam avanço silencioso
    expect(await ingerirLoteImapCanal(db, {
      accountId: "imap-clinica-1",
      mailbox: "INBOX",
      uidValiditySessao: 5002,
      ingestedAt: "2026-10-15T12:06:00.000Z",
      cadastros,
      mensagens: [],
    })).toMatchObject({ ok: false, codigo: "CHECKPOINT_EM_RECONCILIACAO" });

    // Após reconciliação explícita, o novo UIDVALIDITY passa a operar normalmente
    const reconciliado = reconciliarUidValidityImapCanal(db, {
      accountId: "imap-clinica-1",
      mailbox: "INBOX",
      novoUidValidity: 5002,
      lastUidReconciliado: 0,
      reconciliadoEm: "2026-10-15T12:07:00.000Z",
    });
    expect(reconciliado.ok).toBe(true);

    const lotePosReconciliacao = await ingerirLoteImapCanal(db, {
      accountId: "imap-clinica-1",
      mailbox: "INBOX",
      uidValiditySessao: 5002,
      ingestedAt: "2026-10-15T12:08:00.000Z",
      cadastros,
      mensagens: [{
        uidValidity: 5002,
        uid: 1,
        fromAddress: emailReal,
        sentAt: ENVIADO,
        rawBytes: utf8("Nova caixa"),
        conteudo: textoConteudo("Mensagem após mudança de UIDVALIDITY."),
      }],
    });
    expect(lotePosReconciliacao.ok).toBe(true);
  });

  it("E · retoma pendências após reinício do servidor no mesmo SQLite e registra janelas sem cobertura sem inventar mensagens", () => {
    const { db, caminho } = ledger();
    const env = utf8(JSON.stringify({
      envelopeId: "env-restart-1",
      enviadoEm: ENVIADO,
      eventos: [{
        categoriaEvento: "MENSAGEM",
        mensagem: {
          tipoConteudo: "TEXT",
          providerMessageId: "wamid-restart-1",
          senderRef: ("+55" + "00000000055"),
          providerSentAt: ENVIADO,
          texto: "Mensagem recebida antes da queda pós-ACK.",
        },
      }],
    }));

    const ack = receberEnvelopeWebhookCanal(
      db,
      { bytes: env, assinatura: assinar(env, SEGREDO_A), keyId: "key-wa-a", verificadoEm: AGORA },
      { contasConfiguradas: CONTAS, cadastros: [] },
    );
    expect(ack.ok).toBe(true);
    expect(listarPendenciasCanal(db)).toEqual([
      expect.objectContaining({ estado: "PENDENTE_PROCESSAMENTO" }),
    ]);

    // Simula queda do processo logo após o ACK e antes do processamento
    db.close();

    // Reinicia em nova conexão sobre o mesmo arquivo SQLite
    const dbReaberto = reabrir(caminho);
    expect(listarPendenciasCanal(dbReaberto)).toEqual([
      expect.objectContaining({ estado: "PENDENTE_PROCESSAMENTO" }),
    ]);

    expect(retomarPendenciasCanal(dbReaberto, {agora:"2026-10-15T12:10:00.000Z"}))
      .toMatchObject({ok:true,retomadas:0,pendentesRestantes:1});
    const processadas:string[]=[];
    const retomada = retomarPendenciasCanal(dbReaberto, {
      agora: "2026-10-15T12:10:00.000Z",
      processador:mensagem=>{processadas.push(mensagem.mensagemId);return {reciboTecnico:"PROCESSADA",mensagemId:mensagem.mensagemId};},
    });
    expect(processadas).toHaveLength(1);
    expect(retomada).toMatchObject({
      ok: true,
      retomadas: 1,
      pendentesRestantes: 0,
    });
    expect(listarPendenciasCanal(dbReaberto)).toEqual([
      expect.objectContaining({ estado: "PROCESSADA", resolvidoEm: "2026-10-15T12:10:00.000Z" }),
    ]);

    // Registra período sem cobertura (ex.: PC desligado à noite) sem inventar mensagens
    const janela = registrarJanelaIndisponibilidadeCanal(dbReaberto, {
      accountId: "wa-servico-principal",
      inicioEm: "2026-10-15T00:00:00.000Z",
      fimEm: "2026-10-15T06:00:00.000Z",
      motivo: "Computador local desligado fora do horário de expediente",
      registradoEm: "2026-10-15T06:01:00.000Z",
    });
    expect(janela.ok).toBe(true);
    expect(listarJanelasIndisponibilidadeCanal(dbReaberto, "wa-servico-principal")).toEqual([
      expect.objectContaining({
        accountId: "wa-servico-principal",
        mensagensPerdidasInventadas: 0,
      }),
    ]);
  });

  it("F/G · recebimento nunca gera TERMO_ACEITO automaticamente; consentimento e revogação são explícitos; saída externa segue bloqueada", () => {
    const { db } = ledger();
    const acesso = sessao();
    const env = utf8(JSON.stringify({
      envelopeId: "env-consent-1",
      enviadoEm: ENVIADO,
      eventos: [{
        categoriaEvento: "MENSAGEM",
        mensagem: {
          tipoConteudo: "TEXT",
          providerMessageId: "wamid-consent-1",
          senderRef: ("+55" + "00000000077"),
          providerSentAt: ENVIADO,
          texto: "Aceito receber mensagens pelo WhatsApp.",
        },
      }],
    }));
    expect(receberEnvelopeWebhookCanal(
      db,
      { bytes: env, assinatura: assinar(env, SEGREDO_A), keyId: "key-wa-a", verificadoEm: AGORA },
      { contasConfiguradas: CONTAS, cadastros: [] },
    ).ok).toBe(true);

    // Mesmo o texto dizendo "Aceito", o estado do consentimento permanece NAO_AVALIADO
    const antes = consultarConsentimentoCanal(db, ("+55" + "00000000077"));
    expect(antes.estado).toBe("NAO_AVALIADO");
    expect(antes.referenciaTermo).toBeNull();

    // Registro explícito autenticado na sessão médica
    const aceito = registrarConsentimentoCanal(db, acesso, {
      contatoId: ("+55" + "00000000077"),
      patientId: "paciente-sintetico-77",
      referenciaTermo: "termo-canal-v1-assinado",
      versaoTermo: "1.0.0",
      finalidade: ["COMUNICACAO_CLINICA", "ORIENTACAO_GERAL"],
      origem: "PRESENCIAL_CONSULTORIO",
    });
    expect(aceito).toMatchObject({
      ok: true,
      consentimento: {
        contatoId: ("+55" + "00000000077"),
        patientId: "paciente-sintetico-77",
        estado: "TERMO_ACEITO",
        referenciaTermo: "termo-canal-v1-assinado",
        versaoTermo: "1.0.0",
        ator: { tipo: "SESSAO", id: "medico-sintetico-s01" },
      },
    });

    // Revogação preserva histórico do aceite anterior mas muda estado para REVOGADO
    const revogado = revogarConsentimentoCanal(db, { ...acesso, agora: "2026-10-15T12:00:30.000Z" }, {
      contatoId: ("+55" + "00000000077"),
      patientId: "paciente-sintetico-77",
      origem: "REVOGACAO_PACIENTE",
    });
    expect(revogado).toMatchObject({
      ok: true,
      consentimento: {
        estado: "REVOGADO",
        referenciaTermo: "termo-canal-v1-assinado",
        revogadoEm: "2026-10-15T12:00:30.000Z",
      },
    });

    // Bloqueio de saída externa preservado em S-F2-01
    expect(enviarParaForaCanal()).toEqual({
      ok: false,
      codigo: "CANAL_EXTERNO_NAO_HABILITADO",
      enviou: false,
    });
  });
});
