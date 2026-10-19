import { createHash } from "node:crypto";
import { expect, it } from "vitest";
import { abrirLedger } from "../../../src/kernel/ledger/db.js";
import { consultarCaixaCanal, detalheMensagemCanal, receberTransporteSintetico } from "../../../src/server/canalEntrada.js";
import { criarGerenciadorSessao } from "../../../src/server/sessao.js";

it.each([false, true])("caixa limitada mostra as 500 mais recentes sem apagar histórico (instantes iguais=%s)", instantesIguais => {
  const db = abrirLedger(":memory:");
  const agora = "2026-10-19T10:00:00Z", senha = "senha-exclusivamente-sintetica";
  const sessoes = criarGerenciadorSessao({ medicoId: "medico-sintetico", crm: "CRM-SINTETICO", senha,
    duracaoMs: 86_400_000, agora: () => agora });
  const acesso = { sessoes, token: sessoes.login(senha)!.token, agora };
  let primeiraId = "";
  try {
    for (let i = 0; i < 501; i++) {
      const texto = `Mensagem inteiramente sintética ${i}`;
      const ack = receberTransporteSintetico(db, { accountId: "conta-sintetica", canal: "WHATSAPP_SERVICO",
        providerMessageId: `mensagem-sintetica-${i}`, senderRef: "remetente-sintetico",
        providerSentAt: agora, ingestedAt: new Date(Date.parse(agora) + (instantesIguais ? 0 : i * 1000)).toISOString(),
        conteudo: { tipo: "TEXT", texto, contentSha256: createHash("sha256").update(texto).digest("hex") }, cadastros: [] });
      if (!ack.ok) throw Error("INGRESSO_SINTETICO_FALHOU");
      if (i === 0) primeiraId = ack.reciboId;
    }
    const caixa = consultarCaixaCanal(db, acesso);
    if (!caixa.ok) throw Error("CAIXA_SINTETICA_FALHOU");
    expect(caixa.mensagens).toHaveLength(500);
    expect(caixa.mensagens[0]!.providerMessageId).toBe("mensagem-sintetica-1");
    expect(caixa.mensagens.at(-1)!.providerMessageId).toBe("mensagem-sintetica-500");
    expect(db.prepare("SELECT COUNT(*) AS n FROM canal_mensagem").get()!.n).toBe(501);
    expect(detalheMensagemCanal(db, acesso, primeiraId)).toMatchObject({ ok: true,
      mensagem: { providerMessageId: "mensagem-sintetica-0" } });
  } finally { db.close(); }
});
