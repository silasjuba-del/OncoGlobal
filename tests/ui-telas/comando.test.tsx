// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { BarraComando } from "../../src/ui/telas/BarraComando.js";
import type { PacienteBusca } from "../../src/ui/telas/comandos.js";

const pacientes: readonly PacienteBusca[] = [
  { patientId: "pt-verde", nome: "Paciente Teste", prontuario: "PR-VERDE" },
  { patientId: "pt-vermelho", nome: "Paciente Teste", prontuario: "PR-VERMELHO" },
  { patientId: "pt-pendente", nome: "Paciente Teste 03", prontuario: "PR-PENDENTE" },
];

const ordem = ["pt-verde", "pt-vermelho", "pt-pendente"];

afterEach(() => {
  cleanup();
});

function montar(abertoId: string | null = null) {
  const onAbrir = vi.fn();
  const onValidarTudo = vi.fn();
  const onImprimir = vi.fn();
  const onNovaTriagem = vi.fn();
  const onSalao = vi.fn();
  const onApac = vi.fn();
  const onCanal = vi.fn();
  render(
    <BarraComando
      pacientes={pacientes}
      ordemIds={ordem}
      pacienteAbertoId={abertoId}
      onAbrir={onAbrir}
      onValidarTudo={onValidarTudo}
      onImprimir={onImprimir}
      onNovaTriagem={onNovaTriagem}
      onSalao={onSalao}
      onApac={onApac}
      onCanal={onCanal}
    />,
  );
  return { onAbrir, onValidarTudo, onImprimir, onNovaTriagem, onSalao, onApac, onCanal };
}

function escrever(comando: string) {
  fireEvent.keyDown(window, { key: "k", ctrlKey: true });
  const campo = screen.getByLabelText("Comando");
  fireEvent.change(campo, { target: { value: comando } });
  fireEvent.keyDown(campo, { key: "Enter" });
}

describe("barra de comando", () => {
  it("homônimos listam e não abrem; comando incompleto não age", () => {
    const acoes = montar();
    escrever("abrir Paciente Teste");
    expect(screen.getByLabelText("Pacientes encontrados").textContent).toContain("PR-VERDE");
    expect(screen.getByLabelText("Pacientes encontrados").textContent).toContain("PR-VERMELHO");
    expect(acoes.onAbrir).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText("Comando"), { target: { value: "abrir" } });
    fireEvent.keyDown(screen.getByLabelText("Comando"), { key: "Enter" });
    expect(screen.getByText("comando incompleto")).toBeTruthy();
    expect(acoes.onAbrir).not.toHaveBeenCalled();
  });

  it("imprimir sem paciente não faz nada; com paciente pede uma tecla", () => {
    const semPaciente = montar(null);
    escrever("imprimir");
    expect(semPaciente.onImprimir).not.toHaveBeenCalled();
    expect(screen.queryByText("Enter confirma a impressão")).toBeNull();
    cleanup();

    const comPaciente = montar("pt-verde");
    fireEvent.keyDown(window, { key: "p", ctrlKey: true });
    expect(screen.getByText("Enter confirma a impressão")).toBeTruthy();
    expect(comPaciente.onImprimir).not.toHaveBeenCalled();
    fireEvent.keyDown(window, { key: "Enter" });
    expect(comPaciente.onImprimir).toHaveBeenCalledTimes(1);
    fireEvent.keyDown(window, { key: "Enter" });
    expect(comPaciente.onImprimir).toHaveBeenCalledTimes(1);
  });

  it("atalhos e comandos funcionam só pelo teclado", () => {
    const acoes = montar("pt-verde");
    fireEvent.keyDown(window, { key: "Enter", ctrlKey: true });
    expect(acoes.onValidarTudo).toHaveBeenCalledTimes(1);

    escrever("abrir PR-PENDENTE");
    expect(acoes.onAbrir).toHaveBeenCalledWith("pt-pendente");

    fireEvent.change(screen.getByLabelText("Comando"), { target: { value: "próximo paciente" } });
    fireEvent.keyDown(screen.getByLabelText("Comando"), { key: "Enter" });
    expect(acoes.onAbrir).toHaveBeenCalledWith("pt-vermelho");

    for (const [comando, fn] of [
      ["nova triagem", acoes.onNovaTriagem],
      ["salão", acoes.onSalao],
      ["APAC", acoes.onApac],
      ["canal", acoes.onCanal],
    ] as const) {
      fireEvent.change(screen.getByLabelText("Comando"), { target: { value: comando } });
      fireEvent.keyDown(screen.getByLabelText("Comando"), { key: "Enter" });
      expect(fn).toHaveBeenCalledTimes(1);
    }

    const controles = [
      ...screen.getAllByRole("button"),
      ...screen.getAllByRole("textbox"),
    ];
    for (const controle of controles) {
      expect(controle.getAttribute("aria-label") || controle.textContent || controle.getAttribute("id")).toBeTruthy();
      expect(controle.getAttribute("tabindex")).not.toBe("-1");
    }
  });
});
