// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { BaseAcaoComposta } from "../../src/contracts/api/acoesCompostas.js";
import { prepararAcaoComposta } from "../../src/rules/prescricao/acoesCompostas.js";
import { AcoesCompostas } from "../../src/ui/consulta/AcoesCompostas.js";

afterEach(cleanup);

const base = (revisao = "revisao-sintetica-1"): BaseAcaoComposta => ({
  contexto: { patientId: "paciente-sintetico", encounterId: "encontro-sintetico", tumorLotId: "lote-sintetico" },
  revisao,
  baseHash: revisao === "revisao-sintetica-1" ? "a".repeat(64) : "b".repeat(64),
  cicloId: "ciclo-sintetico",
  episodioId: "episodio-sintetico",
  protocoloId: "protocolo-sintetico-A",
  previstoEm: "2026-10-20",
  itens: [{ item: 1, droga: "Fármaco alfa", doseMg: 100 }, { item: 2, droga: "Fármaco beta", doseMg: null }],
});

describe("AcoesCompostas: editor de proposta sem ato clínico", () => {
  it("explica base ausente e não permite preparar ação", () => {
    const aoPreparar = vi.fn();
    render(<AcoesCompostas base={null} tipoInicial="REDUZIR_DOSE" aoPreparar={aoPreparar} aoUsar={vi.fn()} />);
    expect(screen.getByText(/base do ciclo ausente/i)).toBeTruthy();
    expect(screen.getByRole("button", { name: /preparar prévia/i }).hasAttribute("disabled")).toBe(true);
    expect(aoPreparar).not.toHaveBeenCalled();
  });

  it("mostra diff e motivo para revisão antes de chamar aoUsar", async () => {
    const atual = base();
    const aoPreparar = vi.fn(async (pedido: Parameters<typeof prepararAcaoComposta>[1]) => prepararAcaoComposta(atual, pedido));
    const aoUsar = vi.fn();
    render(<AcoesCompostas base={atual} tipoInicial="REDUZIR_DOSE" aoPreparar={aoPreparar} aoUsar={aoUsar} />);

    fireEvent.change(screen.getByLabelText("Motivo"), { target: { value: "Redução solicitada para revisão." } });
    fireEvent.change(screen.getByLabelText("Percentual de redução"), { target: { value: "25" } });
    fireEvent.click(screen.getByLabelText("Selecionar item 1 — Fármaco alfa (100 mg)"));
    fireEvent.click(screen.getByRole("button", { name: /preparar prévia/i }));

    expect(await screen.findByText(/protocolo-sintetico-a/i)).toBeTruthy();
    expect(screen.getByText("75 mg")).toBeTruthy();
    expect(screen.getByText("Redução solicitada para revisão.")).toBeTruthy();
    expect(aoPreparar).toHaveBeenCalledWith({ tipo: "REDUZIR_DOSE", motivo: "Redução solicitada para revisão.", reducaoPct: 25, itensSelecionados: [1] });
    expect(aoUsar).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: /usar esta proposta revisada/i }));
    await waitFor(() => expect(aoUsar).toHaveBeenCalledWith(expect.objectContaining({ estado: "PREPARADA", baseRevisao: atual.revisao })));
  });

  it("descarta a prévia se a revisão/hash da base mudar", async () => {
    const atual = base();
    const aoPreparar = vi.fn(async (pedido: Parameters<typeof prepararAcaoComposta>[1]) => prepararAcaoComposta(atual, pedido));
    const aoUsar = vi.fn();
    const view = render(<AcoesCompostas base={atual} tipoInicial="REDUZIR_DOSE" aoPreparar={aoPreparar} aoUsar={aoUsar} />);
    fireEvent.change(screen.getByLabelText("Motivo"), { target: { value: "Revisar redução." } });
    fireEvent.click(screen.getByLabelText("Selecionar item 1 — Fármaco alfa (100 mg)"));
    fireEvent.click(screen.getByRole("button", { name: /preparar prévia/i }));
    expect(await screen.findByText("80 mg")).toBeTruthy();

    view.rerender(<AcoesCompostas base={base("revisao-sintetica-2")} tipoInicial="REDUZIR_DOSE" aoPreparar={aoPreparar} aoUsar={aoUsar} />);
    await waitFor(() => expect(screen.queryByText("80 mg")).toBeNull());
    expect(screen.queryByRole("button", { name: /usar esta proposta revisada/i })).toBeNull();
    expect(aoUsar).not.toHaveBeenCalled();
  });
});
