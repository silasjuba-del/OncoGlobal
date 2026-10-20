// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { BasePrescricaoExecutavelResposta, EdicaoPrescricaoExecutavel, PrescricaoExecutavelPreparada } from "../../src/contracts/api/operacaoPrescricaoExecutavel.js";
import type { ConteudoPrescricaoExecutavel, ItemPrescricaoExecutavel } from "../../src/contracts/api/prescricaoExecutavel.js";
import { EditorPrescricaoExecutavel } from "../../src/ui/consulta/EditorPrescricaoExecutavel.js";

afterEach(cleanup);

const item: ItemPrescricaoExecutavel = {
  itemId: "item-base-1",
  item: {
    drug: "Fármaco sintético alfa", classe: "QT", sequence: 1,
    standardDose: 2, doseBasis: "FIXED", calculatedDose: 1.5, prescribedDose: 1.5, unit: "mg",
    adjustmentPercent: null, adjustmentReason: null, route: "EV", diluent: "SF sintético",
    finalVolumeMl: 100, infusionTime: "30 min", days: ["d1"], observacao: "nota da fonte",
    source: "PROTOCOL", overrideMotivo: null,
  },
};

const content = (items: ItemPrescricaoExecutavel[] = [item]): ConteudoPrescricaoExecutavel => ({
  schema: "PrescricaoExecutavel@1",
  contexto: { patientId: "paciente-sintetico", encounterId: "encontro-sintetico", tumorLotId: "lote-sintetico", episodioId: "episodio-1", cicloId: "ciclo-1" },
  documentId: "prescricao-vigente-1", documentVersion: 1, protocoloId: "protocolo-sintetico-A",
  dataPrevista: "2026-10-20", motivo: "Motivo previamente registrado", itens: items, origemProposta: null,
});

const base = (revisao = "a".repeat(64), patientId = "paciente-sintetico"): BasePrescricaoExecutavelResposta => ({
  contexto: { patientId, encounterId: "encontro-sintetico", tumorLotId: "lote-sintetico" },
  revisao, pacienteNome: "Paciente sintético",
  episodio: { episodioId: "episodio-1", tumorLotId: "lote-sintetico", modalidade: "QT", intencao: "ADJUVANTE",
    intentModifier: null, linha: 2, esquemaId: "protocolo-sintetico-A",
    inicio: { valor: null, estado: "PENDENTE", campo: "AUSENTE", motivo: "sem data sintética", fontes: [], revisao: "RAW" },
    fim: { valor: null, estado: "PENDENTE", campo: "AUSENTE", motivo: "sem data sintética", fontes: [], revisao: "RAW" } },
  ciclo: null, vigente: content(), pendencias: [],
});

const preparation = (edicao: EdicaoPrescricaoExecutavel, overrides: Partial<PrescricaoExecutavelPreparada> = {}): PrescricaoExecutavelPreparada => ({
  draftId: "rascunho-prescricao-1", revision: 1, conteudoHash: "b".repeat(64), baseHash: "a".repeat(64),
  conteudo: { ...content(edicao.itens), protocoloId: edicao.protocoloId, dataPrevista: edicao.dataPrevista, motivo: edicao.motivo },
  texto: "Prescrição sintética exata: 1,5 mg EV.", avisos: ["Aviso sintético para revisar."],
  efeitos: ["2026-10-21 · ciclo sintético atualizado"], ...overrides,
});

function concluirCamposObrigatorios() {
  fireEvent.change(screen.getByLabelText("Data prevista"), { target: { value: "2026-10-21" } });
  fireEvent.change(screen.getByLabelText("Motivo da prescrição"), { target: { value: "Revisão médica sintética" } });
  fireEvent.change(screen.getByLabelText("Número do ciclo"), { target: { value: "1" } });
}

describe("EditorPrescricaoExecutavel", () => {
  it("mudança de dose protocolar passa a manual e exige motivo por item", async () => {
    const aoPreparar = vi.fn(async (edicao: EdicaoPrescricaoExecutavel) => preparation(edicao));
    render(<EditorPrescricaoExecutavel base={base()} aoPreparar={aoPreparar} aoAssinar={vi.fn()} />);
    concluirCamposObrigatorios();
    fireEvent.change(screen.getByLabelText("Dose final · item 1"), { target: { value: "1,25" } });
    expect(screen.getByText("Origem do item: MANUAL")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Preparar prévia exata" }));
    expect(aoPreparar).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText("Motivo do override · item 1"), { target: { value: "Ajuste médico sintético" } });
    fireEvent.click(screen.getByRole("button", { name: "Preparar prévia exata" }));
    await waitFor(() => expect(aoPreparar).toHaveBeenCalledTimes(1));
    expect(aoPreparar.mock.calls[0]?.[0].itens[0]?.item).toMatchObject({
      source: "MANUAL", prescribedDose: 1.25, adjustmentPercent: null, adjustmentReason: null,
      overrideMotivo: "Ajuste médico sintético",
    });
  });

  it("trocar medicamento não reaproveita dose nem parâmetros de preparo da droga anterior", () => {
    render(<EditorPrescricaoExecutavel base={base()} aoPreparar={vi.fn()} aoAssinar={vi.fn()} />);
    fireEvent.change(screen.getByLabelText("Medicamento · item 1"), { target: { value: "Outra droga sintética" } });
    for (const label of ["Dose final · item 1", "Unidade · item 1", "Via · item 1",
      "Diluente · item 1", "Volume final (mL) · item 1", "Tempo de infusão · item 1", "Dias de administração · item 1"])
      expect((screen.getByLabelText(label) as HTMLInputElement).value).toBe("");
  });

  it("mostra prévia exata antes da assinatura e chama o callback final somente após confirmação explícita", async () => {
    const atual = base();
    const aoPreparar = vi.fn(async (edicao: EdicaoPrescricaoExecutavel) => preparation(edicao));
    const aoAssinar = vi.fn(async () => undefined);
    const aoAlterarPendente = vi.fn();
    render(<EditorPrescricaoExecutavel base={atual} aoPreparar={aoPreparar} aoAssinar={aoAssinar} aoAlterarPendente={aoAlterarPendente} />);

    expect((screen.getByLabelText("Dose final · item 1") as HTMLInputElement).value).toBe("1.5");
    expect((screen.getByLabelText("Classe · item 1") as HTMLSelectElement).value).toBe("QT");
    expect((screen.getByLabelText("Encaminhar para a fila interna da farmácia") as HTMLInputElement).checked).toBe(false);
    expect((screen.getByLabelText("Modo do ciclo") as HTMLSelectElement).value).toBe("NOVO_CICLO");
    expect((screen.getByLabelText("Linha terapêutica") as HTMLInputElement).value).toBe("2");
    expect((screen.getByLabelText("Intenção terapêutica") as HTMLSelectElement).value).toBe("ADJUVANTE");
    expect((screen.getByLabelText("Número do ciclo") as HTMLInputElement).value).toBe("");
    expect((screen.getByLabelText("Data prevista") as HTMLInputElement).value).toBe("");
    expect(aoAssinar).not.toHaveBeenCalled();
    concluirCamposObrigatorios();
    fireEvent.click(screen.getByLabelText("Encaminhar para a fila interna da farmácia"));
    fireEvent.click(screen.getByRole("button", { name: "Preparar prévia exata" }));

    const preview = await screen.findByRole("region", { name: "Prévia da prescrição" });
    expect(aoAlterarPendente).toHaveBeenLastCalledWith(true);
    expect(preview.textContent).toContain("Prescrição sintética exata: 1,5 mg EV.");
    expect(preview.textContent).toContain("Aviso sintético para revisar.");
    expect(preview.textContent).toContain("2026-10-21 · ciclo sintético atualizado");
    expect(preview.textContent).toContain("Encaminhamento à fila interna da farmácia: selecionado.");
    expect(aoPreparar).toHaveBeenCalledTimes(1);
    expect(aoPreparar.mock.calls[0]?.[0].itens[0]).toEqual(item);
    expect(aoAssinar).not.toHaveBeenCalled();
    expect(aoAlterarPendente).toHaveBeenLastCalledWith(true);

    fireEvent.click(screen.getByRole("button", { name: "Confirmar e assinar prescrição" }));
    await waitFor(() => expect(aoAssinar).toHaveBeenCalledWith(expect.objectContaining({ draftId: "rascunho-prescricao-1" })));
  });

  it("mantém parâmetros clínicos ausentes vazios e itens novos manuais sem valores inventados", () => {
    render(<EditorPrescricaoExecutavel base={null} aoPreparar={vi.fn()} aoAssinar={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Adicionar item manual" }));

    expect((screen.getByLabelText("Medicamento · item 1") as HTMLInputElement).value).toBe("");
    expect((screen.getByLabelText("Dose final · item 1") as HTMLInputElement).value).toBe("");
    expect((screen.getByLabelText("Unidade · item 1") as HTMLInputElement).value).toBe("");
    expect((screen.getByLabelText("Via · item 1") as HTMLInputElement).value).toBe("");
    expect((screen.getByLabelText("Diluente · item 1") as HTMLInputElement).value).toBe("");
    expect((screen.getByLabelText("Volume final (mL) · item 1") as HTMLInputElement).value).toBe("");
    expect((screen.getByLabelText("Tempo de infusão · item 1") as HTMLInputElement).value).toBe("");
    expect(screen.getByText("Origem do item: MANUAL")).toBeTruthy();
    expect(screen.getByLabelText("Motivo do override · item 1")).toBeTruthy();
    expect(screen.getByRole("status").textContent).toMatch(/base da prescrição indisponível/i);
    expect(screen.queryByText(/não se aplica/i)).toBeNull();
  });

  it("não converte itens legados do ciclo em parâmetros executáveis tipados", () => {
    const legado: BasePrescricaoExecutavelResposta = {
      ...base(),
      vigente: null,
      ciclo: {
        cicloId: "ciclo-legado", episodioId: "episodio-1", numero: 4, previstoEm: "2026-10-20",
        pesoKg: { valor: null, estado: "PENDENTE", campo: "AUSENTE", motivo: "sem peso sintético", fontes: [], revisao: "RAW" },
        origemPeso: null, ciclosSemPesoConsecutivos: 0, prescricaoRef: null,
        itens: [{ item: 1, droga: "Fármaco legado", doseMg: 100, reducaoPct: 0 }], comMedico: false,
      },
    };
    render(<EditorPrescricaoExecutavel base={legado} aoPreparar={vi.fn()} aoAssinar={vi.fn()} />);

    expect(screen.getByText(/nenhum item executável confirmado na base/i)).toBeTruthy();
    expect(screen.queryByLabelText("Dose final · item 1")).toBeNull();
    expect(screen.queryByDisplayValue("100")).toBeNull();
  });

  it("exige escolha da linha e intenção quando a base não contém episódio confirmado", () => {
    render(<EditorPrescricaoExecutavel base={{ ...base(), episodio: null }} aoPreparar={vi.fn()} aoAssinar={vi.fn()} />);

    expect((screen.getByLabelText("Linha terapêutica") as HTMLInputElement).value).toBe("");
    expect((screen.getByLabelText("Intenção terapêutica") as HTMLSelectElement).value).toBe("");
    expect((screen.getByLabelText("Número do ciclo") as HTMLInputElement).value).toBe("");
    fireEvent.click(screen.getByRole("button", { name: "Preparar prévia exata" }));
    expect(screen.getByRole("alert").textContent).toMatch(/selecione a intenção terapêutica/i);
  });

  it("gera UUIDs e sequências únicas para novos itens manuais e exige motivo de override antes do preparo", async () => {
    const aoPreparar = vi.fn(async (edicao: EdicaoPrescricaoExecutavel) => preparation(edicao));
    render(<EditorPrescricaoExecutavel base={base()} aoPreparar={aoPreparar} aoAssinar={vi.fn()} />);
    concluirCamposObrigatorios();
    fireEvent.click(screen.getByRole("button", { name: "Adicionar item manual" }));
    fireEvent.click(screen.getByRole("button", { name: "Adicionar item manual" }));
    for (const index of [2, 3]) {
      fireEvent.change(screen.getByLabelText(`Medicamento · item ${index}`), { target: { value: `Fármaco manual ${index}` } });
      fireEvent.change(screen.getByLabelText(`Classe · item ${index}`), { target: { value: "QT" } });
      fireEvent.change(screen.getByLabelText(`Base da dose · item ${index}`), { target: { value: "FIXED" } });
      fireEvent.change(screen.getByLabelText(`Dose final · item ${index}`), { target: { value: "1,75" } });
      fireEvent.change(screen.getByLabelText(`Unidade · item ${index}`), { target: { value: "mg" } });
      fireEvent.change(screen.getByLabelText(`Via · item ${index}`), { target: { value: "EV" } });
    }
    fireEvent.click(screen.getByRole("button", { name: "Preparar prévia exata" }));
    expect(aoPreparar).not.toHaveBeenCalled();
    expect(screen.getByRole("alert").textContent).toMatch(/motivo do override/i);

    fireEvent.click(screen.getAllByRole("button", { name: "Usar motivo médico informado acima" })[0]!);
    fireEvent.change(screen.getByLabelText("Motivo do override · item 3"), { target: { value: "Escolha médica sintética 3" } });
    fireEvent.click(screen.getByRole("button", { name: "Preparar prévia exata" }));
    await waitFor(() => expect(aoPreparar).toHaveBeenCalledTimes(1));
    const enviados = aoPreparar.mock.calls[0]![0].itens;
    expect(enviados.map(entry => entry.item.sequence)).toEqual([1, 2, 3]);
    expect(new Set(enviados.map(entry => entry.itemId)).size).toBe(3);
    expect(enviados.slice(1).every(entry => /^[0-9a-f-]{36}$/i.test(entry.itemId))).toBe(true);
    expect(enviados.slice(1).map(entry => entry.item.source)).toEqual(["MANUAL", "MANUAL"]);
    expect(enviados[1]?.item.prescribedDose).toBe(1.75);
    expect(enviados[1]?.item.overrideMotivo).toBe("Revisão médica sintética");
  });

  it("preserva dose fracionária e invalida a prévia quando qualquer campo editável muda", async () => {
    const aoPreparar = vi.fn(async (edicao: EdicaoPrescricaoExecutavel) => preparation(edicao));
    const aoAssinar = vi.fn(async () => undefined);
    const aoAlterarPendente = vi.fn();
    render(<EditorPrescricaoExecutavel base={base()} aoPreparar={aoPreparar} aoAssinar={aoAssinar} aoAlterarPendente={aoAlterarPendente} />);
    concluirCamposObrigatorios();
    fireEvent.click(screen.getByRole("button", { name: "Preparar prévia exata" }));
    await screen.findByRole("region", { name: "Prévia da prescrição" });

    fireEvent.change(screen.getByLabelText("Dose final · item 1"), { target: { value: "1.75" } });
    expect(screen.queryByRole("region", { name: "Prévia da prescrição" })).toBeNull();
    expect((screen.getByLabelText("Dose final · item 1") as HTMLInputElement).value).toBe("1.75");
    expect(aoAssinar).not.toHaveBeenCalled();
    expect(aoAlterarPendente).toHaveBeenLastCalledWith(true);
  });

  it("ignora resposta de preparo tardia após mudança da revisão da base", async () => {
    let resolvePreparation!: (value: PrescricaoExecutavelPreparada) => void;
    const aoPreparar = vi.fn((edicao: EdicaoPrescricaoExecutavel) => new Promise<PrescricaoExecutavelPreparada>(resolve => { resolvePreparation = () => resolve(preparation(edicao)); }));
    const props = { aoPreparar, aoAssinar: vi.fn(async () => undefined) };
    const view = render(<EditorPrescricaoExecutavel base={base()} {...props} />);
    concluirCamposObrigatorios();
    fireEvent.click(screen.getByRole("button", { name: "Preparar prévia exata" }));
    expect(aoPreparar).toHaveBeenCalledTimes(1);

    view.rerender(<EditorPrescricaoExecutavel base={base("a".repeat(64), "paciente-sintetico-2")} {...props} />);
    await act(async () => { resolvePreparation(preparation(aoPreparar.mock.calls[0]![0])); });
    expect(screen.queryByRole("region", { name: "Prévia da prescrição" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Confirmar e assinar prescrição" })).toBeNull();
    expect(props.aoAssinar).not.toHaveBeenCalled();
  });

  it("preserva edição não salva quando a revisão da base muda no mesmo contexto e invalida a prévia", () => {
    const aoAlterarPendente = vi.fn();
    const props = { aoPreparar: vi.fn(async (edicao: EdicaoPrescricaoExecutavel) => preparation(edicao)),
      aoAssinar: vi.fn(async () => undefined), aoAlterarPendente };
    const view = render(<EditorPrescricaoExecutavel base={base()} {...props} />);
    fireEvent.change(screen.getByLabelText("Motivo da prescrição"), { target: { value: "Motivo ainda não salvo" } });

    view.rerender(<EditorPrescricaoExecutavel base={base("c".repeat(64))} {...props} />);

    expect((screen.getByLabelText("Motivo da prescrição") as HTMLTextAreaElement).value).toBe("Motivo ainda não salvo");
    expect(screen.getByRole("status").textContent).toMatch(/campos editados foram preservados/i);
    expect(aoAlterarPendente).toHaveBeenLastCalledWith(true);
    expect(screen.queryByRole("region", { name: "Prévia da prescrição" })).toBeNull();
  });

  it("mantém os campos e a pendência quando o preparo falha", async () => {
    const aoPreparar = vi.fn(async () => { throw new Error("Falha sintética de preparo."); });
    const aoAlterarPendente = vi.fn();
    render(<EditorPrescricaoExecutavel base={base()} aoPreparar={aoPreparar} aoAssinar={vi.fn()} aoAlterarPendente={aoAlterarPendente} />);
    concluirCamposObrigatorios();
    fireEvent.click(screen.getByRole("button", { name: "Preparar prévia exata" }));

    expect((await screen.findByRole("status")).textContent).toContain("Falha sintética de preparo.");
    expect((screen.getByLabelText("Motivo da prescrição") as HTMLTextAreaElement).value).toBe("Revisão médica sintética");
    expect(screen.queryByRole("region", { name: "Prévia da prescrição" })).toBeNull();
    expect(aoAlterarPendente).toHaveBeenLastCalledWith(true);
    expect(screen.queryByRole("button", { name: "Confirmar e assinar prescrição" })).toBeNull();
  });

  it("mantém o editor ocupado enquanto aguarda o callback explícito de assinatura", async () => {
    let resolveSignature!: () => void;
    const aoAssinar = vi.fn(() => new Promise<void>(resolve => { resolveSignature = resolve; }));
    render(<EditorPrescricaoExecutavel base={base()} aoPreparar={async edicao => preparation(edicao)} aoAssinar={aoAssinar} />);
    concluirCamposObrigatorios();
    fireEvent.click(screen.getByRole("button", { name: "Preparar prévia exata" }));
    await screen.findByRole("region", { name: "Prévia da prescrição" });

    fireEvent.click(screen.getByRole("button", { name: "Confirmar e assinar prescrição" }));
    expect((await screen.findByRole("region", { name: "Editor de prescrição executável" })).getAttribute("aria-busy")).toBe("true");
    expect((screen.getByRole("button", { name: "Confirmar e assinar prescrição" }) as HTMLButtonElement).disabled).toBe(true);
    expect(aoAssinar).toHaveBeenCalledTimes(1);

    await act(async () => { resolveSignature(); });
    await waitFor(() => expect(screen.getByRole("region", { name: "Editor de prescrição executável" }).getAttribute("aria-busy")).toBe("false"));
    expect(screen.getByRole("status").textContent).toMatch(/não comprova preparo, dispensação ou administração/i);
  });
});
