// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { AgendaMedica } from "../../../src/ui/medico/AgendaMedica.js";
import { PreConsultaMedica } from "../../../src/ui/medico/PreConsultaMedica.js";
import { NutricaoMedica } from "../../../src/ui/medico/NutricaoMedica.js";
import { CadastroMedico } from "../../../src/ui/medico/CadastroMedico.js";
import type { ApiConsultorioMedico, ContextoConsultorio, EntradaPreConsultaMedica } from "../../../src/contracts/api/consultorioMedico.js";

afterEach(cleanup);
const contexto: ContextoConsultorio = { patientId: "SINTETICO-A", encounterId: "en-SINTETICO-A", tumorLotId: null };
const vazia: EntradaPreConsultaMedica = { queixa: "", historia: "", antecedentes: "", medicamentos: "", alergias: "", contextoPessoal: "", observacoes: "",
  pesoKg: null, alturaCm: null, origemPeso: "NAO_INFORMADO" };
function apiCom(metodos: Partial<ApiConsultorioMedico>) { return metodos as ApiConsultorioMedico; }

it("cadastro usa uma operação por tentativa e preserva campos diante de falha", async () => {
  const cadastrar = vi.fn().mockRejectedValueOnce(Error("REDE_INDISPONIVEL")).mockResolvedValue({ codigo: "GRAVADA", contexto, eventId: "evento-SINTETICO" });
  const api = apiCom({ agenda: vi.fn().mockResolvedValue({ codigo: "AGENDA_MEDICA", itens: [], pacientes: [], retornos: [] }), cadastrar });
  const abrir = vi.fn(); render(<AgendaMedica api={api} onSelecionar={abrir} />);
  fireEvent.click(screen.getByLabelText("Cadastrar novo paciente"));
  fireEvent.change(screen.getByLabelText("Nome do paciente"), { target: { value: "Paciente SINTETICO" } });
  fireEvent.click(screen.getByRole("button", { name: "Cadastrar e agendar" }));
  await screen.findByRole("alert");
  expect((screen.getByLabelText("Nome do paciente") as HTMLInputElement).value).toBe("Paciente SINTETICO");
  fireEvent.click(screen.getByRole("button", { name: "Cadastrar e agendar" }));
  await screen.findByText("Paciente e encontro gravados. Abra a consulta quando desejar.");
  expect(cadastrar).toHaveBeenCalledTimes(2);
  expect(cadastrar.mock.calls[0]![0].operationId).toBe(cadastrar.mock.calls[1]![0].operationId);
  expect(abrir).not.toHaveBeenCalled();
});

it("pré-consulta não converte ausência em negativa e não perde texto numa falha de salvamento", async () => {
  const salvar = vi.fn().mockRejectedValue(Error("FALHA_TRANSPORTE"));
  const api = apiCom({ preConsulta: vi.fn().mockResolvedValue({ codigo: "PRECONSULTA_MEDICA", contexto, rascunho: null, assinado: false }), salvarPreConsulta: salvar });
  render(<PreConsultaMedica api={api} contexto={contexto} />);
  const queixa = await screen.findByLabelText("Queixa principal");
  await waitFor(() => expect((queixa as HTMLTextAreaElement).disabled).toBe(false));
  expect((screen.getByLabelText("Alergias relatadas") as HTMLTextAreaElement).value).toBe("");
  fireEvent.change(queixa, { target: { value: "Nega febre. Relato SINTETICO incerto." } });
  fireEvent.click(screen.getByRole("button", { name: "Salvar pré-consulta" }));
  await screen.findByRole("alert");
  expect((queixa as HTMLTextAreaElement).value).toBe("Nega febre. Relato SINTETICO incerto.");
  expect(salvar.mock.calls[0]![0].entrada.alergias).toBe("");
  expect(screen.queryByRole("button", { name: "Registrar relato revisado na evolução" })).toBeNull();
});

it("resposta tardia de pré-consulta não ocupa a ficha de outro paciente", async () => {
  let resolver!: (value: unknown) => void;
  const tardia = new Promise(resolve => { resolver = resolve; });
  const b = { patientId: "SINTETICO-B", encounterId: "en-SINTETICO-B", tumorLotId: null };
  const api = apiCom({ preConsulta: vi.fn().mockImplementation(async c => c.patientId === contexto.patientId ? tardia
    : { codigo: "PRECONSULTA_MEDICA", contexto: b, rascunho: null, assinado: false }) });
  const view = render(<PreConsultaMedica api={api} contexto={contexto} />);
  view.rerender(<PreConsultaMedica api={api} contexto={b} />);
  const queixa = await screen.findByLabelText("Queixa principal");
  resolver({ codigo: "PRECONSULTA_MEDICA", contexto, rascunho: { entrada: { ...vazia, queixa: "DADO DO PACIENTE A" } }, assinado: false });
  await waitFor(() => expect((queixa as HTMLTextAreaElement).value).toBe(""));
  expect(screen.queryByText("DADO DO PACIENTE A")).toBeNull();
});

it("nutrição inicia vazia e só entrega texto salvo por ação médica", async () => {
  const salvar = vi.fn().mockImplementation(async p => ({ codigo: "NUTRICAO_MEDICA", contexto,
    rascunho: { draftId: "nut-SINTETICO", versao: 1, texto: p.texto, autor: "MEDICO-SINTETICO", salvoEm: "2026-10-26T12:00:00Z" }, assinado: false }));
  const usar = vi.fn(), api = apiCom({ nutricao: vi.fn().mockResolvedValue({ codigo: "NUTRICAO_MEDICA", contexto, rascunho: null, assinado: false }), salvarNutricao: salvar });
  render(<NutricaoMedica api={api} contexto={contexto} aoUsarOrientacao={usar} />);
  const texto = await screen.findByLabelText("Orientação dietética para revisão");
  await waitFor(() => expect((texto as HTMLTextAreaElement).disabled).toBe(false));
  expect((texto as HTMLTextAreaElement).value).toBe("");
  fireEvent.change(texto, { target: { value: "Orientação SINTETICA personalizada pelo médico." } });
  expect((screen.getByRole("button", { name: "Usar orientação na consulta" }) as HTMLButtonElement).disabled).toBe(true);
  fireEvent.click(screen.getByRole("button", { name: "Salvar orientação dietética" }));
  await screen.findByText("Orientação salva como rascunho, sem assinatura ou entrega ao paciente.");
  expect(usar).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Usar orientação na consulta" }));
  expect(usar).toHaveBeenCalledWith("Orientação SINTETICA personalizada pelo médico.");
});

it("correção cadastral exige motivo, preserva edição em falha e mantém chave no retry", async () => {
  const inicial = { codigo: "CADASTRO_MEDICO", contexto, eventId: "cadastro-SINTETICO-1", historico: [],
    paciente: { patientId: contexto.patientId, nome: "Paciente SINTETICO", nascimento: null, sexoCadastral: "NAO_INFORMADO", identificadores: [], divergencia: false } };
  const alterar = vi.fn().mockRejectedValueOnce(Error("REDE_INDISPONIVEL")).mockImplementationOnce(async p => ({ ...inicial, codigo: "GRAVADA",
    eventId: "cadastro-SINTETICO-2", paciente: { ...inicial.paciente, ...p.dados } }));
  const atualizou = vi.fn(), pendente = vi.fn(), api = apiCom({ paciente: vi.fn().mockResolvedValue(inicial), alterarPaciente: alterar });
  render(<CadastroMedico api={api} contexto={contexto} aoAtualizar={atualizou} aoAlterarPendente={pendente} />);
  const nome = await screen.findByLabelText("Nome cadastral");
  await waitFor(() => expect((nome as HTMLInputElement).value).toBe("Paciente SINTETICO"));
  fireEvent.change(nome, { target: { value: "Paciente SINTETICO Corrigido" } });
  expect(pendente).toHaveBeenLastCalledWith(true);
  expect((screen.getByRole("button", { name: "Confirmar correção cadastral" }) as HTMLButtonElement).disabled).toBe(true);
  fireEvent.change(screen.getByLabelText("Motivo da correção cadastral"), { target: { value: "Correção conferida SINTETICA" } });
  fireEvent.click(screen.getByRole("button", { name: "Confirmar correção cadastral" }));
  await screen.findByRole("alert");
  expect((nome as HTMLInputElement).value).toBe("Paciente SINTETICO Corrigido");
  fireEvent.click(screen.getByRole("button", { name: "Confirmar correção cadastral" }));
  await screen.findByText("Cadastro corrigido com histórico. Documentos e assinaturas anteriores foram preservados.");
  expect(alterar.mock.calls[0]![0].operationId).toBe(alterar.mock.calls[1]![0].operationId);
  expect(atualizou).toHaveBeenCalledWith("Paciente SINTETICO Corrigido");
});

it("resposta cadastral antiga não substitui o paciente selecionado depois", async () => {
  let resolver!: (value: unknown) => void;
  const tardia = new Promise(resolve => { resolver = resolve; });
  const b = { patientId: "SINTETICO-B", encounterId: "en-SINTETICO-B", tumorLotId: null };
  const api = apiCom({ paciente: vi.fn().mockImplementation(async c => c.patientId === contexto.patientId ? tardia : {
    codigo: "CADASTRO_MEDICO", contexto: b, eventId: "cadastro-B", historico: [], paciente: { patientId: b.patientId, nome: "Paciente B", nascimento: null, sexoCadastral: "NAO_INFORMADO", identificadores: [], divergencia: false },
  }) });
  const view = render(<CadastroMedico api={api} contexto={contexto} />);
  view.rerender(<CadastroMedico api={api} contexto={b} />);
  const nome = await screen.findByLabelText("Nome cadastral");
  resolver({ codigo: "CADASTRO_MEDICO", contexto, eventId: "cadastro-A", historico: [], paciente: { patientId: contexto.patientId, nome: "Paciente A" } });
  await waitFor(() => expect((nome as HTMLInputElement).value).toBe("Paciente B"));
});

it("agenda comunica edicao pendente e salvamento sem perder campos na falha", async () => {
  const pendente = vi.fn(), salvando = vi.fn();
  let rejeitar!: (e: Error) => void;
  const api = apiCom({ agenda: vi.fn().mockResolvedValue({ codigo: "AGENDA_MEDICA", itens: [], pacientes: [], retornos: [] }),
    cadastrar: vi.fn().mockImplementation(() => new Promise((_ok, erro) => { rejeitar = erro; })) });
  render(<AgendaMedica api={api} onSelecionar={vi.fn()} aoAlterarPendente={pendente} aoAlterarSalvando={salvando} />);
  fireEvent.click(screen.getByLabelText("Cadastrar novo paciente"));
  fireEvent.change(screen.getByLabelText("Nome do paciente"), { target: { value: "Paciente SINTETICO" } });
  expect(pendente).toHaveBeenLastCalledWith(true);
  fireEvent.click(screen.getByRole("button", { name: "Cadastrar e agendar" }));
  expect(salvando).toHaveBeenLastCalledWith(true);
  rejeitar(Error("REDE_INDISPONIVEL"));
  await screen.findByRole("alert");
  // O aviso renderiza antes de o efeito comunicar o fim da gravação ao pai.
  await waitFor(() => expect(salvando).toHaveBeenLastCalledWith(false));
  expect(pendente).toHaveBeenLastCalledWith(true);
});

it("cancelar outro encontro nao libera cadastro ainda nao salvo", async () => {
  const pendente = vi.fn();
  const api = apiCom({ agenda: vi.fn().mockResolvedValue({ codigo: "AGENDA_MEDICA", pacientes: [], retornos: [], itens: [
    { ...contexto, nome: "Pessoa ja cadastrada", eventId: "agenda-existente", data: "2026-10-29", horario: "10:00", cancelado: false, motivo: null, preConsulta: "AUSENTE" }
  ] }), alterarAgenda: vi.fn().mockResolvedValue({ codigo: "GRAVADA", contexto, eventId: "cancelamento" }) });
  render(<AgendaMedica api={api} onSelecionar={vi.fn()} aoAlterarPendente={pendente} />);
  await screen.findByRole("button", { name: "Remarcar ou cancelar" });
  fireEvent.click(screen.getByLabelText("Cadastrar novo paciente"));
  fireEvent.change(screen.getByLabelText("Nome do paciente"), { target: { value: "Novo SINTETICO nao salvo" } });
  fireEvent.change(screen.getByLabelText("Data do encontro"), { target: { value: "2026-11-20" } });
  fireEvent.change(screen.getByLabelText("Horário do encontro"), { target: { value: "15:45" } });
  fireEvent.click(screen.getByRole("button", { name: "Remarcar ou cancelar" }));
  fireEvent.change(screen.getByLabelText("Motivo da alteração"), { target: { value: "Pedido sintetico" } });
  fireEvent.click(screen.getByRole("button", { name: "Confirmar cancelamento do encontro" }));
  await screen.findByText("Encontro cancelado; prontuário e histórico preservados.");
  expect((screen.getByLabelText("Nome do paciente") as HTMLInputElement).value).toBe("Novo SINTETICO nao salvo");
  expect((screen.getByLabelText("Data do encontro") as HTMLInputElement).value).toBe("2026-11-20");
  expect((screen.getByLabelText("Horário do encontro") as HTMLInputElement).value).toBe("15:45");
  expect(pendente).toHaveBeenLastCalledWith(true);
});
