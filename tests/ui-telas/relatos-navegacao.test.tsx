// @vitest-environment jsdom
// Navegação exercitada pela jornada real OncoassistLocal; fontes e conteúdo são sintéticos.
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { OncoassistLocal } from "../../src/ui/OncoassistLocal.js";
import { criarPortaFalsa } from "../../src/ui/api/fake.js";
import type { MensagemCanalVisao, PedidoBundle, ResultadoTranscricaoLocal } from "../../src/contracts/api/porta.js";
import type { BasePrescricaoExecutavelResposta } from "../../src/contracts/api/operacaoPrescricaoExecutavel.js";
import { BaseApacRascunhoRespostaSchema } from "../../src/contracts/api/apacRascunho.js";

afterEach(cleanup);

const contexto: PedidoBundle = { patientId: "pt-multi", encounterId: "en-multi", tumorLotId: "lot-multi-a" };
const mensagem: MensagemCanalVisao = {
  mensagemId: "msg-navegacao-sintetica",
  texto: "Relato sintético de navegação; nenhuma ação clínica foi solicitada.",
  em: "2026-10-19T15:00:00-03:00",
  redFlag: false,
  contatoId: "contato-sintetico",
  patientId: contexto.patientId,
  estadoVinculo: "VINCULADO",
  nomePaciente: "Paciente sintético",
  candidatos: [],
  origemCanal: "WHATSAPP_SERVICO",
  pendenciaProcessamento: false,
  reciboTecnico: "RECEBIDA",
  estadoConversa: "NOVA",
};

function fixture() {
  const porta = criarPortaFalsa();
  porta.login = vi.fn(async () => ({ ok: true, expiraEm: null }));
  porta.oncoassistStatus = vi.fn(async () => ({ status: "PENDENTE" as const, motivo: "CHAVE_AUSENTE" }));
  porta.oncoassistFontes = vi.fn(async () => ({ fontes: [] }));
  porta.caixaCanal = vi.fn(async () => ({ mensagens: [mensagem] }));
  porta.importarTranscricaoLocal = vi.fn(async () => ({ codigo: "RASCUNHO_SALVO", draftId: "rascunho-sintetico",
    revision: 0, linkedPatientId: null, requiresMedicalReview: true } as ResultadoTranscricaoLocal));
  const basePrescricao: BasePrescricaoExecutavelResposta = {
    contexto,
    revisao: "a".repeat(64),
    pacienteNome: "Paciente sintético",
    vigente: null,
    episodio: null,
    ciclo: null,
    pendencias: [],
  };
  porta.lerBasePrescricaoExecutavel = vi.fn(async () => basePrescricao);
  porta.prepararPrescricaoExecutavel = vi.fn(async () => { throw new Error("não deve preparar ao editar"); });
  porta.confirmarPrescricaoExecutavel = vi.fn(async () => { throw new Error("não deve assinar ao editar"); });
  porta.lerBaseApacRascunho = vi.fn(async (ctx) => BaseApacRascunhoRespostaSchema.parse({
    contexto: ctx,
    revisao: "b".repeat(64),
    prescricao: { documentId: "rx-sintetica", documentVersion: 1, protocoloId: "Esquema sintético", dataPrevista: "2026-10-20" },
    sugestao: { competencia: "2026-10", campos: {
      procedimentoPrincipal: null, pacienteCns: null, nomeMae: null, nomeEstabelecimento: null,
      cnesSolicitante: null, solicitanteNome: null, solicitanteCns: null, justificativa: null,
      descricaoDiagnostico: null, quantidadePrincipal: null, pacienteNascimento: null, pacienteSexo: null,
    } },
    camposClinicos: [], existentes: [], pendencias: [],
  }));
  porta.prepararApacRascunho = vi.fn(async () => { throw new Error("não deve preparar ao editar"); });
  porta.confirmarApacRascunho = vi.fn(async () => { throw new Error("não deve salvar ao editar"); });
  porta.prepararRespostaCanal = vi.fn(async () => { throw new Error("não deve preparar resposta ao navegar"); });
  porta.confirmarRespostaCanal = vi.fn(async () => { throw new Error("não deve confirmar resposta ao navegar"); });
  const carregar = porta.carregarConsulta.bind(porta);
  porta.carregarConsulta = vi.fn(async (patientId: string, tumorLotId?: string | null, encounterId?: string) => {
    const visao = await carregar(patientId, tumorLotId, encounterId);
    return { ...visao, contatosCanal: { mensagens: [mensagem] } };
  });
  const fabrica = vi.fn(() => porta);
  return { porta, fabrica };
}

function entrar() {
  fireEvent.change(screen.getByLabelText("Senha do servidor"), { target: { value: "senha-sintetica" } });
  fireEvent.click(screen.getByRole("button", { name: "Entrar" }));
}

async function abrirConsulta() {
  fireEvent.change(await screen.findByLabelText("Paciente da agenda"), { target: { value: contexto.encounterId } });
  await screen.findByRole("button", { name: "Abrir caixa do canal" });
  await waitFor(() => expect((screen.getByLabelText("Paciente da agenda") as HTMLSelectElement).disabled).toBe(false));
}

async function abrirPainelCanal() {
  fireEvent.click(await screen.findByRole("button", { name: "Abrir caixa do canal" }));
  await screen.findByRole("region", { name: "Caixa do canal" });
}

async function deixarPrescricaoPendente() {
  fireEvent.click(await screen.findByRole("button", { name: "Prescrição estruturada" }));
  const motivo = await screen.findByLabelText("Motivo da prescrição");
  fireEvent.change(motivo, { target: { value: "Edição sintética não concluída" } });
}

async function deixarApacPendente() {
  fireEvent.click(await screen.findByRole("button", { name: /Preparar APAC da prescr/ }));
  fireEvent.change(await screen.findByLabelText("Procedimento principal"), { target: { value: "PROC-SINTETICO" } });
}

async function esperarGuard(nomeDialogo: string, campo: string, valor: string, porta: ReturnType<typeof criarPortaFalsa>) {
  fireEvent.click(screen.getByRole("button", { name: "Abrir caixa do canal" }));
  const dialogo = await screen.findByRole("dialog", { name: nomeDialogo });
  expect(within(dialogo).getByRole("button", { name: "Continuar editando" })).toBeTruthy();
  expect(screen.queryByRole("region", { name: "Caixa do canal" })).toBeNull();

  fireEvent.click(within(dialogo).getByRole("button", { name: "Continuar editando" }));
  expect(screen.queryByRole("dialog")).toBeNull();
  expect(screen.getByLabelText(campo)).toHaveProperty("value", valor);
  expect(screen.queryByRole("region", { name: "Caixa do canal" })).toBeNull();
  expect(porta.confirmarPrescricaoExecutavel).not.toHaveBeenCalled();
  expect(porta.confirmarApacRascunho).not.toHaveBeenCalled();
  expect(porta.importarTranscricaoLocal).not.toHaveBeenCalled();
  expect(porta.prepararPrescricaoExecutavel).not.toHaveBeenCalled();
  expect(porta.prepararApacRascunho).not.toHaveBeenCalled();
  expect(porta.prepararRespostaCanal).not.toHaveBeenCalled();
  expect(porta.confirmarRespostaCanal).not.toHaveBeenCalled();
}

it("o botão Abrir caixa do canal navega pelo OncoassistLocal sem disparar ação clínica ou resposta", async () => {
  const f = fixture();
  render(<OncoassistLocal fabricaPorta={f.fabrica} />);
  entrar(); await abrirConsulta();

  const confirmar = vi.spyOn(f.porta, "confirmar");
  const acao = vi.spyOn(f.porta, "acao");
  const pedirVinculo = vi.spyOn(f.porta, "pedirVinculo");
  const prepararResposta = vi.spyOn(f.porta, "prepararRespostaCanal");
  const confirmarResposta = vi.spyOn(f.porta, "confirmarRespostaCanal");
  await abrirPainelCanal();

  expect(screen.getByText(mensagem.texto)).toBeTruthy();
  expect(f.porta.caixaCanal).toHaveBeenCalledOnce();
  expect(confirmar).not.toHaveBeenCalled();
  expect(acao).not.toHaveBeenCalled();
  expect(pedirVinculo).not.toHaveBeenCalled();
  expect(prepararResposta).not.toHaveBeenCalled();
  expect(confirmarResposta).not.toHaveBeenCalled();
});

it("navegar aos relatos enquanto uma transcrição está pendente preserva texto e pede decisão explícita", async () => {
  const f = fixture();
  render(<OncoassistLocal fabricaPorta={f.fabrica} />);
  entrar(); await abrirConsulta();
  fireEvent.change(screen.getByLabelText("Texto da transcrição"), { target: { value: "Texto sintético ainda não salvo" } });
  fireEvent.click(screen.getByLabelText("Revisei o texto para salvar como rascunho"));
  await esperarGuard("Transcrição não salva", "Texto da transcrição", "Texto sintético ainda não salvo", f.porta);
});

it("navegar aos relatos enquanto a prescrição está pendente preserva a edição e pede decisão explícita", async () => {
  const f = fixture();
  render(<OncoassistLocal fabricaPorta={f.fabrica} />);
  entrar(); await abrirConsulta(); await deixarPrescricaoPendente();
  await esperarGuard("Prescrição em edição", "Motivo da prescrição", "Edição sintética não concluída", f.porta);
});

it("navegar aos relatos enquanto a APAC está pendente preserva a edição e pede decisão explícita", async () => {
  const f = fixture();
  render(<OncoassistLocal fabricaPorta={f.fabrica} />);
  entrar(); await abrirConsulta(); await deixarApacPendente();
  await esperarGuard("APAC em edição", "Procedimento principal", "PROC-SINTETICO", f.porta);
});
