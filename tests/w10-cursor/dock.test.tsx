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

describe("CURSOR-09 Dock e overlays", () => {
  it("mostra dock ≥44px, WhatsApp com CANAL_EXTERNO e liberação sem bloqueio", async () => {
    render(<TelaConsulta patientId={ID.verde} porta={criarPortaFalsa()} chaves={criarChaves()} />);
    await screen.findByLabelText("Cabeçalho do paciente", {}, lento);
    const dock = screen.getByRole("navigation", { name: "Dock de ações" });
    const btn = within(dock).getByRole("button", { name: "Encerrar · WhatsApp" });
    expect(btn.getAttribute("data-min-touch")).toBe("44");
    fireEvent.click(btn);
    const wa = screen.getByRole("dialog", { name: "Encerrar · WhatsApp" });
    expect(within(wa).getByText(/CANAL_EXTERNO_NAO_HABILITADO/)).toBeTruthy();
    fireEvent.click(within(wa).getByRole("button", { name: /Fechar Encerrar/ }));
    fireEvent.click(within(dock).getByRole("button", { name: "Ciclo QT" }));
    const lib = screen.getByRole("dialog", { name: "Liberação QT" });
    expect(within(lib).getByText(/não bloqueiam salvar/i)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Consulta Flash" }));
    expect(screen.getByRole("dialog", { name: "Consulta Flash" })).toBeTruthy();
  }, 60_000);
});
