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

describe("CURSOR-05 caixa de revisão", () => {
  it("colar abre revisão com exceções e exige clique para ligar órfão", async () => {
    render(<TelaConsulta patientId={ID.verde} porta={criarPortaFalsa()} chaves={criarChaves()} />);
    await screen.findByLabelText("Cabeçalho do paciente", {}, lento);
    fireEvent.change(screen.getByLabelText("Colar texto na caixa única"), {
      target: { value: "texto sintético de laudo" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Enviar para revisão" }));
    const rev = await screen.findByRole("region", { name: "Caixa de revisão" }, lento);
    expect(within(rev).getByText(/fatos reconciliados/)).toBeTruthy();
    expect(within(rev).getByText(/nunca automática/)).toBeTruthy();
    fireEvent.click(within(rev).getByRole("button", { name: "Ligar ao paciente…" }));
    fireEvent.click(within(rev).getByRole("button", { name: /Ligar a Paciente Teste · PR-VERDE/ }));
    expect(screen.getByText(/ligado: exc-orfao/)).toBeTruthy();
  }, 30_000);
});

describe("CURSOR-07 ImageViewer", () => {
  it("narra laudo sem conduta e mostra morfometria como DRAFT", async () => {
    render(<TelaConsulta patientId={ID.verde} porta={criarPortaFalsa()} chaves={criarChaves()} />);
    await screen.findByLabelText("Cabeçalho do paciente", {}, lento);
    fireEvent.click(screen.getByRole("button", { name: "Abrir TC" }));
    const viewer = screen.getByRole("dialog", { name: "Visualizador de imagem" });
    expect(within(viewer).getByText(/sem conduta/)).toBeTruthy();
    fireEvent.click(within(viewer).getByRole("button", { name: "Narrar laudo" }));
    expect(within(viewer).getByRole("status").textContent).toMatch(/Laudo/);
    for (let i = 0; i < 4; i++) {
      fireEvent.click(within(viewer).getByRole("button", { name: /Modo 4 cliques/ }));
    }
    expect(within(viewer).getByText(/DRAFT \/ NEEDS_REVIEW/)).toBeTruthy();
    expect(within(viewer).getByText(/não alimenta RECIST/)).toBeTruthy();
  }, 30_000);
});
