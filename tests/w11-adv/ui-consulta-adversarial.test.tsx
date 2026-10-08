// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { criarChaves } from "../../src/ui/api/chaves.js";
import { ErroPorta, type PortaConsulta } from "../../src/ui/api/porta.js";
import { criarPortaFalsa, ID } from "../../src/ui/api/fake.js";
import { TelaConsulta } from "../../src/ui/telas/TelaConsulta.js";
import { Bundle, type DocumentoBundleVisao } from "../../src/ui/consulta/Bundle.js";

afterEach(() => {
  cleanup();
});

function portaComExibicaoFalha(): PortaConsulta {
  const base = criarPortaFalsa();
  return {
    ...base,
    exibirBundle: vi.fn(async () => {
      throw new ErroPorta("SERVIDOR_PENDENTE");
    }),
  };
}

const PROIBIDAS_MAQUINA = /amarelo|liberad[oa]|aprovad[oa]|\bapto\b/i;

describe("w11-h19 adversarial: fechamento da consulta", () => {
  it("1. validar tudo sem exibirBundle bem-sucedido nao chama confirmar", async () => {
    const porta = portaComExibicaoFalha();
    const confirmar = vi.spyOn(porta, "confirmar");
    render(<TelaConsulta patientId={ID.verde} porta={porta} chaves={criarChaves()} />);
    fireEvent.click(await screen.findByRole("button", { name: "validar tudo" }));
    await waitFor(() => expect(porta.exibirBundle).toHaveBeenCalledTimes(1));
    await new Promise((r) => setTimeout(r, 20));
    expect(confirmar).not.toHaveBeenCalled();
    expect(await screen.findByRole("status", { name: "status do fechamento" })).toBeTruthy();
    expect(screen.getByRole("status", { name: "status do fechamento" }).textContent).toBe("SERVIDOR_PENDENTE");
  });

  it("2. falha de exibirBundle nao arma impressao e Enter nao imprime", async () => {
    const porta = portaComExibicaoFalha();
    const acao = vi.spyOn(porta, "acao");
    render(<TelaConsulta patientId={ID.verde} porta={porta} chaves={criarChaves()} />);
    fireEvent.click(await screen.findByRole("button", { name: "validar tudo" }));
    await waitFor(() => expect(porta.exibirBundle).toHaveBeenCalledTimes(1));
    await new Promise((r) => setTimeout(r, 20));
    expect(screen.queryByText("Enter confirma a impressão")).toBeNull();
    expect(screen.queryByRole("button", { name: "confirmar impressão" })).toBeNull();
    fireEvent.keyDown(window, { key: "Enter" });
    await new Promise((r) => setTimeout(r, 20));
    expect(acao).not.toHaveBeenCalled();
  });

  it("3. duplo clique em validar tudo confirma uma vez", async () => {
    const porta = criarPortaFalsa();
    const exibir = vi.spyOn(porta, "exibirBundle");
    const confirmar = vi.spyOn(porta, "confirmar");
    render(<TelaConsulta patientId={ID.verde} porta={porta} chaves={criarChaves()} />);
    const botao = await screen.findByRole("button", { name: "validar tudo" });
    fireEvent.click(botao);
    fireEvent.click(botao);
    fireEvent.click(botao);
    await waitFor(() => expect(confirmar).toHaveBeenCalledTimes(1));
    await new Promise((r) => setTimeout(r, 20));
    expect(exibir).toHaveBeenCalledTimes(1);
    expect(confirmar).toHaveBeenCalledTimes(1);
  });

  it("4. nenhum texto renderizado traz amarelo, LIBERADO, APROVADO ou APTO", async () => {
    for (const id of [ID.verde, ID.vermelho, ID.pendente, ID.e1]) {
      const { container, unmount } = render(
        <TelaConsulta patientId={id} porta={criarPortaFalsa()} chaves={criarChaves()} />,
      );
      await screen.findByRole("button", { name: "validar tudo" });
      const texto = container.textContent ?? "";
      expect(texto.match(PROIBIDAS_MAQUINA), `paciente ${id}`).toBeNull();
      unmount();
    }
  });

  it("5. alerta E1 visivel nao desabilita salvar, validar nem imprimir", async () => {
    render(<TelaConsulta patientId={ID.e1} porta={criarPortaFalsa()} chaves={criarChaves()} />);
    expect(await screen.findByText("Emergência E1 — não dispensável")).toBeTruthy();
    expect((screen.getByRole("button", { name: "Salvar rascunho" }) as HTMLButtonElement).disabled).toBe(false);
    expect((screen.getByRole("button", { name: "validar tudo" }) as HTMLButtonElement).disabled).toBe(false);
    expect((screen.getByRole("button", { name: "validar bloco" }) as HTMLButtonElement).disabled).toBe(false);
    expect((screen.getByRole("button", { name: "imprimir" }) as HTMLButtonElement).disabled).toBe(false);
  });

  it("6. checkboxes de sugestao nascem desmarcados quando o item nao e pre-marcado", () => {
    const docs: DocumentoBundleVisao[] = [
      { documentId: "sug-1", documentVersion: 1, titulo: "sugestão sintética", preMarcado: false, visivel: true },
      { documentId: "sug-2", documentVersion: 1, titulo: "sugestão sintética 2", preMarcado: false, visivel: true },
    ];
    const marcados: Record<string, boolean> = { "sug-1": false, "sug-2": false };
    render(<Bundle documentos={docs} marcados={marcados} onAlternar={() => undefined} />);
    const caixas = screen.getAllByRole("checkbox") as HTMLInputElement[];
    expect(caixas.length).toBe(2);
    expect(caixas.every((c) => c.checked === false)).toBe(true);
  });

  it("6b. painel OncoAssist nao traz nenhum checkbox marcado", async () => {
    const { container } = render(<TelaConsulta patientId={ID.verde} porta={criarPortaFalsa()} chaves={criarChaves()} />);
    await screen.findByRole("button", { name: "validar tudo" });
    const painel = container.querySelector('section[aria-label="OncoAssist — documentos"]');
    expect(painel).not.toBeNull();
    const marcados = Array.from(painel!.querySelectorAll('input[type="checkbox"]')).filter(
      (c) => (c as HTMLInputElement).checked,
    );
    expect(marcados.length).toBe(0);
  });

  it("7. conteudo de impressao (fechamento) sem IA, OncoAssist ou inteligencia artificial", async () => {
    render(<TelaConsulta patientId={ID.verde} porta={criarPortaFalsa()} chaves={criarChaves()} />);
    const fechamento = await screen.findByLabelText("Fechamento");
    const texto = fechamento.textContent ?? "";
    expect(texto).not.toMatch(/\bIA\b/);
    expect(texto).not.toMatch(/oncoassist/i);
    expect(texto).not.toMatch(/inteligência artificial/i);
    expect(texto.length).toBeGreaterThan(0);
  });
});
