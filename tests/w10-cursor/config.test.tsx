// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { App } from "../../src/ui/App.js";

afterEach(() => {
  cleanup();
});

const lento = { timeout: 20_000 };

describe("CURSOR-11 Configurações", () => {
  it("abre DIA|NOITE|PERSONALIZAR, caixa de número e glossário", async () => {
    render(<App />);
    await screen.findByRole("region", { name: "Agenda do dia" }, lento);
    fireEvent.click(screen.getByRole("button", { name: "Usuário" }));
    fireEvent.click(screen.getByRole("button", { name: "Configurações" }));
    const cfg = await screen.findByRole("dialog", { name: "Configurações" }, lento);
    expect(within(cfg).getByDisplayValue("2605473")).toBeTruthy();
    expect(within(cfg).getByRole("button", { name: "PERSONALIZAR" })).toBeTruthy();
    fireEvent.change(within(cfg).getByLabelText("Número da caixa"), { target: { value: "8" } });
    fireEvent.change(within(cfg).getByLabelText("Dado da caixa"), { target: { value: "teste" } });
    fireEvent.click(within(cfg).getByRole("button", { name: "Salvar (1 clique)" }));
    expect(within(cfg).getByRole("status").textContent).toMatch(/salvo #8/);
    fireEvent.change(within(cfg).getByLabelText("Pesquisar glossário"), {
      target: { value: "Laudo" },
    });
    expect(within(cfg).getByRole("button", { name: /#21/ })).toBeTruthy();
  }, 60_000);
});
