// Infra exclusiva dos ataques HTTP: loopback real, nomes/IDs inteiramente sintéticos.
import { abrirLedger } from "../../src/kernel/ledger/db.js";
import { criarGateway, memoriaIdempotencia } from "../../src/kernel/gateway/gateway.js";
import { criarServidorLocal } from "../../src/server/http.js";
import { criarGerenciadorSessao } from "../../src/server/sessao.js";

export async function ambienteHttp() {
  const agora = "2026-10-05T12:00:00Z";
  const db = abrirLedger(":memory:");
  let efeitos = 0;
  const logs: { rota: string; codigo: string; status: number }[] = [];
  const sessoes = criarGerenciadorSessao({ medicoId: "medico-teste", crm: "CRM-TESTE",
    senha: "senha-sintetica-comprida", duracaoMs: 60_000, agora: () => agora });
  const gateway = criarGateway({ agora: () => agora, auditar: () => {},
    store: memoriaIdempotencia(), executores: {
      IMPRIMIR: { executar: async () => { efeitos++; return { ok: true, recibo: "impresso-teste" }; } },
      ENVIAR_EMAIL: { executar: async () => { efeitos++; return { ok: true, recibo: "email-teste" }; } },
      EXPORTAR_APAC: { executar: async () => { efeitos++; return { ok: true, recibo: "exportado-teste" }; } },
    } });
  const server = criarServidorLocal({ db, sessoes, gateway, agora: () => agora, log: (e) => logs.push(e) });
  await new Promise<void>((resolve) => server.listening ? resolve() : server.once("listening", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("PORTA_AUSENTE");
  const base = `http://127.0.0.1:${address.port}`;
  const request = async (path: string, method: string, raw: string, token?: string, contentType?: string) => {
    const r = await fetch(base + path, { method, headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(contentType ? { "Content-Type": contentType } : {}),
    }, ...(method === "GET" ? {} : { body: raw }) });
    return { status: r.status, body: await r.text() };
  };
  const token = sessoes.login("senha-sintetica-comprida")!.token;
  const close = async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    db.close();
  };
  return { db, sessoes, request, token, efeitos: () => efeitos, logs, close };
}
