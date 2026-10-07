// @vitest-environment jsdom
import { useState } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ActionIntent } from "../../src/contracts/operacao.js";
import { criarChaves, type ChavesIntencao } from "../../src/ui/api/chaves.js";
import { criarPortaFalsa, ID } from "../../src/ui/api/fake.js";
import type { PortaConsulta } from "../../src/ui/api/porta.js";
import { TelaConsulta } from "../../src/ui/telas/TelaConsulta.js";

afterEach(() => {
  cleanup();
});

function Abrir({
  porta,
  chaves,
  patientId,
  rotulo,
}: {
  porta: PortaConsulta;
  chaves: ChavesIntencao;
  patientId: string;
  rotulo: string;
}) {
  const [aberto, setAberto] = useState<string | null>(null);
  if (!aberto) {
    return <button type="button" onClick={() => setAberto(patientId)}>{rotulo}</button>;
  }
  return <TelaConsulta patientId={aberto} porta={porta} chaves={chaves} />;
}

describe("consulta pronta", () => {
  it("rotina abre, valida e imprime em 3 cliques; imprimir só depois do Enter", async () => {
    const porta = criarPortaFalsa();
    const acao = vi.spyOn(porta, "acao");
    const confirmar = vi.spyOn(porta, "confirmar");
    const cliques: string[] = [];
    render(<Abrir porta={porta} chaves={criarChaves()} patientId={ID.verde} rotulo="abrir Paciente Teste" />);

    fireEvent.click(screen.getByRole("button", { name: "abrir Paciente Teste" }));
    cliques.push("abrir");
    fireEvent.click(await screen.findByRole("button", { name: "validar tudo" }));
    cliques.push("validar tudo");
    fireEvent.click(screen.getByRole("button", { name: "validar tudo" }));
    fireEvent.click(screen.getByRole("button", { name: "imprimir" }));
    cliques.push("imprimir");

    expect(cliques).toEqual(["abrir", "validar tudo", "imprimir"]);
    expect(acao).not.toHaveBeenCalled();
    expect(confirmar).toHaveBeenCalledTimes(2);
    const chaves = confirmar.mock.calls.map((chamada) => chamada[0].idempotencyKey);
    expect(chaves[0]).toBe(chaves[1]);
    expect(confirmar.mock.calls[0]?.[0].bloco).toBe("TUDO");
    expect(JSON.stringify(confirmar.mock.calls[0]?.[0])).not.toContain("medicoId");

    fireEvent.keyDown(window, { key: "Enter" });
    expect(acao).toHaveBeenCalledTimes(1);
    const intent = acao.mock.calls[0]?.[0];
    expect(ActionIntent.safeParse(intent).success).toBe(true);
    expect(intent?.verbo).toBe("IMPRIMIR");
    expect(JSON.stringify(intent)).not.toContain("medicoId");
  });

  it("com vermelho a lista de ciente aparece antes de validar e o percurso cabe em 5 cliques", async () => {
    const porta = criarPortaFalsa();
    const acao = vi.spyOn(porta, "acao");
    const cliques: string[] = [];
    render(<Abrir porta={porta} chaves={criarChaves()} patientId={ID.vermelho} rotulo="abrir consulta vermelha" />);
    fireEvent.click(screen.getByRole("button", { name: "abrir consulta vermelha" }));
    cliques.push("abrir");
    expect(await screen.findByText("Serão marcados como ciente:")).toBeTruthy();
    expect(screen.getByText("hemoglobina abaixo do corte")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "validar tudo" }));
    cliques.push("validar tudo");
    expect(cliques.length).toBeLessThanOrEqual(5);
    expect(acao).not.toHaveBeenCalled();
  });

  it("paciente pendente não aparece verde", async () => {
    render(<TelaConsulta patientId={ID.pendente} porta={criarPortaFalsa()} chaves={criarChaves()} />);
    const header = await screen.findByLabelText("Cabeçalho do paciente");
    expect(header.textContent).toContain("PENDENTE");
    expect(header.querySelector(".semaforo-verde")).toBeNull();
    expect(header.querySelector("[data-semaforo]")?.getAttribute("data-semaforo")).toBe("PENDENTE");
    expect(document.querySelector(".semaforo-verde")).toBeNull();
  });
});
