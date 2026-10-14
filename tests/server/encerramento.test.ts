import { expect, it, vi } from "vitest";
import { abrirLedger } from "../../src/kernel/ledger/db.js";
import { criarServidorLocal } from "../../src/server/http.js";
import { criarGerenciadorSessao } from "../../src/server/sessao.js";
import { criarGateway, memoriaIdempotencia } from "../../src/kernel/gateway/gateway.js";

it.each(["inicializacao", "apos-resposta"])("close aguarda trabalho do motor: %s", async fase => {
  const db = abrirLedger(":memory:");
  const agora = () => "2026-10-14T12:00:00-03:00";
  let concluir!: () => void;
  const trabalho = new Promise<void>(resolve => { concluir = resolve; });
  let iniciar!: () => void;
  const iniciado = new Promise<void>(resolve => { iniciar = resolve; });
  let chamadas = 0;
  const sessoes = criarGerenciadorSessao({ medicoId: "medico-sintetico", crm: "CRM-TESTE", senha: "senha-sintetica-comprida", duracaoMs: 60_000, agora });
  const server = criarServidorLocal({ db, sessoes, agora, log: () => {},
    gateway: criarGateway({ agora, auditar: () => {}, store: memoriaIdempotencia(), executores: {} }),
    motorF1: { processar: vi.fn(() => {
      chamadas++;
      if (fase === "apos-resposta" && chamadas === 1) return Promise.resolve();
      iniciar(); return trabalho;
    }) } as never });
  await new Promise<void>(resolve => server.listening ? resolve() : server.once("listening", resolve));
  if (fase === "apos-resposta") {
    const endereco = server.address();
    if (!endereco || typeof endereco === "string") throw new Error("PORTA_AUSENTE");
    const r = await fetch(`http://127.0.0.1:${endereco.port}/login`, { method: "POST", body: JSON.stringify({ senha: "senha-sintetica-comprida" }) });
    expect(r.status).toBe(200); await r.json();
  }
  await iniciado;
  let fechou = false;
  const fechado = new Promise<void>(resolve => server.close(() => { fechou = true; resolve(); }));
  try {
    await new Promise<void>(resolve => setImmediate(resolve));
    expect(fechou).toBe(false);
    concluir();
    await fechado;
    expect(fechou).toBe(true);
  } finally { concluir(); await fechado; db.close(); }
});
