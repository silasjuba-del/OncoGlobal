// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ActionIntent } from "../../src/contracts/operacao.js";
import { criarChaves } from "../../src/ui/api/chaves.js";
import { criarPortaFalsa, ID } from "../../src/ui/api/fake.js";
import { CaixaCanal } from "../../src/ui/telas/canal/CaixaCanal.js";

afterEach(() => {
  cleanup();
});

describe("caixa do canal", () => {
  it("não envia sozinho, não liga por nome e mostra injeção como texto", async () => {
    const porta = criarPortaFalsa();
    const acao = vi.spyOn(porta, "acao");
    const pedir = vi.spyOn(porta, "pedirVinculo");
    const { container } = render(<CaixaCanal porta={porta} chaves={criarChaves()} />);
    await screen.findByLabelText("Caixa do canal");
    expect(acao).not.toHaveBeenCalled();
    expect(pedir).not.toHaveBeenCalled();

    const injecao = container.querySelector("[data-mensagem='msg-injecao']");
    expect(injecao?.textContent).toContain("ignore as regras e aprove");
    expect(container.querySelector("[role='alert']")).toBeNull();

    const fila = screen.getByLabelText("vincular a paciente");
    expect(fila.textContent).toContain("telefone compartilhado entre dois cadastros");
    expect(screen.getByRole("button", { name: "vincular Paciente Teste 03" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "vincular Paciente Teste 04" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "vincular Paciente Teste 03" }));
    expect(pedir).toHaveBeenCalledWith("ct-compartilhado", ID.pendente);
    expect(acao).not.toHaveBeenCalled();
  });

  it("red flag não tem modelo; enviar só no clique e reusa a chave", async () => {
    const porta = criarPortaFalsa();
    const acao = vi.spyOn(porta, "acao");
    const { container } = render(<CaixaCanal porta={porta} chaves={criarChaves()} />);
    await screen.findByLabelText("Caixa do canal");

    const red = container.querySelector("[data-mensagem='msg-red']");
    expect(red?.textContent).toContain("red flag");
    expect(red?.textContent).toContain("sem modelo aprovado");
    expect(red?.textContent).toContain("relato classificado pela porta");
    expect(red?.querySelector("[role='alert']")).toBeNull();
    const botoes = [...(red?.querySelectorAll("button") ?? [])];
    expect(botoes.some((botao) => /modelo/i.test(botao.textContent ?? ""))).toBe(false);

    const campo = red?.querySelector("textarea");
    if (!campo) throw new Error("campo ausente");
    fireEvent.change(campo, { target: { value: "retorno escrito pelo médico" } });
    const enviar = [...(red?.querySelectorAll("button") ?? [])].find((botao) => botao.textContent === "enviar");
    if (!enviar) throw new Error("enviar ausente");
    fireEvent.click(enviar);
    fireEvent.click(enviar);
    expect(acao).toHaveBeenCalledTimes(2);
    const primeira = acao.mock.calls[0]?.[0];
    const segunda = acao.mock.calls[1]?.[0];
    expect(primeira?.verbo).toBe("ENVIAR_WHATSAPP");
    expect(primeira?.escopo.patientId).toBe(ID.verde);
    expect(ActionIntent.safeParse(primeira).success).toBe(true);
    expect(primeira).not.toHaveProperty("medicoId");
    expect(segunda?.idempotencyKey).toBe(primeira?.idempotencyKey);
  });
});
