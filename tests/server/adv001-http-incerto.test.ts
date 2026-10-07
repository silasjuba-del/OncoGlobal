// Reataque ADV-001: caminho HTTP /acao, banco SQLite reaberto e executor fake.
// A store em memória passada ao gateway é intencional: o roteador canônico precisa
// substituí-la por sqliteIdempotencia(db). Nenhum efeito externo real ocorre.
import { artefatoAssinado } from "./_artefatoAssinado.js";
import { afterEach, describe, expect, it } from "vitest";
import { mkdtempSync, realpathSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, sep } from "node:path";
import type { Server } from "node:http";
import { abrirLedger } from "../../src/kernel/ledger/db.js";
import { criarGateway, memoriaIdempotencia, type Executor } from "../../src/kernel/gateway/gateway.js";
import { criarServidorLocal } from "../../src/server/http.js";
import { criarGerenciadorSessao } from "../../src/server/sessao.js";

const agora = "2026-10-05T12:00:00Z";
const dirs: string[] = [];
const instances: { server: Server; db: ReturnType<typeof abrirLedger>; closed: boolean }[] = [];

afterEach(async () => {
  for (const f of instances.splice(0)) {
    if (!f.closed) {
      await new Promise<void>((resolve) => f.server.close(() => resolve()));
      f.db.close();
      f.closed = true;
    }
  }
  for (const dir of dirs.splice(0)) {
    const root = realpathSync(tmpdir()).toLowerCase();
    const real = realpathSync(dir).toLowerCase();
    if (!real.startsWith(root + sep) || !real.includes("oncoglobal-adv001-http-"))
      throw new Error("TEMP_FORA_DO_ESCOPO_NAO_REMOVIDO");
    rmSync(dir, { recursive: true, force: false });
  }
});

function banco() {
  const dir = mkdtempSync(join(tmpdir(), "oncoglobal-adv001-http-"));
  dirs.push(dir);
  return join(dir, "ledger.sqlite");
}
async function boot(path: string, executor: Executor) {
  const db = abrirLedger(path);
  const sessoes = criarGerenciadorSessao({ medicoId: "medico-teste", crm: "CRM-TESTE",
    senha: "senha-sintetica-comprida", duracaoMs: 60_000, agora: () => agora });
  const gateway = criarGateway({ agora: () => agora, auditar: () => {},
    store: memoriaIdempotencia(), executores: { IMPRIMIR: executor } });
  const server = criarServidorLocal({ db, sessoes, gateway, agora: () => agora, log: () => {} });
  await new Promise<void>((resolve) => server.listening ? resolve() : server.once("listening", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("PORTA_AUSENTE");
  const token = sessoes.login("senha-sintetica-comprida")!.token;
  const instance = { server, db, closed: false };
  instances.push(instance);
  return {
    async post(id: string, idempotencyKey: string) {
      try { artefatoAssinado(db, { patientId: "Paciente Teste 01", encounterId: "encontro-teste", documentId: id }); }
      catch { /* já assinado nesta base (reabertura): mantém o registro original */ }
      const res = await fetch(`http://127.0.0.1:${address.port}/acao`, {
        method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ verbo: "IMPRIMIR", objeto: { tipo: "DOCUMENTO", id, versao: 1 },
          escopo: { patientId: "Paciente Teste 01", encounterId: "encontro-teste" },
          destino: null, idempotencyKey }),
      });
      return { status: res.status, body: await res.json() as { decisao: string } };
    },
    async close() {
      if (instance.closed) return;
      await new Promise<void>((resolve) => server.close(() => resolve()));
      db.close();
      instance.closed = true;
    },
  };
}

describe("F1 · ADV-001 reataque da rota real /acao com SQLite entre instâncias", () => {
  it("ADV-001 · resultado incerto persiste após reabrir SQLite, sem reenviar", async () => {
    const path = banco();
    let chamadas = 0;
    const a = await boot(path, { executar: async () => {
      chamadas++;
      return { ok: false, incerto: true, erro: "incerto-sintetico" };
    } });
    expect((await a.post("doc-teste", "reatack-incerto-02")).body.decisao).toBe("OUTCOME_UNKNOWN");
    await a.close();
    const b = await boot(path, { executar: async () => {
      chamadas++;
      return { ok: true, recibo: "nao-reenviar" };
    } });
    expect((await b.post("doc-teste", "reatack-incerto-02")).body.decisao).toBe("OUTCOME_UNKNOWN");
    expect(chamadas).toBe(1);
  });

});
