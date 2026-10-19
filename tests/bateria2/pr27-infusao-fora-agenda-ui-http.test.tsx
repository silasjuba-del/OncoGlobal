// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { createHash } from "node:crypto";
import { once } from "node:events";
import { expect, it, vi } from "vitest";
import { criarGateway, memoriaIdempotencia } from "../../src/kernel/gateway/gateway.js";
import { listarEventos } from "../../src/kernel/comandos/portas.js";
import { dadosDoEvento } from "../../src/kernel/projections/snapshot.js";
import { receberTransporteSintetico } from "../../src/server/canalEntrada.js";
import { criarServidorLocal } from "../../src/server/http.js";
import { criarPortaHttp } from "../../src/ui/api/http.js";
import { TelaSalao } from "../../src/ui/telas/TelaSalao.js";
import { ambiente, ctx, EM } from "./fixtures.js";

it.each([false, true])("revisa paciente fora da agenda sem trocar foco da triagem (outro agendado=%s)", async outroAgendado => {
  const a = ambiente(), alvo = { ...ctx, tumorLotId: null };
  const outro = { patientId: "outro-paciente-sintetico", encounterId: "outro-encontro-sintetico", tumorLotId: null };
  const paciente = (patientId: string, nome: string) => ({ patientId, nome, identificadores: [], nascimento: null, sexoCadastral: "NAO_INFORMADO", divergencia: false });
  a.seed("Paciente", paciente(ctx.patientId, "Paciente Sintetico Relato"), "CONFIRMADO", alvo);
  if (outroAgendado) {
    a.seed("Paciente", paciente(outro.patientId, "Outro Sintetico"), "CONFIRMADO", outro);
    a.seed("AgendaEntry", { patientId: outro.patientId, encounterId: outro.encounterId, data: "2026-10-19", horario: "15:00" }, "CONFIRMADO", outro);
  }
  const sender = "contato-sintetico-paciente", cuidador = "contato-sintetico-cuidador";
  for (const contatoId of [sender, cuidador]) a.seed("Contato", { contatoId, canal: "WHATSAPP_SERVICO", endereco: contatoId,
    patientId: ctx.patientId, relacao: contatoId === sender ? "PACIENTE" : "CUIDADOR", vinculadoEm: EM, revogadoEm: null }, "CONFIRMADO", alvo);
  const ingressar = (id: string, texto: string, senderRef: string) => receberTransporteSintetico(a.db, { accountId: "conta-sintetica",
    canal: "WHATSAPP_SERVICO", providerMessageId: id, senderRef, providerSentAt: EM, ingestedAt: EM,
    conteudo: { tipo: "TEXT", texto, contentSha256: createHash("sha256").update(texto).digest("hex") }, cadastros: [] });
  expect(ingressar("relato-fora-agenda", "Tive coceira na infusão de ontem", sender).ok).toBe(true);
  expect(ingressar("contexto-cuidador", "O cuidador relata que depois melhorou", cuidador).ok).toBe(true);
  const server = criarServidorLocal({ db: a.db, sessoes: a.acesso.sessoes, agora: () => EM, log: () => {},
    gateway: criarGateway({ agora: () => EM, auditar: () => {}, store: memoriaIdempotencia(), executores: {} }) });
  if (!server.listening) await once(server, "listening");
  const endereco = server.address(); if (!endereco || typeof endereco === "string") throw Error("PORTA");
  const base = `http://127.0.0.1:${endereco.port}`, realFetch = globalThis.fetch;
  vi.stubGlobal("fetch", (input: string | URL | Request, init?: RequestInit) => realFetch(new URL(String(input), base), init));
  const selecionar = vi.spyOn(a.acesso.sessoes, "selecionarConsulta");
  try {
    const row = a.db.prepare("SELECT mensagemId,payloadSha256 FROM canal_mensagem WHERE providerMessageId='relato-fora-agenda'").get()!;
    const hash = String(row.payloadSha256);
    const post = async (rota: string, pedido: unknown) => realFetch(base + rota, { method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${a.acesso.token}` }, body: JSON.stringify(pedido) });
    const revisao = { contexto: { ...alvo, operationId: "revisao-global-negativa" }, mensagemId: String(row.mensagemId), payloadSha256: hash,
      decisao: "Revisão sintética com contexto explícito." };
    expect((await post("/salao/revisar-relato-canal", { ...revisao, contexto: { ...ctx, operationId: "lote-nao-patientwide" } })).status).toBe(403);
    expect((await post("/salao/revisar-relato-canal", { ...revisao, payloadSha256: (hash[0] === "0" ? "1" : "0") + hash.slice(1) })).status).toBe(409);
    expect((await post("/salao/revisar-relato-canal", { ...revisao, contexto: { ...revisao.contexto, encounterId: "encontro-inexistente" } })).status).toBe(403);
    expect((await post("/farmacia/enviar", { contexto: revisao.contexto, prescricao: { documentId: "prescricao-inexistente", documentVersion: 1 } })).status).toBe(403);
    expect(listarEventos(a.db, alvo.patientId).filter(e => e.tipo === "ReviewDecision")).toHaveLength(0);
    const porta = criarPortaHttp({ onSessaoExpirada: () => {} });
    expect((await porta.login("senha-sintetica-bateria2")).ok).toBe(true);
    const registrar = vi.spyOn(porta, "revisarRelatoInfusao");
    render(<TelaSalao porta={porta} />);
    await screen.findByText(/Tive coceira na infusão/);
    expect(screen.getByText(/O cuidador relata/)).toBeTruthy();
    expect(screen.getByText(new RegExp(`contato ${sender}`))).toBeTruthy();
    expect(screen.getByText(new RegExp(`contato ${cuidador}`))).toBeTruthy();
    if (outroAgendado) await waitFor(() => expect(selecionar.mock.calls.some(([, c]) => c?.patientId === outro.patientId)).toBe(true));
    else expect(screen.getByText("salão vazio")).toBeTruthy();
    const antes = selecionar.mock.calls.length;
    fireEvent.change(screen.getByLabelText("Decisão médica sobre o relato"), { target: { value: "Relato revisto pelo médico sintético, sem atribuir agente causal." } });
    fireEvent.click(screen.getByRole("button", { name: "Registrar revisão deste relato" }));
    await waitFor(() => expect(screen.queryByLabelText("Relato de infusão pendente")).toBeNull());
    expect(selecionar.mock.calls).toHaveLength(antes);
    const decisoes = listarEventos(a.db, alvo.patientId).filter(e => e.tipo === "ReviewDecision");
    expect(decisoes).toHaveLength(1);
    expect(decisoes[0]!.encounterId).toBe(alvo.encounterId);
    expect(dadosDoEvento(decisoes[0]!)).toMatchObject({ contatoId: sender, canal: "WHATSAPP_SERVICO" });
    const pedidoPersistido = registrar.mock.calls[0]![0];
    expect(await porta.revisarRelatoInfusao!(pedidoPersistido)).toMatchObject({ codigo: "REPLAY" });
    expect(listarEventos(a.db, alvo.patientId).filter(e => e.tipo === "ReviewDecision")).toHaveLength(1);
    expect(listarEventos(a.db, outro.patientId).filter(e => e.tipo === "ReviewDecision")).toHaveLength(0);
    expect(a.db.prepare("SELECT COUNT(*) AS n FROM canal_mensagem").get()!.n).toBe(2);
  } finally {
    cleanup(); vi.unstubAllGlobals(); selecionar.mockRestore();
    await new Promise<void>(r => server.close(() => r())); a.db.close();
  }
});
