// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { App } from "../../src/ui/App.js";

afterEach(() => {
  cleanup();
});

const lento = { timeout: 20_000 };

describe("CURSOR-06 painel lateral", () => {
  it("mostra Exame, OncoBoard, fila com E1 badge sem reordenar e Chamar próximo", async () => {
    render(<App />);
    await screen.findByRole("region", { name: "Agenda do dia" }, lento);
    const ordemAgenda = [...document.querySelectorAll("[data-patient]")].map((el) =>
      el.getAttribute("data-patient"),
    );
    fireEvent.click(screen.getByRole("button", { name: /abrir Paciente Teste 04 PR-E1/i }));
    await screen.findByLabelText("Cabeçalho do paciente", {}, lento);
    const painel = await screen.findByRole("region", { name: "Painel clínico lateral" }, lento);
    fireEvent.click(within(painel).getByRole("tab", { name: "Fila" }));
    const fila = within(painel).getByRole("list", { name: "Ordem da fila" });
    const ordemFila = [...fila.querySelectorAll("[data-patient]")].map((el) =>
      el.getAttribute("data-patient"),
    );
    expect(ordemFila).toEqual(ordemAgenda);
    const e1 = within(fila).getByText("E1");
    expect(e1.getAttribute("data-badge")).toBe("E1");
    fireEvent.click(within(painel).getByRole("button", { name: "Chamar próximo" }));
    expect(within(painel).getByRole("status").textContent).toMatch(/chamou:/);
    fireEvent.click(within(painel).getByRole("tab", { name: "OncoBoard" }));
    expect(within(painel).getByText("A fazer")).toBeTruthy();
    fireEvent.click(within(painel).getByRole("tab", { name: "Exame" }));
    expect(within(painel).getByRole("tab", { name: "Laudo" })).toBeTruthy();
  }, 60_000);
});
