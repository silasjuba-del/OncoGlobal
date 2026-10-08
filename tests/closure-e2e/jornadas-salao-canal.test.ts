import { afterEach, expect, it } from "vitest";
import type { Server } from "node:http";
import type { DatabaseSync } from "node:sqlite";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { abrirLedger } from "../../src/kernel/ledger/db.js";
import { salvarDraft } from "../../src/kernel/ledger/drafts.js";
import { listarEventos } from "../../src/kernel/ledger/ledger.js";
import { confirmar } from "../../src/kernel/ledger/writeRouter.js";
import { criarGateway, memoriaIdempotencia } from "../../src/kernel/gateway/gateway.js";
import { criarServidorLocal } from "../../src/server/http.js";
import { criarGerenciadorSessao } from "../../src/server/sessao.js";
import { fonteSintetica, triagemBase } from "../fixtures/triagem.js";

const dirs: string[] = [];
const servers: Server[] = [];
const databases: DatabaseSync[] = [];
afterEach(async () => {
  await Promise.all(servers.splice(0).filter((server) => server.listening)
    .map((server) => new Promise<void>((resolve) => server.close(() => resolve()))));
  for (const db of databases.splice(0)) { try { db.close(); } catch { /* already closed */ } }
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

async function fixture() {
  const root = mkdtempSync(join(tmpdir(), "w10-closure-e2e-")); dirs.push(root);
  const dbPath = join(root, "ledger.sqlite");
  const db = abrirLedger(dbPath); databases.push(db);
  let now = "2026-10-08T12:00:00-03:00";
  const agora = () => now;
  const sessoes = criarGerenciadorSessao({ medicoId: "medico-fechamento", crm: "CRM-SINTETICO",
    senha: "senha-sintetica-comprida", duracaoMs: 60_000, agora });
  const server = criarServidorLocal({ db, sessoes,
    gateway: criarGateway({ agora, auditar: () => {}, store: memoriaIdempotencia(), executores: {} }),
    agora, log: () => {} });
  servers.push(server);
  await new Promise<void>((resolve) => server.listening ? resolve() : server.once("listening", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("porta ausente");
  const base = `http://127.0.0.1:${address.port}`;
  const request = async (path: string, body: unknown, token?: string) => {
    const response = await fetch(base + path, { method: "POST", headers: {
      "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}),
    }, body: JSON.stringify(body) });
    return { status: response.status, body: await response.json() as Record<string, any> };
  };
  const token = sessoes.login("senha-sintetica-comprida")!.token;
  let sequence = 0;
  const seed = (anchorPatient: string, anchorEncounter: string, tipo: string, payload: unknown) => {
    sequence += 1;
    const id = `closure-seed-${sequence}`;
    salvarDraft(db, { draftId: id, patientId: anchorPatient, sourceId: `source-${id}`,
      rawRef: "fixture-sintetico-local", payload: {}, diagnostics: [], revision: 0, criadoEm: agora() });
    const result = confirmar(db, { operationId: `closure-seed-op-${sequence}`, patientId: anchorPatient,
      tumorLotId: null, encounterId: anchorEncounter, reviewDecisionId: `closure-review-${sequence}`,
      sessao: sessoes.obter(token)!, em: agora(), registros: [{ draftId: id, expectedRevision: 0,
        eventId: `closure-seed-event-${sequence}`, tipo, payload, fontes: [], revisao: "CONFIRMADO" }] });
    expect(result.estado).toBe("GRAVADA");
  };
  const select = async (patientId: string, encounterId: string, tumorLotId: string | null = null) =>
    request("/consulta/contexto/selecionar", { patientId, encounterId, tumorLotId }, token);
  const seedPatientAndEncounter = (patientId: string, encounterId: string) => {
    seed(patientId, encounterId, "Paciente", { patientId, identificadores: [], nome: patientId,
      nascimento: null, sexoCadastral: "NAO_INFORMADO", divergencia: false });
    seed(patientId, encounterId, "Triagem", triagemBase({ patientId, encounterId }));
  };
  return { root, dbPath, db, sessoes, token, request, select, seed, seedPatientAndEncounter,
    closeHttp: () => new Promise<void>((resolve) => server.close(() => resolve())),
    setNow: (value: string) => { now = value; } };
}

const paciente = "Paciente Sintetico Fechamento";
const encontro = "encontro-fechamento-01";

it("triagem autenticada cria somente rascunho no escopo selecionado e fica legível por HTTP", async () => {
  const f = await fixture();
  f.seedPatientAndEncounter(paciente, encontro);
  const triagem = triagemBase({ patientId: paciente, encounterId: encontro,
    pas: { ...triagemBase().pas, valor: 161 },
    coletaHemograma: { ...triagemBase().coletaHemograma, fontes: [fonteSintetica("fonte-triagem") ] } });
  expect((await f.select(paciente, encontro)).status).toBe(200);
  const baselineEvents = listarEventos(f.db, paciente);

  const anonimo = await f.request("/consulta/salao/triagem", { triagem });
  expect(anonimo.status).toBe(401);
  expect(listarEventos(f.db, paciente)).toEqual(baselineEvents);

  const gravado = await f.request("/consulta/salao/triagem", { triagem, expectedRevision: 0 }, f.token);
  expect(gravado.status).toBe(200);
  expect(gravado.body.pacientes).toEqual(expect.arrayContaining([
    expect.objectContaining({ patientId: paciente, encounterId: encontro, draftId: expect.any(String), revision: expect.any(Number) }),
  ]));
  expect(listarEventos(f.db, paciente)).toEqual(baselineEvents);
  const draft = gravado.body.pacientes.find((item: Record<string, unknown>) => item.patientId === paciente);
  expect(draft.revision).toBe(0);

  const leitura = await f.request("/consulta/salao", {}, f.token);
  expect(leitura.status).toBe(200);
  expect(leitura.body.pacientes).toEqual(expect.arrayContaining([
    expect.objectContaining({ patientId: paciente, encounterId: encontro, draftId: draft.draftId }),
  ]));
  f.closeHttp();
});

it("liberação com corte registra ator da sessão, preserva a negativa sem motivo e reproduz replay após reabrir SQLite", async () => {
  const f = await fixture();
  f.seedPatientAndEncounter(paciente, encontro);
  expect((await f.select(paciente, encontro)).status).toBe(200);
  const triagem = triagemBase({ patientId: paciente, encounterId: encontro, pas: {
    ...triagemBase().pas, valor: 161, fontes: [fonteSintetica("fonte-corte")],
  } });
  const triagemSalva = await f.request("/consulta/salao/triagem", { triagem, expectedRevision: 0 }, f.token);
  expect(triagemSalva.status).toBe(200);
  const draft = triagemSalva.body.pacientes.find((item: Record<string, unknown>) => item.patientId === paciente);
  const semMotivo = await f.request("/consulta/salao/liberar", {
    patientId: paciente, encounterId: encontro, expectedRevision: draft.revision, motivo: "", idempotencyKey: "liberacao-sem-motivo-01",
  }, f.token);
  expect(semMotivo.status).toBe(400);
  expect(listarEventos(f.db, paciente).filter((event) => event.tipo === "DecisaoLiberacaoSalao")).toHaveLength(0);

  const pedido = { patientId: paciente, encounterId: encontro, expectedRevision: draft.revision,
    motivo: "Médico avaliou o corte e registrou justificativa sintética", idempotencyKey: "liberacao-medica-01" };
  const first = await f.request("/consulta/salao/liberar", pedido, f.token);
  expect(first.status).toBe(200);
  expect(first.body.codigo).toBe("GRAVADA");
  const eventos = listarEventos(f.db, paciente);
  expect(eventos.filter((event) => event.tipo === "DecisaoLiberacaoSalao")).toHaveLength(1);
  expect(eventos.at(-1)).toMatchObject({ encounterId: encontro, tipo: "DecisaoLiberacaoSalao",
    criadoPor: { tipo: "SESSAO", id: "medico-fechamento" } });
  expect(JSON.stringify(eventos[0])).not.toContain("reviewed");
  expect(JSON.stringify(eventos[0])).not.toContain("signed");

  const replay = await f.request("/consulta/salao/liberar", pedido, f.token);
  expect(replay.status).toBe(200);
  expect(replay.body.codigo).toBe("REPLAY");
  expect(listarEventos(f.db, paciente)).toEqual(eventos);
  f.closeHttp();

  f.db.close();
  const reopened = abrirLedger(f.dbPath); databases.push(reopened);
  expect(listarEventos(reopened, paciente)).toEqual(eventos);
  const replayServer = criarServidorLocal({ db: reopened, sessoes: f.sessoes,
    gateway: criarGateway({ agora: () => "2026-10-08T12:00:00-03:00", auditar: () => {},
      store: memoriaIdempotencia(), executores: {} }), agora: () => "2026-10-08T12:00:00-03:00", log: () => {} });
  servers.push(replayServer);
  await new Promise<void>((resolve) => replayServer.listening ? resolve() : replayServer.once("listening", resolve));
  const address = replayServer.address();
  if (!address || typeof address === "string") throw new Error("porta ausente");
  const replayResponse = await fetch(`http://127.0.0.1:${address.port}/consulta/salao/liberar`, { method: "POST",
    headers: { Authorization: `Bearer ${f.token}`, "Content-Type": "application/json" }, body: JSON.stringify(pedido) });
  expect(replayResponse.status).toBe(200);
  expect((await replayResponse.json()).codigo).toBe("REPLAY");
  expect(listarEventos(reopened, paciente)).toEqual(eventos);
});

it("vínculo de canal exige escolha humana, escopo da sessão e deixa negativas sem evento", async () => {
  const f = await fixture();
  f.seedPatientAndEncounter(paciente, encontro);
  f.seed(paciente, encontro, "Contato", { contatoId: "contato-sintetico-01", canal: "WHATSAPP_SERVICO",
    endereco: "5511999999999", patientId: null, relacao: "DESCONHECIDO", vinculadoEm: null, revogadoEm: null });
  f.seed(paciente, encontro, "CanalMessage", { mensagemId: "mensagem-sintetica-01", contatoId: "contato-sintetico-01",
    patientId: null, texto: "mensagem sintética", em: "2026-10-08T12:00:00-03:00", redFlag: false });
  const semAutenticacao = await f.request("/consulta/canal/vincular", {
    contatoId: "contato-sintetico-01", patientId: paciente, encounterId: encontro, idempotencyKey: "vinculo-sem-auth-01",
  });
  expect(semAutenticacao.status).toBe(401);
  const outroPaciente = "Outro Paciente Sintetico";
  f.seedPatientAndEncounter(outroPaciente, "outro-encontro-01");
  expect((await f.select(outroPaciente, "outro-encontro-01")).status).toBe(200);
  const foraDoEscopo = await f.request("/consulta/canal/vincular", {
    contatoId: "contato-sintetico-01", patientId: paciente, encounterId: encontro, idempotencyKey: "vinculo-fora-escopo-01",
  }, f.token);
  expect(foraDoEscopo.status).toBe(409);
  const beforeLink = listarEventos(f.db, paciente).length;

  expect((await f.select(paciente, encontro)).status).toBe(200);
  const escolha = await f.request("/consulta/canal/vincular", {
    contatoId: "contato-sintetico-01", patientId: paciente, encounterId: encontro, idempotencyKey: "vinculo-humano-01",
  }, f.token);
  expect(escolha.status).toBe(200);
  expect(escolha.body.codigo).toBe("GRAVADA");
  const eventos = listarEventos(f.db, paciente);
  expect(eventos).toHaveLength(beforeLink + 1);
  expect(eventos.at(-1)).toMatchObject({ encounterId: encontro, tipo: "VinculoContato",
    criadoPor: { tipo: "SESSAO", id: "medico-fechamento" } });
  const leitura = await f.request("/consulta/canal", {}, f.token);
  expect(leitura.status).toBe(200);
  expect(leitura.body.mensagens).toEqual(expect.arrayContaining([
    expect.objectContaining({ contatoId: "contato-sintetico-01", patientId: paciente }),
  ]));
  f.closeHttp();
});
