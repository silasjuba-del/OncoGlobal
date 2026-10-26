// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { ConversaOncoassist } from "../../../src/ui/consulta/ConversaOncoassist.js";
import { HistoricoConversa, RespostaConversa, type ApiConversaOncoassist, type ContextoConversa, type EventoConversa } from "../../../src/contracts/api/conversaOncoassist.js";

const ctx = { patientId: "SINTETICO-A", encounterId: "ENCONTRO-A", tumorLotId: null };
const base = (contexto: ContextoConversa) => HistoricoConversa.parse({ codigo: "CONVERSA_HISTORICO", contexto, configuracao: {
  revision: 0, preferencias: { formato: "TOPICOS", extensao: "BREVE", incluirBiblioteca: false }, modelo: { endpoint: "http://127.0.0.1:1234/v1", modelo: "SINTETICO" } }, fontes: [], turnos: [], limiteHistorico: 100 });
const resposta = () => RespostaConversa.parse({ codigo: "CONVERSA_CONCLUIDA", contexto: ctx, turno: { id: "turno", operationId: "op", pergunta: "SINTETICO", modo: "MODELO_LOCAL", modelo: "SINTETICO", estado: "CONCLUIDA", texto: "Proposta SINTETICA revisável", citacoes: [], fontes: [], criadoEm: "2026-10-26T12:00:00.000Z", concluidoEm: "2026-10-26T12:00:01.000Z", atorId: "medico-sintetico", codigo: null, validadeFontes: "ATUAIS", revisaoObrigatoria: true, assinado: false, criaEventoClinico: false } });
function api(): ApiConversaOncoassist {
  return { historico: vi.fn(async c => base(c)), configurar: vi.fn(), cancelar: vi.fn(), responder: vi.fn(async () => resposta()) };
}
afterEach(cleanup);

it("ditado só acrescenta rascunho uma vez, preserva edição e sinaliza pendência", async () => {
  const porta = api(), pendente = vi.fn();
  const v = render(<ConversaOncoassist api={porta} contexto={ctx} aoAlterarPendente={pendente} />);
  const pergunta = await screen.findByLabelText("Pergunta ao OncoAssist");
  fireEvent.change(pergunta, { target: { value: "Pergunta já editada" } });
  v.rerender(<ConversaOncoassist api={porta} contexto={ctx} aoAlterarPendente={pendente} textoDitado={{ id: "ditado1", texto: "Ditado SINTETICO" }} />);
  expect((pergunta as HTMLTextAreaElement).value).toBe("Pergunta já editada\nDitado SINTETICO");
  v.rerender(<ConversaOncoassist api={porta} contexto={ctx} aoAlterarPendente={pendente} textoDitado={{ id: "ditado1", texto: "Ditado SINTETICO" }} />);
  expect((pergunta as HTMLTextAreaElement).value).toBe("Pergunta já editada\nDitado SINTETICO");
  expect(porta.responder).not.toHaveBeenCalled(); expect(pendente).toHaveBeenLastCalledWith(true);
});

it("delta parcial não pode ser aceito; texto só segue por ação explícita depois do final", async () => {
  const porta = api(), usar = vi.fn(), atividade = vi.fn();
  let finalizar!: (r: RespostaConversa) => void;
  let evento!: (e: EventoConversa) => void;
  porta.responder = vi.fn((_p, _s, onEvento) => { evento = onEvento!; return new Promise<RespostaConversa>(resolve => { finalizar = resolve; }); });
  render(<ConversaOncoassist api={porta} contexto={ctx} aoUsarTexto={usar} aoAtividade={atividade} />);
  fireEvent.change(await screen.findByLabelText("Pergunta ao OncoAssist"), { target: { value: "Pergunta SINTETICA" } });
  fireEvent.click(screen.getByRole("button", { name: "Perguntar ao modelo local" }));
  evento({ tipo: "delta", texto: "Parcial SINTETICO", parcialNaoValidado: true });
  await screen.findByText("Parcial SINTETICO");
  expect(screen.queryByRole("button", { name: "Preparar documento com texto revisado" })).toBeNull();
  expect(atividade).toHaveBeenLastCalledWith(true);
  finalizar(resposta());
  const editar = await screen.findByLabelText("Texto da proposta para revisão");
  fireEvent.change(editar, { target: { value: "Texto explicitamente revisto" } });
  expect(usar).not.toHaveBeenCalled();
  expect((screen.getByRole("button", { name: "Perguntar ao modelo local" }) as HTMLButtonElement).disabled).toBe(true);
  fireEvent.click(screen.getByRole("button", { name: "Preparar briefing documental" }));
  expect(porta.responder).toHaveBeenCalledTimes(1);
  expect((editar as HTMLTextAreaElement).value).toBe("Texto explicitamente revisto");
  fireEvent.click(screen.getByRole("button", { name: "Preparar documento com texto revisado" }));
  expect(usar).toHaveBeenCalledWith("Texto explicitamente revisto");
});

it("troca de paciente descarta resposta tardia mesmo se o transporte ignorar abort", async () => {
  const porta = api(); let finalizar!: (r: RespostaConversa) => void;
  porta.responder = vi.fn(() => new Promise<RespostaConversa>(resolve => { finalizar = resolve; }));
  const v = render(<ConversaOncoassist api={porta} contexto={ctx} />);
  await screen.findByLabelText("Pergunta ao OncoAssist");
  fireEvent.click(screen.getByRole("button", { name: "Preparar briefing documental" }));
  v.rerender(<ConversaOncoassist api={porta} contexto={{ ...ctx, patientId: "SINTETICO-B", encounterId: "ENCONTRO-B" }} />);
  await screen.findByLabelText("Pergunta ao OncoAssist"); finalizar(resposta());
  await waitFor(() => expect(screen.queryByLabelText("Texto da proposta para revisão")).toBeNull());
  expect(screen.queryByText("Proposta SINTETICA revisável")).toBeNull();
});



