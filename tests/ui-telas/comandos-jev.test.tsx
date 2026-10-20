// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ComandosJEV } from "../../src/ui/consulta/ComandosJEV.js";

afterEach(cleanup);

describe("ComandosJEV", () => {
  it("Ctrl+K abre a busca, Enter cria um draft e devolve foco ao acionador", () => {
    const aoComando = vi.fn();
    render(<ComandosJEV aoComando={aoComando} />);
    const acionador = screen.getByRole("button", { name: /comandos JEV/i });
    acionador.focus();
    fireEvent.keyDown(window, { key: "k", ctrlKey: true });

    const entrada = screen.getByRole("combobox", { name: /buscar comando/i });
    expect(screen.getByRole("dialog", { name: /comandos da consulta/i })).toBeTruthy();
    expect(document.activeElement).toBe(entrada);
    fireEvent.change(entrada, { target: { value: "reduzir dose" } });
    expect(aoComando).not.toHaveBeenCalled();
    fireEvent.keyDown(entrada, { key: "Enter" });

    expect(aoComando).toHaveBeenCalledOnce();
    expect(aoComando).toHaveBeenCalledWith("REDUZIR_DOSE");
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.activeElement).toBe(acionador);
  });

  it("permite navegar candidatos por setas e cancelar com Escape sem criar draft", () => {
    const aoComando = vi.fn();
    render(<ComandosJEV aoComando={aoComando} />);
    const acionador = screen.getByRole("button", { name: /comandos JEV/i });
    acionador.focus(); fireEvent.click(acionador);
    const entrada = screen.getByRole("combobox", { name: /buscar comando/i });
    expect(document.activeElement).toBe(entrada);
    const fechar = screen.getByRole("button", { name: "Fechar comandos" });
    const opcoes = screen.getByRole("listbox").querySelectorAll<HTMLButtonElement>("button[role='option']");
    const ultimaOpcao = opcoes[opcoes.length - 1];
    fechar.focus(); fireEvent.keyDown(fechar, { key: "Tab", shiftKey: true });
    expect(document.activeElement).toBe(ultimaOpcao);
    fireEvent.keyDown(ultimaOpcao!, { key: "Tab" });
    expect(document.activeElement).toBe(fechar);
    entrada.focus();

    fireEvent.change(entrada, { target: { value: "ciclo" } });
    fireEvent.keyDown(entrada, { key: "ArrowDown" });
    fireEvent.keyDown(entrada, { key: "Enter" });
    expect(aoComando).toHaveBeenCalledWith(expect.stringMatching(/^(MANTER_CICLO|ADIAR_CICLO)$/));

    fireEvent.click(screen.getByRole("button", { name: /comandos JEV/i }));
    fireEvent.keyDown(screen.getByRole("combobox", { name: /buscar comando/i }), { key: "Escape" });
    expect(aoComando).toHaveBeenCalledOnce();
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.activeElement).toBe(acionador);
  });

  it("explica que os comandos abrem drafts e não oferece controle vocal ainda não integrado", () => {
    render(<ComandosJEV aoComando={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /comandos JEV/i }));
    expect(screen.getByText(/abre um rascunho para revisão/i)).toBeTruthy();
    expect(screen.queryByRole("button", { name: /voz|falar|microfone/i })).toBeNull();
  });
});
