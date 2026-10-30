// Regressões dos erros clássicos confirmados na auditoria. Dados sintéticos.
import { afterEach, expect, it, vi } from "vitest";
import { DatabaseSync } from "node:sqlite";
import { criarSchema } from "../../src/kernel/ledger/schema.js";
import { criarGerenciadorSessao } from "../../src/server/sessao.js";
import { criarGateway, memoriaIdempotencia } from "../../src/kernel/gateway/gateway.js";
import { criarServidorLocal } from "../../src/server/http.js";
import { confirmarBloco } from "../../src/server/rotas/confirmacao.js";
import * as ledgerDb from "../../src/kernel/ledger/db.js";

const dbs: DatabaseSync[] = [];
const fechar: Array<() => Promise<void>> = [];
afterEach(async () => {
  vi.restoreAllMocks();
  dbs.splice(0).forEach((d) => { try { d.close(); } catch { /* já fechado */ } });
  for (const f of fechar.splice(0)) await f();
});

function sessaoMemoria() {
  const db = new DatabaseSync(":memory:");
  criarSchema(db);
  dbs.push(db);
  const agora = () => "2026-10-12T10:00:00Z";
  const sessoes = criarGerenciadorSessao({
    medicoId: "medico-sintetico", crm: "CRM-AUD",
    senha: "senha-sintetica-longa", duracaoMs: 3_600_000, agora,
  });
  const token = sessoes.login("senha-sintetica-longa")!.token;
  const ctx = { patientId: "paciente-sintetico-aud", encounterId: "encontro-sintetico-aud", tumorLotId: null };
  sessoes.selecionarConsulta(token, ctx);
  return { db, sessoes, agora, token, ctx };
}

async function httpCom(
  motor: { consultar: () => Promise<unknown>; retrato: () => unknown },
  extra: Record<string, unknown> = {},
) {
  const { db, sessoes, agora, token, ctx } = sessaoMemoria();
  const gateway = criarGateway({ agora, store: memoriaIdempotencia(), auditar: () => {}, executores: {} });
  const server = criarServidorLocal({
    db, sessoes, gateway, agora, log: () => {},
    motorF1: { processar: async () => {}, ...motor },
    catalogoTumorPacks: { packs: [], lotes: {}, rejeitados: [] },
    corpus: null,
    ...extra,
  } as never, { host: "127.0.0.1", port: 0 });
  await new Promise<void>((ok, fail) => {
    const aoErro = () => { server.off("listening", aoOk); fail(new Error("SERVIDOR_LOCAL_INDISPONIVEL")); };
    const aoOk = () => { server.off("error", aoErro); ok(); };
    if (server.listening) return ok();
    server.once("error", aoErro);
    server.once("listening", aoOk);
  });
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("PORTA_AUSENTE");
  fechar.push(async () => { await new Promise<void>((ok) => server.close(() => ok())); });
  const request = async (path: string, body: unknown) => {
    const r = await fetch(`http://127.0.0.1:${address.port}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
    });
    return { status: r.status, data: await r.json() as { codigo?: string } };
  };
  return { request, ctx };
}

it("A1: RETRATO_* conhecido permanece 409 REVISAO_CLINICA_PENDENTE", async () => {
  const a = await httpCom({
    consultar: async () => { throw new Error("RETRATO_ALTERADO"); },
    retrato: () => { throw new Error("RETRATO_ALTERADO"); },
  });
  const r = await a.request("/consulta/revisao-clinica", a.ctx);
  expect(r).toEqual({ status: 409, data: { codigo: "REVISAO_CLINICA_PENDENTE" } });
});

it("CC-001: negativa com sessão ausente continua 409 e audita como SISTEMA", () => {
  const { db, sessoes, agora } = sessaoMemoria();
  vi.spyOn(ledgerDb, "transacao").mockReturnValue({
    status: 409, body: { codigo: "NEGADA" },
    negativa: { motivo: "TESTE_NEGADA_SINTETICA", em: agora() },
  } as never);
  sessoes.obter = () => null;
  const r = confirmarBloco({ db, sessoes, agora, log: () => {}, gateway: {} as never }, "token-ausente", {
    patientId: "p", encounterId: "e", tumorLotId: null, idempotencyKey: "k",
    reviewDecisionId: "r", registros: [], documentosExibidos: [], reconhecerAlertas: [],
  } as never);
  expect(r.status).toBe(409);
  const auditoria = db.prepare("SELECT ator, decisao, motivoCodigo FROM audit_event").get() as {
    ator: string; decisao: string; motivoCodigo: string;
  };
  expect(JSON.parse(auditoria.ator)).toEqual({ tipo: "SISTEMA", id: "confirmacao" });
  expect(auditoria).toMatchObject({ decisao: "NEGADA", motivoCodigo: "TESTE_NEGADA_SINTETICA" });
});

it("CC-004: TypeError em fontePack é 500 ERRO_INTERNO", async () => {
  const a = await httpCom({
    consultar: async () => { throw new Error("nao-usado"); },
    retrato: () => { throw new Error("nao-usado"); },
  }, {
    catalogoTumorPacks: {
      packs: Object.assign([], {
        find() { throw new TypeError("catalogo.find sintético"); },
        filter() { return []; },
      }),
      lotes: {}, rejeitados: [],
    },
  });
  const r = await a.request("/consulta/pack/fonte", {
    ...a.ctx, packId: "pack-sintetico", hashOriginal: "a".repeat(64),
  });
  expect(r).toEqual({ status: 500, data: { codigo: "ERRO_INTERNO" } });
});

it("A1: exceção desconhecida em revisaoClinica é 500 ERRO_INTERNO", async () => {
  const a = await httpCom({
    consultar: async () => { throw new TypeError("motor.consultar is not a function"); },
    retrato: () => { throw new TypeError("motor.consultar is not a function"); },
  });
  const r = await a.request("/consulta/revisao-clinica", a.ctx);
  expect(r).toEqual({ status: 500, data: { codigo: "ERRO_INTERNO" } });
});
