// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { App } from "../../src/ui/App.js";
import { criarChaves } from "../../src/ui/api/chaves.js";
import { criarPortaFalsa, ID } from "../../src/ui/api/fake.js";
import { TelaConsulta } from "../../src/ui/telas/TelaConsulta.js";

afterEach(() => {
  cleanup();
});

const lento = { timeout: 20_000 };

describe("CURSOR-02 PatientHeader + Modelo 08", () => {
  it("alergia em destaque, idade em anos e meses, Consulta Flash e TNM", async () => {
    render(<TelaConsulta patientId={ID.vermelho} porta={criarPortaFalsa()} chaves={criarChaves()} />);
    const header = await screen.findByLabelText("Cabeçalho do paciente", {}, lento);
    expect(within(header).getByText("Paciente Teste")).toBeTruthy();
    expect(within(header).getByText(/anos e .* meses/)).toBeTruthy();
    const alergia = within(header).getByText(/Alergia: penicilina/);
    expect(alergia.className).toContain("oc-chip-danger");
    expect(within(header).getByRole("button", { name: "Consulta Flash" })).toBeTruthy();
    expect(within(header).getByLabelText("Editar TNM")).toBeTruthy();
  }, 30_000);

  it("alergia ausente no pendente fica PENDENTE, não 'nega alergias'", async () => {
    render(<TelaConsulta patientId={ID.pendente} porta={criarPortaFalsa()} chaves={criarChaves()} />);
    const header = await screen.findByLabelText("Cabeçalho do paciente", {}, lento);
    expect(within(header).getByText("Alergia PENDENTE")).toBeTruthy();
    expect(within(header).queryByText(/nega alergias/i)).toBeNull();
    expect(header.getAttribute("data-semaforo")).toBe("PENDENTE");
    expect(header.querySelector(".semaforo-verde")).toBeNull();
  }, 30_000);

  it("cartão Modelo 08 na lateral com Responsável PENDENTE", async () => {
    render(<App />);
    await screen.findByRole("region", { name: "Agenda do dia" }, lento);
    fireEvent.click(screen.getByRole("button", { name: /abrir Paciente Teste PR-VERMELHO/i }));
    const cartao = await screen.findByRole("region", { name: "Cartão de cadastro" }, lento);
    expect(within(cartao).getByText("Matrícula / CNS")).toBeTruthy();
    expect(within(cartao).getByText("Responsável").closest("div")?.textContent).toContain("PENDENTE");
    expect(within(cartao).queryByText("SEM INFORMACAO")).toBeNull();
  }, 60_000);
});
