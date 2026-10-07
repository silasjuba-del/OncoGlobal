// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { criarServidorLocal } from "../../src/server/http.js";
import { criarGerenciadorSessao } from "../../src/server/sessao.js";
import { criarGateway, memoriaIdempotencia } from "../../src/kernel/gateway/gateway.js";
import { abrirLedger } from "../../src/kernel/ledger/db.js";
import { salvarDraft } from "../../src/kernel/ledger/drafts.js";
import { confirmar } from "../../src/kernel/ledger/writeRouter.js";
import { listarEventos } from "../../src/kernel/ledger/ledger.js";
import { criarPortaHttp } from "../../src/ui/api/http.js";
import { RevisaoExtracaoLocal } from "../../src/ui/consulta/RevisaoExtracaoLocal.js";

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
it("UI → HTTP real → revisão exibida → ledger: exige seleção e segundo clique; desmarcar invalida prova", async () => {
  const db = abrirLedger(":memory:");
  const agora = () => "2026-10-07T12:00:00Z";
  const senha = "senha-sintetica-reauditoria";
  const sessoes = criarGerenciadorSessao({ medicoId: "medico-teste", crm: "CRM-TESTE", senha, duracaoMs: 60_000, agora });
  const token = sessoes.login(senha)!.token;
  const contexto = { patientId: "Paciente Teste 95", encounterId: "encontro-95", tumorLotId: null };
  salvarDraft(db, { draftId: "cadastro", patientId: contexto.patientId, sourceId: "cadastro", rawRef: "local",
    payload: {}, revision: 0, diagnostics: [], criadoEm: agora() });
  confirmar(db, { ...contexto, operationId: "cadastro-95", reviewDecisionId: "review-cadastro", sessao: sessoes.obter(token)!, em: agora(),
    registros: [{ draftId: "cadastro", expectedRevision: 0, eventId: "paciente-95", tipo: "Paciente", fontes: [], revisao: "CONFIRMADO",
      payload: { patientId: contexto.patientId, nome: contexto.patientId, identificadores: [], nascimento: null,
        sexoCadastral: "NAO_INFORMADO", divergencia: false } }] });
  const server = criarServidorLocal({ db, sessoes, agora, log: () => {},
    gateway: criarGateway({ agora, auditar: () => {}, store: memoriaIdempotencia(), executores: {} }) });
  await new Promise<void>((resolve) => server.listening ? resolve() : server.once("listening", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("PORTA_AUSENTE");
  const base = `http://127.0.0.1:${address.port}`;
  const http = globalThis.fetch;
  vi.stubGlobal("fetch", (input: string | URL | Request, init?: RequestInit) => http(new URL(String(input), base), init));
  const post = async (path: string, data: unknown) => (await fetch(path, { method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify(data) })).json();
  try {
    await post("/consulta/carregar", { patientId: contexto.patientId });
    const raw = "01/09/2026 Creatinina 1,2 mg/dL; Hb 11,2 g/dL";
    const extracted = await post("/consulta/extrair", { sourceId: "fonte-95", recordingId: "gravacao-95",
      sourceType: "medical_note", rawTranscript: raw }) as { draftId: string };
    await post("/consulta/rascunho/revisar", { draftId: extracted.draftId, patientId: contexto.patientId, expectedRevision: 0 });
    const porta = criarPortaHttp({ onSessaoExpirada: () => {} });
    await porta.login(senha);
    await porta.carregarConsulta(contexto.patientId);
    const fatos = () => listarEventos(db, contexto.patientId).filter((e) => e.tipo === "FATO");
    const { rerender } = render(<RevisaoExtracaoLocal porta={porta} contexto={contexto} />);
    await screen.findByRole("option", { name: "Fonte local 1" });
    fireEvent.change(screen.getByLabelText("Fonte para revisão"), { target: { value: extracted.draftId } });
    await screen.findByText(raw);
    const checkboxes = await screen.findAllByRole("checkbox");
    expect(checkboxes).toHaveLength(2);
    expect(screen.queryByRole("button", { name: "Confirmar revisão exibida" })).toBeNull();
    fireEvent.click(checkboxes[0]!);
    fireEvent.click(screen.getByRole("button", { name: "Preparar revisão" }));
    await screen.findByRole("button", { name: "Confirmar revisão exibida" });
    expect(screen.getByLabelText("Conteúdo preparado para revisão").textContent).toContain("fonte-95");
    expect(fatos()).toHaveLength(0);
    const apenasPreparada = await porta.carregarConsulta(contexto.patientId);
    expect(apenasPreparada).toMatchObject({ resumoEvolucao: null,
      evolucoesRascunho: [expect.objectContaining({ somentePreparada: true, revisaoRegistrada: false })] });
    expect(JSON.stringify(apenasPreparada)).not.toContain("fato revisado explicitamente pelo médico");
    fireEvent.click(checkboxes[1]!);
    expect(screen.queryByRole("button", { name: "Confirmar revisão exibida" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Preparar revisão" }));
    const confirm = await screen.findByRole("button", { name: "Confirmar revisão exibida" });
    expect(fatos()).toHaveLength(0);
    fireEvent.click(confirm); fireEvent.click(confirm);
    await screen.findByText(/Revisão registrada/);
    expect(fatos()).toHaveLength(2);
    expect(new Set(fatos().map((f) => f.operationId)).size).toBe(1);
    expect(fatos().every((f) => f.fontes[0]?.sourceId === "fonte-95")).toBe(true);
    const reaberta = await porta.carregarConsulta(contexto.patientId);
    expect(JSON.stringify(reaberta)).toContain("Creatinina");
    expect(reaberta).toMatchObject({ resumoEvolucao: expect.not.stringContaining("Fato não selecionado") });
    rerender(<RevisaoExtracaoLocal porta={porta} contexto={{ ...contexto, encounterId: "outro" }} />);
    await waitFor(() => expect(screen.queryByRole("button", { name: "Confirmar revisão exibida" })).toBeNull());
  } finally {
    cleanup();
    await new Promise<void>((resolve) => server.close(() => resolve()));
    db.close();
  }
});
