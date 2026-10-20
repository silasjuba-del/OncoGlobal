// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { ConsultaFlash, type ConsultaFlashProps, type PlanoFlash } from "../../../src/ui/consulta/ConsultaFlash.js";
import { ConsultaPersistida } from "../../../src/ui/consulta/ConsultaPersistida.js";
import { criarPortaHttp } from "../../../src/ui/api/http.js";
import { abrirAmbiente, cadastrarPaciente, criarDiretorio, removerDiretorio, PACIENTE, ENCONTRO, SENHA } from "../../f0-fecha/fixtures/consulta-completa.js";

let ambiente: Awaited<ReturnType<typeof abrirAmbiente>> | undefined;
afterEach(async () => { cleanup(); vi.unstubAllGlobals(); if (ambiente) { await ambiente.close(); removerDiretorio(ambiente.dir); ambiente = undefined; } });
const receitas = [
  { id: "manual-a", medicamento: "Medicamento sintético A", dose: "Dose escrita A", orientacao: null, duracao: "Prazo escrito A", via: null, quantidade: null },
  { id: "manual-b", medicamento: "Medicamento sintético B", dose: null, orientacao: "Orientação escrita B", duracao: null, via: "Via escrita B", quantidade: "Quantidade escrita B" },
];
const plano: PlanoFlash = { acoesMarcadas: [], receitasMarcadas: ["manual-a"], receitas,
  apac: { cid: "", sigtap: "", finalidade: "", competencia: "", estado: "PENDENTE", pendencias: [], emitir: false },
  retorno: { dias: 14, examesAntesDoRetorno: [] }, solicitacoes: { laboratorio: [], imagem: [] },
  decisaoQt: { solicitarCiclo: false, data: null } };
const props = (salvar: (p: PlanoFlash) => void, inicial = plano): ConsultaFlashProps => ({ cabecalho: {}, exames: [],
  acoesHoje: [], receitas: [], apac: inicial.apac, iaFala: [], retorno: inicial.retorno, planoInicial: inicial,
  aoSalvarRascunho: salvar, aoFinalizar: vi.fn() });

it("salvar e reabrir preserva todas as receitas, inclusive não selecionadas e campos não ditos", () => {
  const salvar = vi.fn<(p: PlanoFlash) => void>();
  render(<ConsultaFlash {...props(salvar)} />);
  expect((screen.getByLabelText("Medicamento da receita 2") as HTMLInputElement).value).toBe(receitas[1]!.medicamento);
  expect((screen.getByLabelText("Dose da receita 2") as HTMLInputElement).value).toBe("");
  fireEvent.change(screen.getByLabelText("Orientação / posologia da receita 2"), { target: { value: "Orientação revisada B" } });
  fireEvent.click(screen.getByRole("button", { name: "SALVAR RASCUNHO" }));
  const salvo = salvar.mock.calls[0]![0];
  expect(salvo.receitas).toEqual([receitas[0], { ...receitas[1], orientacao: "Orientação revisada B" }]);
  expect(salvo.receitasMarcadas).toEqual(["manual-a"]);
  cleanup(); render(<ConsultaFlash {...props(salvar, salvo)} />);
  expect((screen.getByLabelText("Medicamento da receita") as HTMLInputElement).value).toBe(receitas[0]!.medicamento);
  expect((screen.getByLabelText("Orientação / posologia da receita 2") as HTMLInputElement).value).toBe("Orientação revisada B");
  expect((screen.getByLabelText("Via da receita") as HTMLInputElement).value).toBe("");
  expect((screen.getByRole("checkbox", { name: "Incluir receita digitada 2" }) as HTMLInputElement).checked).toBe(false);
});

it("desmarcar mantém o conteúdo; remover apaga apenas a linha escolhida explicitamente", () => {
  const salvar = vi.fn<(p: PlanoFlash) => void>();
  render(<ConsultaFlash {...props(salvar)} />);
  fireEvent.click(screen.getByRole("checkbox", { name: "Incluir receita digitada" }));
  fireEvent.click(screen.getByRole("button", { name: "SALVAR RASCUNHO" }));
  expect(salvar.mock.calls[0]![0].receitas).toEqual(receitas);
  expect(salvar.mock.calls[0]![0].receitasMarcadas).toEqual([]);
  fireEvent.click(screen.getByRole("button", { name: "Remover receita 1" }));
  fireEvent.click(screen.getByRole("button", { name: "SALVAR RASCUNHO" }));
  expect(salvar.mock.calls[1]![0].receitas).toEqual([receitas[1]]);
});

it("acrescenta outra receita sem completar campos e não descarta linha editada sem medicamento", () => {
  const salvar = vi.fn<(p: PlanoFlash) => void>();
  render(<ConsultaFlash {...props(salvar, { ...plano, receitas: [], receitasMarcadas: [] })} />);
  fireEvent.change(screen.getByLabelText("Medicamento da receita"), { target: { value: "Primeiro literal" } });
  fireEvent.click(screen.getByRole("checkbox", { name: "Incluir receita digitada" }));
  fireEvent.click(screen.getByRole("button", { name: "Adicionar medicamento" }));
  fireEvent.change(screen.getByLabelText("Dose da receita 2"), { target: { value: "Dose ainda sem nome" } });
  expect((screen.getByRole("button", { name: "SALVAR RASCUNHO" }) as HTMLButtonElement).disabled).toBe(true);
  expect(screen.getByRole("alert").textContent).toContain("Informe o medicamento ou remova a linha");
  fireEvent.change(screen.getByLabelText("Medicamento da receita 2"), { target: { value: "Segundo literal" } });
  fireEvent.click(screen.getByRole("checkbox", { name: "Incluir receita digitada 2" }));
  fireEvent.click(screen.getByRole("button", { name: "SALVAR RASCUNHO" }));
  expect(salvar.mock.calls[0]![0].receitas).toMatchObject([
    { medicamento: "Primeiro literal", dose: null, via: null, quantidade: null },
    { medicamento: "Segundo literal", dose: "Dose ainda sem nome", via: null, quantidade: null },
  ]);
  expect(salvar.mock.calls[0]![0].receitasMarcadas).toHaveLength(2);
});

it("HTTP/SQLite: rascunho com duas receitas atravessa edição, salvar, reabrir e prévia integral", async () => {
  ambiente = await abrirAmbiente(criarDiretorio()); cadastrarPaciente(ambiente);
  const transporte = globalThis.fetch, baseUrl = ambiente.baseUrl;
  vi.stubGlobal("fetch", (input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]) =>
    transporte(typeof input === "string" && input.startsWith("/") ? `${baseUrl}${input}` : input, init));
  const porta = criarPortaHttp({ onSessaoExpirada: () => { throw new Error("SESSAO_EXPIRADA"); } });
  expect((await porta.login(SENHA)).ok).toBe(true);
  const contexto = { patientId: PACIENTE, encounterId: ENCONTRO, tumorLotId: null };
  await porta.carregarConsulta(PACIENTE, null, ENCONTRO);
  await porta.salvarRascunhoFlash!({ ...contexto, expectedRevision: null, plano: { ...plano, receitasMarcadas: receitas.map(r => r.id) } });
  render(<ConsultaPersistida porta={porta} contexto={contexto} />);
  fireEvent.click(await screen.findByRole("button", { name: "Consulta Flash" }, { timeout: 10_000 }));
  expect((screen.getByLabelText("Medicamento da receita 2") as HTMLInputElement).value).toBe(receitas[1]!.medicamento);
  fireEvent.change(screen.getByLabelText("Orientação / posologia da receita 2"), { target: { value: "Orientação B revisada pela UI" } });
  fireEvent.click(screen.getByRole("button", { name: "SALVAR RASCUNHO" }));
  await screen.findByText("Rascunho salvo; sem assinatura.", {}, { timeout: 10_000 });
  const salvo = await porta.carregarConsulta(PACIENTE, null, ENCONTRO);
  expect(salvo.flash?.rascunho?.plano?.receitas).toEqual([receitas[0], { ...receitas[1], orientacao: "Orientação B revisada pela UI" }]);
  cleanup(); render(<ConsultaPersistida porta={porta} contexto={contexto} />);
  fireEvent.click(await screen.findByRole("button", { name: "Consulta Flash" }, { timeout: 10_000 }));
  // Decisão do Dr. Silas em 19/10: dose ausente continua minuta, inclusive após reabrir.
  expect((screen.getByRole("button", { name: "Revisar documentos para assinatura" }) as HTMLButtonElement).disabled).toBe(true);
  expect(ambiente.eventos().filter(e => e.revisao === "ASSINADO")).toHaveLength(0);
  fireEvent.change(screen.getByLabelText("Dose da receita 2"), { target: { value: "Dose B validada pelo médico no teste" } });
  fireEvent.click(screen.getByRole("button", { name: "Revisar documentos para assinatura" }));
  // Duas requisições HTTP reais (preparação e bundle); limite de integração separado do gate CRIT-5.
  const preview = await screen.findByRole("region", { name: "Conteúdo para assinatura" }, { timeout: 10_000 });
  expect(preview.textContent).toContain(receitas[0]!.medicamento);
  expect(preview.textContent).toContain(receitas[1]!.medicamento);
  expect(preview.textContent).toContain("Orientação B revisada pela UI");
  expect(preview.textContent).toContain("Dose B validada pelo médico no teste");
  expect(preview.textContent).toContain("Via: PENDENTE");
  expect(ambiente.eventos().filter(e => e.revisao === "ASSINADO")).toHaveLength(0);
});
