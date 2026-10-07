// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { App } from "../../src/ui/App.js";

afterEach(() => {
  cleanup();
});

const lento = { timeout: 20_000 };

describe("CURSOR-12 triagem 5 passos e agenda QT", () => {
  it("avança sem travar, alerta em campo e agenda com status", async () => {
    render(<App />);
    await screen.findByRole("region", { name: "Agenda do dia" }, lento);
    fireEvent.click(screen.getByRole("button", { name: "Salão" }));
    const salao = await screen.findByRole("region", { name: "Salão" }, lento);
    const tri = within(salao).getByRole("region", { name: "Triagem em 5 passos" });
    fireEvent.click(within(tri).getByRole("button", { name: /Próximo: Sinais/ }));
    fireEvent.change(within(tri).getByLabelText("PAS"), { target: { value: "190" } });
    expect(within(tri).getByRole("status").textContent).toMatch(/alerta/i);
    fireEvent.click(within(tri).getByRole("button", { name: /Próximo: Laboratorial/ }));
    fireEvent.click(within(tri).getByRole("button", { name: /Próximo: ECOG/ }));
    fireEvent.click(within(tri).getByRole("button", { name: "ECOG 1" }));
    fireEvent.click(within(tri).getByRole("button", { name: /Próximo: CTCAE/ }));
    expect(within(tri).getByLabelText("Resumo final da triagem").textContent).toMatch(/ECOG: 1/);
    const agenda = within(salao).getByRole("region", { name: "Agenda de QT" });
    fireEvent.click(within(agenda).getByText(/Paciente A/));
    fireEvent.click(within(agenda).getByRole("button", { name: "chegou" }));
    expect(within(agenda).getByText(/Paciente A · chegou/)).toBeTruthy();
  }, 60_000);
});
