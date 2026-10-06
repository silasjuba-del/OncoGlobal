// Prova ADV-001 do RED@5e1093d: mesmas expectativas, agora com reabertura do SQLite.
import { afterEach, describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { abrirLedger } from "../../src/kernel/ledger/db.js";
import { sqliteIdempotencia } from "../../src/kernel/ledger/idempotencia.js";
import { criarGateway, memoriaIdempotencia } from "../../src/kernel/gateway/gateway.js";
import { ActionIntent } from "../../src/contracts/operacao.js";
import { criarServidorLocal } from "../../src/server/http.js";
import { criarGerenciadorSessao } from "../../src/server/sessao.js";

const agora = "2026-10-05T12:00:00Z";
const sessao = { medicoId: "medico-teste", crm: "CRM-TESTE", emitidaEm: "2026-10-05T11:00:00Z", expiraEm: "2026-10-05T13:00:00Z" };
const intent = (key: string, id = "doc-sintetico") => ({
  verbo: "IMPRIMIR", objeto: { tipo: "DOCUMENTO", id, versao: 1 },
  escopo: { patientId: "Paciente Teste 01", encounterId: "encontro-teste" },
  destino: null, idempotencyKey: key,
});
const dirs: string[] = [];
const dbs: ReturnType<typeof abrirLedger>[] = [];
function arquivoSQLite(): string {
  const dir = mkdtempSync(join(tmpdir(), "oncoglobal-adv001-"));
  dirs.push(dir);
  return join(dir, "ledger.sqlite");
}
function abrirStore(path: string) {
  const db = abrirLedger(path);
  dbs.push(db);
  return { db, store: sqliteIdempotencia(db) };
}
afterEach(() => {
  for (const db of dbs.splice(0)) { try { db.close(); } catch { /* já fechado no teste */ } }
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

describe("F1 · reinício/replay de efeito externo (SQLite persistente)", () => {
  it("ADV-001 · duas execuções sequenciais após reinício não repetem impressão", async () => {
    const path = arquivoSQLite();
    let impressoes = 0;
    const novoProcesso = () => {
      const { db, store } = abrirStore(path);
      return { db, gateway: criarGateway({ agora: () => agora, auditar: () => {},
        store, executores: { IMPRIMIR: {
        executar: async () => { impressoes++; return { ok: true as const, recibo: `recibo-${impressoes}` }; },
      } } }) };
    };
    const first = novoProcesso();
    expect((await first.gateway.executar(intent("replay-restart-01"), sessao)).decisao).toBe("EXECUTADA");
    first.db.close();
    const replay = await novoProcesso().gateway.executar(intent("replay-restart-01"), sessao);
    expect(replay.decisao).toBe("REPLAY");
    expect(impressoes).toBe(1);
  });

  it("ADV-001 · reserva OUTCOME_UNKNOWN sobrevive ao reinício antes do efeito terminar", async () => {
    const path = arquivoSQLite();
    let chamadas = 0;
    const { db, store } = abrirStore(path);
    const first = criarGateway({ agora: () => agora, auditar: () => {},
      store, executores: { IMPRIMIR: {
        executar: async () => { chamadas++; return { ok: false as const, incerto: true, erro: "resultado-incerto" }; },
      } } });
    expect((await first.executar(intent("replay-restart-02"), sessao)).decisao).toBe("OUTCOME_UNKNOWN");
    db.close();
    const afterRestart = criarGateway({ agora: () => agora, auditar: () => {},
      store: abrirStore(path).store, executores: { IMPRIMIR: {
        executar: async () => { chamadas++; return { ok: true as const, recibo: "nao-deve-repetir" }; },
      } } });
    expect((await afterRestart.executar(intent("replay-restart-02"), sessao)).decisao).toBe("OUTCOME_UNKNOWN");
    expect(chamadas).toBe(1);
  });

  it("W4-01 · crash após reserva e antes do efeito mantém OUTCOME_UNKNOWN ao reabrir", async () => {
    const path = arquivoSQLite();
    const key = "replay-crash-reserva-01";
    const db = abrirLedger(path);
    const payloadHash = createHash("sha256")
      .update(JSON.stringify(ActionIntent.parse(intent(key)))).digest("hex");
    expect(sqliteIdempotencia(db).reserve(key, payloadHash, agora).criada).toBe(true);
    db.close(); // simula fim do processo antes de invocar o executor
    let chamadas = 0;
    const afterRestart = criarGateway({ agora: () => agora, auditar: () => {},
      store: abrirStore(path).store, executores: { IMPRIMIR: {
        executar: async () => { chamadas++; return { ok: true as const, recibo: "nao-deve-executar" }; },
      } } });
    expect((await afterRestart.executar(intent(key), sessao)).decisao).toBe("OUTCOME_UNKNOWN");
    expect(chamadas).toBe(0);
  });

  it("ADV-001 · mesmo key e payload diferente após reinício é negado", async () => {
    const path = arquivoSQLite();
    let chamadas = 0;
    const novoProcesso = () => {
      const { db, store } = abrirStore(path);
      return { db, gateway: criarGateway({ agora: () => agora, auditar: () => {},
        store, executores: { IMPRIMIR: {
        executar: async () => { chamadas++; return { ok: true as const, recibo: "teste" }; },
      } } }) };
    };
    const first = novoProcesso();
    await first.gateway.executar(intent("replay-restart-03", "doc-A"), sessao);
    first.db.close();
    expect((await novoProcesso().gateway.executar(intent("replay-restart-03", "doc-B"), sessao)).decisao).toBe("NEGADA");
    expect(chamadas).toBe(1);
  });

  it("ADV-001 · RESISTIU: replay no mesmo processo não duplica efeito", async () => {
    let chamadas = 0;
    const gateway = criarGateway({ agora: () => agora, auditar: () => {},
      store: memoriaIdempotencia(), executores: { IMPRIMIR: {
        executar: async () => { chamadas++; return { ok: true, recibo: "teste" }; },
      } } });
    await gateway.executar(intent("replay-processo-01"), sessao);
    expect((await gateway.executar(intent("replay-processo-01"), sessao)).decisao).toBe("REPLAY");
    expect(chamadas).toBe(1);
  });

  it("ADV-001 · reserva atômica entre gateways SQLite impede segundo executor durante ação pendente", async () => {
    const path = arquivoSQLite();
    let chamadas = 0;
    let liberar!: () => void;
    const pendente = new Promise<void>((resolve) => { liberar = resolve; });
    const first = criarGateway({ agora: () => agora, auditar: () => {},
      store: abrirStore(path).store, executores: { IMPRIMIR: {
        executar: async () => { chamadas++; await pendente; return { ok: true as const, recibo: "r1" }; },
      } } });
    const second = criarGateway({ agora: () => agora, auditar: () => {},
      store: abrirStore(path).store, executores: { IMPRIMIR: {
        executar: async () => { chamadas++; return { ok: true as const, recibo: "r2" }; },
      } } });
    const primeira = first.executar(intent("replay-concorrente-01"), sessao);
    expect((await second.executar(intent("replay-concorrente-01"), sessao)).decisao).toBe("OUTCOME_UNKNOWN");
    expect(chamadas).toBe(1);
    liberar();
    expect((await primeira).decisao).toBe("EXECUTADA");
    expect((await second.executar(intent("replay-concorrente-01"), sessao)).decisao).toBe("REPLAY");
    expect(chamadas).toBe(1);
  });

  it("ADV-001 · falha certa libera a chave para tentativa explícita no mesmo banco", async () => {
    const path = arquivoSQLite();
    let chamadas = 0;
    const gateway = criarGateway({ agora: () => agora, auditar: () => {},
      store: abrirStore(path).store, executores: { IMPRIMIR: {
        executar: async () => {
          chamadas++;
          return chamadas === 1 ? { ok: false as const, incerto: false, erro: "falha-certa" }
            : { ok: true as const, recibo: "r2" };
        },
      } } });
    expect((await gateway.executar(intent("replay-falhou-01"), sessao)).decisao).toBe("FALHOU");
    const retry = criarGateway({ agora: () => agora, auditar: () => {},
      store: abrirStore(path).store, executores: { IMPRIMIR: {
        executar: async () => { chamadas++; return { ok: true as const, recibo: "r2" }; },
      } } });
    expect((await retry.executar(intent("replay-falhou-01"), sessao)).decisao).toBe("EXECUTADA");
    expect(chamadas).toBe(2);
  });

  it("ADV-001 · /acao usa SQLite mesmo quando o gateway injetado tem store volátil", async () => {
    const path = arquivoSQLite();
    let efeitosFake = 0;
    const start = async () => {
      const db = abrirLedger(path); dbs.push(db);
      const sessoes = criarGerenciadorSessao({ medicoId: "medico-teste", crm: "CRM-TESTE",
        senha: "senha-sintetica-comprida", duracaoMs: 60_000, agora: () => agora });
      const token = sessoes.login("senha-sintetica-comprida")!.token;
      const gateway = criarGateway({ agora: () => agora, auditar: () => {},
        store: memoriaIdempotencia(), executores: { IMPRIMIR: {
          executar: async () => { efeitosFake++; return { ok: true, recibo: "teste" }; },
        } } });
      const server = criarServidorLocal({ db, sessoes, gateway, agora: () => agora, log: () => {} });
      await new Promise<void>((resolve) => server.listening ? resolve() : server.once("listening", resolve));
      const address = server.address();
      if (!address || typeof address === "string") throw new Error("PORTA_AUSENTE");
      return {
        async post(id: string) {
          const response = await fetch(`http://127.0.0.1:${address.port}/acao`, {
            method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
            body: JSON.stringify(intent("http-replay-01", id)),
          });
          return { status: response.status, body: await response.json() as { decisao: string } };
        },
        async close() {
          await new Promise<void>((resolve) => server.close(() => resolve()));
          db.close();
        },
      };
    };
    // Executor fake, sem saída real: este teste prova somente idempotência HTTP;
    // autorização do artefato externo continua BLOQUEADA em ADV-006.
    const first = await start();
    try {
      expect((await first.post("doc-sintetico")).body.decisao).toBe("EXECUTADA");
    } finally { await first.close(); }
    const second = await start();
    try {
      expect((await second.post("doc-sintetico")).body.decisao).toBe("REPLAY");
      expect((await second.post("doc-diferente")).status).toBe(409);
      expect(efeitosFake).toBe(1);
    } finally { await second.close(); }
  });
});
