// @vitest-environment jsdom
// Fármacos e dados inteiramente sintéticos.
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { EditorPrescricaoExecutavel } from "../../src/ui/consulta/EditorPrescricaoExecutavel.js";
import { InstanciacaoFichaRespostaSchema } from "../../src/contracts/api/fichasPrescricao.js";
import type { BasePrescricaoExecutavelResposta, EdicaoPrescricaoExecutavel } from "../../src/contracts/api/operacaoPrescricaoExecutavel.js";
afterEach(cleanup);
const contexto = { patientId: "p-sintetico", encounterId: "e-sintetico", tumorLotId: "l-sintetico" };
const base: BasePrescricaoExecutavelResposta = { contexto, revisao: "base-sintetica", pacienteNome: "Pessoa sintética",
  ciclo: null, episodio: null, vigente: null, pendencias: [] };
const item = { drug: "Fármaco sintético", classe: "QT", sequence: 1, standardDose: 1.5, doseBasis: "FIXED",
  calculatedDose: 1.5, prescribedDose: 1.5, unit: "mg", adjustmentPercent: null, adjustmentReason: null, route: "EV",
  diluent: "Diluente sintético", finalVolumeMl: 100, infusionTime: "30 min", days: ["d1"], observacao: null,
  source: "PROTOCOL", overrideMotivo: null };
function fonte(id = "ficha-a") {
  return InstanciacaoFichaRespostaSchema.parse({ contexto, origemProposta: { draftId: id, revision: 0, hash: "a".repeat(64) },
    template: { templateId: id, nome: "Modelo sintético", tumor: "Tumor sintético", cenario: "Cenário sintético",
      versao: "1", hash: "rótulo-original", codigoInstitucional: null, intervaloDias: null, ciclos: null,
      itens: [item], limiaresBula: null, fonte: "Fonte sintética conferida", status: "RASCUNHO" },
    contentHash: "b".repeat(64), revisionFicha: 1, revisaoFatos: "c".repeat(64),
    itens: [{ itemId: "item-1", item }, { itemId: "item-2", item: { ...item, drug: "Segundo fármaco sintético", sequence: 2 } }],
    pendencias: [], avisos: ["Aviso sintético de cálculo"], dadosCorporais: { pesoKg: null, alturaCm: null, bsaM2: null, clcr: null, medidoEm: null } });
}
const valor = (label: string) => (screen.getByLabelText(label) as HTMLInputElement).value;
const preencher = (label: string, value: string) => fireEvent.change(screen.getByLabelText(label), { target: { value } });
it("preenche a partir da origem e apresenta fonte/avisos, sem preparar ou assinar automaticamente", async () => {
  const aoPreparar = vi.fn(), aoAssinar = vi.fn(), dirty = vi.fn();
  render(<EditorPrescricaoExecutavel base={base} origemFicha={fonte()} aoPreparar={aoPreparar} aoAssinar={aoAssinar} aoAlterarPendente={dirty} />);
  await screen.findByLabelText("Medicamento · item 1");
  expect(valor("Dose final · item 1")).toBe("1.5");
  expect(valor("Protocolo ou esquema")).toBe("Modelo sintético");
  expect(screen.getByText("Aviso sintético de cálculo")).toBeTruthy();
  expect(dirty).toHaveBeenLastCalledWith(true);
  expect(aoPreparar).not.toHaveBeenCalled(); expect(aoAssinar).not.toHaveBeenCalled();
});
it("preserva edição manual até confirmação explícita de substituir pelos itens de outra ficha", async () => {
  const props = { base, aoPreparar: vi.fn(), aoAssinar: vi.fn() };
  const view = render(<EditorPrescricaoExecutavel {...props} origemFicha={fonte()} />);
  await screen.findByLabelText("Medicamento · item 1");
  preencher("Dose final · item 1", "1.25");
  view.rerender(<EditorPrescricaoExecutavel {...props} origemFicha={fonte("ficha-b")} />);
  expect(valor("Dose final · item 1")).toBe("1.25");
  fireEvent.click(await screen.findByRole("button", { name: "Substituir itens pela ficha selecionada" }));
  expect(valor("Dose final · item 1")).toBe("1.5");
});
it("ajuste manual de um item preserva origem para os outros itens PROTOCOL", async () => {
  const origem = fonte(), aoPreparar = vi.fn(async (_pedido: EdicaoPrescricaoExecutavel) => { throw new Error("Interrupção sintética após capturar pedido"); });
  render(<EditorPrescricaoExecutavel base={base} origemFicha={origem} aoPreparar={aoPreparar} aoAssinar={vi.fn()} />);
  await screen.findByLabelText("Medicamento · item 1");
  preencher("Dose final · item 1", "1.25"); preencher("Motivo do override · item 1", "Ajuste manual sintético");
  preencher("Linha terapêutica", "1"); preencher("Intenção terapêutica", "PALIATIVA");
  preencher("Número do ciclo", "1"); preencher("Data prevista", "2026-10-20"); preencher("Motivo da prescrição", "Revisão sintética");
  fireEvent.click(screen.getByRole("button", { name: "Preparar prévia exata" }));
  await waitFor(() => expect(aoPreparar).toHaveBeenCalledOnce());
  const pedido = aoPreparar.mock.calls[0]![0];
  expect(pedido.origemProposta).toEqual(origem.origemProposta);
  expect(pedido.itens[0]!.item.source).toBe("MANUAL");
  expect(pedido.itens[1]!.item.source).toBe("PROTOCOL");
});
