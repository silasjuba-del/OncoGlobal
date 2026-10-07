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

describe("CURSOR-04 Abas e cards", () => {
  it("abas com indicador e cards PENDENTE; rascunho salva sem bloquear; drop vai à caixa única", async () => {
    render(<TelaConsulta patientId={ID.pendente} porta={criarPortaFalsa()} chaves={criarChaves()} />);
    const abas = await screen.findByRole("region", { name: "Abas da consulta" }, lento);
    expect(within(abas).getByRole("tab", { name: "Visão geral" }).getAttribute("aria-selected")).toBe("true");
    const geral = within(abas).getByRole("region", { name: "Visão geral" });
    expect(within(geral).getByText(/TNM:/).textContent).toContain("PENDENTE");
    expect(within(geral).getByText(/RECIST:/).textContent).toContain("PENDENTE");
    expect(within(geral).getByText(/ECOG:/).textContent).toContain("PENDENTE");
    expect(within(geral).getByText(/CTCAE:/).textContent).toContain("PENDENTE");

    fireEvent.change(within(geral).getByLabelText("Rascunho de evolução"), {
      target: { value: "SOAP sintético" },
    });
    fireEvent.click(within(geral).getByRole("button", { name: "Salvar rascunho" }));
    expect(within(geral).getByRole("status").textContent).toContain("não bloqueia");

    const drop = within(geral).getByLabelText("Caixa única — soltar PDF ou Word");
    const arquivo = new File(["x"], "laudo-sintetico.pdf", { type: "application/pdf" });
    fireEvent.drop(drop, {
      dataTransfer: {
        files: [arquivo],
        types: ["Files"],
        items: [],
        getData: () => "",
      },
    });
    expect(await screen.findByRole("region", { name: "Caixa de revisão" }, lento)).toBeTruthy();

    fireEvent.click(within(abas).getByRole("tab", { name: /^Quimioterapia/ }));
    expect(within(abas).getByText(/CURSOR-10/)).toBeTruthy();
  }, 30_000);
});
