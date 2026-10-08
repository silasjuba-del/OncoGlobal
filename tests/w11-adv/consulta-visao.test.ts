// W11-H22 · visão da consulta calculada no servidor (HTTP real, dados sintéticos, loopback).
import { afterEach, expect, it } from "vitest";
import type { Server } from "node:http";
import type { DatabaseSync } from "node:sqlite";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { abrirLedger } from "../../src/kernel/ledger/db.js";
import { salvarDraft } from "../../src/kernel/ledger/drafts.js";
import { confirmar } from "../../src/kernel/ledger/writeRouter.js";
import { criarGateway, memoriaIdempotencia } from "../../src/kernel/gateway/gateway.js";
import { criarServidorLocal } from "../../src/server/http.js";
import { criarGerenciadorSessao } from "../../src/server/sessao.js";
import { fonteSintetica } from "../fixtures/triagem.js";

const dirs: string[] = [];
const servers: Server[] = [];
const databases: DatabaseSync[] = [];
const AGORA = "2026-10-07T12:00:00-03:00";
const HOJE = "2026-10-07";

afterEach(async () => {
  await Promise.all(servers.splice(0).filter((server) => server.listening)
    .map((server) => new Promise<void>((resolve) => server.close(() => resolve()))));
  for (const db of databases.splice(0)) { try { db.close(); } catch { /* já fechado */ } }
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

async function ambiente() {
  const root = mkdtempSync(join(tmpdir(), "w11-h22-visao-")); dirs.push(root);
  const db = abrirLedger(join(root, "ledger.sqlite")); databases.push(db);
  const sessoes = criarGerenciadorSessao({ medicoId: "medico-teste", crm: "CRM-TESTE",
    senha: "senha-sintetica-comprida", duracaoMs: 60_000, agora: () => AGORA });
  const server = criarServidorLocal({ db, sessoes, configRootDir: join(root, "config"),
    gateway: criarGateway({ agora: () => AGORA, auditar: () => {}, store: memoriaIdempotencia(), executores: {} }),
    agora: () => AGORA, log: () => {} });
  servers.push(server);
  await new Promise<void>((resolve) => server.listening ? resolve() : server.once("listening", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("porta ausente");
  const token = sessoes.login("senha-sintetica-comprida")!.token;
  let seq = 0;
  const persistir = (patientId: string, encounterId: string, tipo: string, payload: unknown,
    fontesId: string | null = `fonte-${seq + 1}`) => {
    seq += 1;
    const draftId = `draft-visao-${seq}`;
    salvarDraft(db, { draftId, patientId, sourceId: `source-visao-${seq}`, rawRef: "fixture-local",
      payload: {}, diagnostics: [], revision: 0, criadoEm: AGORA });
    const result = confirmar(db, { operationId: `op-visao-${String(seq).padStart(3, "0")}`, patientId,
      tumorLotId: null, encounterId, reviewDecisionId: `review-visao-${seq}`, sessao: sessoes.obter(token)!,
      em: AGORA, registros: [{ draftId, expectedRevision: 0, eventId: `event-visao-${seq}`, tipo, payload,
        fontes: fontesId === null ? [] : [fonteSintetica(fontesId)], revisao: "CONFIRMADO" }] });
    expect(result.estado).toBe("GRAVADA");
  };
  const carregar = async (patientId: string) => {
    const r = await fetch(`http://127.0.0.1:${address.port}/consulta/carregar`, { method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ patientId }) });
    return { status: r.status, body: await r.json() as Record<string, any> };
  };
  const paciente = (patientId: string) => ({ patientId, identificadores: [], nome: `Paciente ${patientId}`,
    nascimento: null, sexoCadastral: "NAO_INFORMADO", divergencia: false });
  return { persistir, carregar, paciente };
}

it("datas fixas: biópsia, C1D1 e reestadiamento com dias desde calculados pela data do servidor", async () => {
  const { persistir, carregar, paciente } = await ambiente();
  persistir("Paciente Teste 61", "encontro-61", "Paciente", paciente("Paciente Teste 61"), null);
  persistir("Paciente Teste 61", "encontro-61", "Biopsy", { dataClinica: "2026-01-10" }, "fonte-biopsia-61");
  persistir("Paciente Teste 61", "encontro-61", "TreatmentCycle",
    { linha: 1, ciclo: 1, dataClinica: "2026-03-01", protocolo: "esquema-sintetico" }, "fonte-ciclo-61");
  persistir("Paciente Teste 61", "encontro-61", "Staging",
    { tipo: "RESTAGING", dataClinica: "2026-06-01", valor: "sintetico" }, "fonte-reest-61");

  const r = await carregar("Paciente Teste 61");
  expect(r.status).toBe(200);
  expect(r.body.datasFixas.dataReferencia).toBe(HOJE);
  expect(r.body.datasFixas.biopsyDate).toMatchObject({ data: "2026-01-10", estado: "PREENCHIDO" });
  expect(r.body.datasFixas.c1d1Date).toMatchObject({ data: "2026-03-01", estado: "PREENCHIDO" });
  expect(r.body.datasFixas.lastStagingDate).toMatchObject({ data: "2026-06-01", tipo: "RESTAGING" });
  expect(r.body.datasFixas.lastRestagingDate).toMatchObject({ data: "2026-06-01", estado: "PREENCHIDO" });
  expect(r.body.datasFixas.lastTreatmentDate).toMatchObject({ data: null, estado: "PENDENTE", motivo: "AUSENTE" });
  // 2026-03-01 até 2026-10-07 = 220 dias corridos.
  expect(r.body.datasFixas.diasDesde.c1d1).toBe(220);
  expect(r.body.datasFixas.diasDesde.lastTreatment).toBeNull();
});

it("histórico: ciclo sem dose confirmada fica PENDENTE e não herda dado de outro ciclo", async () => {
  const { persistir, carregar, paciente } = await ambiente();
  persistir("Paciente Teste 62", "encontro-62", "Paciente", paciente("Paciente Teste 62"), null);
  persistir("Paciente Teste 62", "encontro-62", "TreatmentCycle",
    { linha: 1, ciclo: 1, dataClinica: "2026-03-01", protocolo: "esquema-sintetico" }, "fonte-ciclo-62");

  const r = await carregar("Paciente Teste 62");
  expect(r.status).toBe(200);
  expect(r.body.historicoTratamento.linhas).toHaveLength(1);
  expect(r.body.historicoTratamento.linhas[0]).toMatchObject({
    tipo: "SISTEMICO", data: "2026-03-01", protocoloOuTipo: "esquema-sintetico", ciclo: 1,
    doseRelativaPct: null, estado: "PENDENTE",
  });
  expect(r.body.historicoTratamento.linhas[0].pendencias).toContain("doseRelativaPct");
});

it("alerta de plaquetas: 42.000/µL gera ALERTA que não bloqueia salvar e deixa a elegibilidade VERMELHO", async () => {
  const { persistir, carregar, paciente } = await ambiente();
  persistir("Paciente Teste 63", "encontro-63", "Paciente", paciente("Paciente Teste 63"), null);
  persistir("Paciente Teste 63", "encontro-63", "LabResult",
    { campo: "plaquetas", valor: 42000, unidade: "/µL", data: "2026-10-05", sourceId: "lab-sintetico-63" },
    "fonte-lab-63");

  const r = await carregar("Paciente Teste 63");
  expect(r.status).toBe(200);
  expect(r.body.alertaPlaquetas).toMatchObject({ estado: "ALERTA", valor: 42000, data: "2026-10-05",
    limiarExclusivo: 50000, bloqueiaSalvar: false });
  expect(r.body.elegibilidade.cor).toBe("VERMELHO");
});

it("sem plaquetas: alerta PENDENTE e elegibilidade PENDENTE, nunca VERDE por omissão", async () => {
  const { persistir, carregar, paciente } = await ambiente();
  persistir("Paciente Teste 64", "encontro-64", "Paciente", paciente("Paciente Teste 64"), null);

  const r = await carregar("Paciente Teste 64");
  expect(r.status).toBe(200);
  expect(r.body.alertaPlaquetas).toMatchObject({ estado: "PENDENTE", valor: null, data: null });
  expect(r.body.elegibilidade.cor).toBe("PENDENTE");
  expect(r.body.elegibilidade.cor).not.toBe("VERDE");
  expect(r.body.datasFixas.biopsyDate).toMatchObject({ data: null, estado: "PENDENTE", motivo: "AUSENTE" });
});
