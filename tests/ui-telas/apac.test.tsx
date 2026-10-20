// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ActionIntent } from "../../src/contracts/operacao.js";
import { criarChaves } from "../../src/ui/api/chaves.js";
import { criarPortaFalsa } from "../../src/ui/api/fake.js";
import { TelaApacLote } from "../../src/ui/telas/apac/TelaApacLote.js";

afterEach(() => {
  cleanup();
});

describe("APAC em bloco por lote", () => {
  it.each(["troca", "desmontagem", "erro-tardio"] as const)(
    "R33-02: %s durante primeira APAC impede despacho das seguintes", async (cenario) => {
      const antiga = criarPortaFalsa(), chaves = criarChaves();
      let resolver: ((value: { codigo: string; decisao: string }) => void) | undefined;
      let rejeitar: ((reason: Error) => void) | undefined;
      const acao = vi.spyOn(antiga, "acao")
        .mockImplementationOnce(() => new Promise((resolve, reject) => { resolver = resolve; rejeitar = reject; }))
        .mockResolvedValue({ codigo: "EXPORTAR_APAC", decisao: "EXECUTADA" });
      const tela = render(<TelaApacLote porta={antiga} chaves={chaves} />);
      await screen.findByLabelText("APAC por lote");
      for (const id of ["apac-verde-1", "apac-verde-2"])
        fireEvent.click(screen.getByRole("checkbox", { name: `selecionar ${id}` }));
      fireEvent.click(screen.getByRole("button", { name: "exportar selecionadas" }));
      expect(acao).toHaveBeenCalledTimes(1);
      if (cenario === "desmontagem") tela.unmount();
      else {
        tela.rerender(<TelaApacLote porta={criarPortaFalsa()} chaves={chaves} />);
        await screen.findByLabelText("APAC por lote");
      }
      await act(async () => {
        if (cenario === "erro-tardio") rejeitar?.(new Error("falha-sintetica"));
        else resolver?.({ codigo: "EXPORTAR_APAC", decisao: "EXECUTADA" });
      });
      expect(screen.queryByText(/Resultado da exportação:/)).toBeNull();
      expect(acao).toHaveBeenCalledTimes(1);
      expect(acao.mock.calls[0]![0].objeto.id).toBe("apac-verde-1");
    });

  it("D85 avisa, D90 fica fora, negada preserva o motivo e PENDENTE não vira intenção", async () => {
    const porta = criarPortaFalsa();
    render(<TelaApacLote porta={porta} chaves={criarChaves()} />);
    await screen.findByLabelText("APAC por lote");

    const multiA = screen.getByLabelText("Lote lot-multi-a");
    expect(multiA.textContent).toContain("PENDENTE");
    expect(multiA.textContent).toContain("aviso D85");
    expect(multiA.textContent).toContain("dias: 85");
    expect(multiA.textContent).not.toContain("ADJUVANTE");

    const multiB = screen.getByLabelText("Lote lot-multi-b");
    expect(multiB.textContent).toContain("VENCIDA");
    expect(multiB.textContent).toContain("fora do faturamento");
    expect(multiB.textContent).toContain("consulta segue");
    expect(multiB.textContent).toContain("dias: 90");
    expect(screen.getByRole("checkbox", { name: "selecionar apac-multi-b" }).hasAttribute("disabled")).toBe(true);

    const negada = screen.getByLabelText("Lote lot-vermelho");
    expect(negada.textContent).toContain("NEGADA");
    expect(negada.textContent).toContain("estádio ausente");
    expect(negada.textContent).toContain("estadiamentos");
    expect(negada.textContent).not.toContain("VENCIDA");
    expect(negada.textContent).not.toContain("ADJUVANTE");
  });

  it("cada APAC selecionada gera a própria intenção (apacId/versão do servidor), a vencida não entra e o resultado é visível", async () => {
    const porta = criarPortaFalsa();
    const acao = vi.spyOn(porta, "acao");
    render(<TelaApacLote porta={porta} chaves={criarChaves()} />);
    await screen.findByLabelText("APAC por lote");

    fireEvent.click(screen.getByRole("checkbox", { name: "selecionar apac-verde-1" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "selecionar apac-verde-2" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "selecionar apac-multi-b" }));
    fireEvent.click(screen.getByRole("button", { name: "exportar selecionadas" }));
    expect(await screen.findByText(/Resultado da exportação:/)).toBeTruthy();

    expect(acao).toHaveBeenCalledTimes(2);
    const primeira = acao.mock.calls[0]?.[0];
    const segunda = acao.mock.calls[1]?.[0];
    expect(primeira?.verbo).toBe("EXPORTAR_APAC");
    expect(primeira?.objeto).toEqual({ tipo: "APAC", id: "apac-verde-1", versao: 1 });
    expect(segunda?.objeto).toEqual({ tipo: "APAC", id: "apac-verde-2", versao: 1 });
    expect(ActionIntent.safeParse(primeira).success).toBe(true);
    expect(primeira).not.toHaveProperty("medicoId");
    expect(JSON.stringify(primeira)).not.toContain("ADJUVANTE");
    expect(acao.mock.calls.some((chamada) => chamada[0]?.objeto.id === "lot-multi-b"
      || chamada[0]?.objeto.id === "apac-multi-b")).toBe(false);

    fireEvent.click(screen.getByRole("button", { name: "exportar selecionadas" }));
    expect(await screen.findByText(/REPLAY/)).toBeTruthy();
    expect(acao).toHaveBeenCalledTimes(4);
    expect(acao.mock.calls[2]?.[0]?.idempotencyKey).toBe(primeira?.idempotencyKey);
    expect(acao.mock.calls[3]?.[0]?.idempotencyKey).toBe(segunda?.idempotencyKey);
  });

  it("troca de porta durante exportação não publica resultado antigo nem mantém seleção", async () => {
    const portaAntiga = criarPortaFalsa();
    let resolverAcao: ((valor: { codigo: string; decisao: string }) => void) | undefined;
    vi.spyOn(portaAntiga, "acao").mockImplementation(() => new Promise((resolve) => { resolverAcao = resolve; }));
    const chaves = criarChaves();
    const tela = render(<TelaApacLote porta={portaAntiga} chaves={chaves} />);
    await screen.findByLabelText("APAC por lote");
    fireEvent.click(screen.getByRole("checkbox", { name: "selecionar apac-verde-1" }));
    fireEvent.click(screen.getByRole("button", { name: "exportar selecionadas" }));

    tela.rerender(<TelaApacLote porta={criarPortaFalsa()} chaves={chaves} />);
    await screen.findByLabelText("APAC por lote");
    await act(async () => { resolverAcao?.({ codigo: "EXPORTAR_APAC", decisao: "EXECUTADA" }); });

    expect(screen.queryByText(/Resultado da exportação:/)).toBeNull();
    expect((screen.getByRole("checkbox", { name: "selecionar apac-verde-1" }) as HTMLInputElement).checked).toBe(false);
  });
});
