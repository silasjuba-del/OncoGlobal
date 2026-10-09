import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { criarGateway, memoriaIdempotencia } from "../../src/kernel/gateway/gateway.js";
import { abrirLedger } from "../../src/kernel/ledger/db.js";
import { salvarDraft } from "../../src/kernel/ledger/drafts.js";
import { confirmar } from "../../src/kernel/ledger/writeRouter.js";
import { criarGerenciadorSessao } from "../../src/server/sessao.js";
import { criarServidorLocal } from "../../src/server/http.js";

const AGORA = "2026-10-08T12:00:00Z";
const PACIENTE = "paciente-sintetico-salao";
const ENCONTRO = "encontro-sintetico-salao";
const SENHA = "senha-sintetica-comprida";
const temporarios: string[] = [];

afterEach(() => { for (const path of temporarios.splice(0)) rmSync(path, { recursive: true, force: true }); });

function iniciar(dbPath: string) {
  const db = abrirLedger(dbPath);
  let agora = AGORA;
  const sessoes = criarGerenciadorSessao({ medicoId: "medico-sintetico", crm: "CRM-SINTETICO",
    senha: SENHA, duracaoMs: 60_000, agora: () => agora });
  const gateway = criarGateway({ agora: () => agora, auditar: () => {}, store: memoriaIdempotencia(), executores: {} });
  const server = criarServidorLocal({ db, sessoes, gateway, agora: () => agora, log: () => {} });
  const token = sessoes.login(SENHA)!.token;
  const addressPromise = new Promise<string>((resolve) => server.once("listening", () => {
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("PORTA_AUSENTE");
    resolve(`http://127.0.0.1:${address.port}`);
  }));
  return { db, sessoes, server, token, addressPromise, setNow: (value: string) => { agora = value; },
    async close() { await new Promise<void>((resolve) => server.close(() => resolve())); db.close(); } };
}

async function post<T>(base: string, token: string, path: string, value: unknown) {
  const response = await fetch(`${base}${path}`, { method: "POST", headers: {
    Authorization: `Bearer ${token}`, "Content-Type": "application/json",
  }, body: JSON.stringify(value) });
  return { status: response.status, data: await response.json() as T };
}

function seedPatient(env: ReturnType<typeof iniciar>) {
  salvarDraft(env.db, { draftId: "seed-salao-patient", patientId: PACIENTE, sourceId: "seed-salao-source",
    rawRef: "fixture-local-sintetica", payload: {}, diagnostics: [], revision: 0, criadoEm: AGORA });
  confirmar(env.db, { operationId: "seed-salao-operation", patientId: PACIENTE, tumorLotId: null,
    encounterId: ENCONTRO, reviewDecisionId: "seed-salao-review", sessao: env.sessoes.obter(env.token)!,
    em: AGORA, registros: [{ draftId: "seed-salao-patient", expectedRevision: 0,
      eventId: "seed-salao-patient-event", tipo: "Paciente", payload: { patientId: PACIENTE,
        identificadores: [], nome: "Paciente Sintético", nascimento: null,
        sexoCadastral: "NAO_INFORMADO", divergencia: false }, fontes: [], revisao: "CONFIRMADO" }] });
}

const source = { sourceId: "entrada-form-sintetica", classe: "MANUAL", localizador: null,
  dataClinica: "2026-10-08", dataCaptura: AGORA, versao: "fixture-v1", contentHash: "a".repeat(64) };
function dado(valor: number | string) { return { valor, estado: "PENDENTE", campo: "PRESENTE",
  motivo: "rascunho sintético", fontes: [source], revisao: "REVISAR" }; }
const triagem = { patientId: PACIENTE, encounterId: ENCONTRO, pas: dado(170), fc: dado(72), spo2: dado(98),
  tempDecimos: dado(365), hbDgDl: dado(120), anc: dado(3000), plq: dado(200000),
  coletaHemograma: dado("2026-10-08"), ecog: dado(0), grauCtcae: dado(0), tontura: false,
  recurso: "AMBULATORIAL", idadeAnos: 54, chegadaEm: AGORA };

describe("closure F07 · Salão persiste rascunho e decisão com replay após reinício", () => {
  it("salva triagem inerte, exige motivo para corte e recupera decisão do ledger após reabrir SQLite", async () => {
    const root = mkdtempSync(join(tmpdir(), "onco-closure-luna1-")); temporarios.push(root);
    const dbPath = join(root, "clinical.sqlite");
    let env = iniciar(dbPath);
    try {
      seedPatient(env);
      let base = await env.addressPromise;
      await post(base, env.token, "/consulta/contexto/selecionar", { patientId: PACIENTE,
        encounterId: ENCONTRO, tumorLotId: null });
      const saved = await post<{ codigo: string; rascunho: { draftId: string; revision: number; criaEventoClinico: boolean } }>(
        base, env.token, "/consulta/salao/triagem", { triagem, expectedRevision: null });
      expect(saved.status).toBe(200);
      expect(saved.data.rascunho).toMatchObject({ revision: 0, criaEventoClinico: false });
      expect(env.db.prepare("SELECT COUNT(*) AS n FROM clinical_event WHERE tipo='Triagem'").get()).toMatchObject({ n: 0 });
      expect(saved.data.rascunho.draftId).toMatch(/^salao-triagem-/);
      const stale = await post<{ codigo: string }>(base, env.token, "/consulta/salao/triagem", {
        triagem, expectedRevision: 99,
      });
      expect(stale).toMatchObject({ status: 409, data: { codigo: "REVISAO_RASCUNHO_CONFLITANTE" } });
      expect(env.db.prepare("SELECT revision FROM draft_envelope WHERE draftId=?").get(saved.data.rascunho.draftId))
        .toMatchObject({ revision: 0 });
      const semMotivo = await post<{ codigo: string }>(base, env.token, "/consulta/salao/liberar", {
        patientId: PACIENTE, encounterId: ENCONTRO, expectedRevision: 0, motivo: "", idempotencyKey: "salao-release-no-reason",
      });
      expect(semMotivo.status).toBe(400);
      expect(env.db.prepare("SELECT COUNT(*) AS n FROM operation WHERE operationId LIKE 'salao-release-%'").get()).toMatchObject({ n: 0 });

      const request = { patientId: PACIENTE, encounterId: ENCONTRO, expectedRevision: 0,
        motivo: "Médico revisou o corte e autorizou avaliação presencial", idempotencyKey: "salao-release-synthetic-1" };
      const first = await post<{ codigo: string }>(base, env.token, "/consulta/salao/liberar", request);
      expect(first).toMatchObject({ status: 200, data: { codigo: "GRAVADA" } });
      expect(env.db.prepare("SELECT COUNT(*) AS n FROM clinical_event WHERE tipo='ReviewDecision'").get()).toMatchObject({ n: 1 });
      expect(env.db.prepare("SELECT COUNT(*) AS n FROM clinical_event WHERE tipo='Triagem'").get()).toMatchObject({ n: 0 });
    } finally { await env.close(); }

    env = iniciar(dbPath);
    try {
      const base = await env.addressPromise;
      const selected = await post<{ codigo: string }>(base, env.token, "/consulta/contexto/selecionar", {
        patientId: PACIENTE, encounterId: ENCONTRO, tumorLotId: null });
      expect(selected.status).toBe(200);
      const request = { patientId: PACIENTE, encounterId: ENCONTRO, expectedRevision: 0,
        motivo: "Médico revisou o corte e autorizou avaliação presencial", idempotencyKey: "salao-release-synthetic-1" };
      const replay = await post<{ codigo: string }>(base, env.token, "/consulta/salao/liberar", request);
      expect(replay).toMatchObject({ status: 200, data: { codigo: "REPLAY" } });
      expect(env.db.prepare("SELECT COUNT(*) AS n FROM clinical_event WHERE tipo='ReviewDecision'").get()).toMatchObject({ n: 1 });
      expect(env.db.prepare("SELECT COUNT(*) AS n FROM operation WHERE operationId LIKE 'salao-release-%'").get()).toMatchObject({ n: 1 });
      const changed = await post<{ codigo: string }>(base, env.token, "/consulta/salao/liberar", {
        ...request, motivo: "Motivo alterado mantendo a mesma chave",
      });
      expect(changed).toMatchObject({ status: 409, data: { codigo: "OPERATION_HASH_CONFLICT" } });
      expect(env.db.prepare("SELECT COUNT(*) AS n FROM clinical_event WHERE tipo='ReviewDecision'").get()).toMatchObject({ n: 1 });
    } finally { await env.close(); }
  });
});
