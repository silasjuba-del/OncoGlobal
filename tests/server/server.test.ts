import { afterEach, expect, it } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Server } from "node:http";
import { abrirLedger } from "../../src/kernel/ledger/db.js";
import { salvarDraft } from "../../src/kernel/ledger/drafts.js";
import { listarEventos } from "../../src/kernel/ledger/ledger.js";
import { criarGateway, memoriaIdempotencia } from "../../src/kernel/gateway/gateway.js";
import { criarServidorLocal } from "../../src/server/http.js";
import { criarGerenciadorSessao } from "../../src/server/sessao.js";

const dirs: string[] = [], servers: Server[] = [];
afterEach(async () => {
  await Promise.all(servers.splice(0).map((server) => new Promise<void>((resolve) => server.close(() => resolve()))));
  for (const dir of dirs.splice(0)) rmSync(dir, { force: true, recursive: true });
});
async function fixture() {
  const dir = mkdtempSync(join(tmpdir(), "oncoglobal-http-")); dirs.push(dir);
  const db = abrirLedger(join(dir, "test.sqlite"));
  const em = "2026-10-05T12:00:00.000Z";
  let now = em, actions = 0;
  const logs: { rota: string; codigo: string; status: number }[] = [];
  const sessoes = criarGerenciadorSessao({ medicoId: "medico-local", crm: "CRM-TESTE",
    senha: "senha-de-teste-sintetica", duracaoMs: 60_000, agora: () => now });
  const gateway = criarGateway({ agora: () => now, auditar: () => {},
    store: memoriaIdempotencia(), executores: { IMPRIMIR: {
      executar: async () => { actions++; return { ok: true, recibo: "recibo-sintetico" }; },
    } } });
  const deps = { db, sessoes, gateway, agora: () => now, log: (e: typeof logs[number]) => logs.push(e) };
  const server = criarServidorLocal(deps);
  servers.push(server);
  await new Promise<void>((resolve) => server.listening ? resolve() : server.once("listening", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("sem porta");
  const url = `http://127.0.0.1:${address.port}`;
  const post = async (path: string, data: unknown, token?: string) => {
    const response = await fetch(url + path, { method: "POST",
      headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify(data) });
    return { status: response.status, json: await response.json() as Record<string, unknown> };
  };
  const login = await post("/login", { senha: "senha-de-teste-sintetica" });
  const token = login.json.token as string;
  return { db, deps, sessoes, post, token, logs, em, now: (date: string) => { now = date; },
    actions: () => actions, close: () => db.close() };
}
it("INV-04 payload medicoId rejeitado; sessão expirada 401", async () => {
  const f = await fixture();
  const payload = { patientId: "Paciente Teste 01", tumorLotId: "t1", encounterId: "e1",
    bloco: "EVOLUCAO", registros: [{ id: "d1", expectedRevision: 0 }], documentosExibidos: [],
    reconhecerAlertas: [], idempotencyKey: "operation-123" };
  expect((await f.post("/consulta/confirmar", { ...payload, medicoId: "spoof" }, f.token)).status).toBe(400);
  f.now("2026-10-05T12:01:01.000Z");
  expect((await f.post("/consulta/confirmar", payload, f.token)).status).toBe(401);
  f.close();
});
it("G-25 rejeita assinatura fora do bundle; validação grava N eventos e não imprime", async () => {
  const f = await fixture();
  for (const id of ["d1", "d2"]) salvarDraft(f.db, { draftId: id, patientId: "Paciente Teste 01",
    sourceId: "sintetico", rawRef: `opaco-${id}`, payload: { campo: id, valor: "sintético" },
    diagnostics: [], revision: 0, criadoEm: f.em });
  f.sessoes.registrarBundleExibido(f.token,
    { patientId: "Paciente Teste 01", encounterId: "e1" }, []);
  const payload = { patientId: "Paciente Teste 01", tumorLotId: "t1", encounterId: "e1",
    bloco: "TUDO", registros: [{ id: "d1", expectedRevision: 0 }, { id: "d2", expectedRevision: 0 }],
    documentosExibidos: [], reconhecerAlertas: [], idempotencyKey: "operation-123" };
  const forged = await f.post("/consulta/confirmar", { ...payload,
    documentosExibidos: [{ documentId: "outro", documentVersion: 1 }] }, f.token);
  expect(forged.status).toBe(409);
  expect((await f.post("/consulta/confirmar", payload, f.token)).json.codigo).toBe("GRAVADA");
  expect((await f.post("/consulta/confirmar", payload, f.token)).json.codigo).toBe("REPLAY");
  expect(listarEventos(f.db, "Paciente Teste 01")).toHaveLength(2);
  expect(f.actions()).toBe(0);
  const action = await f.post("/acao", { verbo: "IMPRIMIR",
    objeto: { tipo: "DOCUMENTO", id: "doc-1", versao: 1 },
    escopo: { patientId: "Paciente Teste 01", encounterId: "e1" },
    destino: null, idempotencyKey: "action-123" }, f.token);
  expect(action.json.decisao).toBe("EXECUTADA");
  expect(f.actions()).toBe(1);
  f.close();
});
it("N18 erro com identificador sintético não vaza no log nem na resposta", async () => {
  const f = await fixture();
  const marker = "CPF-SINTETICO-NAO-LOGAR";
  const errGateway = criarGateway({ agora: () => f.em,
    auditar: () => {}, store: memoriaIdempotencia(), executores: { IMPRIMIR: {
      executar: async () => { throw new Error(marker); },
    } } });
  // This second server exercises the real catch/log boundary with a throwing gateway.
  const second = criarServidorLocal({ ...f.deps, gateway: errGateway });
  servers.push(second);
  await new Promise<void>((resolve) => second.listening ? resolve() : second.once("listening", resolve));
  const address = second.address();
  if (!address || typeof address === "string") throw new Error("sem porta");
  const response = await fetch(`http://127.0.0.1:${address.port}/acao`, { method: "POST",
    headers: { Authorization: `Bearer ${f.token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ verbo: "IMPRIMIR", objeto: { tipo: "DOCUMENTO", id: "doc-1", versao: 1 },
      escopo: { patientId: "Paciente Teste 01", encounterId: "e1" },
      destino: null, idempotencyKey: "action-456" }) });
  expect(response.status).toBe(500);
  expect(JSON.stringify(f.logs)).not.toContain(marker);
  expect(await response.text()).not.toContain(marker);
  f.close();
});
it("servidor recusa bind externo antes de ouvir", async () => {
  const f = await fixture();
  expect(() => criarServidorLocal(f.deps, { host: "0.0.0.0" })).toThrow("BIND_FORA_DO_LOOPBACK");
  f.close();
});
