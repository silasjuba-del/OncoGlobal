// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { OncoassistLocal } from "../../../src/ui/OncoassistLocal.js";
import { criarPortaFalsa } from "../../../src/ui/api/fake.js";

afterEach(() => { vi.useRealTimers(); cleanup(); });

it("consulta que não volta libera a tela em 20 s para tentar de novo", async () => {
  const porta = criarPortaFalsa();
  porta.carregarConsulta = () => new Promise(() => {});
  porta.selecionarContexto = () => new Promise(() => {});
  porta.lotesPaciente = () => new Promise(() => {});
  render(<OncoassistLocal fabricaPorta={() => porta} />);
  fireEvent.change(screen.getByLabelText("Senha do servidor"), { target: { value: "senha-sintetica-para-teste" } });
  fireEvent.click(screen.getByRole("button", { name: "Entrar" }));
  const agenda = await porta.agendaDoDia();
  const select = await screen.findByLabelText("Paciente da agenda");
  vi.useFakeTimers();
  await act(async () => {
    fireEvent.change(select, { target: { value: agenda.itens[0]!.encounterId } });
  });
  expect(screen.getByText("Abrindo consulta…")).toBeTruthy();
  await act(async () => { await vi.advanceTimersByTimeAsync(20_000); });
  expect(screen.getByText("Não foi possível abrir a consulta local.")).toBeTruthy();
  expect((screen.getByLabelText("Paciente da agenda") as HTMLSelectElement).disabled).toBe(false);
});
