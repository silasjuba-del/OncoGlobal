// @vitest-environment jsdom
// Dados de canal sintéticos; esta prova cobre o cockpit HTTP real, não a tela legada.
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { ComponentProps } from "react";
import { afterEach, expect, it, vi } from "vitest";
import { ConsultaPersistida } from "../../src/ui/consulta/ConsultaPersistida.js";
import { criarPortaFalsa, ID } from "../../src/ui/api/fake.js";
import type { MensagemCanalVisao } from "../../src/contracts/api/porta.js";
import type { ConsultaVisao, PedidoBundle } from "../../src/contracts/api/porta.js";

afterEach(cleanup);

const relatoElegivel: MensagemCanalVisao = {
  mensagemId: "msg-relato-persistido-01",
  texto: "Relato sintético literal: houve desconforto ontem.\nAinda não revisado pelo médico.",
  em: "2026-10-19T22:15:00-03:00",
  redFlag: false,
  contatoId: "contato-sintetico-01",
  patientId: ID.verde,
  estadoVinculo: "VINCULADO",
  nomePaciente: "Paciente sintético",
  candidatos: [],
  origemCanal: "WHATSAPP_SERVICO",
  pendenciaProcessamento: false,
  reciboTecnico: "RECEBIDA",
  estadoConversa: "NOVA",
};

const relatoSemVinculo: MensagemCanalVisao = {
  ...relatoElegivel,
  mensagemId: "msg-sem-vinculo-02",
  texto: "CONTEÚDO SINTÉTICO QUE NÃO DEVE APARECER COMO RELATO VINCULADO",
  patientId: null,
  estadoVinculo: "CONFLITO",
};

function propsPersistida(contexto: PedidoBundle, aoAbrirCanal = vi.fn()) {
  const porta = criarPortaFalsa();
  const props: ComponentProps<typeof ConsultaPersistida> & { aoAbrirCanal: () => void } = {
    porta,
    contexto,
    aoAbrirCanal,
  };
  return { porta, props, aoAbrirCanal };
}

it("mostra o original vinculado no cartão real de pré-consulta e mantém a abertura da caixa sem ação clínica", async () => {
  const contexto: PedidoBundle = { patientId: ID.verde, encounterId: "en-verde", tumorLotId: "lot-verde" };
  const { porta, props, aoAbrirCanal } = propsPersistida(contexto);
  const carregar = porta.carregarConsulta.bind(porta);
  porta.carregarConsulta = vi.fn(async (patientId: string, tumorLotId?: string | null, encounterId?: string) => {
    const consulta = await carregar(patientId, tumorLotId, encounterId);
    return { ...consulta, contatosCanal: { mensagens: [relatoElegivel], pendenciasSemAtribuicao: 1 } };
  });
  const confirmar = vi.spyOn(porta, "confirmar");
  const acao = vi.spyOn(porta, "acao");

  render(<ConsultaPersistida {...props} />);

  const preConsulta = await screen.findByRole("region", { name: "Mudanças e pré-consulta" });
  await within(preConsulta).findByRole("heading", { name: "Relatos do canal" });
  expect(within(preConsulta).getByText(relatoElegivel.texto, { normalizer: texto => texto }).textContent).toBe(relatoElegivel.texto);
  expect(within(preConsulta).queryByText(relatoSemVinculo.texto)).toBeNull();
  expect(within(preConsulta).getByText(/Há 1 relato na caixa do canal com vínculo não validado/)).toBeTruthy();
  expect(screen.getByText(/autoria.*conferir|conteúdo relatado/i)).toBeTruthy();

  fireEvent.click(within(preConsulta).getByRole("button", { name: /abrir.*caixa/i }));
  expect(aoAbrirCanal).toHaveBeenCalledOnce();
  expect(confirmar).not.toHaveBeenCalled();
  expect(acao).not.toHaveBeenCalled();
});

it("descarta resposta tardia do contexto anterior ao trocar paciente/encontro/lote", async () => {
  const porta = criarPortaFalsa();
  const baseAntiga = await porta.carregarConsulta(ID.verde, "lot-verde", "en-verde");
  const baseNova = await porta.carregarConsulta(ID.multi, "lot-multi-a", "en-multi");
  const contextoAntigo: PedidoBundle = { patientId: baseAntiga.patientId, encounterId: baseAntiga.encounterId,
    tumorLotId: baseAntiga.tumorLotId };
  const contextoNovo: PedidoBundle = { patientId: baseNova.patientId, encounterId: baseNova.encounterId,
    tumorLotId: baseNova.tumorLotId };
  let resolverAntiga!: (visao: ConsultaVisao) => void;
  let resolverNova!: (visao: ConsultaVisao) => void;
  const mensagemAntiga: MensagemCanalVisao = { ...relatoElegivel, patientId: ID.verde,
    mensagemId: "msg-paciente-anterior", texto: "SEGREDO SINTÉTICO DO PACIENTE ANTERIOR" };
  const mensagemNova: MensagemCanalVisao = { ...relatoElegivel, patientId: ID.multi,
    mensagemId: "msg-paciente-atual", texto: "Relato sintético do contexto atual" };
  porta.carregarConsulta = vi.fn((patientId: string, _tumorLotId?: string | null, _encounterId?: string) => new Promise<ConsultaVisao>((resolve) => {
    if (patientId === ID.verde) resolverAntiga = resolve;
    else resolverNova = resolve;
  }));

  const tela = render(<ConsultaPersistida porta={porta} contexto={contextoAntigo} />);
  await waitFor(() => expect(resolverAntiga).toBeTypeOf("function"));
  tela.rerender(<ConsultaPersistida porta={porta} contexto={contextoNovo} />);
  await waitFor(() => expect(resolverNova).toBeTypeOf("function"));

  await act(async () => resolverAntiga({ ...baseAntiga, contatosCanal: { mensagens: [mensagemAntiga] } }));
  expect(screen.queryByText(mensagemAntiga.texto)).toBeNull();

  await act(async () => resolverNova({ ...baseNova, contatosCanal: { mensagens: [mensagemNova] } }));
  expect(await screen.findByText(mensagemNova.texto)).toBeTruthy();
  expect(screen.queryByText(mensagemAntiga.texto)).toBeNull();
});
