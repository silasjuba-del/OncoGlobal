import { createHmac } from "node:crypto";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, expect, it } from "vitest";
import { abrirLedger } from "../../../src/kernel/ledger/db.js";
import { receberEnvelopeWebhookCanal, resolverContaWebhookConfigurada, type ContaWebhookConfigurada } from "../../../src/server/canalEntrada.js";
import { carregarOperacaoCanal, ConfiguracaoCanalLocal } from "../../../src/server/canalOperacao.js";

const EM = "2026-10-19T18:00:00.000Z", SEGREDO = "segredo-exclusivamente-sintetico-meta";
const PHONE_NUMBER_ID = ["1234567", "89012345"].join("");
const OUTRO_PHONE_NUMBER_ID = ["2234567", "89012345"].join("");
const PHONE_INCORRETO = ["9999999", "99999999"].join("");
const REMETENTE = "5500" + "000007777";
const TIMESTAMP_META = ["17924", "32800"].join("");
const conta: ContaWebhookConfigurada = { accountId: "wpp-consultorio", phoneNumberId: PHONE_NUMBER_ID, canal: "WHATSAPP_SERVICO", keyId: "meta-sintetica", segredo: SEGREDO, verifyToken: "verify-sintetico" };
const bancos: ReturnType<typeof abrirLedger>[] = [];
const dbNovo = () => { const db = abrirLedger(":memory:"); bancos.push(db); return db; };
afterEach(() => { for (const db of bancos.splice(0)) db.close(); });
function assinar(payload: unknown, keyId = conta.keyId) {
  const bytes = Buffer.from(JSON.stringify(payload));
  return { bytes, keyId, assinatura: `sha256=${createHmac("sha256", SEGREDO).update(bytes).digest("hex")}`, verificadoEm: EM };
}
function meta(phoneNumberId = conta.phoneNumberId!, status = false) {
  return { object: "whatsapp_business_account", entry: [{ id: "waba-sintetica", changes: [{ field: "messages", value: {
    messaging_product: "whatsapp", metadata: { phone_number_id: phoneNumberId },
    ...(status ? { statuses: [{ id: "recibo-sintetico", status: "read", timestamp: TIMESTAMP_META, recipient_id: REMETENTE }] }
      : { messages: [{ from: REMETENTE, id: "wamid-sintetico", timestamp: TIMESTAMP_META, type: "text", text: { body: "Relato exclusivamente sintetico" } }] }),
  } }] }] };
}
function sintetico(accountRef?: string) {
  return { envelopeId: "envelope-sintetico", enviadoEm: EM, ...(accountRef === undefined ? {} : { accountRef }), eventos: [{ categoriaEvento: "MENSAGEM", mensagem: {
    tipoConteudo: "TEXT", providerMessageId: "msg-sintetica", senderRef: REMETENTE, providerSentAt: EM, texto: "Relato sintetico legado",
  } }] };
}
const contexto = (contasConfiguradas: readonly ContaWebhookConfigurada[] = [conta]) => ({ contasConfiguradas, cadastros: [] });

it("Meta autentica ID nativo e persiste/reexecuta sob conta logica distinta", () => {
  const db = dbNovo(), pedido = assinar(meta());
  const primeira = receberEnvelopeWebhookCanal(db, pedido, contexto());
  expect(primeira).toMatchObject({ ok: true, accountId: "wpp-consultorio", ackAutorizado: true,
    mensagens: [{ providerMessageId: "wamid-sintetico", classificacao: "NOVA" }] });
  expect(receberEnvelopeWebhookCanal(db, { ...pedido, verificadoEm: "2026-10-19T18:01:00.000Z" }, contexto())).toMatchObject({ ok: true, accountId: "wpp-consultorio", mensagens: [{ classificacao: "REPLAY" }] });
  const rows = db.prepare("SELECT accountId, providerMessageId FROM canal_mensagem").all();
  expect(rows).toEqual([{ accountId: "wpp-consultorio", providerMessageId: "wamid-sintetico" }]);
  expect(db.prepare("SELECT accountId FROM canal_pendencia").all()).toEqual([{ accountId: "wpp-consultorio" }]);
});

it.each([PHONE_INCORRETO, conta.accountId])("Meta recusa conta nativa incorreta %s mesmo com HMAC valido", phone => {
  const db = dbNovo();
  expect(receberEnvelopeWebhookCanal(db, assinar(meta(phone)), contexto())).toMatchObject({ ok: false, codigo: "CONTA_INCORRETA" });
  expect(db.prepare("SELECT name FROM sqlite_master WHERE name='canal_mensagem'").get()).toBeUndefined();
});

it("conta numerica legada nao e fallback implicito para ID nativo", () => {
  const db = dbNovo(), { phoneNumberId: _, ...legada } = conta;
  expect(receberEnvelopeWebhookCanal(db, assinar(meta()), contexto([{ ...legada, accountId: conta.phoneNumberId! }]))).toMatchObject({ ok: false, codigo: "CONFIGURACAO_INVALIDA" });
});

it("recibos tecnicos nativos tambem usam exclusivamente a conta logica", () => {
  const db = dbNovo(), p = assinar(meta(conta.phoneNumberId!, true));
  expect(receberEnvelopeWebhookCanal(db, p, contexto())).toMatchObject({ ok: true, accountId: conta.accountId, recibosTecnicosPersistidos: 1 });
  expect(receberEnvelopeWebhookCanal(db, p, contexto())).toMatchObject({ ok: true, recibosTecnicosPersistidos: 0 });
  expect(db.prepare("SELECT accountId, statusRecibo FROM canal_recibo_tecnico").all()).toEqual([{ accountId: conta.accountId, statusRecibo: "LIDA" }]);
});

it("segredo compartilhado nao permite selecionar outra conta pela URL/keyId", () => {
  const db = dbNovo(), outra = { ...conta, accountId: "wpp-secundario", keyId: "meta-secundaria", phoneNumberId: OUTRO_PHONE_NUMBER_ID };
  const contas = [conta, outra];
  expect(receberEnvelopeWebhookCanal(db, assinar(meta(), outra.keyId), contexto(contas))).toMatchObject({ ok: false, codigo: "CONTA_INCORRETA" });
  expect(receberEnvelopeWebhookCanal(db, assinar(meta()), contexto(contas))).toMatchObject({ ok: true, accountId: conta.accountId });
  expect(receberEnvelopeWebhookCanal(db, assinar(meta(outra.phoneNumberId), outra.keyId), contexto(contas))).toMatchObject({ ok: true, accountId: outra.accountId, mensagens: [{ classificacao: "NOVA" }] });
  expect(db.prepare("SELECT COUNT(*) AS n FROM canal_mensagem").get()!.n).toBe(2);
});

it("sintetico usa accountRef logico e permanece compativel sem phoneNumberId", () => {
  const db = dbNovo(), { phoneNumberId: _, ...legada } = conta;
  expect(receberEnvelopeWebhookCanal(db, assinar(sintetico(conta.accountId)), contexto([legada]))).toMatchObject({ ok: true, accountId: conta.accountId });
  expect(receberEnvelopeWebhookCanal(db, assinar(sintetico(conta.accountId)), contexto([legada]))).toMatchObject({ ok: true, mensagens: [{ classificacao: "REPLAY" }] });
  expect(receberEnvelopeWebhookCanal(db, assinar(sintetico(conta.phoneNumberId)), contexto())).toMatchObject({ ok: false, codigo: "CONTA_INCORRETA" });
});

it("sintetico sem accountRef preserva compatibilidade de segredo unico, sem liberar segredo compartilhado", () => {
  expect(receberEnvelopeWebhookCanal(dbNovo(), assinar(sintetico()), contexto()).ok).toBe(true);
  const outra = { ...conta, accountId: "outra-conta", keyId: "outra-chave", phoneNumberId: OUTRO_PHONE_NUMBER_ID };
  expect(receberEnvelopeWebhookCanal(dbNovo(), assinar(sintetico()), contexto([conta, outra]))).toMatchObject({ ok: false, codigo: "CONTA_INCORRETA" });
});

it("HMAC invalido nao e substituido por ID nativo valido", () => {
  const p = assinar(meta());
  expect(receberEnvelopeWebhookCanal(dbNovo(), { ...p, assinatura: "sha256=" + "0".repeat(64) }, contexto())).toMatchObject({ ok: false, codigo: "ASSINATURA_INVALIDA" });
});

it("configuracao nativa explicita e carregada sem comparar accountId local com phoneNumberId", () => {
  const dir = mkdtempSync(join(tmpdir(), "pr27-config-meta-"));
  try {
    const c = { contasWebhook: [conta], whatsappSaida: [{ accountId: conta.accountId, phoneNumberId: conta.phoneNumberId, apiVersion: "v99.0", accessToken: "token-sintetico" }] };
    writeFileSync(join(dir, "canal.local.json"), JSON.stringify(c));
    expect(carregarOperacaoCanal(dir).contasWebhook).toEqual([conta]);
    expect(ConfiguracaoCanalLocal.safeParse({ ...c, whatsappSaida: [{ ...c.whatsappSaida[0], phoneNumberId: PHONE_INCORRETO }] }).success).toBe(false);
    expect(ConfiguracaoCanalLocal.safeParse({ ...c, contasWebhook: [conta, { ...conta, accountId: "outra", keyId: "outra", phoneNumberId: conta.phoneNumberId }] }).success).toBe(false);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

it.each(["", "com-texto", " 123", "../../outro", "1".repeat(251)])("configuracao recusa ID nativo invalido: %s", valor => {
  expect(ConfiguracaoCanalLocal.safeParse({ contasWebhook: [{ ...conta, phoneNumberId: valor }] }).success).toBe(false);
  expect(resolverContaWebhookConfigurada(conta.keyId, [{ ...conta, phoneNumberId: valor }])).toMatchObject({ ok: false, codigo: "CONFIGURACAO_INVALIDA" });
});

it.each(["meta", "sintetico"] as const)("BOM UTF-8 com HMAC dos bytes crus e aceito sem excecao: %s", formato => {
  const db = dbNovo(), payload = formato === "meta" ? meta() : sintetico(conta.accountId);
  const semBom = assinar(payload);
  const bytes = Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), semBom.bytes]);
  const pedido = { ...semBom, bytes, assinatura: `sha256=${createHmac("sha256", SEGREDO).update(bytes).digest("hex")}` };
  expect(receberEnvelopeWebhookCanal(db, pedido, contexto())).toMatchObject({ ok: true, accountId: conta.accountId, mensagens: [{ classificacao: "NOVA" }] });
  expect(receberEnvelopeWebhookCanal(db, pedido, contexto())).toMatchObject({ ok: true, mensagens: [{ classificacao: "REPLAY" }] });
  expect(receberEnvelopeWebhookCanal(db, semBom, contexto())).toMatchObject({ ok: true, mensagens: [{ classificacao: "REPLAY" }] });
  // O decoder nao pode normalizar os bytes antes da verificacao HMAC.
  expect(receberEnvelopeWebhookCanal(db, { ...semBom, bytes }, contexto())).toMatchObject({ ok: false, codigo: "ASSINATURA_INVALIDA" });
  expect(db.prepare("SELECT COUNT(*) AS n FROM canal_mensagem").get()!.n).toBe(1);
});
