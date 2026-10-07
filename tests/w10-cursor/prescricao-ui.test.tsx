// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { criarChaves } from "../../src/ui/api/chaves.js";
import { criarPortaFalsa, ID } from "../../src/ui/api/fake.js";
import { TelaConsulta } from "../../src/ui/telas/TelaConsulta.js";

afterEach(() => {
  cleanup();
});

const lento = { timeout: 20_000 };

describe("CURSOR-10 Prescrição UI", () => {
  it("mostra Modelo 05 só com exceções, −20 com motivo e os 3 produtos", async () => {
    render(<TelaConsulta patientId={ID.verde} porta={criarPortaFalsa()} chaves={criarChaves()} />);
    await screen.findByLabelText("Cabeçalho do paciente", {}, lento);
    fireEvent.click(screen.getByRole("tab", { name: /Quimioterapia/i }));
    const rx = await screen.findByRole("region", { name: "Prescrição" }, lento);
    expect(within(rx).getByText("PRÉ-QT")).toBeTruthy();
    expect(within(rx).getByText("NÃO ONCOLÓGICAS")).toBeTruthy();
    expect(within(rx).getByText(/Só as/)).toBeTruthy();
    expect(within(rx).getAllByRole("row").length).toBeGreaterThan(1);
    fireEvent.change(within(rx).getByLabelText("Motivo do ajuste"), {
      target: { value: "toxicidade G2" },
    });
    fireEvent.click(within(rx).getByRole("button", { name: "−20" }));
    expect(within(rx).getByRole("status").textContent).toMatch(/−20%/);
    fireEvent.click(within(rx).getByRole("tab", { name: "Receita pós-QT / VO" }));
    expect(within(rx).getByDisplayValue(/ONDANSETRONA/)).toBeTruthy();
    fireEvent.click(within(rx).getByRole("tab", { name: "EV avulsa" }));
    expect(within(rx).getByText(/Cloreto de sódio/)).toBeTruthy();
  }, 60_000);
});
