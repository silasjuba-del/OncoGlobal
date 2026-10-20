// @vitest-environment jsdom
// APAC e prescricao sinteticas; nenhuma emissao, exportacao ou autorizacao externa.
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { ApacRascunhoPreparadoSchema, BaseApacRascunhoRespostaSchema,
  type BaseApacRascunhoResposta, type EdicaoApacRascunho,
  type PrepararApacRascunhoPedido, type ConfirmarApacRascunhoPedido } from "../../src/contracts/api/apacRascunho.js";
import type { PortaConsulta } from "../../src/contracts/api/porta.js";
import { ConsultaPersistida } from "../../src/ui/consulta/ConsultaPersistida.js";
import { PrepararApacConsulta } from "../../src/ui/consulta/PrepararApacConsulta.js";
import { criarPortaFalsa } from "../../src/ui/api/fake.js";

afterEach(cleanup);

const contexto = { patientId: "pt-multi", encounterId: "en-multi", tumorLotId: "lot-multi-a" };
const apacFields = (): EdicaoApacRascunho["campos"] => ({
  procedimentoPrincipal: null, pacienteCns: null, nomeMae: null, nomeEstabelecimento: null,
  cnesSolicitante: null, solicitanteNome: null, solicitanteCns: null,
  justificativa: null, descricaoDiagnostico: null, quantidadePrincipal: null,
  pacienteNascimento: null, pacienteSexo: null,
});

function baseApac(overrides: Partial<BaseApacRascunhoResposta> = {}): BaseApacRascunhoResposta {
  return BaseApacRascunhoRespostaSchema.parse({
    contexto, revisao: "a".repeat(64),
    prescricao: { documentId: "documento-eRx-sintetico", documentVersion: 3,
      protocoloId: "Esquema sintetico A", dataPrevista: "2026-10-20" },
    sugestao: { competencia: "2026-10", campos: apacFields() },
    camposClinicos: [
      { chave: "cidPrincipal", rotulo: "CID do lote", valor: "C50" },
      { chave: "finalidadeApac", rotulo: "Finalidade do lote", valor: "PALIATIVA" },
      { chave: "prescricaoRef", rotulo: "Prescricao assinada", valor: "documento-eRx-sintetico · versao 3" },
    ],
    existentes: [], pendencias: ["SIGTAP da competencia 2026-10 indisponivel para validacao."],
    ...overrides,
  });
}

function prepared(pedido: PrepararApacRascunhoPedido): ReturnType<typeof ApacRascunhoPreparadoSchema.parse> {
  const base = baseApac();
  return ApacRascunhoPreparadoSchema.parse({
    contexto: pedido.contexto, draftId: "rascunho-apac-sintetico", revision: 1,
    conteudoHash: "b".repeat(64), baseHash: pedido.expectedBaseHash,
    apac: { apacId: "apac-sintetica", tumorLotId: contexto.tumorLotId,
      prescricaoAssinadaRef: { documentId: "documento-eRx-sintetico", documentVersion: 3 },
      dataGeracaoApp: "2026-10-20", competencia: pedido.edicao.competencia,
      campos: { cidPrincipal: "C50", finalidade: "PALIATIVA", qtEsquema: "Esquema sintetico A",
        ...pedido.edicao.campos }, estado: "RASCUNHO", resultadoExterno: null,
      versao: 1, substituiApacId: null },
    texto: "APAC RASCUNHO sintetica ligada a prescricao assinada.",
    pendencias: base.pendencias, avisos: [], permiteExportar: false,
  });
}

function fixture(options: { withPrescription?: boolean } = {}) {
  const porta = criarPortaFalsa();
  const sourceBase = baseApac();
  const source = options.withPrescription === false
    ? baseApac({ prescricao: null, camposClinicos: sourceBase.camposClinicos.map(field =>
      field.chave === "prescricaoRef" ? { ...field, valor: null } : field) })
    : sourceBase;
  const ler = vi.fn(async () => source);
  const preparar = vi.fn(async (pedido: PrepararApacRascunhoPedido) => prepared(pedido));
  const confirmar = vi.fn(async (_pedido: ConfirmarApacRascunhoPedido) => ({ codigo: "GRAVADA" as const, apacId: "apac-sintetica", versao: 1,
    eventId: "evento-apac-sintetico", estado: "RASCUNHO" as const, permiteExportar: false as const }));
  porta.lerBaseApacRascunho = ler;
  porta.prepararApacRascunho = preparar;
  porta.confirmarApacRascunho = confirmar;
  return { porta, source, ler, preparar, confirmar };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

it("abre APAC apenas com as tres operacoes da porta e liga o painel ao contexto atual", async () => {
  const f = fixture();
  render(<ConsultaPersistida porta={f.porta} contexto={contexto} />);
  const open = await screen.findByRole("button", { name: /Preparar APAC da prescr/ });
  fireEvent.click(open);
  expect(await screen.findByRole("region", { name: /APAC em rascunho/ })).toBeTruthy();
  await waitFor(() => expect(f.ler).toHaveBeenCalled());
});

it("mantem campos clinicos como fonte read-only, prepara preview exata e salva somente RASCUNHO", async () => {
  const f = fixture();
  render(<ConsultaPersistida porta={f.porta} contexto={contexto} />);
  fireEvent.click(await screen.findByRole("button", { name: /Preparar APAC da prescr/ }));
  const panel = await screen.findByRole("region", { name: /APAC em rascunho/ });
  await waitFor(() => expect(f.ler).toHaveBeenCalled());

  expect(panel.textContent).toContain("documento-eRx-sintetico");
  expect(panel.textContent).toContain("Esquema sintetico A");
  expect(panel.textContent).toContain("CID do lote");
  expect(panel.textContent).toContain("C50");
  expect(panel.textContent).toContain("Finalidade do lote");
  expect(panel.textContent).toContain("PALIATIVA");
  expect(panel.textContent).toContain("SIGTAP da competencia 2026-10 indisponivel para validacao.");
  expect(screen.queryByLabelText("CID do lote")).toBeNull();
  expect(screen.queryByLabelText("Finalidade do lote")).toBeNull();

  fireEvent.change(screen.getByLabelText("Procedimento principal"), { target: { value: "PROC-SINTETICO-01" } });
  fireEvent.change(screen.getByLabelText("Justificativa"), { target: { value: "Justificativa administrativa sintetica." } });
  fireEvent.click(screen.getByRole("button", { name: /Preparar.*exata da APAC/ }));
  await waitFor(() => expect(f.preparar).toHaveBeenCalledTimes(1));
  const pedido = f.preparar.mock.calls[0]![0];
  expect(pedido).toMatchObject({ contexto, expectedBaseHash: "a".repeat(64) });
  expect(pedido.edicao).toMatchObject({ competencia: "2026-10", campos: {
    procedimentoPrincipal: "PROC-SINTETICO-01", justificativa: "Justificativa administrativa sintetica.",
  } });
  expect(pedido.edicao.campos).not.toHaveProperty("cidPrincipal");
  expect(pedido.edicao).not.toHaveProperty("patientId");
  expect(pedido.edicao).not.toHaveProperty("prescricaoAssinadaRef");
  const preview = await screen.findByRole("region", { name: /exata da APAC/ });
  expect(preview.textContent).toContain("RASCUNHO");
  expect(preview.textContent).toMatch(/Permite exportar:\s*não/i);
  expect(f.confirmar).not.toHaveBeenCalled();
  expect(screen.queryByRole("button", { name: /Emitir APAC|Exportar APAC|Autorizar APAC/ })).toBeNull();

  fireEvent.click(screen.getByRole("button", { name: "Salvar APAC em rascunho" }));
  await waitFor(() => expect(f.confirmar).toHaveBeenCalledWith(expect.objectContaining({
    contexto, draftId: "rascunho-apac-sintetico", expectedRevision: 1, conteudoHash: "b".repeat(64),
    idempotencyKey: expect.any(String),
  })));
  expect(screen.getAllByRole("status").some(status => /RASCUNHO/.test(status.textContent ?? ""))).toBe(true);
  expect(f.confirmar.mock.calls[0]![0]).not.toHaveProperty("resultadoExterno");
});

it("sem prescricao assinada exibe pendencia e bloqueia preparo", async () => {
  const f = fixture({ withPrescription: false });
  render(<ConsultaPersistida porta={f.porta} contexto={contexto} />);
  fireEvent.click(await screen.findByRole("button", { name: /Preparar APAC da prescr/ }));
  const panel = await screen.findByRole("region", { name: /APAC em rascunho/ });
  expect(panel.textContent).toMatch(/prescrição assinada indisponível/i);
  expect((screen.getByRole("button", { name: /Preparar.*exata da APAC/ }) as HTMLButtonElement).disabled).toBe(true);
  expect(f.preparar).not.toHaveBeenCalled();
});

it("falha de preparo mantem campos editaveis e libera nova tentativa", async () => {
  const f = fixture();
  f.preparar.mockRejectedValueOnce(new Error("BASE_APAC_ALTERADA"));
  render(<ConsultaPersistida porta={f.porta} contexto={contexto} />);
  fireEvent.click(await screen.findByRole("button", { name: /Preparar APAC da prescr/ }));
  await screen.findByRole("region", { name: /APAC em rascunho/ });
  const campo = await screen.findByLabelText("Procedimento principal");
  fireEvent.change(campo, { target: { value: "PROC-ERRO-SINTETICO" } });
  fireEvent.click(screen.getByRole("button", { name: /Preparar.*exata da APAC/ }));
  expect(await screen.findByRole("alert")).toBeTruthy();
  expect((screen.getByLabelText("Procedimento principal") as HTMLInputElement).value).toBe("PROC-ERRO-SINTETICO");
  expect((screen.getByRole("button", { name: /Preparar.*exata da APAC/ }) as HTMLButtonElement).disabled).toBe(false);
});

it("edicao invalida a previa e troca de porta descarta a previa e recarrega a base", async () => {
  const primeira = fixture(), segunda = fixture();
  segunda.ler.mockResolvedValue(baseApac({ revisao: "f".repeat(64), sugestao: {
    competencia: "2026-11", campos: { ...apacFields(), procedimentoPrincipal: "PROC-NOVO-SINTETICO" },
  } }));
  const view = render(<PrepararApacConsulta porta={primeira.porta} contexto={contexto} aberto aoAtualizarClinico={vi.fn()} />);
  await screen.findByRole("region", { name: /APAC em rascunho/ });
  fireEvent.change(await screen.findByLabelText("Procedimento principal"), { target: { value: "PROC-ANTES-SINTETICO" } });
  fireEvent.click(screen.getByRole("button", { name: /Preparar.*exata da APAC/ }));
  expect(await screen.findByRole("region", { name: /exata da APAC/ })).toBeTruthy();

  fireEvent.change(screen.getByLabelText("Justificativa"), { target: { value: "Edicao apos previa." } });
  expect(screen.queryByRole("region", { name: /exata da APAC/ })).toBeNull();
  expect(screen.queryByRole("button", { name: "Salvar APAC em rascunho" })).toBeNull();
  expect(primeira.confirmar).not.toHaveBeenCalled();

  fireEvent.click(screen.getByRole("button", { name: /Preparar.*exata da APAC/ }));
  expect(await screen.findByRole("region", { name: /exata da APAC/ })).toBeTruthy();
  view.rerender(<PrepararApacConsulta porta={segunda.porta} contexto={contexto} aberto aoAtualizarClinico={vi.fn()} />);
  expect(segunda.ler).toHaveBeenCalled();
  expect(screen.queryByRole("region", { name: /exata da APAC/ })).toBeNull();
  const novoContexto = { ...contexto, encounterId: "encontro-apac-novo" };
  view.rerender(<PrepararApacConsulta porta={segunda.porta} contexto={novoContexto} aberto aoAtualizarClinico={vi.fn()} />);
  await waitFor(() => expect(segunda.ler).toHaveBeenCalledTimes(2));
  expect(screen.queryByRole("region", { name: /exata da APAC/ })).toBeNull();
});

it("ignora preparo que termina depois do fechamento e nao publica previa ao reabrir", async () => {
  const f = fixture();
  const pendente = deferred<ReturnType<typeof prepared>>();
  f.preparar.mockImplementation(() => pendente.promise);
  const view = render(<PrepararApacConsulta porta={f.porta} contexto={contexto} aberto aoAtualizarClinico={vi.fn()} />);
  await screen.findByLabelText("Procedimento principal");

  fireEvent.click(screen.getByRole("button", { name: /Preparar.*exata da APAC/ }));
  expect(f.preparar).toHaveBeenCalledTimes(1);
  view.rerender(<PrepararApacConsulta porta={f.porta} contexto={contexto} aberto={false} aoAtualizarClinico={vi.fn()} />);
  await act(async () => { pendente.resolve(prepared(f.preparar.mock.calls[0]![0])); });
  view.rerender(<PrepararApacConsulta porta={f.porta} contexto={contexto} aberto aoAtualizarClinico={vi.fn()} />);

  expect(screen.queryByRole("region", { name: /exata da APAC/ })).toBeNull();
  expect((screen.getByRole("button", { name: /Preparar.*exata da APAC/ }) as HTMLButtonElement).disabled).toBe(false);
});

it("ignora confirmação que termina depois do unmount sem chamar atualização clínica", async () => {
  const f = fixture();
  const aoAtualizarClinico = vi.fn();
  const pendente = deferred<Awaited<ReturnType<NonNullable<typeof f.porta.confirmarApacRascunho>>>>();
  f.confirmar.mockImplementation(() => pendente.promise);
  const view = render(<PrepararApacConsulta porta={f.porta} contexto={contexto} aberto aoAtualizarClinico={aoAtualizarClinico} />);
  await screen.findByLabelText("Procedimento principal");
  fireEvent.click(screen.getByRole("button", { name: /Preparar.*exata da APAC/ }));
  await screen.findByRole("region", { name: /exata da APAC/ });
  fireEvent.click(screen.getByRole("button", { name: "Salvar APAC em rascunho" }));
  expect(f.confirmar).toHaveBeenCalledTimes(1);

  view.unmount();
  await act(async () => { pendente.resolve({ codigo: "GRAVADA", apacId: "apac-sintetica", versao: 1,
    eventId: "evento-apac-sintetico", estado: "RASCUNHO", permiteExportar: false }); });

  expect(aoAtualizarClinico).not.toHaveBeenCalled();
});

it("fechar e reabrir durante a carga ignora resposta antiga e libera a nova base", async () => {
  const f = fixture();
  const cargaAntiga = deferred<BaseApacRascunhoResposta>();
  const cargaNova = deferred<BaseApacRascunhoResposta>();
  f.ler.mockImplementationOnce(() => cargaAntiga.promise).mockImplementationOnce(() => cargaNova.promise);
  const view = render(<PrepararApacConsulta porta={f.porta} contexto={contexto} aberto aoAtualizarClinico={vi.fn()} />);
  expect(f.ler).toHaveBeenCalledTimes(1);
  view.rerender(<PrepararApacConsulta porta={f.porta} contexto={contexto} aberto={false} aoAtualizarClinico={vi.fn()} />);
  view.rerender(<PrepararApacConsulta porta={f.porta} contexto={contexto} aberto aoAtualizarClinico={vi.fn()} />);
  expect(f.ler).toHaveBeenCalledTimes(2);

  await act(async () => { cargaAntiga.resolve(baseApac({ revisao: "c".repeat(64) })); });
  expect(screen.queryByLabelText("Procedimento principal")).toBeNull();
  await act(async () => { cargaNova.resolve(baseApac({ revisao: "d".repeat(64) })); });

  expect((await screen.findByLabelText("Procedimento principal") as HTMLInputElement).value).toBe("");
  expect((screen.getByRole("button", { name: /Preparar.*exata da APAC/ }) as HTMLButtonElement).disabled).toBe(false);
});
