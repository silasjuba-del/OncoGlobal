import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { once } from "node:events";
import { DatabaseSync } from "node:sqlite";
import type { Server } from "node:http";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { abrirLedger } from "../../src/kernel/ledger/db.js";
import { criarGateway, memoriaIdempotencia } from "../../src/kernel/gateway/gateway.js";
import { criarServidorLocal } from "../../src/server/http.js";
import { carregarCorpusServidor } from "../../src/server/corpus.js";
import { criarGerenciadorSessao } from "../../src/server/sessao.js";

const agora = () => "2026-10-07T13:00:00.000Z";
const senha = "senha-sintetica-http-config-01";

type JsonResponse = { status: number; body: Record<string, unknown> };

function criarHarness() {
  const rootDir = mkdtempSync(join(tmpdir(), "w10-http-config-"));
  const ledgerPath = join(rootDir, "ledger.sqlite");
  const configRootDir = join(rootDir, "config");
  const logs: Array<{ rota: string; codigo: string; status: number }> = [];
  let db: DatabaseSync = abrirLedger(ledgerPath);
  let server: Server | null = null;
  let baseUrl = "";

  async function start() {
    const sessoes = criarGerenciadorSessao({
      medicoId: "medico-sintetico-http-01", crm: "CRM-TESTE-01", senha,
      duracaoMs: 60 * 60 * 1000, agora,
    });
    const gateway = criarGateway({ executores: {}, store: memoriaIdempotencia(), agora, auditar: () => undefined });
    const current = criarServidorLocal({ db, sessoes, gateway, agora, log: (entry) => logs.push(entry), configRootDir });
    server = current;
    await once(current, "listening");
    const address = current.address();
    if (!address || typeof address === "string") throw new Error("HTTP_LOOPBACK_SEM_PORTA");
    baseUrl = `http://127.0.0.1:${address.port}`;
  }

  async function stop() {
    if (!server) return;
    const current = server;
    server = null;
    if (current.listening) await new Promise<void>((resolve, reject) => {
      current.close((error) => error ? reject(error) : resolve());
    });
  }

  async function restart() {
    await stop();
    db.close();
    db = abrirLedger(ledgerPath);
    await start();
  }

  async function post(path: string, value: unknown, token?: string): Promise<JsonResponse> {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (token) headers.Authorization = `Bearer ${token}`;
    const response = await fetch(`${baseUrl}${path}`, { method: "POST", headers, body: JSON.stringify(value) });
    return { status: response.status, body: await response.json() as Record<string, unknown> };
  }

  async function login(): Promise<string> {
    const response = await post("/login", { senha });
    if (response.status !== 200 || typeof response.body.token !== "string") throw new Error("LOGIN_HTTP_FALHOU");
    return response.body.token;
  }

  async function dispose() {
    await stop();
    db.close();
    rmSync(rootDir, { recursive: true, force: true });
  }

  return { rootDir, configRootDir, logs, start, stop, restart, post, login, dispose };
}

let harness: ReturnType<typeof criarHarness>;
beforeEach(async () => { harness = criarHarness(); await harness.start(); });
afterEach(async () => { await harness.dispose(); });

describe("W10 Luna5 · configurações pela API HTTP real", () => {
  it("carrega o corpus compartilhado, nega leitura sem sessão e retorna o tema DIA por default", async () => {
    const corpus = carregarCorpusServidor();
    expect(corpus.caixasTodas).toHaveLength(47);
    expect(corpus.caixas).toHaveLength(16);
    expect(corpus.caixasTodas.filter((box) => box.chave.startsWith("apac."))).toHaveLength(31);

    const unauthorized = await harness.post("/config/perfil", {});
    expect(unauthorized.status).toBe(401);
    expect(unauthorized.body.codigo).toBe("SESSAO_INVALIDA");

    const token = await harness.login();
    const profile = await harness.post("/config/perfil", {}, token);
    expect(profile.status).toBe(200);
    expect(profile.body).toMatchObject({ revision: 0, perfil: {
      medico: { nome: null, crm: null, rqe: null, telefone: null, cns: null },
      instituicao: { hospital: null, cnes: null },
    } });
    expect((profile.body.perfil as { conexoes: { sites: { habilitada: boolean } } }).conexoes.sites.habilitada).toBe(false);

    const theme = await harness.post("/config/caixa/ler", { numero: 8 }, token);
    expect(theme.status).toBe(200);
    expect(theme.body).toEqual({ revision: 0, value: "DIA" });
  });

  it("grava CNES como texto com zeros, atribui a sessão e replay não duplica histórico nem vaza valores em logs", async () => {
    const token = await harness.login();
    const first = await harness.post("/config/caixa/alterar", {
      numero: 7, valorNovo: "00001234", expectedRevision: 0,
      operationId: "http-cnes-first-0001", motivo: "cabeçalho sintético",
    }, token);
    expect(first.status).toBe(200);
    expect(first.body).toMatchObject({ estado: "GRAVADA", revision: 1 });
    expect((first.body.alteracoes as Array<Record<string, unknown>>)[0]).toMatchObject({
      numero: 7, valorAnterior: null, valorNovo: "00001234", por: "medico-sintetico-http-01",
    });

    const secondRequest = {
      numero: 7, valorNovo: "00005678", expectedRevision: 1,
      operationId: "http-cnes-change-0001", motivo: "cabeçalho sintético",
    };
    const second = await harness.post("/config/caixa/alterar", secondRequest, token);
    expect(second.status).toBe(200);
    expect((second.body.alteracoes as Array<Record<string, unknown>>)[0]).toMatchObject({
      valorAnterior: "00001234", valorNovo: "00005678", por: "medico-sintetico-http-01",
    });
    const replay = await harness.post("/config/caixa/alterar", secondRequest, token);
    expect(replay.status).toBe(200);
    expect(replay.body.estado).toBe("REPLAY");

    const readback = await harness.post("/config/caixa/ler", { numero: 7 }, token);
    expect(readback.body).toEqual({ revision: 2, value: "00005678" });
    const history = await harness.post("/config/historico", {}, token);
    expect(history.status).toBe(200);
    expect((history.body.itens as unknown[])).toHaveLength(2);
    const logged = JSON.stringify(harness.logs);
    for (const sensitiveValue of ["00001234", "00005678", "cabeçalho sintético", "http-cnes-change-0001"]) {
      expect(logged).not.toContain(sensitiveValue);
    }
  });

  it("reabre o SQLite local ao reiniciar o servidor e recupera perfil, caixa e trilha", async () => {
    const token = await harness.login();
    const saved = await harness.post("/config/caixa/alterar", {
      numero: 7, valorNovo: "00009876", expectedRevision: 0, operationId: "restart-cnes-save-01",
    }, token);
    expect(saved.body.estado).toBe("GRAVADA");

    await harness.restart();
    const newToken = await harness.login();
    const box = await harness.post("/config/caixa/ler", { numero: 7 }, newToken);
    const profile = await harness.post("/config/perfil", {}, newToken);
    const history = await harness.post("/config/historico", {}, newToken);
    expect(box.body).toEqual({ revision: 1, value: "00009876" });
    expect((profile.body.perfil as { instituicao: { cnes: string | null } }).instituicao.cnes).toBe("00009876");
    expect((history.body.itens as unknown[])).toHaveLength(1);
  });

  it("nega caixa APAC sem contexto de paciente sem alterar snapshot nem histórico global", async () => {
    const token = await harness.login();
    const saved = await harness.post("/config/caixa/alterar", {
      numero: 7, valorNovo: "00004321", expectedRevision: 0, operationId: "apac-guard-base-01",
    }, token);
    expect(saved.body.estado).toBe("GRAVADA");

    const apac = await harness.post("/config/caixa/alterar", {
      numero: 101, valorNovo: "estabelecimento-sintético", expectedRevision: 1,
      operationId: "apac-global-denied-01",
    }, token);
    expect(apac.status < 200 || apac.status >= 300).toBe(true);
    expect(apac.body.estado).not.toBe("GRAVADA");

    const box = await harness.post("/config/caixa/ler", { numero: 7 }, token);
    const profile = await harness.post("/config/perfil", {}, token);
    const history = await harness.post("/config/historico", {}, token);
    expect(box.body).toEqual({ revision: 1, value: "00004321" });
    expect((profile.body.perfil as { instituicao: { cnes: string | null } }).instituicao.cnes).toBe("00004321");
    expect((history.body.itens as unknown[])).toHaveLength(1);
    expect(JSON.stringify(harness.logs)).not.toContain("estabelecimento-sintético");
  });
});
