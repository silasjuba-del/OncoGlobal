// @vitest-environment jsdom
// Caso e fontes inteiramente sinteticos; nenhum evento clinico e executado.
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { BaseAcaoComposta, PedidoAcaoComposta, TipoAcaoComposta } from "../../src/contracts/api/acoesCompostas.js";
import { AcaoCompostaPreparada as AcaoCompostaPreparadaSchema } from "../../src/contracts/api/execucaoAcaoComposta.js";
import type { AcaoCompostaPreparada } from "../../src/contracts/api/execucaoAcaoComposta.js";
import { BasePrescricaoExecutavelResposta as BasePrescricaoExecutavelRespostaSchema } from "../../src/contracts/api/operacaoPrescricaoExecutavel.js";
import type { BasePrescricaoExecutavelResposta, EdicaoPrescricaoExecutavel,
  PrepararPrescricaoExecutavelPedido, PrescricaoExecutavelPreparada,
  ConfirmarPrescricaoExecutavelPedido, PrescricaoExecutavelConfirmada } from "../../src/contracts/api/operacaoPrescricaoExecutavel.js";
import type { PrepararAcaoCompostaPedido } from "../../src/contracts/api/execucaoAcaoComposta.js";
import type { ConteudoPrescricaoExecutavel, ItemPrescricaoExecutavel } from "../../src/contracts/api/prescricaoExecutavel.js";
import { prepararAcaoComposta } from "../../src/rules/prescricao/acoesCompostas.js";
import { fonteSintetica } from "../fixtures/triagem.js";
import { EditorPrescricaoExecutavel } from "../../src/ui/consulta/EditorPrescricaoExecutavel.js";
import { ConsultaPersistida } from "../../src/ui/consulta/ConsultaPersistida.js";
import { criarPortaFalsa } from "../../src/ui/api/fake.js";

afterEach(cleanup);

const contexto = { patientId: "pt-multi", encounterId: "en-multi", tumorLotId: "lot-multi-a" };
const revisao = "a".repeat(64);
const hashAcao = "c".repeat(64);

const itens: ItemPrescricaoExecutavel[] = [
  { itemId: "item-prescricao-1", item: { drug: "Fármaco alfa sintético", classe: "QT", sequence: 1,
    standardDose: 100, doseBasis: "FIXED", calculatedDose: 100, prescribedDose: 100, unit: "mg",
    adjustmentPercent: null, adjustmentReason: null, route: "EV", diluent: "Diluente sintético",
    finalVolumeMl: 100, infusionTime: "30 min", days: ["d1"], observacao: null,
    source: "PROTOCOL", overrideMotivo: null } },
  { itemId: "item-prescricao-2", item: { drug: "Fármaco beta sintético", classe: "QT", sequence: 2,
    standardDose: 50, doseBasis: "FIXED", calculatedDose: 50, prescribedDose: 50, unit: "mg",
    adjustmentPercent: null, adjustmentReason: null, route: "EV", diluent: "Diluente sintético",
    finalVolumeMl: 100, infusionTime: "30 min", days: ["d1"], observacao: null,
    source: "PROTOCOL", overrideMotivo: null } },
];

const dado = <T,>(valor: T | null) => ({ valor, estado: valor === null ? "PENDENTE" as const : "VERDE" as const,
  campo: valor === null ? "AUSENTE" as const : "PRESENTE" as const, motivo: "Fixture sintética da Onda06",
  fontes: valor === null ? [] : [fonteSintetica("onda06-fonte-sintetica")],
  revisao: valor === null ? "RAW" as const : "CONFIRMADO" as const });

const conteudoVigente = (patientId = contexto.patientId): ConteudoPrescricaoExecutavel => ({
  schema: "PrescricaoExecutavel@1",
  contexto: { ...contexto, patientId, episodioId: "episodio-acao-1", cicloId: "ciclo-acao-1" },
  documentId: "documento-prescricao-sintetico", documentVersion: 2, pacienteNome: "Paciente sintético Onda06",
  linha: 2, numeroCiclo: 3, protocoloId: "protocolo-sintetico-A", dataPrevista: "2026-10-20",
  motivo: "Prescrição vigente sintética", itens, origemProposta: null,
});

function basePrescricao(patientId = contexto.patientId, hashBase = revisao): BasePrescricaoExecutavelResposta {
  const conteudo = conteudoVigente(patientId);
  const episodioId = "episodio-acao-1", cicloId = "ciclo-acao-1";
  return { contexto: { ...contexto, patientId }, revisao: hashBase, pacienteNome: "Paciente sintético Onda06",
    episodio: { episodioId, tumorLotId: contexto.tumorLotId, modalidade: "QT", intencao: "ADJUVANTE",
      intentModifier: null, linha: 2, esquemaId: "protocolo-sintetico-A",
      inicio: dado("2026-09-01"), fim: dado(null) },
    ciclo: { cicloId, episodioId, numero: 3, previstoEm: "2026-10-20", pesoKg: dado(70), origemPeso: "MEDIDO",
      ciclosSemPesoConsecutivos: 0, prescricaoRef: { documentId: conteudo.documentId, documentVersion: 2 },
      itens: [{ item: 1, droga: "Fármaco alfa sintético", doseMg: 100, reducaoPct: null },
        { item: 2, droga: "Fármaco beta sintético", doseMg: 50, reducaoPct: null }], comMedico: true },
    vigente: conteudo, pendencias: [] };
}

function baseAcao(patientId = contexto.patientId, baseHash = "b".repeat(64), baseRevision = revisao): BaseAcaoComposta {
  return { contexto: { ...contexto, patientId }, cicloId: "ciclo-acao-1", episodioId: "episodio-acao-1",
    protocoloId: "protocolo-sintetico-A", previstoEm: "2026-10-20", revisao: baseRevision,
    baseHash, itens: [{ item: 1, droga: "Fármaco alfa sintético", doseMg: 100 },
      { item: 2, droga: "Fármaco beta sintético", doseMg: 50 }] };
}

function acao(tipo: TipoAcaoComposta, pedido: PedidoAcaoComposta, inputBase = baseAcao()): AcaoCompostaPreparada {
  return { draftId: `acao-${tipo.toLowerCase()}-sintetica`, revision: 4, conteudoHash: hashAcao,
    resultado: prepararAcaoComposta(inputBase, pedido),
    documentoPlano: { titulo: "Plano de ação sintético", texto: pedido.motivo },
    criaEventoClinico: false, liberaTratamento: false };
}

function preparacao(edicao: EdicaoPrescricaoExecutavel, base = basePrescricao()): PrescricaoExecutavelPreparada {
  return { draftId: "prescricao-preparada-sintetica", revision: 1, conteudoHash: "d".repeat(64),
    baseHash: base.revisao,
    conteudo: { ...conteudoVigente(base.contexto.patientId), protocoloId: edicao.protocoloId,
      dataPrevista: edicao.dataPrevista, motivo: edicao.motivo, itens: edicao.itens,
      origemProposta: edicao.origemProposta },
    texto: "Prescrição sintética revisada.", avisos: [], efeitos: [] };
}

const pedidos: Array<{ nome: string; tipo: TipoAcaoComposta; pedido: PedidoAcaoComposta; data: string; doses: number[] }> = [
  { nome: "manter ciclo", tipo: "MANTER_CICLO", pedido: { tipo: "MANTER_CICLO", motivo: "Manter sem alterar itens." },
    data: "2026-10-20", doses: [100, 50] },
  { nome: "adiar ciclo", tipo: "ADIAR_CICLO", pedido: { tipo: "ADIAR_CICLO", dias: 7, motivo: "Adiar por motivo sintético." },
    data: "2026-10-27", doses: [100, 50] },
  { nome: "reduzir dose", tipo: "REDUZIR_DOSE", pedido: { tipo: "REDUZIR_DOSE", reducaoPct: 25,
    itensSelecionados: [1], motivo: "Redução de dose sintética." }, data: "2026-10-20", doses: [75, 50] },
];

describe("prescrição a partir de ação revisada", () => {
  it("usa fixtures completas aceitas pelas fronteiras da proposta e da prescrição", () => {
    const base = BasePrescricaoExecutavelRespostaSchema.safeParse(basePrescricao());
    const proposta = AcaoCompostaPreparadaSchema.safeParse(acao("MANTER_CICLO",
      { tipo: "MANTER_CICLO", motivo: "Manter ciclo sintético." }));
    if (!base.success) throw new Error(JSON.stringify(base.error.issues));
    if (!proposta.success) throw new Error(JSON.stringify(proposta.error.issues));
  });

  it.each(pedidos)("aplica $nome ao ciclo vigente e mantém origem e diff antes da prévia", async scenario => {
    const preparedAction = acao(scenario.tipo, scenario.pedido);
    const aoPreparar = vi.fn(async (edicao: EdicaoPrescricaoExecutavel) => preparacao(edicao));
    const aoAssinar = vi.fn(async () => {});
    render(<EditorPrescricaoExecutavel base={basePrescricao()} origemAcao={preparedAction}
      aoPreparar={aoPreparar} aoAssinar={aoAssinar} />);

    const origin = await screen.findByRole("region", { name: /Origem da proposta de ação/ });
    expect(origin.textContent).toContain(preparedAction.draftId);
    expect(origin.textContent).toContain(hashAcao);
    const acaoHumana: Record<TipoAcaoComposta, string> = {
      MANTER_CICLO: "Manter ciclo", ADIAR_CICLO: "Adiar ciclo", REDUZIR_DOSE: "Reduzir dose",
      TROCAR_PROTOCOLO: "Trocar protocolo",
    };
    expect(origin.textContent).toContain(acaoHumana[scenario.tipo]);
    expect((screen.getByLabelText("Data prevista") as HTMLInputElement).value).toBe(scenario.data);
    expect((screen.getByLabelText(/Dose final.*item 1/) as HTMLInputElement).value).toBe(String(scenario.doses[0]));
    expect((screen.getByLabelText(/Dose final.*item 2/) as HTMLInputElement).value).toBe(String(scenario.doses[1]));
    expect(aoPreparar).not.toHaveBeenCalled();
    expect(aoAssinar).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Preparar prévia exata" }));
    await waitFor(() => expect(aoPreparar).toHaveBeenCalledTimes(1));
    const enviada = aoPreparar.mock.calls[0]![0];
    expect(enviada.origemProposta).toEqual({ draftId: preparedAction.draftId, revision: 4, hash: hashAcao });
    expect(enviada.planejamento).toEqual({ modo: "CICLO_ATUAL", linha: 2, intencao: "ADJUVANTE", numeroCiclo: 3 });
    expect(enviada.itens.map(x => x.item.prescribedDose)).toEqual(scenario.doses);
    expect(enviada.itens[0]!.item.source).toBe(scenario.tipo === "REDUZIR_DOSE" ? "MANUAL" : "PROTOCOL");
    expect(enviada.itens[1]!.item).toMatchObject({ drug: "Fármaco beta sintético", prescribedDose: 50,
      route: "EV", diluent: "Diluente sintético", finalVolumeMl: 100, infusionTime: "30 min", days: ["d1"] });
    expect(aoAssinar).not.toHaveBeenCalled();
    expect(await screen.findByRole("region", { name: "Prévia da prescrição" })).toBeTruthy();
  });

  it("pede confirmação antes de substituir edição manual e permite manter os campos", async () => {
    const preparedAction = acao("REDUZIR_DOSE", { tipo: "REDUZIR_DOSE", reducaoPct: 25,
      itensSelecionados: [1], motivo: "Redução revisada sintética." });
    const props = { base: basePrescricao(), aoPreparar: vi.fn(async (edicao: EdicaoPrescricaoExecutavel) => preparacao(edicao)),
      aoAssinar: vi.fn(async () => {}) };
    const view = render(<EditorPrescricaoExecutavel {...props} />);
    fireEvent.change(screen.getByLabelText("Motivo da prescrição"), { target: { value: "Minha edição deve permanecer." } });
    view.rerender(<EditorPrescricaoExecutavel {...props} origemAcao={preparedAction} />);
    expect((screen.getByLabelText("Motivo da prescrição") as HTMLTextAreaElement).value).toBe("Minha edição deve permanecer.");
    expect((screen.getByLabelText(/Dose final.*item 1/) as HTMLInputElement).value).toBe("100");
    const pending = await screen.findByRole("alert", { name: /Substituição por ação revisada/ });
    expect(pending.textContent).toContain(preparedAction.resultado.diff[0]!.antes?.toString());

    fireEvent.click(screen.getByRole("button", { name: /Manter minha edição/ }));
    expect((screen.getByLabelText("Motivo da prescrição") as HTMLTextAreaElement).value).toBe("Minha edição deve permanecer.");
    expect(screen.queryByRole("region", { name: /Origem da proposta de ação/ })).toBeNull();
    expect(props.aoPreparar).not.toHaveBeenCalled();
  });

  it("substitui somente após confirmação explícita e mantém origem de ação exclusiva", async () => {
    const preparedAction = acao("ADIAR_CICLO", { tipo: "ADIAR_CICLO", dias: 7, motivo: "Adiamento revisado sintético." });
    const props = { base: basePrescricao(), aoPreparar: vi.fn(async (edicao: EdicaoPrescricaoExecutavel) => preparacao(edicao)),
      aoAssinar: vi.fn(async () => {}) };
    const view = render(<EditorPrescricaoExecutavel {...props} />);
    fireEvent.change(screen.getByLabelText("Motivo da prescrição"), { target: { value: "Rascunho local não descartável." } });
    view.rerender(<EditorPrescricaoExecutavel {...props} origemAcao={preparedAction} />);
    fireEvent.click(await screen.findByRole("button", { name: /Substituir.*ação revisada/ }));

    expect((screen.getByLabelText("Motivo da prescrição") as HTMLTextAreaElement).value).toBe("Adiamento revisado sintético.");
    expect((screen.getByLabelText("Data prevista") as HTMLInputElement).value).toBe("2026-10-27");
    expect(screen.getByRole("region", { name: /Origem da proposta de ação/ })).toBeTruthy();
    expect(screen.queryByRole("region", { name: /Origem da prescrição/ })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /Desvincular.*ação/ }));
    expect(screen.queryByRole("region", { name: /Origem da proposta de ação/ })).toBeNull();
    expect((screen.getByLabelText("Data prevista") as HTMLInputElement).value).toBe("2026-10-27");
  });

  it("recusa proposta de contexto ou revisão obsoletos e não aplica troca de protocolo", async () => {
    const originalBase = basePrescricao();
    const stale = acao("REDUZIR_DOSE", { tipo: "REDUZIR_DOSE", reducaoPct: 25,
      itensSelecionados: [1], motivo: "Redução obsoleta sintética." });
    const changed = basePrescricao(contexto.patientId, "e".repeat(64));
    const view = render(<EditorPrescricaoExecutavel base={originalBase} aoPreparar={vi.fn()} aoAssinar={vi.fn()} />);
    view.rerender(<EditorPrescricaoExecutavel base={changed} origemAcao={stale} aoPreparar={vi.fn()} aoAssinar={vi.fn()} />);
    await waitFor(() => expect((screen.getByLabelText(/Dose final.*item 1/) as HTMLInputElement).value).toBe("100"));
    expect(screen.queryByRole("region", { name: /Origem da proposta de ação/ })).toBeNull();

    const troca = acao("TROCAR_PROTOCOLO", { tipo: "TROCAR_PROTOCOLO", novoProtocoloId: "protocolo-novo-sintetico",
      motivo: "Troca de protocolo sintética." });
    const aoPrepararTroca = vi.fn(async (edicao: EdicaoPrescricaoExecutavel) => preparacao(edicao));
    view.rerender(<EditorPrescricaoExecutavel base={originalBase} aoPreparar={aoPrepararTroca} aoAssinar={vi.fn()} />);
    view.rerender(<EditorPrescricaoExecutavel base={originalBase} origemAcao={troca} aoPreparar={aoPrepararTroca} aoAssinar={vi.fn()} />);
    await waitFor(() => expect((screen.getByLabelText("Protocolo ou esquema") as HTMLInputElement).value)
      .toBe("protocolo-sintetico-A"));
    expect((screen.getByLabelText(/Dose final.*item 1/) as HTMLInputElement).value).toBe("100");
    expect(screen.queryByRole("region", { name: /Origem da proposta de ação/ })).toBeNull();
    expect(screen.getByRole("status", { name: "Pendências da ação" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Descartar proposta de ação e seguir manualmente/ }));
    expect(screen.queryByRole("status", { name: "Pendências da ação" })).toBeNull();
    fireEvent.change(screen.getByLabelText("Motivo da prescrição"), { target: { value: "Prescrição manual sintética." } });
    fireEvent.click(screen.getByRole("button", { name: "Preparar prévia exata" }));
    await waitFor(() => expect(aoPrepararTroca).toHaveBeenCalledTimes(1));
    expect(aoPrepararTroca.mock.calls[0]![0].origemProposta).toBeNull();
  });

  it("abre o editor a partir da proposta revisada e prepara prescrição com o ponteiro da ação", async () => {
    const porta = criarPortaFalsa();
    const resumo = baseAcao();
    const rxBase = basePrescricao();
    porta.carregarBaseAcaoComposta = vi.fn(async () => ({ base: resumo, pendencias: [] }));
    porta.prepararAcaoComposta = vi.fn(async (pedido: PrepararAcaoCompostaPedido) =>
      acao("MANTER_CICLO", pedido.pedido, resumo));
    porta.lerBasePrescricaoExecutavel = vi.fn(async () => rxBase);
    const prepararPrescricao = vi.fn(async (pedido: PrepararPrescricaoExecutavelPedido) =>
      preparacao(pedido.edicao, rxBase));
    porta.prepararPrescricaoExecutavel = prepararPrescricao;
    porta.confirmarPrescricaoExecutavel = vi.fn(async (_pedido: ConfirmarPrescricaoExecutavelPedido): Promise<PrescricaoExecutavelConfirmada> => ({
      codigo: "GRAVADA", documentId: "doc-sintetico", documentVersion: 3, eventoId: "evento-sintetico",
      cicloId: "ciclo-acao-1", episodioId: "episodio-acao-1",
    }));
    render(<ConsultaPersistida porta={porta} contexto={contexto} />);

    fireEvent.click(await screen.findByRole("button", { name: "Manter ciclo" }));
    fireEvent.change(await screen.findByLabelText("Motivo"), { target: { value: "Manter ciclo sintético." } });
    fireEvent.click(screen.getByRole("button", { name: "Preparar prévia" }));
    fireEvent.click(await screen.findByRole("button", { name: "Usar esta proposta revisada" }));
    expect(await screen.findByRole("region", { name: /Editor de prescrição executável/ })).toBeTruthy();
    expect(await screen.findByRole("region", { name: /Origem da proposta de ação/ })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Preparar prévia exata" }));
    await waitFor(() => expect(prepararPrescricao).toHaveBeenCalledTimes(1));
    expect(prepararPrescricao.mock.calls[0]![0].edicao.origemProposta)
      .toEqual({ draftId: "acao-manter_ciclo-sintetica", revision: 4, hash: hashAcao });
    expect(prepararPrescricao.mock.calls[0]![0].edicao.itens.map(entry => entry.item.prescribedDose)).toEqual([100, 50]);
    expect(screen.getByRole("region", { name: "Prévia da prescrição" })).toBeTruthy();
    expect(porta.confirmarPrescricaoExecutavel).not.toHaveBeenCalled();
  });
});
