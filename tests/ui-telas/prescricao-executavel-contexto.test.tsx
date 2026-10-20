// @vitest-environment jsdom
// Dados sintéticos; testa identidade do acknowledgement e fronteiras assíncronas.
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { ConsultaPersistida } from "../../src/ui/consulta/ConsultaPersistida.js";
import { criarPortaFalsa } from "../../src/ui/api/fake.js";
import type { BasePrescricaoExecutavelResposta, PrepararPrescricaoExecutavelPedido,
  PrescricaoExecutavelPreparada } from "../../src/contracts/api/operacaoPrescricaoExecutavel.js";
import { presente, ausente } from "../fixtures/triagem.js";

afterEach(cleanup);
const contexto = { patientId: "pt-multi", encounterId: "en-multi", tumorLotId: "lot-multi-a" };
function fixture() {
  const porta = criarPortaFalsa();
  const conteudo: PrescricaoExecutavelPreparada["conteudo"] = {
    schema: "PrescricaoExecutavel@1", contexto: { ...contexto, episodioId: "ep-sintetico", cicloId: "ciclo-sintetico" },
    documentId: "rx-sintetica", documentVersion: 1, protocoloId: "protocolo-sintetico",
    dataPrevista: "2026-10-20", motivo: "Revisão sintética", origemProposta: null,
    itens: [{ itemId: "item-sintetico", item: {
      drug: "Fármaco sintético", classe: "QT", sequence: 1, standardDose: null,
      doseBasis: "FIXED", calculatedDose: null, prescribedDose: 1.5, unit: "mg",
      adjustmentPercent: null, adjustmentReason: null, route: "EV", diluent: "Diluente sintético",
      finalVolumeMl: 100, infusionTime: "30 min", days: ["d1"], observacao: null,
      source: "MANUAL", overrideMotivo: "Escolha sintética explícita",
    } }],
  };
  const base: BasePrescricaoExecutavelResposta = {
    contexto, pacienteNome: "Paciente sintético", revisao: "a".repeat(64), pendencias: [], vigente: conteudo,
    episodio: { episodioId: "ep-sintetico", tumorLotId: contexto.tumorLotId, modalidade: "QT", intencao: "PALIATIVA",
      intentModifier: null, linha: 1, esquemaId: "protocolo-sintetico", inicio: ausente<string>(), fim: ausente<string>() },
    ciclo: { cicloId: "ciclo-sintetico", episodioId: "ep-sintetico", numero: 1, previstoEm: "2026-10-20",
      pesoKg: presente(70), origemPeso: "MEDIDO", ciclosSemPesoConsecutivos: 0, comMedico: true,
      prescricaoRef: { documentId: "rx-sintetica", documentVersion: 1 },
      itens: [{ item: 1, droga: "Fármaco sintético", doseMg: 1.5, reducaoPct: null }] },
  };
  const preparada = (pedido: PrepararPrescricaoExecutavelPedido): PrescricaoExecutavelPreparada => ({
    draftId: "draft-sintetico", revision: 0, conteudoHash: "b".repeat(64), baseHash: base.revisao,
    conteudo: { ...conteudo, documentVersion: 2, itens: pedido.edicao.itens, motivo: pedido.edicao.motivo },
    texto: "Prescrição sintética 1,5 mg", avisos: [], efeitos: ["Assinar versão 2"],
  });
  const ack = { codigo: "GRAVADA" as const, documentId: "rx-sintetica", documentVersion: 2,
    eventoId: "evento-sintetico", cicloId: "ciclo-sintetico", episodioId: "ep-sintetico" };
  porta.lerBasePrescricaoExecutavel = vi.fn(async () => base);
  porta.prepararPrescricaoExecutavel = vi.fn(async (pedido: PrepararPrescricaoExecutavelPedido) => preparada(pedido));
  const confirmar = vi.fn(async () => ack);
  porta.confirmarPrescricaoExecutavel = confirmar;
  const pendente = vi.fn(), salvando = vi.fn(), atualizar = vi.fn();
  const props = { contexto, aoAlterarPrescricaoPendente: pendente, aoAlterarPrescricaoSalvando: salvando, aoAtualizarClinico: atualizar };
  return { porta, confirmar, ack, preparada, props, pendente, salvando, atualizar };
}

async function abrirEditor() {
  fireEvent.click(await screen.findByRole("button", { name: "Prescrição estruturada" }));
  await waitFor(() => expect((screen.getByRole("button", { name: "Preparar prévia exata" }) as HTMLButtonElement).disabled).toBe(false));
  fireEvent.change(screen.getByLabelText("Motivo da prescrição"), { target: { value: "Correção sintética revisada" } });
}
async function preparar() {
  fireEvent.click(screen.getByRole("button", { name: "Preparar prévia exata" }));
  await screen.findByRole("region", { name: "Prévia da prescrição" });
}

it.each([
  ["documentId", "outra-prescricao"], ["documentVersion", 9], ["cicloId", "outro-ciclo"], ["episodioId", "outro-episodio"],
] as const)("não confirma sucesso quando acknowledgement diverge em %s", async (campo, valor) => {
  const f = fixture();
  f.confirmar.mockResolvedValue({ ...f.ack, [campo]: valor });
  render(<ConsultaPersistida porta={f.porta} {...f.props} />);
  await abrirEditor(); await preparar();
  fireEvent.click(screen.getByRole("button", { name: "Confirmar e assinar prescrição" }));
  await waitFor(() => expect(f.confirmar).toHaveBeenCalledOnce());
  await waitFor(() => expect(f.salvando).toHaveBeenLastCalledWith(false));
  expect(f.atualizar).not.toHaveBeenCalled();
  expect(f.pendente).toHaveBeenLastCalledWith(true);
  expect(screen.getByRole("region", { name: "Prévia da prescrição" })).toBeTruthy();
  expect(screen.queryByText("Prescrição assinada e ciclo planejado gravados. Nenhuma administração registrada.")).toBeNull();
});

it("acknowledgement correspondente libera a revisão e atualiza a consulta", async () => {
  const f = fixture();
  render(<ConsultaPersistida porta={f.porta} {...f.props} />);
  await abrirEditor(); await preparar();
  fireEvent.click(screen.getByRole("button", { name: "Confirmar e assinar prescrição" }));
  await waitFor(() => expect(f.atualizar).toHaveBeenCalledOnce());
  expect(f.pendente).toHaveBeenLastCalledWith(false);
});

it("troca da porta em preparo não deixa a nova consulta permanentemente ocupada", async () => {
  const antiga = fixture();
  let resolver!: (value: PrescricaoExecutavelPreparada) => void;
  let pedido!: PrepararPrescricaoExecutavelPedido;
  antiga.porta.prepararPrescricaoExecutavel = vi.fn((entrada: PrepararPrescricaoExecutavelPedido) => {
    pedido = entrada;
    return new Promise<PrescricaoExecutavelPreparada>(resolve => { resolver = resolve; });
  });
  const tela = render(<ConsultaPersistida porta={antiga.porta} {...antiga.props} />);
  await abrirEditor();
  fireEvent.click(screen.getByRole("button", { name: "Preparar prévia exata" }));
  await waitFor(() => expect(antiga.salvando).toHaveBeenLastCalledWith(true));
  const nova = fixture();
  tela.rerender(<ConsultaPersistida porta={nova.porta} {...antiga.props} />);
  await waitFor(() => expect((screen.getByRole("button", { name: "Prescrição estruturada" }) as HTMLButtonElement).disabled).toBe(false));
  expect(antiga.salvando).toHaveBeenLastCalledWith(false);
  expect(antiga.pendente).toHaveBeenLastCalledWith(false);
  await act(async () => resolver(antiga.preparada(pedido)));
  expect(screen.queryByRole("region", { name: "Prévia da prescrição" })).toBeNull();
  await abrirEditor(); await preparar();
  expect(nova.porta.prepararPrescricaoExecutavel).toHaveBeenCalledOnce();
});
