import { afterEach, expect, it } from "vitest";
import type { Server } from "node:http";
import type { DatabaseSync } from "node:sqlite";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { abrirLedger } from "../../src/kernel/ledger/db.js";
import { listarDrafts } from "../../src/kernel/ledger/drafts.js";
import { confirmar } from "../../src/kernel/ledger/writeRouter.js";
import { criarGateway, memoriaIdempotencia } from "../../src/kernel/gateway/gateway.js";
import { criarServidorLocal } from "../../src/server/http.js";
import { criarGerenciadorSessao } from "../../src/server/sessao.js";

const dirs: string[] = [];
const servers: Server[] = [];
const databases: DatabaseSync[] = [];
afterEach(async () => {
  await Promise.all(servers.splice(0).filter((server) => server.listening)
    .map((server) => new Promise<void>((resolve) => server.close(() => resolve()))));
  for (const db of databases.splice(0)) { try { db.close(); } catch { /* already closed */ } }
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

it("persiste extração como rascunho não vinculado e recupera após reabrir o ledger", async () => {
  const dir = mkdtempSync(join(tmpdir(), "w10-extracao-")); dirs.push(dir);
  const path = join(dir, "ledger.sqlite"), db = abrirLedger(path);
  databases.push(db);
  const agora = () => "2026-10-07T12:00:00-03:00";
  const sessoes = criarGerenciadorSessao({ medicoId: "medico-teste", crm: "CRM-TESTE",
    senha: "senha-sintetica-comprida", duracaoMs: 60_000, agora });
  const gateway = criarGateway({ agora, auditar: () => {}, store: memoriaIdempotencia(), executores: {} });
  const logs: unknown[] = [];
  const server = criarServidorLocal({ db, sessoes, gateway, agora, log: (entry) => logs.push(entry) });
  servers.push(server);
  await new Promise<void>((resolve) => server.listening ? resolve() : server.once("listening", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("porta ausente");
  const token = sessoes.login("senha-sintetica-comprida")!.token;
  const response = await fetch(`http://127.0.0.1:${address.port}/consulta/extrair`, { method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ recordingId: "gravacao-sintetica", sourceId: "fonte-sintetica",
      sourceType: "medical_note", rawTranscript: "Diagnóstico: adenocarcinoma. Sem evidência de metástases." }) });
  const result = await response.json() as { draftId: string; linkedPatientId: string | null; alerts: { gate: string; decisao: string }[] };
  expect(response.status).toBe(201);
  expect(result.linkedPatientId).toBeNull();
  expect(result.alerts.some((a) => a.gate === "G-07" && a.decisao === "PENDENTE")).toBe(true);
  const patientDraft = { draftId: "paciente-31", patientId: "Paciente Teste 31", sourceId: "fonte-local",
    rawRef: "local-record", payload: {}, diagnostics: [], revision: 0, criadoEm: agora() };
  const { salvarDraft } = await import("../../src/kernel/ledger/drafts.js");
  salvarDraft(db, patientDraft);
  const paciente = { patientId: "Paciente Teste 31", identificadores: [], nome: "Paciente Teste 31",
    nascimento: null, sexoCadastral: "NAO_INFORMADO" as const, divergencia: false };
  const sessao = sessoes.obter(token)!;
  confirmar(db, { operationId: "op-paciente-31", patientId: paciente.patientId, tumorLotId: null,
    encounterId: "encontro-31", reviewDecisionId: "revisao-medica-31", sessao, em: agora(),
    registros: [{ draftId: patientDraft.draftId, expectedRevision: 0, eventId: "evento-paciente-31",
      tipo: "Paciente", payload: paciente, fontes: [], revisao: "CONFIRMADO" }] });
  const destinoInexistente = await fetch(`http://127.0.0.1:${address.port}/consulta/rascunho/revisar`, { method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ draftId: result.draftId, expectedRevision: 0, patientId: "Paciente Teste 99" }) });
  expect(destinoInexistente.status).toBe(404);
  const review = await fetch(`http://127.0.0.1:${address.port}/consulta/rascunho/revisar`, { method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ draftId: result.draftId, expectedRevision: 0, patientId: paciente.patientId }) });
  expect(review.status).toBe(200);
  expect(await review.json()).toMatchObject({ codigo: "VINCULO_REVISTO", linkedPatientId: paciente.patientId, criaEventoClinico: false });
  const consulta = await fetch(`http://127.0.0.1:${address.port}/consulta/carregar`, { method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ patientId: paciente.patientId }) });
  expect(consulta.status).toBe(200);
  expect(await consulta.json()).toMatchObject({ patientId: paciente.patientId, encounterId: "encontro-31",
    cabecalho: { paciente, semaforo: "PENDENTE" } });
  const chat = await fetch(`http://127.0.0.1:${address.port}/consulta/chat`, { method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ setor: "MEDICO" }) });
  expect(chat.status).toBe(200);
  expect(await chat.json()).toMatchObject({ patientId: paciente.patientId, encounterId: "encontro-31", mensagens: [] });
  await new Promise<void>((resolve) => server.close(() => resolve()));
  db.close();

  const reopened = abrirLedger(path);
  databases.push(reopened);
  const drafts = listarDrafts(reopened);
  expect(drafts).toHaveLength(2);
  const extraction = drafts.find((d) => d.draftId === result.draftId);
  expect(extraction?.patientId).toBe("Paciente Teste 31");
  expect(extraction?.revision).toBe(1);
  expect(JSON.stringify(extraction?.payload)).toContain("Sem evidência de metástases");
  expect(JSON.stringify(logs)).not.toContain("adenocarcinoma");
});

it("recusa extração sem sessão válida", async () => {
  const db = abrirLedger(":memory:");
  databases.push(db);
  const agora = () => "2026-10-07T12:00:00Z";
  const sessoes = criarGerenciadorSessao({ medicoId: "medico-teste", crm: "CRM-TESTE",
    senha: "senha-sintetica-comprida", duracaoMs: 60_000, agora });
  const server = criarServidorLocal({ db, sessoes,
    gateway: criarGateway({ agora, auditar: () => {}, store: memoriaIdempotencia(), executores: {} }),
    agora, log: () => {} });
  servers.push(server);
  await new Promise<void>((resolve) => server.listening ? resolve() : server.once("listening", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("porta ausente");
  const response = await fetch(`http://127.0.0.1:${address.port}/consulta/extrair`, { method: "POST",
    headers: { "Content-Type": "application/json" }, body: "{}" });
  expect(response.status).toBe(401);
  await new Promise<void>((resolve) => server.close(() => resolve()));
});
