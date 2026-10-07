// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { criarPortaFalsa, ID } from "../../src/ui/api/fake.js";
import { Agenda } from "../../src/ui/telas/Agenda.js";

afterEach(() => {
  cleanup();
});

describe("agenda do dia", () => {
  it("preserva a ordem da porta, mostra E1 e não pinta pendente de verde", async () => {
    const visao = await criarPortaFalsa().agendaDoDia();
    const onAbrir = vi.fn();
    const { container } = render(<Agenda visao={visao} onAbrir={onAbrir} />);
    const ids = [...container.querySelectorAll("[data-patient]")].map((el) => el.getAttribute("data-patient"));
    expect(ids).toEqual(visao.itens.map((item) => item.patientId));
    expect(ids).not.toEqual([...ids].sort());

    const pendente = container.querySelector(`[data-patient="${ID.pendente}"]`);
    expect(pendente?.textContent).toContain("PENDENTE");
    expect(pendente?.querySelector(".semaforo-verde")).toBeNull();
    expect(pendente?.textContent).toContain("pré-consulta pronta: não");

    const e1 = container.querySelector(`[data-patient="${ID.e1}"]`);
    expect(e1?.textContent).toContain("E1");

    fireEvent.click(screen.getByRole("button", { name: "abrir Paciente Teste PR-VERDE" }));
    expect(onAbrir).toHaveBeenCalledWith(ID.verde);
  });

  it("próximo paciente segue a ordem recebida", async () => {
    const visao = await criarPortaFalsa().agendaDoDia();
    const onAbrir = vi.fn();
    render(<Agenda visao={visao} onAbrir={onAbrir} />);
    fireEvent.click(screen.getByRole("button", { name: "próximo paciente" }));
    fireEvent.click(screen.getByRole("button", { name: "próximo paciente" }));
    expect(onAbrir.mock.calls.map((chamada) => chamada[0])).toEqual([
      visao.itens[0]?.patientId,
      visao.itens[1]?.patientId,
    ]);
  });
});
