// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ordenarFila } from "../../src/rules/index.js";
import { criarPortaFalsa, ID } from "../../src/ui/api/fake.js";
import { TelaSalao } from "../../src/ui/telas/TelaSalao.js";

afterEach(() => {
  cleanup();
});

describe("tela do salão", () => {
  it("a ordem é a de ordenarFila e E1 não muda a posição", async () => {
    const porta = criarPortaFalsa();
    const salao = await porta.filaSalao();
    const { container } = render(<TelaSalao porta={porta} />);
    await screen.findByLabelText("SALÃO");
    const ids = [...container.querySelectorAll("[aria-label='SALÃO'] [data-patient]")].map((el) => el.getAttribute("data-patient"));
    const esperado = ordenarFila(salao.cartoes.map((c) => c.entrada), salao.ruleset).map((e) => e.patientId);
    expect(ids).toEqual(esperado);
    expect(ids[0]).not.toBe(ID.e1);
    expect(screen.getByLabelText("Escalonamento").textContent).toContain("E1");
  });

  it("liberar sem motivo não envia; com motivo registra a decisão do médico", async () => {
    const porta = criarPortaFalsa();
    const liberar = vi.spyOn(porta, "liberarComCorte");
    render(<TelaSalao porta={porta} />);
    fireEvent.click(await screen.findByRole("button", { name: "liberar mesmo com corte" }));
    fireEvent.click(screen.getByRole("button", { name: "confirmar liberação" }));
    expect(liberar).not.toHaveBeenCalled();
    expect(screen.getByText("motivo obrigatório")).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Motivo"), { target: { value: "conduta deste ciclo" } });
    fireEvent.click(screen.getByRole("button", { name: "confirmar liberação" }));
    expect(liberar).toHaveBeenCalledWith(ID.vermelho, "conduta deste ciclo");
    expect(await screen.findByText("conduta deste ciclo")).toBeTruthy();
  });

  it("idade vazia aparece PENDENTE e não avalia a triagem", async () => {
    const porta = criarPortaFalsa();
    const salvar = vi.spyOn(porta, "salvarTriagem");
    render(<TelaSalao porta={porta} />);
    fireEvent.click(await screen.findByRole("button", { name: "salvar triagem" }));
    expect(screen.getByText("PENDENTE: idade ausente. Triagem não avaliada (idade decide a frente).")).toBeTruthy();
    expect(salvar).not.toHaveBeenCalled();
  });
});
