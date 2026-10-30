// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { OncoassistLocal } from "../../../src/ui/OncoassistLocal.js";
import { ConsultaPersistida } from "../../../src/ui/consulta/ConsultaPersistida.js";
import { criarPortaFalsa, ID } from "../../../src/ui/api/fake.js";
import { ConsultaResposta } from "../../../src/ui/api/respostas.js";
import { FonteRevisao, RevisaoPreparada } from "../../../src/ui/api/revisaoExtracao.js";
import type { ConsultaVisao, PedidoBundle, PortaConsulta } from "../../../src/ui/api/porta.js";
import type { Retrato } from "../../../src/contracts/f1/retrato.js";
import type { VisaoIntegrada } from "../../../src/contracts/f1/visaoIntegrada.js";
import { usarEsperaDeJornadaHttpCompleta } from "../../fixtures/espera-jornada-http.js";
usarEsperaDeJornadaHttpCompleta();

afterEach(cleanup);
const antiga = "Nenhum resultado laboratorial confirmado.";
const nova = "Hemoglobina revisada: 9 g/dL.";
const geradoAntes = "2026-10-12T08:00:00-03:00";
const geradoDepois = "2026-10-12T08:10:00-03:00";
type Confirmacao = Awaited<ReturnType<NonNullable<PortaConsulta["confirmarRevisaoExtracao"]>>>;

function adiada<T>() {
  let resolve!: (valor: T) => void;
  let reject!: (erro: Error) => void;
  const promise = new Promise<T>((sim, nao) => { resolve = sim; reject = nao; });
  return { promise, resolve, reject };
}

function comVisao(base: ConsultaVisao, confirmada: boolean) {
  const { patientId, encounterId, tumorLotId } = base;
  const ref = { eventId: "lab-revisado-sintetico", revisao: "revisao-lab" };
  const retrato: Retrato = {
    schema: "Retrato@1", patientId, encounterId, tumorLotId, revisao: confirmada ? "depois" : "antes",
    versaoProjecao: "1", geradoEm: confirmada ? geradoDepois : geradoAntes, regras: [],
    biblioteca: { id: "sintetica", versao: "1", hash: "hash-biblioteca" }, integridade: [],
    delta: { encounterAnteriorId: null, novos: [], substituidos: [] },
    fatos: confirmada ? [{ ref, tipo: "FATO", campo: "extracao.lab:HB", patientId, encounterId, tumorLotId,
      escopo: "PACIENTE", tempoClinico: "2026-10-12", tempoRegistro: geradoDepois, dados: { valor: 9 },
      fontes: [{ sourceId: "lab-sintetico", classe: "LAB_FEED", localizador: "página 1",
        dataClinica: "2026-10-12", dataCaptura: geradoAntes, versao: "1", contentHash: "hash-fonte" }] }] : [],
    resumo: confirmada ? [{ texto: nova, fatos: [ref] }] : [],
  };
  const visaoIntegrada: VisaoIntegrada = {
    schema: "VisaoIntegrada@1", correlacao: { patientId, encounterId, tumorLotId, operationId: "visao-sintetica",
      revisaoFatos: retrato.revisao, regras: retrato.regras, biblioteca: retrato.biblioteca, proposta: null },
    achados: [], lacunas: confirmada ? [] : [{ codigo: "LAB_AUSENTE", texto: antiga, setor: "LABORATORIO", fatos: [] }],
    cobertura: { setoresEsperados: ["LABORATORIO"], setoresAvaliados: confirmada ? ["LABORATORIO"] : [],
      avaliados: confirmada ? 1 : 0, semRegraAprovada: 0 },
  };
  return ConsultaResposta.parse({ ...base, retrato, visaoIntegrada });
}

async function fixture(codigo: Confirmacao["codigo"] = "GRAVADA") {
  const porta = criarPortaFalsa();
  const carregarOriginal = porta.carregarConsulta.bind(porta);
  const agenda = await porta.agendaDoDia();
  const entrada = agenda.itens.find((p) => p.patientId === ID.multi)!;
  const outra = agenda.itens.find((p) => p.patientId === ID.verde)!;
  const base = await carregarOriginal(entrada.patientId, undefined, entrada.encounterId);
  const contexto: PedidoBundle = { patientId: base.patientId, encounterId: base.encounterId, tumorLotId: base.tumorLotId };
  const outroEncontro = { ...entrada, encounterId: "outro-encontro-mesmo-paciente" };
  const fonte = FonteRevisao.parse({ draft: { draftId: "draft-lab-sintetico", patientId: contexto.patientId, revision: 1,
    payload: { kind: "EXTRACAO_RASCUNHO", input: { sourceId: "lab-sintetico", rawTranscript: "Hb 9 g/dL em 12/10/2026" },
      patientLinkReview: contexto, state: { facts: [{ id: "fato-hb", segmentId: "segmento-lab", patientCandidateId: contexto.patientId,
        domain: "lab", value: { valor: 9 }, sourceType: "lab_feed", evidence: "EXPLICIT", sourceId: "lab-sintetico",
        rawEvidence: "Hb 9 g/dL", confidence: 1, requiresConfirmation: false }] } } } });
  const preparada = RevisaoPreparada.parse({ codigo: "REVISAO_PREPARADA", criaEventoClinico: false,
    conteudo: { kind: "EVOLUCAO_RASCUNHO", status: "RASCUNHO", resumo: "Achado sintético selecionado para revisão.",
      contexto, selectedFactIds: ["fato-hb"], facts: fonte.draft.payload.state.facts },
    comprovanteExibicao: { documentId: "documento-revisao", documentVersion: 1, conteudoHash: "a".repeat(64) } });
  let confirmada = false;
  const snapshot = async (revisada: boolean) => comVisao(await carregarOriginal(contexto.patientId, contexto.tumorLotId, contexto.encounterId), revisada);
  const carregar = vi.fn<PortaConsulta["carregarConsulta"]>(async (p, t, e) => {
    const dados = e === outroEncontro.encounterId ? { ...base, encounterId: e } : await carregarOriginal(p, t, e);
    return comVisao(dados, confirmada && p === contexto.patientId && e === contexto.encounterId);
  });
  const confirmar = vi.fn<NonNullable<PortaConsulta["confirmarRevisaoExtracao"]>>(async () => { confirmada = true; return { codigo }; });
  const preparar = vi.fn<NonNullable<PortaConsulta["prepararRevisaoExtracao"]>>(async () => preparada);
  porta.login = vi.fn(async () => ({ ok: true, expiraEm: null }));
  porta.agendaDoDia = async () => ({ ...agenda, itens: [entrada, outra, outroEncontro] });
  porta.carregarConsulta = carregar;
  porta.oncoassistFontes = async (ctx) => ({ fontes: ctx.encounterId === contexto.encounterId
    ? [{ draftId: fonte.draft.draftId, rotulo: "Laboratório sintético", criadoEm: geradoAntes }] : [] });
  porta.carregarFonteRevisao = async () => fonte;
  porta.prepararRevisaoExtracao = preparar;
  porta.confirmarRevisaoExtracao = confirmar;
  porta.oncoassistStatus = async () => ({ status: "PENDENTE" });
  const assinar = vi.spyOn(porta, "confirmar");
  const fabrica = vi.fn(() => porta);
  return { porta, fabrica, contexto, outra, outroEncontro, carregar, confirmar, preparar, preparada, fonte, snapshot, assinar };
}

async function abrir(f: Awaited<ReturnType<typeof fixture>>) {
  render(<OncoassistLocal fabricaPorta={f.fabrica} />);
  fireEvent.change(screen.getByLabelText("Senha do servidor"), { target: { value: "senha-sintetica-para-teste" } });
  fireEvent.click(screen.getByRole("button", { name: "Entrar" }));
  fireEvent.change(await screen.findByLabelText("Paciente da agenda"), { target: { value: f.contexto.encounterId } });
  await screen.findByRole("button", { name: "Reabrir histórico" });
  expect(screen.getByRole("region", { name: "Visão clínica integrada" }).textContent).toContain(antiga);
}

async function prepararRevisao(f: Awaited<ReturnType<typeof fixture>>) {
  await screen.findByRole("option", { name: "Laboratório sintético" });
  fireEvent.change(screen.getByLabelText("Fonte para revisão"), { target: { value: f.fonte.draft.draftId } });
  const achado = await screen.findByRole("checkbox", { name: "Hb 9 g/dL — EXPLICIT" });
  fireEvent.click(achado);
  fireEvent.click(screen.getByRole("button", { name: "Preparar revisão" }));
  return screen.findByRole("button", { name: "Confirmar revisão exibida" });
}

it.each(["GRAVADA", "REPLAY"] as const)("%s atualiza automaticamente, oculta visão antiga na recarga e preserva rascunho salvo", async (codigo) => {
  const f = await fixture(codigo);
  await abrir(f);
  fireEvent.click(screen.getByRole("button", { name: "Consulta Flash" }));
  fireEvent.change(screen.getByLabelText("Prazo do retorno em dias"), { target: { value: "47" } });
  fireEvent.click(screen.getByRole("button", { name: "SALVAR RASCUNHO" }));
  await screen.findByText("Rascunho salvo; sem assinatura.");
  const botao = await prepararRevisao(f);
  const chamadasAntes = f.carregar.mock.calls.length;
  const recarga = adiada<ConsultaVisao>();
  f.carregar.mockImplementationOnce(() => recarga.promise);
  fireEvent.click(botao);
  await screen.findByText(/Revisão registrada/);
  // A confirmação e o efeito de recarga são commits distintos do React.
  await waitFor(() => expect(f.carregar).toHaveBeenCalledTimes(chamadasAntes + 1));
  expect(f.carregar).toHaveBeenLastCalledWith(f.contexto.patientId, f.contexto.tumorLotId, f.contexto.encounterId);
  const consulta = screen.getByRole("region", { name: "Consulta persistida" });
  await waitFor(() => expect(consulta.textContent).toContain("Carregando consulta persistida"));
  expect(consulta.textContent).not.toContain(antiga);
  expect(consulta.textContent).not.toContain(geradoAntes);
  expect(within(consulta).queryByRole("region", { name: "Visão clínica integrada" })).toBeNull();
  await act(async () => recarga.resolve(await f.snapshot(true)));
  await screen.findByText(nova);
  expect(screen.getByRole("region", { name: "Visão clínica integrada" }).textContent).toContain(geradoDepois);
  expect(f.confirmar).toHaveBeenCalledTimes(1);
  expect(f.confirmar.mock.calls[0]?.[0]).toEqual({ ...f.preparar.mock.calls[0]?.[0], comprovanteExibicao: f.preparada.comprovanteExibicao });
  expect(f.assinar).not.toHaveBeenCalled();
  expect(f.fabrica).toHaveBeenCalledTimes(1);
  expect(f.porta.login).toHaveBeenCalledTimes(1);
  fireEvent.click(screen.getByRole("button", { name: "Consulta Flash" }));
  expect((screen.getByLabelText("Prazo do retorno em dias") as HTMLInputElement).value).toBe("47");
});

it.each(["rejeitada", "codigo-invalido"])("confirmação %s não anuncia sucesso nem invalida a consulta", async (falha) => {
  const f = await fixture();
  if (falha === "rejeitada") f.confirmar.mockRejectedValueOnce(new Error("FALHA_DE_REDE"));
  else f.confirmar.mockResolvedValueOnce({ codigo: "PENDENTE" } as unknown as Confirmacao);
  await abrir(f);
  const botao = await prepararRevisao(f);
  const chamadasAntes = f.carregar.mock.calls.length;
  fireEvent.click(botao);
  await screen.findByText(/A operação não foi concluída/);
  expect(screen.queryByText(/Revisão registrada/)).toBeNull();
  expect(f.carregar).toHaveBeenCalledTimes(chamadasAntes);
  expect(screen.getByRole("region", { name: "Visão clínica integrada" }).textContent).toContain(antiga);
});

it.each(["paciente", "encontro"] as const)("confirmação tardia após troca de %s não recarrega o novo contexto", async (troca) => {
  const f = await fixture();
  const resposta = adiada<Confirmacao>();
  f.confirmar.mockImplementationOnce(() => resposta.promise);
  await abrir(f);
  fireEvent.click(await prepararRevisao(f));
  await waitFor(() => expect(f.confirmar).toHaveBeenCalledTimes(1));
  const destino = troca === "paciente" ? f.outra : f.outroEncontro;
  fireEvent.change(screen.getByLabelText("Paciente da agenda"), { target: { value: destino.encounterId } });
  await screen.findByRole("button", { name: "Reabrir histórico" });
  const chamadasAntes = f.carregar.mock.calls.length;
  await act(async () => resposta.resolve({ codigo: "GRAVADA" }));
  expect(f.carregar).toHaveBeenCalledTimes(chamadasAntes);
  expect(screen.queryByText(/Revisão registrada/)).toBeNull();
  expect(screen.getByRole("region", { name: "Visão clínica integrada" }).textContent).toContain(`consulta ${destino.encounterId}`);
  expect(screen.queryByText(nova)).toBeNull();
});

it("recarga tardia do paciente anterior não substitui a visão do paciente atual", async () => {
  const f = await fixture();
  await abrir(f);
  const botao = await prepararRevisao(f);
  const recarga = adiada<ConsultaVisao>();
  const atual = f.carregar.getMockImplementation();
  if (!atual) throw new Error("CARREGAR_SEM_IMPLEMENTACAO");
  let pendurar = true;
  f.carregar.mockImplementation(async (p, t, e) => {
    if (pendurar && p === f.contexto.patientId && e === f.contexto.encounterId) {
      pendurar = false;
      return recarga.promise;
    }
    return atual(p, t, e);
  });
  const chamadasAntes = f.carregar.mock.calls.length;
  fireEvent.click(botao);
  await waitFor(() => expect(f.carregar.mock.calls.length).toBeGreaterThan(chamadasAntes));
  expect(f.carregar).toHaveBeenLastCalledWith(f.contexto.patientId, f.contexto.tumorLotId, f.contexto.encounterId);
  fireEvent.change(screen.getByLabelText("Paciente da agenda"), { target: { value: f.outra.encounterId } });
  await waitFor(() => expect(screen.queryByText("Abrindo consulta…")).toBeNull());
  await screen.findByRole("button", { name: "Reabrir histórico" });
  await act(async () => recarga.resolve(await f.snapshot(true)));
  expect(screen.getByRole("region", { name: "Visão clínica integrada" }).textContent).toContain(`Paciente ${f.outra.patientId}`);
  expect(screen.queryByText(nova)).toBeNull();
});

it("falha da recarga mantém visão invalidada em vez de reapresentar dados antigos", async () => {
  const f = await fixture();
  await abrir(f);
  const botao = await prepararRevisao(f);
  f.carregar.mockRejectedValueOnce(new Error("FALHA_RECARGA"));
  fireEvent.click(botao);
  await screen.findByText("Não foi possível carregar a consulta persistida.");
  expect(screen.getByRole("region", { name: "Consulta persistida" }).textContent).not.toContain(antiga);
  expect(screen.queryByRole("region", { name: "Visão clínica integrada" })).toBeNull();
});

it("uma recarga antiga do mesmo contexto não vence a versão clínica mais recente", async () => {
  const f = await fixture();
  const tela = render(<ConsultaPersistida porta={f.porta} contexto={f.contexto} versaoClinica={0} />);
  await screen.findByRole("button", { name: "Reabrir histórico" });
  const atrasada = adiada<ConsultaVisao>();
  f.carregar.mockImplementationOnce(() => atrasada.promise);
  tela.rerender(<ConsultaPersistida porta={f.porta} contexto={f.contexto} versaoClinica={1} />);
  expect(screen.queryByRole("region", { name: "Visão clínica integrada" })).toBeNull();
  f.carregar.mockResolvedValueOnce(await f.snapshot(true));
  tela.rerender(<ConsultaPersistida porta={f.porta} contexto={f.contexto} versaoClinica={2} />);
  await screen.findByText(nova);
  await act(async () => atrasada.resolve(await f.snapshot(false)));
  expect(screen.getByRole("region", { name: "Visão clínica integrada" }).textContent).toContain(geradoDepois);
  expect(screen.queryByText(nova)).toBeTruthy();
});

it("refresh após revisão preserva a edição Flash não salva e só a reexibe com dados atualizados", async () => {
  const f = await fixture(); await abrir(f);
  fireEvent.click(screen.getByRole("button", { name: "Consulta Flash" }));
  const prazo = screen.getByLabelText("Prazo do retorno em dias") as HTMLInputElement;
  fireEvent.change(prazo, { target: { value: "63" } });
  fireEvent.change(screen.getByLabelText("Outros LAB"), { target: { value: "Exame sintético preservado" } });
  const medicamento = screen.getByLabelText("Medicamento da receita") as HTMLInputElement;
  fireEvent.change(medicamento, { target: { value: "Medicamento sintético manual" } });
  fireEvent.change(screen.getByLabelText("Dose da receita"), { target: { value: "Dose escrita pelo médico" } });
  fireEvent.click(screen.getByRole("checkbox", { name: "Incluir receita digitada" }));
  const confirmar = await prepararRevisao(f), recarga = adiada<ConsultaVisao>();
  f.carregar.mockImplementationOnce(() => recarga.promise);
  fireEvent.click(confirmar); await screen.findByText(/Revisão registrada/);
  expect(screen.queryByRole("region", { name: "Conteúdo da Consulta Flash" })).toBeNull();
  expect(prazo.isConnected).toBe(true);
  await act(async () => recarga.resolve(await f.snapshot(true)));
  await screen.findByText(nova);
  expect(screen.getByLabelText("Prazo do retorno em dias")).toBe(prazo);
  expect(prazo.value).toBe("63");
  expect((screen.getByLabelText("Outros LAB") as HTMLInputElement).value).toBe("Exame sintético preservado");
  expect(screen.getByLabelText("Medicamento da receita")).toBe(medicamento);
  expect(medicamento.value).toBe("Medicamento sintético manual");
  expect((screen.getByLabelText("Dose da receita") as HTMLInputElement).value).toBe("Dose escrita pelo médico");
  expect((screen.getByRole("checkbox", { name: "Incluir receita digitada" }) as HTMLInputElement).checked).toBe(true);
});

it.each(["erro", "negada"])("refresh durante impressão %s conserva retry e chave sem reassinar", async (falha) => {
  const f = await fixture(); await abrir(f);
  const confirmarRevisao = await prepararRevisao(f);
  fireEvent.click(screen.getByRole("button", { name: "Consulta Flash" }));
  fireEvent.click(screen.getByRole("button", { name: "Revisar documentos para assinatura" }));
  const assinar = await screen.findByRole("button", { name: "Confirmar e assinar conteúdo exibido" });
  const resposta = adiada<Awaited<ReturnType<PortaConsulta["acao"]>>>();
  const acao = vi.fn<PortaConsulta["acao"]>().mockImplementationOnce(() => resposta.promise)
    .mockResolvedValue({ codigo: "IMPRIMIR", decisao: "EXECUTADA" });
  f.porta.acao = acao;
  fireEvent.click(assinar);
  await waitFor(() => expect(acao).toHaveBeenCalledTimes(1));
  fireEvent.click(confirmarRevisao); await screen.findByText(nova);
  await act(async () => { if (falha === "erro") resposta.reject(new Error("IMPRESSAO_FALHOU"));
    else resposta.resolve({ codigo: "IMPRESSAO_NEGADA", decisao: "NEGADA" }); });
  const repetir = await screen.findByRole("button", { name: "Solicitar impressão novamente" });
  await waitFor(() => expect((repetir as HTMLButtonElement).disabled).toBe(false));
  fireEvent.click(repetir);
  await waitFor(() => expect(acao).toHaveBeenCalledTimes(2));
  expect(acao.mock.calls[1]?.[0]).toEqual(acao.mock.calls[0]?.[0]);
  expect(f.assinar).toHaveBeenCalledTimes(1);
});

it("preparação em voo fica obsoleta após revisão e a próxima prévia usa a nova versão com edição preservada", async () => {
  const f = await fixture(); await abrir(f);
  const confirmarRevisao = await prepararRevisao(f);
  const prepararOriginal = f.porta.prepararFinalizacaoFlash!.bind(f.porta);
  const atrasada = adiada<Awaited<ReturnType<typeof prepararOriginal>>>();
  let respostaAntiga: Awaited<ReturnType<typeof prepararOriginal>> | undefined;
  const prepararFlash = vi.fn(prepararOriginal).mockImplementationOnce(async (pedido) => {
    respostaAntiga = await prepararOriginal(pedido); return atrasada.promise;
  });
  f.porta.prepararFinalizacaoFlash = prepararFlash;
  fireEvent.click(screen.getByRole("button", { name: "Consulta Flash" }));
  fireEvent.change(screen.getByLabelText("Prazo do retorno em dias"), { target: { value: "64" } });
  fireEvent.click(screen.getByRole("button", { name: "Revisar documentos para assinatura" }));
  await waitFor(() => expect(respostaAntiga).toBeDefined());
  fireEvent.click(confirmarRevisao); await screen.findByText(nova);
  await act(async () => atrasada.resolve(respostaAntiga!));
  expect(screen.queryByRole("region", { name: "Conteúdo para assinatura" })).toBeNull();
  expect((screen.getByLabelText("Prazo do retorno em dias") as HTMLInputElement).value).toBe("64");
  fireEvent.click(screen.getByRole("button", { name: "Revisar documentos para assinatura" }));
  await screen.findByRole("region", { name: "Conteúdo para assinatura" });
  expect(prepararFlash).toHaveBeenCalledTimes(2);
  expect(prepararFlash.mock.calls[1]?.[0].idempotencyKey).not.toBe(prepararFlash.mock.calls[0]?.[0].idempotencyKey);
  expect(prepararFlash.mock.calls[1]?.[0].plano.retorno.dias).toBe(64);
});

it("falha tardia de impressão após troca de paciente não oferece retry no contexto novo", async () => {
  const f = await fixture(); await abrir(f);
  fireEvent.click(screen.getByRole("button", { name: "Consulta Flash" }));
  fireEvent.click(screen.getByRole("button", { name: "Revisar documentos para assinatura" }));
  const resposta = adiada<Awaited<ReturnType<PortaConsulta["acao"]>>>();
  const acao = vi.fn<PortaConsulta["acao"]>(() => resposta.promise); f.porta.acao = acao;
  fireEvent.click(await screen.findByRole("button", { name: "Confirmar e assinar conteúdo exibido" }));
  await waitFor(() => expect(acao).toHaveBeenCalledTimes(1));
  fireEvent.change(screen.getByLabelText("Paciente da agenda"), { target: { value: f.outra.encounterId } });
  await screen.findByRole("button", { name: "Reabrir histórico" });
  await act(async () => resposta.reject(new Error("IMPRESSAO_ANTIGA_FALHOU")));
  expect(screen.queryByRole("button", { name: "Solicitar impressão novamente" })).toBeNull();
  expect(screen.getByRole("region", { name: "Visão clínica integrada" }).textContent).toContain(`Paciente ${f.outra.patientId}`);
  expect(acao).toHaveBeenCalledTimes(1);
});
