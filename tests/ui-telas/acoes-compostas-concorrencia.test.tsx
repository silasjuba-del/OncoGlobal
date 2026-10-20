// @vitest-environment jsdom
// Proveniência: dados sintéticos; nenhuma execução clínica.
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { ConsultaPersistida } from "../../src/ui/consulta/ConsultaPersistida.js";
import { criarPortaFalsa } from "../../src/ui/api/fake.js";
import { prepararAcaoComposta } from "../../src/rules/prescricao/acoesCompostas.js";
import type { BaseAcaoComposta } from "../../src/contracts/api/acoesCompostas.js";
import type { AcaoCompostaPreparada, PrepararAcaoCompostaPedido } from "../../src/contracts/api/execucaoAcaoComposta.js";

afterEach(cleanup);
const contexto = { patientId: "pt-multi", encounterId: "en-multi", tumorLotId: "lot-multi-a" };
function fixture() {
  const porta = criarPortaFalsa();
  const base: BaseAcaoComposta = { contexto, cicloId: "ciclo-sintetico", episodioId: "episodio-sintetico",
    protocoloId: "protocolo-sintetico", previstoEm: "2026-10-20", revisao: "r1", baseHash: "a".repeat(64),
    itens: [{ item: 1, droga: "Fármaco sintético", doseMg: 100 }] };
  porta.carregarBaseAcaoComposta = vi.fn(async () => ({ base, pendencias: [] }));
  const liberar: Array<() => void> = [];
  porta.prepararAcaoComposta = vi.fn((pedido: PrepararAcaoCompostaPedido) => new Promise<AcaoCompostaPreparada>(resolve => {
    const resposta: AcaoCompostaPreparada = {
      draftId: `draft-sintetico-${liberar.length}`, revision: 0, conteudoHash: "b".repeat(64),
      resultado: prepararAcaoComposta(base, pedido.pedido),
      documentoPlano: { titulo: "Plano sintético", texto: pedido.pedido.motivo },
      criaEventoClinico: false, liberaTratamento: false,
    };
    liberar.push(() => resolve(resposta));
  }));
  return { porta, liberar };
}
async function abrir(nome: string) {
  fireEvent.click(await screen.findByRole("button", { name: nome }));
  await waitFor(() => expect((screen.getByLabelText("Motivo") as HTMLTextAreaElement).disabled).toBe(false));
}
function preparar(motivo: string) {
  fireEvent.change(screen.getByLabelText("Motivo"), { target: { value: motivo } });
  fireEvent.click(screen.getByRole("button", { name: "Preparar prévia" }));
}

it("resposta de comando abandonado não apaga a proposta mais nova já revisada", async () => {
  const f = fixture();
  render(<ConsultaPersistida porta={f.porta} contexto={contexto} />);
  await abrir("Manter ciclo"); preparar("Proposta anterior sintética");
  await waitFor(() => expect(f.liberar).toHaveLength(1));
  await abrir("Adiar ciclo"); preparar("Proposta nova sintética");
  await waitFor(() => expect(f.liberar).toHaveLength(2));
  await act(async () => f.liberar[1]!());
  fireEvent.click(await screen.findByRole("button", { name: "Usar esta proposta revisada" }));
  expect(screen.getByRole("article", { name: "Plano de ação revisado" }).textContent).toContain("Proposta nova sintética");
  await act(async () => f.liberar[0]!());
  expect(screen.getByRole("article", { name: "Plano de ação revisado" }).textContent).toContain("Proposta nova sintética");
  expect(screen.queryByText("Proposta anterior sintética")).toBeNull();
});

it("reabrir o mesmo comando inicia uma nova intenção sem deixar prévia inutilizável", async () => {
  const f = fixture();
  render(<ConsultaPersistida porta={f.porta} contexto={contexto} />);
  await abrir("Manter ciclo"); preparar("Primeira intenção sintética");
  await waitFor(() => expect(f.liberar).toHaveLength(1));
  await act(async () => f.liberar[0]!());
  expect(await screen.findByRole("region", { name: "Prévia para revisão" })).toBeTruthy();
  await abrir("Manter ciclo");
  expect(screen.queryByRole("region", { name: "Prévia para revisão" })).toBeNull();
  expect((screen.getByLabelText("Motivo") as HTMLTextAreaElement).value).toBe("");
  preparar("Segunda intenção sintética");
  await waitFor(() => expect(f.liberar).toHaveLength(2));
  await act(async () => f.liberar[1]!());
  fireEvent.click(await screen.findByRole("button", { name: "Usar esta proposta revisada" }));
  expect(screen.getByRole("article", { name: "Plano de ação revisado" }).textContent).toContain("Segunda intenção sintética");
});
