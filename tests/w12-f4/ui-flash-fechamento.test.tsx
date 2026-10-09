// @vitest-environment jsdom
// W12-F4 · UI: os botões da Flash chamam a porta; erro mantém o overlay aberto e as marcações.
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TelaConsulta } from "../../src/ui/telas/TelaConsulta.js";
import { criarChaves } from "../../src/ui/api/chaves.js";
import { criarPortaFalsa, ID } from "../../src/ui/api/fake.js";
import { ErroPorta, type PortaConsulta } from "../../src/ui/api/porta.js";

afterEach(cleanup);

async function abrirFlash(porta: PortaConsulta) {
  render(<TelaConsulta patientId={ID.multi} porta={porta} chaves={criarChaves()} />);
  fireEvent.click(await screen.findByRole("button", { name: "Consulta Flash" }));
  await screen.findByText("Tarefas do retorno");
}

describe("W12-F4 UI", () => {
  it("salvar rascunho chama a porta, fecha o overlay e confirma; não chama confirmar nem acao", async () => {
    const base = criarPortaFalsa();
    const salvar = vi.fn(base.salvarRascunhoFlash!);
    base.salvarRascunhoFlash = salvar;
    const confirmar = vi.spyOn(base, "confirmar");
    const acao = vi.spyOn(base, "acao");
    await abrirFlash(base);
    fireEvent.click(screen.getByRole("button", { name: "SALVAR RASCUNHO" }));
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Consulta Flash" })).toBeNull());
    expect(salvar).toHaveBeenCalledTimes(1);
    const pedido = salvar.mock.calls[0]![0];
    expect(pedido.expectedRevision).toBeNull();
    expect(pedido.plano.apac.emitir).toBe(false);
    expect(screen.getByLabelText("status da Consulta Flash").textContent).toContain("Rascunho");
    expect(confirmar).not.toHaveBeenCalled();
    expect(acao).not.toHaveBeenCalled();
  });

  it("finalizar prepara, exibe o bundle e só então confirma, com os documentos exibidos", async () => {
    const base = criarPortaFalsa();
    const ordem: string[] = [];
    const porta: PortaConsulta = {
      ...base,
      prepararFinalizacaoFlash: async (p) => { ordem.push("preparar"); return base.prepararFinalizacaoFlash!(p); },
      exibirBundle: async (p) => { ordem.push("exibir"); return base.exibirBundle(p); },
      confirmar: async (b) => { ordem.push("confirmar"); expect(b.bloco).toBe("TUDO");
        expect(b.documentosExibidos).toEqual([{ documentId: "flash-doc-sintetico", documentVersion: 1 }]);
        return base.confirmar(b); },
    };
    await abrirFlash(porta);
    fireEvent.click(screen.getByRole("button", { name: "FINALIZAR · IMPRIMIR · SAIR" }));
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Consulta Flash" })).toBeNull());
    expect(ordem).toEqual(["preparar", "exibir", "confirmar"]);
    expect(screen.getByLabelText("status da Consulta Flash").textContent).toContain("finalizada");
  });

  it("erro ao finalizar: mostra o erro, mantém o overlay aberto e preserva as marcações; nada é confirmado", async () => {
    const base = criarPortaFalsa();
    const confirmar = vi.fn(base.confirmar);
    const porta: PortaConsulta = {
      ...base,
      confirmar,
      prepararFinalizacaoFlash: async () => { throw new ErroPorta("FLASH_RECUSADA", "FLASH_JA_FINALIZADA"); },
    };
    await abrirFlash(porta);
    const imagem = screen.getByRole("checkbox", { name: /Imagem/ }) as HTMLInputElement;
    expect(imagem.checked).toBe(false);
    fireEvent.click(imagem);
    expect(imagem.checked).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "FINALIZAR · IMPRIMIR · SAIR" }));
    const alerta = await screen.findByRole("alert");
    expect(alerta.textContent).toContain("FLASH_JA_FINALIZADA");
    expect(screen.getByRole("dialog", { name: "Consulta Flash" })).toBeTruthy();
    expect((screen.getByRole("checkbox", { name: /Imagem/ }) as HTMLInputElement).checked).toBe(true);
    expect(confirmar).not.toHaveBeenCalled();
    // pode tentar de novo
    expect((screen.getByRole("button", { name: "FINALIZAR · IMPRIMIR · SAIR" }) as HTMLButtonElement).disabled).toBe(false);
  });

  it("confirmação recusada pelo servidor também mantém o overlay aberto", async () => {
    const base = criarPortaFalsa();
    const porta: PortaConsulta = { ...base, confirmar: async () => ({ codigo: "DOCUMENTO_NAO_SELECIONADO", resultRef: null }) };
    await abrirFlash(porta);
    fireEvent.click(screen.getByRole("button", { name: "FINALIZAR · IMPRIMIR · SAIR" }));
    expect((await screen.findByRole("alert")).textContent).toContain("DOCUMENTO_NAO_SELECIONADO");
    expect(screen.getByRole("dialog", { name: "Consulta Flash" })).toBeTruthy();
  });

  it("erro ao salvar rascunho mantém o overlay aberto", async () => {
    const base = criarPortaFalsa();
    const porta: PortaConsulta = {
      ...base,
      salvarRascunhoFlash: async () => { throw new ErroPorta("FLASH_RECUSADA", "REVISAO_RASCUNHO_CONFLITANTE"); },
    };
    await abrirFlash(porta);
    fireEvent.click(screen.getByRole("button", { name: "SALVAR RASCUNHO" }));
    expect((await screen.findByRole("alert")).textContent).toContain("Não foi possível salvar o rascunho");
    expect(screen.getByRole("dialog", { name: "Consulta Flash" })).toBeTruthy();
  });

  it("porta sem as ações novas: erro visível, overlay aberto", async () => {
    const base = criarPortaFalsa();
    const { prepararFinalizacaoFlash: _a, salvarRascunhoFlash: _b, ...semAcoes } = base;
    await abrirFlash(semAcoes as PortaConsulta);
    fireEvent.click(screen.getByRole("button", { name: "FINALIZAR · IMPRIMIR · SAIR" }));
    expect((await screen.findByRole("alert")).textContent).toContain("SERVIDOR_PENDENTE");
    expect(screen.getByRole("dialog", { name: "Consulta Flash" })).toBeTruthy();
  });
});
