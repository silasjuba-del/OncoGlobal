// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { InvestigacaoMinima } from "../../../src/ui/consulta/InvestigacaoMinima.js";
import { SinteseProposta } from "../../../src/ui/consulta/SinteseProposta.js";
import type { PortaConsulta, PedidoBundle } from "../../../src/ui/api/porta.js";
import type { InvestigacaoConsultaVisao } from "../../../src/contracts/api/investigacao.js";
import type { SintesePropostaResposta } from "../../../src/contracts/api/sinteseProposta.js";

afterEach(cleanup);
const a = { patientId: "paciente-a", encounterId: "encontro-a", tumorLotId: null };
const b = { patientId: "paciente-b", encounterId: "encontro-b", tumorLotId: null };
type Modo = "investigacao" | "sintese";
type Resposta = InvestigacaoConsultaVisao | SintesePropostaResposta;
function resposta(modo: Modo, contexto = a, texto = "Conteúdo sintético anterior"): Resposta {
  if (modo === "investigacao") return { codigo: "INVESTIGACAO_CARREGADA", schema: "InvestigacaoConsulta@1", contexto,
    revisao: "revisao-1", estado: "PENDENTE", fatos: [], resultado: null, lacunas: [{ codigo: "PENDENTE", texto, fatos: [] }] };
  const ref = { eventId: "fato-sintetico", revisao: "fato-1" };
  return { codigo: "PROPOSTA_SINTESE_SALVA", contexto, criaEventoClinico: false, fatosRetrato: [ref], proposta: {
    status: "PROPOSTA_DE_SINTESE", revisaoObrigatoria: true, correlacao: { ...contexto, operationId: "operacao-sintese",
      revisaoFatos: "revisao-1", regras: [], biblioteca: { id: "biblioteca", versao: "1", hash: "hash" }, proposta: null },
    citacoes: [{ texto, fatos: [ref] }] } };
}
function adiada() {
  let resolve!: (r: Resposta) => void, reject!: (e: Error) => void;
  const promise = new Promise<Resposta>((sim, nao) => { resolve = sim; reject = nao; });
  return { promise, resolve, reject };
}
function porta(modo: Modo, chamar: () => Promise<Resposta>): PortaConsulta {
  return { [modo === "investigacao" ? "investigacao" : "sintetizarRetrato"]: chamar } as unknown as PortaConsulta;
}
const componente = (modo: Modo, p: PortaConsulta, ctx: PedidoBundle) => modo === "investigacao"
  ? <InvestigacaoMinima porta={p} contexto={ctx} revisaoEsperada="revisao-1" /> : <SinteseProposta porta={p} contexto={ctx} />;
const nomeBotao = (modo: Modo) => modo === "investigacao" ? "Investigação e exames" : "Propor síntese citada";
const clicar = (modo: Modo) => fireEvent.click(screen.getByRole("button", { name: nomeBotao(modo) }));

it.each(["investigacao", "sintese"] as const)("%s limpa resultado anterior durante nova tentativa e após erro", async modo => {
  const pendente = adiada(), chamar = vi.fn(async () => resposta(modo));
  const p = porta(modo, chamar); render(componente(modo, p, a)); clicar(modo);
  await screen.findByText(/Conteúdo sintético anterior/);
  chamar.mockImplementationOnce(() => pendente.promise);
  if (modo === "investigacao") clicar(modo);
  clicar(modo);
  expect(screen.queryByText(/Conteúdo sintético anterior/)).toBeNull();
  await act(async () => pendente.reject(new Error("FALHA_SINTETICA")));
  expect(screen.queryByText(/Conteúdo sintético anterior/)).toBeNull();
  expect(await screen.findByText(modo === "investigacao" ? /Não foi possível consultar a investigação/ : /Proposta indisponível/)).toBeTruthy();
});

it.each(["investigacao", "sintese"] as const)("%s ignora resposta tardia do paciente anterior", async modo => {
  const pendente = adiada(), chamar = vi.fn(async () => resposta(modo, b, "Conteúdo atual B"));
  chamar.mockImplementationOnce(() => pendente.promise);
  const p = porta(modo, chamar), tela = render(componente(modo, p, a)); clicar(modo);
  tela.rerender(componente(modo, p, b)); clicar(modo);
  await screen.findByText(/Conteúdo atual B/);
  await act(async () => pendente.resolve(resposta(modo, a)));
  expect(screen.queryByText(/Conteúdo sintético anterior/)).toBeNull();
  expect(screen.getByText(/Conteúdo atual B/)).toBeTruthy();
});

it.each(["investigacao", "sintese"] as const)("%s não conserva resposta de uma porta substituída no mesmo contexto", async modo => {
  const pendente = adiada(), antiga = porta(modo, () => pendente.promise);
  const nova = porta(modo, async () => resposta(modo, a, "Conteúdo da porta atual"));
  const tela = render(componente(modo, antiga, a)); clicar(modo);
  tela.rerender(componente(modo, nova, a)); clicar(modo);
  await screen.findByText(/Conteúdo da porta atual/);
  await act(async () => pendente.resolve(resposta(modo, a)));
  expect(screen.queryByText(/Conteúdo sintético anterior/)).toBeNull();
  expect(screen.getByText(/Conteúdo da porta atual/)).toBeTruthy();
});

it.each(["investigacao", "sintese"] as const)("%s rejeita conteúdo de contexto divergente", async modo => {
  render(componente(modo, porta(modo, async () => resposta(modo, b)), a)); clicar(modo);
  await screen.findByText(modo === "investigacao" ? /contexto ou referências divergentes/ : /Proposta indisponível/);
  expect(screen.queryByText(/Conteúdo sintético anterior/)).toBeNull();
});
