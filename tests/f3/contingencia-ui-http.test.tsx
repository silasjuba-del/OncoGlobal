// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { once } from "node:events";
import { criarGateway, memoriaIdempotencia } from "../../src/kernel/gateway/gateway.js";
import { abrirLedger } from "../../src/kernel/ledger/db.js";
import { criarServidorLocal } from "../../src/server/http.js";
import { criarPortaHttp } from "../../src/ui/api/http.js";
import { TelaSalao } from "../../src/ui/telas/TelaSalao.js";
import { ambiente, ctx, EM } from "../bateria2/fixtures.js";

it("contingência cruza tela, HTTP e SQLite: contexto, E1, replay, conflito e reabertura", async () => {
  const pasta = mkdtempSync(join(tmpdir(), "f3-contingencia-sintetica-"));
  const caminho = join(pasta, "ledger.sqlite");
  const a = ambiente(caminho), contexto = { ...ctx, tumorLotId: null };
  a.seed("Paciente", { patientId: ctx.patientId, nome: "Paciente Sintetico Contingencia", identificadores: [],
    nascimento: null, sexoCadastral: "NAO_INFORMADO", divergencia: false }, "CONFIRMADO", contexto);
  a.seed("AgendaEntry", { patientId: ctx.patientId, encounterId: ctx.encounterId, horario: "15:00", data: "2026-10-19" }, "CONFIRMADO", contexto);
  let db = a.db;
  let agora = EM;
  const iniciar = () => criarServidorLocal({ db, sessoes: a.acesso.sessoes, agora: () => agora,
    log: () => {}, gateway: criarGateway({ agora: () => agora, auditar: () => {}, store: memoriaIdempotencia(), executores: {} }) });
  let server = iniciar();
  if (!server.listening) await once(server, "listening");
  const endereco = () => { const p = server.address(); if (!p || typeof p === "string") throw Error("PORTA"); return `http://127.0.0.1:${p.port}`; };
  let base = endereco();
  const realFetch = globalThis.fetch;
  vi.stubGlobal("fetch", (input: string | URL | Request, init?: RequestInit) => realFetch(new URL(String(input), base), init));
  const post = (rota: string, body: unknown, token: string | null = a.acesso.token) => realFetch(base + rota,
    { method: "POST", headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify(body) });
  try {
    const gerar = "/consulta/salao/contingencia/gerar", historico = "/consulta/salao/contingencia/historico";
    const pedido = { patientId: ctx.patientId, encounterId: ctx.encounterId, operationId: "operacao-sintetica-contingencia",
      destino: "FILA_MEDICO", emergenciaAtiva: false, alertasOperacionaisE1: [], resumoTriagem: { observacao: "Dado operacional sintético" } };
    expect((await post(gerar, pedido, null)).status).toBe(401);
    expect((await post(gerar, { ...pedido, patientId: "outro-paciente" })).status).toBe(409);
    expect((await post(historico, { patientId: ctx.patientId, encounterId: "outro-encontro" })).status).toBe(409);
    expect((await post(gerar, { ...pedido, nomePaciente: "Nome injetado" })).status).toBe(400);
    expect((await post(gerar, { ...pedido, emergenciaAtiva: true })).status).toBe(409);
    const primeira = await post(gerar, pedido);
    expect(primeira.status).toBe(200);
    const documento = await primeira.json();
    agora = "2026-10-20T03:01:00Z"; // mudou o dia civil do serviço; retry mantém a data original.
    expect(await (await post(gerar, pedido)).json()).toEqual(documento);
    expect((await post(gerar, { ...pedido, resumoTriagem: { observacao: "Alterado" } })).status).toBe(409);
    const porta = criarPortaHttp({ onSessaoExpirada: () => {} });
    expect((await porta.login("senha-sintetica-bateria2")).ok).toBe(true);
    agora = EM;
    const lerHistorico = porta.historicoContingenciaSalao!;
    let liberarHistorico!: () => void;
    const esperaHistorico = new Promise<void>(r => { liberarHistorico = r; });
    porta.historicoContingenciaSalao = async contexto => {
      const antigas = await lerHistorico(contexto);
      await esperaHistorico;
      return antigas;
    };
    render(<TelaSalao porta={porta} />);
    await screen.findByLabelText("Resumo operacional informado pelo médico");
    await porta.selecionarContexto?.(contexto);
    fireEvent.change(screen.getByLabelText("Resumo operacional informado pelo médico"), { target: { value: "Observação sintética <script>alert('x')</script>" } });
    fireEvent.click(screen.getByLabelText("Emergência ativa informada pelo médico"));
    expect((screen.getByRole("button", { name: "Conferir e gravar folha operacional" }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(screen.getByLabelText("Destaque E1 confirmado"), { target: { value: "E1 sintético informado pelo médico" } });
    fireEvent.click(screen.getByRole("button", { name: "Conferir e gravar folha operacional" }));
    await waitFor(() => expect(screen.getByTitle("Folha operacional persistida")).toBeTruthy());
    const html = (screen.getByTitle("Folha operacional persistida") as HTMLIFrameElement).srcdoc;
    expect(html).toContain("Paciente Sintetico Contingencia");
    expect(html).toContain(ctx.patientId);
    expect(html).toContain(ctx.encounterId);
    expect(html).toContain("E1 — EMERGÊNCIA ATIVA");
    expect(html).toContain("&lt;script&gt;");
    expect(html).not.toContain("<script>");
    liberarHistorico();
    await waitFor(() => expect(screen.getAllByRole("button", { name: /Reabrir folha de/ })).toHaveLength(2));
    porta.historicoContingenciaSalao = lerHistorico;
    expect(db.prepare("SELECT COUNT(*) AS n FROM salao_folha_contingencia").get()!.n).toBe(2);
    expect(db.prepare("SELECT COUNT(*) AS n FROM clinical_event").get()!.n).toBe(2);
    const novaId = String(db.prepare("SELECT folhaId FROM salao_folha_contingencia WHERE folhaId <> ?")
      .get(documento.folha.folhaId)!.folhaId);
    cleanup();
    await new Promise<void>(r => server.close(() => r())); db.close();
    db = abrirLedger(caminho); server = iniciar();
    if (!server.listening) await once(server, "listening");
    base = endereco();
    render(<TelaSalao porta={porta} />);
    const botoes = await screen.findAllByRole("button", { name: /Reabrir folha de/ });
    expect(botoes).toHaveLength(2);
    const botaoNova = botoes.find(b => b.dataset.folhaId === novaId);
    expect(botaoNova).toBeDefined();
    fireEvent.click(botaoNova!);
    expect((screen.getByTitle("Folha operacional persistida") as HTMLIFrameElement).srcdoc).toBe(html);
  } finally {
    cleanup(); vi.unstubAllGlobals();
    if (server.listening) await new Promise<void>(r => server.close(() => r()));
    db.close(); rmSync(pasta, { recursive: true, force: true });
  }
}, 30_000);
