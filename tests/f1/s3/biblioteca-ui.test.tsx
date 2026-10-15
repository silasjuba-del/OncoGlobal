// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { BibliotecaLocal } from "../../../src/ui/biblioteca/BibliotecaLocal.js";
import type { ApiBiblioteca, BibliotecaEstado, ItemBibliotecaResposta } from "../../../src/contracts/api/biblioteca.js";

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

const item: ItemBibliotecaResposta = {
  schema: "ItemBiblioteca@1", id: "item-sintetico", versao: "1.0.0", pilar: 1, tipo: "REFERENCIA",
  titulo: "Referência sintética", texto: "Texto público de exemplo.",
  aplicabilidade: { tumor: ["mama"], histologia: [], estadio: [], biomarcador: [], linha: [] },
  proveniencia: { fonte: "https://example.org/ref", trecho: "Trecho literal sintético", publicadoEm: "2026-01-01", recuperadoEm: "2026-01-02T00:00:00Z", licenca: "Fixture" },
  dependencias: [], estado: "RASCUNHO", curadoria: null,
};
const hash = "a".repeat(64);
const manifesto = { schema: "PacoteBiblioteca@1", id: "fixture", versao: "1.0.0", origem: "GENSPARK_MANUAL", classificacao: "PUBLIC", criadoEm: "2026-01-02T00:00:00Z", itens: [] };

it("importa como rascunho e só cura/ativa após exibir e confirmar conteúdo e versão", async () => {
  let curado = false, ativa: string | null = null;
  const pacote = { pacoteId: "fixture@1.0.0", versao: "1.0.0", hash, ativo: false, itens: [{ id: item.id, estado: curado ? "CONSULTAVEL" as const : "RASCUNHO" as const }] };
  const estado = vi.fn(async (pacoteId?: string): Promise<BibliotecaEstado> => ({
    ativa, referencia: ativa ? { id: "fixture", versao: "1.0.0", hash } : null,
    pacoteId: pacoteId ?? null, hash: pacoteId ? hash : null, ativacao: null,
    pacotes: [{ ...pacote, ativo: ativa === pacote.pacoteId }],
    itens: pacoteId ? [{ ...item, estado: curado ? "CONSULTAVEL" : "RASCUNHO", curadoria: curado ? { ator: "medico", registradoEm: "2026-01-03T00:00:00Z" } : null }] : [],
  }));
  const api: ApiBiblioteca = {
    estado,
    importar: vi.fn(async () => ({ codigo: "PACOTE_IMPORTADO_RASCUNHO", pacoteId: pacote.pacoteId, hash })),
    curar: vi.fn(async () => { curado = true; return { codigo: "ITEM_CURADO" }; }),
    ativar: vi.fn(async () => { ativa = pacote.pacoteId; return { codigo: "BIBLIOTECA_ATIVADA" }; }),
    rollback: vi.fn(async () => { ativa = null; return { codigo: "BIBLIOTECA_RESTAURADA" }; }),
    consultar: vi.fn(async () => ({ itens: [], referencia: null })),
  };
  vi.spyOn(window, "confirm").mockReturnValue(true);
  render(<BibliotecaLocal api={api} />);
  const arquivo = new File([JSON.stringify({ manifesto, arquivos: { "item-sintetico.json": { texto: JSON.stringify(item) } } })], "pacote-http.json", { type: "application/json" });
  fireEvent.change(screen.getByLabelText(/Importar pacote JSON local/), { target: { files: [arquivo] } });
  await screen.findByText(/Pacote importado como RASCUNHO/);
  expect(api.importar).toHaveBeenCalledWith(expect.objectContaining({ manifesto, arquivos: expect.any(Object) }));
  expect(screen.getByText("Exibir conteúdo e trecho da fonte")).toBeTruthy();
  const ativar = screen.getByRole("button", { name: "Ativar pacote revisado" }) as HTMLButtonElement;
  expect(ativar.disabled).toBe(true);

  const article = screen.getAllByRole("article")[0]!;
  const curar = within(article).getByRole("button", { name: "Marcar CONSULTAVEL" }) as HTMLButtonElement;
  expect(curar.disabled).toBe(true);
  fireEvent.click(within(article).getByText("Exibir conteúdo e trecho da fonte"));
  await screen.findByText("Texto público de exemplo.");
  expect(screen.getByText("Trecho literal sintético")).toBeTruthy();
  const confirmarItem = within(article).getByLabelText(/Li e conferi o conteúdo e a fonte/) as HTMLInputElement;
  await waitFor(() => expect(confirmarItem.disabled).toBe(false));
  fireEvent.click(confirmarItem);
  fireEvent.click(curar);
  await waitFor(() => expect(api.curar).toHaveBeenCalledWith({ pacoteId: pacote.pacoteId, itemId: item.id, expectedHash: hash, estado: "CONSULTAVEL" }));
  await waitFor(() => expect(confirmarItem.checked).toBe(true));
  fireEvent.click(screen.getByLabelText(/Revisei a versão, o hash e os itens exibidos/));
  fireEvent.click(screen.getByRole("button", { name: "Ativar pacote revisado" }));
  await waitFor(() => expect(api.ativar).toHaveBeenCalledWith({ pacoteId: pacote.pacoteId, expectedHash: hash }));
  expect(window.confirm).toHaveBeenCalled();
});

it("consulta conteúdo e exige confirmação para rollback da ativa", async () => {
  const estado: BibliotecaEstado = {
    ativa: "fixture@1.0.0", referencia: { id: "fixture", versao: "1.0.0", hash }, pacoteId: null, hash: null,
    ativacao: null, pacotes: [{ pacoteId: "fixture@1.0.0", versao: "1.0.0", hash, ativo: true, itens: [{ id: item.id, estado: "CONSULTAVEL" }] }], itens: [],
  };
  const api: ApiBiblioteca = {
    estado: vi.fn(async () => estado), importar: vi.fn(), curar: vi.fn(), ativar: vi.fn(),
    rollback: vi.fn(async () => ({ codigo: "BIBLIOTECA_RESTAURADA" })),
    consultar: vi.fn(async () => ({ itens: [item], referencia: estado.referencia })),
  };
  vi.spyOn(window, "confirm").mockReturnValue(true);
  render(<BibliotecaLocal api={api} />);
  const consultar = screen.getByRole("button", { name: "Consultar" }) as HTMLButtonElement;
  await waitFor(() => expect(consultar.disabled).toBe(false));
  fireEvent.change(screen.getByLabelText("tumor"), { target: { value: "mama" } });
  fireEvent.click(consultar);
  await screen.findByText("Texto público de exemplo.");
  fireEvent.click(screen.getByRole("button", { name: "Restaurar versão anterior" }));
  await waitFor(() => expect(api.rollback).toHaveBeenCalledWith({ expectedAtiva: "fixture@1.0.0", expectedHash: hash }));
});

it("remove controles de ativação se a atualização do pacote falhar, sem expor erro bruto", async () => {
  const detalhe: BibliotecaEstado = {
    ativa: null, referencia: null, pacoteId: "fixture@1.0.0", hash,
    ativacao: null, pacotes: [{ pacoteId: "fixture@1.0.0", versao: "1.0.0", hash, ativo: false, itens: [{ id: item.id, estado: "CONSULTAVEL" }] }],
    itens: [{ ...item, estado: "CONSULTAVEL", curadoria: { ator: "medico", registradoEm: null } }],
  };
  const api: ApiBiblioteca = {
    estado: vi.fn().mockResolvedValueOnce({ ...detalhe, pacoteId: null, hash: null, itens: [] })
      .mockResolvedValueOnce(detalhe).mockRejectedValueOnce(new Error("ERRO_INTERNO_COM_PAYLOAD_SENSIVEL")),
    importar: vi.fn(), curar: vi.fn(), ativar: vi.fn(), rollback: vi.fn(), consultar: vi.fn(),
  };
  render(<BibliotecaLocal api={api} />);
  await screen.findByRole("button", { name: "Abrir para revisão" });
  fireEvent.click(screen.getByRole("button", { name: "Abrir para revisão" }));
  const itemCard = (await screen.findAllByRole("article"))[0]!;
  fireEvent.click(within(itemCard).getByText("Exibir conteúdo e trecho da fonte"));
  await screen.findByText("Trecho literal sintético");
  const conferir = within(itemCard).getByLabelText(/Li e conferi o conteúdo e a fonte/) as HTMLInputElement;
  await waitFor(() => expect(conferir.disabled).toBe(false));
  fireEvent.click(conferir);
  fireEvent.click(screen.getByLabelText(/Revisei a versão, o hash e os itens exibidos/));
  expect(screen.getByRole("button", { name: "Ativar pacote revisado" })).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Atualizar lista" }));
  expect((await screen.findByRole("alert")).textContent).toContain("Não foi possível concluir a operação");
  expect(screen.queryByRole("button", { name: "Ativar pacote revisado" })).toBeNull();
  expect(screen.queryByText(/ERRO_INTERNO_COM_PAYLOAD_SENSIVEL/)).toBeNull();
});
