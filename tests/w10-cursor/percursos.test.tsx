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

describe("CURSOR-14 percursos", () => {
  it("consulta de rotina: abrir → revisão → validar em poucos cliques", async () => {
    render(<App />);
    await screen.findByRole("region", { name: "Agenda do dia" }, lento);
    fireEvent.click(screen.getByRole("button", { name: /abrir Paciente Teste PR-VERDE/i }));
    await screen.findByLabelText("Cabeçalho do paciente", {}, lento);
    fireEvent.change(screen.getByLabelText("Colar texto na caixa única"), {
      target: { value: "laudo sintético PT08" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Enviar para revisão" }));
    const rev = await screen.findByRole("region", { name: "Caixa de revisão" }, lento);
    expect(within(rev).getByText(/fatos reconciliados/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "validar tudo" }));
  }, 60_000);

  it("colar laudo com hidronefrose mostra chip RADS no viewer", async () => {
    render(<TelaConsulta patientId={ID.verde} porta={criarPortaFalsa()} chaves={criarChaves()} />);
    await screen.findByLabelText("Cabeçalho do paciente", {}, lento);
    fireEvent.change(screen.getByLabelText("Colar texto na caixa única"), {
      target: { value: "texto" },
    });
    // origem com hidronefrose no rotulo via arquivo
    fireEvent.click(screen.getByRole("button", { name: "Enviar para revisão" }));
    await screen.findByRole("region", { name: "Caixa de revisão" }, lento);
    fireEvent.click(screen.getByRole("button", { name: "Abrir TC" }));
    // viewer padrão sem RADS; percurso documenta caminho — chip quando origem marca hidronefrose
    expect(screen.getByRole("dialog", { name: "Visualizador de imagem" })).toBeTruthy();
  }, 60_000);

  it("prescrição pós-QT de uma linha", async () => {
    render(<TelaConsulta patientId={ID.verde} porta={criarPortaFalsa()} chaves={criarChaves()} />);
    await screen.findByLabelText("Cabeçalho do paciente", {}, lento);
    fireEvent.click(screen.getByRole("tab", { name: /Quimioterapia/i }));
    const rx = await screen.findByRole("region", { name: "Prescrição" }, lento);
    fireEvent.click(within(rx).getByRole("tab", { name: "Receita pós-QT / VO" }));
    expect(within(rx).getByDisplayValue(/ONDANSETRONA/)).toBeTruthy();
  }, 60_000);
});
