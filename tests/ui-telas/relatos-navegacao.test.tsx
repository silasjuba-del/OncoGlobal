// @vitest-environment jsdom
// Navegação exercitada pela jornada real OncoassistLocal; fontes e conteúdo são sintéticos.
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
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


it.each(["transcricao", "apac", "prescricao"])("Task010: salvamento de %s impede abrir caixa e falha preserva edicao", async modo => {
  const f = fixture();
  let rejeitar!: (erro: Error) => void;
  const pendente = () => new Promise<never>((_resolve, reject) => { rejeitar = reject; });
  const salvar = modo === "transcricao" ? vi.spyOn(f.porta, "importarTranscricaoLocal").mockImplementation(pendente)
    : modo === "apac" ? vi.spyOn(f.porta, "prepararApacRascunho").mockImplementation(pendente)
    : vi.spyOn(f.porta, "prepararPrescricaoExecutavel").mockImplementation(pendente);
  render(<OncoassistLocal fabricaPorta={f.fabrica} />);
  entrar(); await abrirConsulta();
  const mudar = (label: string | RegExp, value: string) => fireEvent.change(screen.getByLabelText(label), { target: { value } });
  if (modo === "transcricao") {
    mudar(/Texto da transcri/, "Texto sintetico preservado");
    fireEvent.click(screen.getByLabelText(/Revisei o texto/));
    fireEvent.click(screen.getByRole("button", { name: /Salvar transcri/ }));
  } else if (modo === "apac") {
    await deixarApacPendente();
    fireEvent.click(screen.getByRole("button", { name: /Preparar pr.*exata da APAC/ }));
  } else {
    await deixarPrescricaoPendente();
    mudar("Protocolo ou esquema", "Esquema sintetico");
    mudar(/Linha terap/, "1"); mudar(/Inten.*terap/, "PALIATIVA");
    mudar(/N.*mero do ciclo/, "1"); mudar("Data prevista", "2026-10-20");
    fireEvent.click(screen.getByRole("button", { name: "Adicionar item manual" }));
    for (const [label, value] of [
      [/Medicamento.*item 1/, "Farmaco sintetico"], [/Classe.*item 1/, "QT"],
      [/Base da dose.*item 1/, "FIXED"], [/Dose final.*item 1/, "1,5"], [/Unidade.*item 1/, "mg"],
      [/Via.*item 1/, "EV"], [/Diluente.*item 1/, "Diluente sintetico"], [/Volume final.*item 1/, "100"],
      [/Tempo de infus.*item 1/, "30 min"], [/Dias de administra.*item 1/, "d1"],
      [/Motivo do override.*item 1/, "Escolha sintetica"],
    ] as const) mudar(label, value);
    fireEvent.click(screen.getByRole("button", { name: /Preparar pr.*exata$/ }));
  }
  await waitFor(() => expect(salvar).toHaveBeenCalledOnce());
  fireEvent.click(screen.getByRole("button", { name: "Abrir caixa do canal" }));
  expect(screen.queryByRole("region", { name: "Caixa do canal" })).toBeNull();
  expect(screen.queryByRole("dialog")).toBeNull();
  expect(screen.getByText(/antes de sair/)).toBeTruthy();
  expect(f.porta.caixaCanal).not.toHaveBeenCalled();
  expect(f.porta.confirmarPrescricaoExecutavel).not.toHaveBeenCalled();
  expect(f.porta.confirmarApacRascunho).not.toHaveBeenCalled();
  expect(f.porta.confirmarRespostaCanal).not.toHaveBeenCalled();
  await act(async () => rejeitar(new Error("falha sintetica controlada")));
  expect(salvar).toHaveBeenCalledOnce();
  const label = modo === "transcricao" ? /Texto da transcri/ : modo === "apac" ? "Procedimento principal" : /Motivo da prescr/;
  expect(screen.getByLabelText(label)).toHaveProperty("value", modo === "transcricao"
    ? "Texto sintetico preservado" : modo === "apac" ? "PROC-SINTETICO" : "Edi\u00e7\u00e3o sint\u00e9tica n\u00e3o conclu\u00edda");
  fireEvent.click(screen.getByRole("button", { name: "Abrir caixa do canal" }));
  expect(await screen.findByRole("dialog")).toBeTruthy();
  expect(f.porta.caixaCanal).not.toHaveBeenCalled();
});
