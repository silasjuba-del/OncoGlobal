// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import type { Server } from "node:http";
import type { DatabaseSync } from "node:sqlite";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { abrirLedger } from "../../src/kernel/ledger/db.js";
import { salvarDraft, listarDrafts } from "../../src/kernel/ledger/drafts.js";
import { confirmar } from "../../src/kernel/ledger/writeRouter.js";
import { listarEventos } from "../../src/kernel/ledger/ledger.js";
import { criarGateway, memoriaIdempotencia } from "../../src/kernel/gateway/gateway.js";
import { criarServidorLocal } from "../../src/server/http.js";
import { criarGerenciadorSessao } from "../../src/server/sessao.js";
import { criarPortaHttp } from "../../src/ui/api/http.js";
import { SalaoResposta } from "../../src/ui/api/respostas.js";
import { TelaSalao } from "../../src/ui/telas/TelaSalao.js";

const servers: Server[] = [];
const databases: DatabaseSync[] = [];
const dirs: string[] = [];
afterEach(async () => {
  cleanup();
  vi.unstubAllGlobals();
  await Promise.all(servers.splice(0).filter((server) => server.listening)
    .map((server) => new Promise<void>((resolve) => server.close(() => resolve()))));
  for (const db of databases.splice(0)) { try { db.close(); } catch { /* already closed */ } }
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

it("UI de primeiro uso envia triagem como draft e registra liberação no SQLite após reload", async () => {
  const root = mkdtempSync(join(tmpdir(), "w10-salao-ui-")); dirs.push(root);
  const dbPath = join(root, "ledger.sqlite");
  let db = abrirLedger(dbPath); databases.push(db);
  const agora = () => "2026-10-08T12:00:00-03:00";
  const senha = "senha-sintetica-salao-ui";
  const sessoes = criarGerenciadorSessao({ medicoId: "medico-salao-ui", crm: "CRM-SINTETICO",
    senha, duracaoMs: 60_000, agora });
  let server: Server | null = null;
  const iniciarServidor = async () => {
    const iniciado = criarServidorLocal({ db, sessoes, agora, log: () => {},
      gateway: criarGateway({ agora, auditar: () => {}, store: memoriaIdempotencia(), executores: {} }) });
    server = iniciado;
    servers.push(iniciado);
    await new Promise<void>((resolve) => iniciado.listening ? resolve() : iniciado.once("listening", resolve));
    const address = iniciado.address();
    if (!address || typeof address === "string") throw new Error("PORTA_AUSENTE");
    return `http://127.0.0.1:${address.port}`;
  };
  const patientId = "Paciente Sintetico Primeiro Uso";
  const encounterId = "encontro-salao-primeiro-uso";
  const outroPatientId = "Paciente Sintetico Outra Agenda";
  const outroEncounterId = "encontro-outra-agenda";
  const seed = (anchorPatientId: string, anchorEncounterId: string, suffix: string, tipo: string, payload: unknown) => {
    const draftId = `draft-ui-salao-${suffix}`;
    salvarDraft(db, { draftId, patientId: anchorPatientId, sourceId: `source-ui-salao-${suffix}`, rawRef: "fixture-local-sintetica",
      payload: {}, diagnostics: [], revision: 0, criadoEm: agora() });
    const result = confirmar(db, { operationId: `op-ui-salao-${suffix}`, patientId: anchorPatientId, tumorLotId: null,
      encounterId: anchorEncounterId, reviewDecisionId: `review-ui-salao-${suffix}`, sessao: sessoes.login(senha)!.sessao,
      em: agora(), registros: [{ draftId, expectedRevision: 0, eventId: `event-ui-salao-${suffix}`,
        tipo, payload, fontes: [], revisao: "CONFIRMADO" }] });
    expect(result.estado).toBe("GRAVADA");
  };
  seed(patientId, encounterId, "paciente", "Paciente", { patientId, identificadores: [], nome: "Paciente Sintético Primeiro Uso",
    nascimento: null, sexoCadastral: "NAO_INFORMADO", divergencia: false });
  seed(patientId, encounterId, "agenda", "AgendaEntry", { patientId, encounterId, horario: "10:00", data: "2026-10-08" });
  seed(outroPatientId, outroEncounterId, "outro-paciente", "Paciente", { patientId: outroPatientId, identificadores: [],
    nome: "Paciente Sintético Outra Agenda", nascimento: null, sexoCadastral: "NAO_INFORMADO", divergencia: false });
  seed(outroPatientId, outroEncounterId, "outra-agenda", "AgendaEntry", {
    patientId: outroPatientId, encounterId: outroEncounterId, horario: "09:00", data: "2026-10-08" });
  expect(listarEventos(db, patientId).some((event) => event.tipo === "Triagem")).toBe(false);

  let base = await iniciarServidor();
  const realFetch = globalThis.fetch;
  const salaDiagnostics: string[] = [];
  vi.stubGlobal("fetch", async (input: string | URL | Request, init?: RequestInit) => {
    const target = new URL(String(input), base);
    const response = await realFetch(target, init);
    if (target.pathname === "/consulta/salao") {
      const body = await response.clone().json() as unknown;
      const parsed = SalaoResposta.safeParse(body);
      if (!parsed.success) salaDiagnostics.push(`status=${response.status}; `
        + parsed.error.issues.map((issue) => `${issue.path.join(".") || "<root>"}:${issue.code}`).join(","));
    }
    return response;
  });
  const porta = criarPortaHttp({ onSessaoExpirada: () => {} });
  expect((await porta.login(senha)).ok).toBe(true);
  const agenda = await porta.agendaDoDia();
  expect(agenda.itens).toEqual(expect.arrayContaining([
    expect.objectContaining({ patientId, nome: "Paciente Sintético Primeiro Uso" }),
    expect.objectContaining({ patientId: outroPatientId, nome: "Paciente Sintético Outra Agenda" }),
  ]));
  const contexto = await porta.carregarConsulta(patientId);
  expect(contexto.encounterId).toBe(encounterId);
  const fila = await porta.filaSalao().catch((error: unknown) => {
    throw new Error(`fila HTTP não corresponde a SalaoResposta: ${salaDiagnostics.join(" | ") || "sem issues zod"}; `
      + `erro cliente=${error instanceof Error ? error.message : "desconhecido"}`);
  });
  expect(fila.pacientes).toEqual(expect.arrayContaining([
    expect.objectContaining({ patientId, encounterId }),
    expect.objectContaining({ patientId: outroPatientId, encounterId: outroEncounterId }),
  ]));
  const baseline = listarEventos(db, patientId);

  render(<TelaSalao porta={porta} />);
  const pacienteSelect = await screen.findByLabelText("Paciente em triagem");
  expect((pacienteSelect as HTMLSelectElement).value).toBe(outroPatientId);
  fireEvent.change(pacienteSelect, { target: { value: patientId } });
  await waitFor(() => expect((pacienteSelect as HTMLSelectElement).value).toBe(patientId));
  fireEvent.change(screen.getByLabelText("PA sistólica (mmHg)"), { target: { value: "181" } });
  fireEvent.click(screen.getByRole("button", { name: "salvar triagem" }));
  await waitFor(() => expect(listarDrafts(db, patientId).some((draft) =>
    (draft.payload as { kind?: string }).kind === "SALAO_TRIAGEM_RASCUNHO")).toBe(true));
  expect(listarEventos(db, patientId)).toEqual(baseline);
  expect(listarEventos(db, patientId).some((event) => event.tipo === "Triagem")).toBe(false);
  const triageDraft = listarDrafts(db, patientId).find((draft) =>
    (draft.payload as { kind?: string }).kind === "SALAO_TRIAGEM_RASCUNHO");
  expect((triageDraft?.payload as { source?: { classe?: string; contentHash?: string } }).source)
    .toMatchObject({ classe: "MANUAL", contentHash: expect.stringMatching(/^[a-f0-9]{64}$/u) });
  expect((triageDraft?.payload as { triagem?: { pas?: { revisao?: string } } }).triagem?.pas?.revisao).toBe("REVISAR");

  fireEvent.click(await screen.findByRole("button", { name: "liberar mesmo com corte" }));
  const motivo = "Liberação médica após avaliação sintética do corte";
  fireEvent.change(screen.getByLabelText("Motivo"), { target: { value: motivo } });
  fireEvent.click(screen.getByRole("button", { name: "confirmar liberação" }));
  await screen.findByText(motivo);
  const liberacao = listarEventos(db, patientId).find((event) => event.tipo === "ReviewDecision"
    && (event.payload as { data?: Record<string, unknown> }).data?.campo === "liberacaoComCorteSalao");
  expect(liberacao).toMatchObject({ patientId, encounterId,
    criadoPor: { tipo: "SESSAO", id: "medico-salao-ui" } });
  expect(listarEventos(db, patientId).some((event) => event.tipo === "Triagem")).toBe(false);

  await new Promise<void>((resolve) => server!.close(() => resolve()));
  db.close();
  db = abrirLedger(dbPath); databases.push(db);
  base = await iniciarServidor();
  cleanup();
  render(<TelaSalao porta={porta} />);
  await screen.findByText(motivo);
  expect(listarEventos(db, patientId).filter((event) => event.tipo === "ReviewDecision"
    && (event.payload as { data?: Record<string, unknown> }).data?.campo === "liberacaoComCorteSalao")).toHaveLength(1);
  expect(listarEventos(db, patientId).some((event) => event.tipo === "Triagem")).toBe(false);
  expect(listarDrafts(db, patientId).some((draft) =>
    (draft.payload as { kind?: string }).kind === "SALAO_TRIAGEM_RASCUNHO")).toBe(true);
});
