// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { LeituraPubMedResposta, ListaRascunhosPubMedResposta } from "../../src/contracts/leituraPubMed.js";
import { ErroPorta } from "../../src/ui/api/porta.js";
import { criarPortaFalsa } from "../../src/ui/api/fake.js";
import { ListaRascunhosPubMed } from "../../src/ui/consulta/ListaRascunhosPubMed.js";

afterEach(cleanup);

const lista: ListaRascunhosPubMedResposta = {
  codigo: "RASCUNHOS_PUBMED_LISTADOS", criaEventoClinico: false, consultaClinica: false,
  omitidos: 1, truncado: false,
  itens: [{
    draftId: "pubmed-local-1", revision: 0, criadoEm: "2026-10-05T12:00:00Z",
    criaEventoClinico: false, consultaClinica: false,
    referencias: [{
      pmid: "12345678", titulo: "Pembrolizumab in metastatic NSCLC", periodico: "N Engl J Med",
      publicadoEm: "2026", url: "https://pubmed.ncbi.nlm.nih.gov/12345678/",
      recuperadoEm: "2026-10-05T12:00:00Z", fatoClinico: false,
    }],
  }],
};

describe("lista local de referências bibliográficas", () => {
  it("mostra o metadado e não oferece confirmação", async () => {
    const base = criarPortaFalsa();
    const confirmar = vi.spyOn(base, "confirmar");
    render(<ListaRascunhosPubMed porta={{ ...base, listarRascunhosPubMed: async () => lista }} />);
    expect(await screen.findByRole("link", { name: "Pembrolizumab in metastatic NSCLC" })).toHaveProperty(
      "href", "https://pubmed.ncbi.nlm.nih.gov/12345678/");
    expect(screen.getByText(/Não são fatos do prontuário/)).toBeTruthy();
    expect(screen.getByText(/Não é fato clínico/)).toBeTruthy();
    expect(screen.getByText(/1 rascunho local não pôde ser lido/)).toBeTruthy();
    expect(screen.queryByRole("button")).toBeNull();
    expect(confirmar).not.toHaveBeenCalled();
  });

  it("preserva a lista aberta quando a atualização falha", async () => {
    const base = criarPortaFalsa();
    const primeira = render(<ListaRascunhosPubMed porta={{ ...base, listarRascunhosPubMed: async () => lista }} />);
    expect(await screen.findByText("Pembrolizumab in metastatic NSCLC")).toBeTruthy();
    primeira.rerender(<ListaRascunhosPubMed porta={{
      ...base, listarRascunhosPubMed: async () => { throw new ErroPorta("RASCUNHOS_PUBMED_INDISPONIVEIS"); },
    }} />);
    expect(await screen.findByText(/A leitura já aberta foi preservada/)).toBeTruthy();
    expect(screen.getByText("Pembrolizumab in metastatic NSCLC")).toBeTruthy();
  });

  it("não aparece quando a porta não oferece a lista", () => {
    render(<ListaRascunhosPubMed porta={criarPortaFalsa()} />);
    expect(screen.queryByRole("region", { name: "Referências bibliográficas locais" })).toBeNull();
  });

  it("envia a consulta aparada, refresca a lista e não confirma", async () => {
    const base = criarPortaFalsa();
    const confirmar = vi.spyOn(base, "confirmar");
    let resolverPesquisa: (valor: LeituraPubMedResposta) => void = () => {};
    let resolverLista: (valor: ListaRascunhosPubMedResposta) => void = () => {};
    let listagens = 0;
    const listar = vi.fn(() => {
      listagens += 1;
      if (listagens === 1) return Promise.resolve(lista);
      return new Promise<ListaRascunhosPubMedResposta>((resolve) => { resolverLista = resolve; });
    });
    const pesquisar = vi.fn((consulta: string, signal?: AbortSignal) => {
      expect(consulta).toBe("pembrolizumab metastatic nsclc");
      expect(signal).toBeInstanceOf(AbortSignal);
      expect(consulta).not.toMatch(/paciente/i);
      return new Promise<LeituraPubMedResposta>((resolve) => { resolverPesquisa = resolve; });
    });
    render(<ListaRascunhosPubMed porta={{ ...base, listarRascunhosPubMed: listar, pesquisarPubMed: pesquisar }} />);
    expect(await screen.findByRole("link", { name: "Pembrolizumab in metastatic NSCLC" })).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Consulta bibliográfica"), { target: { value: "  pembrolizumab metastatic nsclc  " } });
    fireEvent.submit(screen.getByRole("form", { name: "Pesquisa bibliográfica" }));
    await waitFor(() => expect(pesquisar).toHaveBeenCalledTimes(1));
    expect(pesquisar.mock.calls[0]).toHaveLength(2);
    expect(screen.getByText("Pembrolizumab in metastatic NSCLC")).toBeTruthy();
    resolverPesquisa({
      codigo: "REFERENCIAS_SALVAS", draftId: "pubmed-salva", revision: 0, referencias: [],
      criaEventoClinico: false, consultaClinica: false,
    });
    expect(await screen.findByText("Referências salvas neste computador. Não são fatos do prontuário.")).toBeTruthy();
    expect(screen.getByText("Pembrolizumab in metastatic NSCLC")).toBeTruthy();
    expect(listar).toHaveBeenCalledTimes(2);
    const atualizada: ListaRascunhosPubMedResposta = {
      codigo: "RASCUNHOS_PUBMED_LISTADOS", criaEventoClinico: false, consultaClinica: false,
      omitidos: 0, truncado: false,
      itens: [{
        draftId: "pubmed-nova", revision: 0, criadoEm: "2026-10-05T12:00:00Z",
        criaEventoClinico: false, consultaClinica: false,
        referencias: [{
          pmid: "87654321", titulo: "Osimertinib in EGFR NSCLC", periodico: "N Engl J Med",
          publicadoEm: "2026", url: "https://pubmed.ncbi.nlm.nih.gov/87654321/",
          recuperadoEm: "2026-10-05T12:00:00Z", fatoClinico: false,
        }],
      }],
    };
    resolverLista(atualizada);
    expect(await screen.findByRole("link", { name: "Osimertinib in EGFR NSCLC" })).toBeTruthy();
    expect(screen.queryByText("Pembrolizumab in metastatic NSCLC")).toBeNull();
    expect(confirmar).not.toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: /confirmar|assinar/i })).toBeNull();
    expect(document.body.textContent ?? "").not.toMatch(/aprovad|liberad|\bapto\b/i);
  });

  it.each([
    ["READ_PHI_NAO_VALIDADA", "A consulta contém um identificador conhecido. Nada foi enviado nem salvo."],
    ["CONTEXTO_CONSULTA_NAO_SELECIONADO", "Abra uma consulta antes de pesquisar. Nada foi salvo."],
    ["READ_OPERACAO_DIVERGENTE", "Esta pesquisa já foi usada com outra consulta. Nada novo foi salvo."],
  ] as const)("preserva a lista quando a pesquisa responde %s", async (codigo, aviso) => {
    const listar = vi.fn(async () => lista);
    const pesquisar = vi.fn(async () => { throw new ErroPorta(codigo); });
    render(<ListaRascunhosPubMed porta={{ ...criarPortaFalsa(), listarRascunhosPubMed: listar, pesquisarPubMed: pesquisar }} />);
    expect(await screen.findByText("Pembrolizumab in metastatic NSCLC")).toBeTruthy();
    const cargas = listar.mock.calls.length;
    fireEvent.change(screen.getByLabelText("Consulta bibliográfica"), { target: { value: "pembrolizumab metastatic nsclc" } });
    fireEvent.submit(screen.getByRole("form", { name: "Pesquisa bibliográfica" }));
    expect(await screen.findByText(aviso)).toBeTruthy();
    expect(screen.getByText("Pembrolizumab in metastatic NSCLC")).toBeTruthy();
    expect(listar).toHaveBeenCalledTimes(cargas);
    expect(document.body.textContent ?? "").not.toMatch(/aprovad|liberad|\bapto\b/i);
  });

  it("preserva a lista quando a pesquisa falha por outro motivo", async () => {
    const listar = vi.fn(async () => lista);
    const pesquisar = vi.fn(async () => { throw new Error("rede"); });
    render(<ListaRascunhosPubMed porta={{ ...criarPortaFalsa(), listarRascunhosPubMed: listar, pesquisarPubMed: pesquisar }} />);
    expect(await screen.findByText("Pembrolizumab in metastatic NSCLC")).toBeTruthy();
    const cargas = listar.mock.calls.length;
    fireEvent.change(screen.getByLabelText("Consulta bibliográfica"), { target: { value: "pembrolizumab metastatic nsclc" } });
    fireEvent.submit(screen.getByRole("form", { name: "Pesquisa bibliográfica" }));
    expect(await screen.findByText("A pesquisa bibliográfica não foi concluída. A lista local foi preservada e nada entrou no prontuário.")).toBeTruthy();
    expect(screen.getByText("Pembrolizumab in metastatic NSCLC")).toBeTruthy();
    expect(listar).toHaveBeenCalledTimes(cargas);
  });

  it("mostra que a mesma pesquisa já estava salva", async () => {
    const listar = vi.fn(async () => lista);
    const pesquisar = vi.fn(async () => ({
      codigo: "REPLAY" as const, draftId: "pubmed-salva", revision: 0, referencias: [],
      criaEventoClinico: false as const, consultaClinica: false as const,
    }));
    render(<ListaRascunhosPubMed porta={{ ...criarPortaFalsa(), listarRascunhosPubMed: listar, pesquisarPubMed: pesquisar }} />);
    expect(await screen.findByText("Pembrolizumab in metastatic NSCLC")).toBeTruthy();
    const cargas = listar.mock.calls.length;
    fireEvent.change(screen.getByLabelText("Consulta bibliográfica"), { target: { value: "pembrolizumab metastatic nsclc" } });
    fireEvent.submit(screen.getByRole("form", { name: "Pesquisa bibliográfica" }));
    expect(await screen.findByText("Esta pesquisa já estava salva neste computador. Não é fato do prontuário.")).toBeTruthy();
    expect(listar.mock.calls.length).toBe(cargas + 1);
    expect(screen.getByText("Pembrolizumab in metastatic NSCLC")).toBeTruthy();
  });

  it("não pesquisa consulta vazia", async () => {
    const pesquisar = vi.fn();
    const listar = vi.fn(async () => ({ ...lista, itens: [], omitidos: 0 }));
    render(<ListaRascunhosPubMed porta={{ ...criarPortaFalsa(), listarRascunhosPubMed: listar, pesquisarPubMed: pesquisar }} />);
    expect(await screen.findByText("Nenhuma referência bibliográfica salva neste computador.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Buscar referências" }).hasAttribute("disabled")).toBe(true);
    fireEvent.submit(screen.getByRole("form", { name: "Pesquisa bibliográfica" }));
    fireEvent.change(screen.getByLabelText("Consulta bibliográfica"), { target: { value: "   " } });
    expect(screen.getByRole("button", { name: "Buscar referências" }).hasAttribute("disabled")).toBe(true);
    fireEvent.submit(screen.getByRole("form", { name: "Pesquisa bibliográfica" }));
    expect(pesquisar).not.toHaveBeenCalled();
  });

  it("preserva a lista quando a atualização depois da pesquisa falha", async () => {
    let listagens = 0;
    const listar = vi.fn(async () => {
      listagens += 1;
      if (listagens === 1) return lista;
      throw new ErroPorta("RASCUNHOS_PUBMED_INDISPONIVEIS");
    });
    const pesquisar = vi.fn(async () => ({
      codigo: "REFERENCIAS_SALVAS" as const, draftId: "pubmed-salva", revision: 0, referencias: [],
      criaEventoClinico: false as const, consultaClinica: false as const,
    }));
    render(<ListaRascunhosPubMed porta={{ ...criarPortaFalsa(), listarRascunhosPubMed: listar, pesquisarPubMed: pesquisar }} />);
    expect(await screen.findByText("Pembrolizumab in metastatic NSCLC")).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Consulta bibliográfica"), { target: { value: "pembrolizumab metastatic nsclc" } });
    fireEvent.submit(screen.getByRole("form", { name: "Pesquisa bibliográfica" }));
    expect(await screen.findByText("Não foi possível atualizar a lista. A leitura já aberta foi preservada e nada entrou no prontuário.")).toBeTruthy();
    expect(screen.getByText("Referências salvas neste computador. Não são fatos do prontuário.")).toBeTruthy();
    expect(screen.getByText("Pembrolizumab in metastatic NSCLC")).toBeTruthy();
  });
});
