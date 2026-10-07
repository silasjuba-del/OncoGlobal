// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { criarChaves } from "../../src/ui/api/chaves.js";
import { criarPortaFalsa, ID } from "../../src/ui/api/fake.js";
import { TelaConsulta } from "../../src/ui/telas/TelaConsulta.js";

afterEach(() => {
  cleanup();
});

describe("CURSOR-03 Timeline 2D", () => {
  it("mostra lanes, HOJE, ciclo e Ver em 3D; histórico de estádio permanece", async () => {
    render(<TelaConsulta patientId={ID.verde} porta={criarPortaFalsa()} chaves={criarChaves()} />);
    const tl = await screen.findByRole("region", { name: "Linha do tempo oncológica" }, { timeout: 20_000 });
    expect(within(tl).getAllByText("Diagnóstico").length).toBeGreaterThan(0);
    expect(within(tl).getAllByText("Imagem").length).toBeGreaterThan(0);
    expect(within(tl).getAllByText("Sistêmico").length).toBeGreaterThan(0);
    expect(within(tl).getAllByText("Cirurgia · RT").length).toBeGreaterThan(0);
    expect(tl.querySelector('[data-lane="Diagnóstico"]')).toBeTruthy();
    expect(within(tl).getByLabelText("HOJE")).toBeTruthy();
    expect(within(tl).getByText(/Ciclo sintético/)).toBeTruthy();
    expect(within(tl).getByRole("region", { name: "Histórico de estádio" }).textContent).toContain("cT2N1M0");
    fireEvent.click(within(tl).getByRole("button", { name: "Ver em 3D" }));
    expect(screen.getByText(/CURSOR-08/)).toBeTruthy();
  }, 30_000);
});
