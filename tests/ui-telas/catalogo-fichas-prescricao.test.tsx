// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ProtocolTemplate } from "../../src/contracts/w10/prescricao.js";
import type { FichaProtocoloCatalogo, RevisarFichaPedido } from "../../src/contracts/api/fichasPrescricao.js";
import { CatalogoFichasPrescricao } from "../../src/ui/consulta/CatalogoFichasPrescricao.js";

afterEach(cleanup);

const hash = "a".repeat(64);
const revisãoHash = "b".repeat(64);
const hashLegadoTemplate = "hash-legado-template-sintetico";
const templateBase: ProtocolTemplate = {
  templateId: "ficha-sintetica-01", tumor: "C50 — tumor sintético de mama", nome: "Protocolo de teste clínico sintético",
  cenario: "Adjuvante", versao: "1.0", hash: hashLegadoTemplate, codigoInstitucional: null, intervaloDias: 21, ciclos: 8,
  itens: [{ drug: "Fármaco sintético", classe: "QT", sequence: 1, standardDose: 1250, doseBasis: "MG_M2",
    calculatedDose: null, prescribedDose: null, unit: "mg", adjustmentPercent: null, adjustmentReason: null,
    route: "VO", diluent: null, finalVolumeMl: null, infusionTime: null, days: ["d1", "d14"],
    observacao: null, source: "PROTOCOL", overrideMotivo: null, doseMaximaMg: 2000 }],
  limiaresBula: { neutrofilosMin: 1500, plaquetasMin: 100000, clcrMinMlMin: null, fevePctMin: null,
    fonte: "Bula sintética de teste, revisão 2026-01" },
  fonte: "Fonte sintética para teste de interface", status: "RASCUNHO",
};

function ficha(estado: FichaProtocoloCatalogo["estado"] = "PENDENTE", bloqueios: string[] = [], versao = "1.0"): FichaProtocoloCatalogo {
  const revision = estado === "PENDENTE" ? 0 : estado === "INATIVA" ? 2 : 1;
  const decisao = estado === "CONFERIDA" ? "CONFERIR" : estado === "INATIVA" ? "INATIVAR" : null;
  const template: ProtocolTemplate = { ...templateBase, versao };
  return { template, contentHash: hash, revision, estado, bloqueios,
    revisao: decisao ? { templateId: template.templateId, versao: template.versao, revision,
      decisao, medicoId: "medico-sintetico-01", em: "2026-10-20T10:00:00-03:00",
      motivo: decisao === "CONFERIR" ? "Conferência sintética" : "Inativação sintética",
      contentHash: hash, reviewHash: revisãoHash } : null };
}

function validada(_next: FichaProtocoloCatalogo, pedido: RevisarFichaPedido): FichaProtocoloCatalogo {
  const estado = pedido.decisao === "CONFERIR" ? "CONFERIDA" : "INATIVA";
  return { ..._next, ...ficha(estado), revision: pedido.expectedRevision + 1,
    revisao: { ...ficha(estado).revisao!, revision: pedido.expectedRevision + 1, motivo: pedido.motivo } };
}

function renderCatalogo(overrides: Partial<React.ComponentProps<typeof CatalogoFichasPrescricao>> = {}) {
  const props = {
    fichas: [ficha()], contextoChave: "paciente-sintetico|encontro-sintetico|sem-lote",
    aoRecarregar: vi.fn(async () => {}), aoRevisar: vi.fn(async (pedido: RevisarFichaPedido) => validada(ficha(), pedido)),
    aoUsar: vi.fn(async () => {}), ...overrides,
  };
  return { ...render(<CatalogoFichasPrescricao {...props} />), props };
}

function abrirFicha() {
  fireEvent.click(screen.getByText("Conteúdo completo da versão 1.0", { exact: true }));
}

function preencherRevisao(motivo = "Conferi a ficha sintética e a fonte declarada.") {
  fireEvent.change(screen.getByLabelText("Motivo da revisão"), { target: { value: motivo } });
  fireEvent.click(screen.getByLabelText("Confirmo a conferência integral da ficha"));
  expect((screen.getByLabelText("Confirmo a conferência integral da ficha") as HTMLInputElement).checked).toBe(true);
}

describe("CatalogoFichasPrescricao", () => {
  it("pesquisa nome, tumor e cenário sem esconder versões ou seu estado", () => {
    const reviewed: FichaProtocoloCatalogo = ficha("CONFERIDA", [], "2.0");
    render(<CatalogoFichasPrescricao fichas={[ficha(), reviewed]} contextoChave="ctx-1"
      aoRecarregar={vi.fn()} aoRevisar={vi.fn()} aoUsar={vi.fn()} />);
    expect(screen.getAllByRole("article", { name: /Protocolo de teste clínico sintético/ })).toHaveLength(2);
    fireEvent.change(screen.getByLabelText("Buscar por nome, tumor ou cenário"), { target: { value: "C50" } });
    expect(screen.getAllByRole("article", { name: /Protocolo de teste clínico sintético/ })).toHaveLength(2);
    fireEvent.change(screen.getByLabelText("Buscar por nome, tumor ou cenário"), { target: { value: "adjuvante" } });
    expect(screen.getAllByRole("article", { name: /Protocolo de teste clínico sintético/ })).toHaveLength(2);
    fireEvent.change(screen.getByLabelText("Buscar por nome, tumor ou cenário"), { target: { value: "sem correspondência" } });
    expect(screen.queryByRole("article", { name: /Protocolo de teste clínico sintético/ })).toBeNull();
    fireEvent.change(screen.getByLabelText("Buscar por nome, tumor ou cenário"), { target: { value: "" } });
    expect(screen.getByText("Aguardando revisão médica")).toBeTruthy();
    expect(screen.getByText("Protocolo conferido por médico")).toBeTruthy();
  });

  it("mostra conteúdo completo e explicita valores null como Não informado", () => {
    renderCatalogo();
    expect(screen.queryByLabelText(/Motivo da revis/)).toBeNull();
    expect(screen.queryByText(/Fonte.*teste/)).toBeNull();
    expect(screen.queryByText("Identificadores e hashes", { exact: true })).toBeNull();
    abrirFicha();
    const hashes = screen.getByText("Identificadores e hashes", { exact: true }).closest("details") as HTMLDetailsElement;
    expect(hashes.open).toBe(false);
    for (const text of ["C50 — tumor sintético de mama", "Adjuvante", "QT"])
      expect(screen.getAllByText(text).length).toBeGreaterThan(0);
    for (const text of ["MG_M2", "1250 mg", "Via", "VO", "d1, d14", "Limiares de bula",
      "Neutrófilos mínimos", "1500 /µL", "Plaquetas mínimas", "100000 /µL",
      "Bula sintética de teste, revisão 2026-01", "Fonte sintética para teste de interface"])
      expect(screen.getByText(text)).toBeTruthy();
    expect(screen.getByRole("heading", { name: /Fármaco sintético/ })).toBeTruthy();
    expect(screen.getAllByText("Não informado").length).toBeGreaterThanOrEqual(5);
    fireEvent.click(screen.getByText("Identificadores e hashes", { exact: true }));
    expect(screen.getByText(hash)).toBeTruthy();
    expect(screen.getByText("ficha-sintetica-01")).toBeTruthy();
  });

  it("exige conteúdo aberto, confirmação explícita e motivo antes de revisar", () => {
    const aoRevisar = vi.fn(async (pedido: RevisarFichaPedido) => validada(ficha(), pedido));
    renderCatalogo({ aoRevisar });
    expect(screen.queryByRole("button", { name: /Conferir e registrar/ })).toBeNull();
    abrirFicha();
    expect(screen.getByRole("button", { name: "Conferir e registrar versão" }).matches(":disabled")).toBe(true);
    fireEvent.click(screen.getByLabelText("Confirmo a conferência integral da ficha"));
    expect(screen.getByRole("button", { name: "Conferir e registrar versão" }).matches(":disabled")).toBe(true);
    fireEvent.change(screen.getByLabelText("Motivo da revisão"), { target: { value: "   " } });
    expect(screen.getByRole("button", { name: "Conferir e registrar versão" }).matches(":disabled")).toBe(true);
    expect(aoRevisar).not.toHaveBeenCalled();
  });

  it("envia somente pedido de revisão explícito e habilita rascunho apenas após conferência", async () => {
    const aoRevisar = vi.fn(async (pedido: RevisarFichaPedido) => validada(ficha(), pedido));
    const aoUsar = vi.fn(async () => {});
    renderCatalogo({ aoRevisar, aoUsar });
    abrirFicha();
    preencherRevisao();
    fireEvent.click(screen.getByRole("button", { name: "Conferir e registrar versão" }));
    await waitFor(() => expect(aoRevisar).toHaveBeenCalledTimes(1));
    expect(aoRevisar.mock.calls[0]![0]).toEqual({ templateId: "ficha-sintetica-01", versao: "1.0",
      expectedContentHash: hash, expectedRevision: 0, decisao: "CONFERIR",
      motivo: "Conferi a ficha sintética e a fonte declarada.", idempotencyKey: expect.any(String) });
    const usar = screen.getByRole("button", { name: "Usar ficha em rascunho" });
    expect((usar as HTMLButtonElement).disabled).toBe(false);
    expect(screen.getByText(/Não calcula dose, não assina e não administra/)).toBeTruthy();
    fireEvent.click(usar);
    await waitFor(() => expect(aoUsar).toHaveBeenCalledWith(expect.objectContaining({
      estado: "CONFERIDA", contentHash: hash, template: expect.objectContaining({ status: "RASCUNHO", hash: hashLegadoTemplate }),
    })));
  });

  it("reusa idempotencyKey em retry idêntico e cria outra chave quando motivo muda", async () => {
    const aoRevisar = vi.fn()
      .mockRejectedValueOnce(new Error("Falha transitória sintética"))
      .mockRejectedValueOnce(new Error("Outra falha sintética"))
      .mockImplementationOnce(async (pedido: RevisarFichaPedido) => validada(ficha(), pedido));
    renderCatalogo({ aoRevisar });
    abrirFicha();
    preencherRevisao();
    fireEvent.click(screen.getByRole("button", { name: "Conferir e registrar versão" }));
    expect((await screen.findByRole("alert")).textContent).toContain("Falha transitória sintética");
    fireEvent.click(screen.getByRole("button", { name: "Conferir e registrar versão" }));
    expect((await screen.findByRole("alert")).textContent).toContain("Outra falha sintética");
    const firstKey = aoRevisar.mock.calls[0]![0].idempotencyKey;
    expect(aoRevisar.mock.calls[1]![0].idempotencyKey).toBe(firstKey);
    fireEvent.change(screen.getByLabelText("Motivo da revisão"), { target: { value: "Motivo clínico revisado sintético." } });
    fireEvent.click(screen.getByRole("button", { name: "Conferir e registrar versão" }));
    await waitFor(() => expect(aoRevisar).toHaveBeenCalledTimes(3));
    expect(aoRevisar.mock.calls[2]![0].idempotencyKey).not.toBe(firstKey);
  });

  it("não aceita resposta que altere o template original", async () => {
    const aoRevisar = vi.fn(async (pedido: RevisarFichaPedido) => ({
      ...validada(ficha(), pedido),
      template: { ...templateBase, nome: "Protocolo alterado fora do corpus" },
    }));
    renderCatalogo({ aoRevisar });
    abrirFicha();
    preencherRevisao();
    fireEvent.click(screen.getByRole("button", { name: "Conferir e registrar versão" }));
    expect((await screen.findByRole("alert")).textContent).toMatch(/alterou o template original/i);
    expect(screen.getByText("Protocolo de teste clínico sintético")).toBeTruthy();
    expect(screen.queryByText("Protocolo alterado fora do corpus")).toBeNull();
    expect(screen.queryByRole("button", { name: "Usar ficha em rascunho" })).toBeNull();
  });

  it("só inativa versão conferida e impede usar versão inativa ou bloqueada", async () => {
    const confirmed = ficha("CONFERIDA");
    const inactivated = ficha("INATIVA");
    const aoRevisar = vi.fn(async (pedido: RevisarFichaPedido) => ({ ...inactivated,
      revision: pedido.expectedRevision + 1, revisao: { ...inactivated.revisao!, revision: pedido.expectedRevision + 1,
        motivo: pedido.motivo } }));
    const aoUsar = vi.fn(async () => {});
    const view = render(<CatalogoFichasPrescricao fichas={[confirmed]} contextoChave="ctx-1"
      aoRecarregar={vi.fn()} aoRevisar={aoRevisar} aoUsar={aoUsar} />);
    abrirFicha();
    expect(screen.getByRole("button", { name: "Inativar versão" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Usar ficha em rascunho" }));
    await waitFor(() => expect(aoUsar).toHaveBeenCalledTimes(1));
    fireEvent.click(screen.getByRole("button", { name: "Inativar versão" }));
    expect(screen.getByLabelText("Confirmo a conferência integral da ficha")).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Motivo da revisão"), { target: { value: "Versão sintética substituída." } });
    fireEvent.click(screen.getByLabelText("Confirmo a conferência integral da ficha"));
    fireEvent.click(screen.getByRole("button", { name: "Inativar versão" }));
    await waitFor(() => expect(aoRevisar).toHaveBeenCalledWith(expect.objectContaining({ decisao: "INATIVAR",
      expectedRevision: confirmed.revision, expectedContentHash: hash })));
    expect(await screen.findByText("Versão inativa")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Usar ficha em rascunho" })).toBeNull();
    view.rerender(<CatalogoFichasPrescricao fichas={[{ ...confirmed, bloqueios: ["Bloqueio sintético"] }]}
      contextoChave="ctx-2" aoRecarregar={vi.fn()} aoRevisar={aoRevisar} aoUsar={aoUsar} />);
    expect((screen.getByRole("button", { name: "Usar ficha em rascunho" }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText("Bloqueio sintético")).toBeTruthy();
  });


  it("allows explicit reconfirmation to reactivate an inactive version", async () => {
    const inactive = ficha("INATIVA");
    const aoRevisar = vi.fn(async (pedido: RevisarFichaPedido) => validada(inactive, pedido));
    render(<CatalogoFichasPrescricao fichas={[inactive]} contextoChave="ctx-reativar"
      aoRecarregar={vi.fn(async () => {})} aoRevisar={aoRevisar} aoUsar={vi.fn(async () => {})} />);
    expect(screen.queryByRole("button", { name: /Conferir e reativar/ })).toBeNull();

    abrirFicha();
    expect(screen.getByRole("button", { name: /Conferir e reativar/ })).toBeTruthy();
    preencherRevisao("Revisao sintetica explicita para reativar a versao.");
    fireEvent.click(screen.getByRole("button", { name: /Conferir e reativar/ }));
    await waitFor(() => expect(aoRevisar).toHaveBeenCalledWith(expect.objectContaining({
      decisao: "CONFERIR", expectedRevision: inactive.revision, expectedContentHash: inactive.contentHash,
      motivo: "Revisao sintetica explicita para reativar a versao.", idempotencyKey: expect.any(String),
    })));
    expect(await screen.findByText(/Protocolo conferido/)).toBeTruthy();
    expect((screen.getByRole("button", { name: /Usar ficha em rascunho/ }) as HTMLButtonElement).disabled).toBe(false);
  });

  it("prefers props at equal revision and drops local overlays when content hash changes", async () => {
    const aoRevisar = vi.fn(async (pedido: RevisarFichaPedido) => validada(ficha(), pedido));
    const props = { contextoChave: "ctx-hash", aoRecarregar: vi.fn(async () => {}), aoRevisar,
      aoUsar: vi.fn(async () => {}) };
    const view = render(<CatalogoFichasPrescricao {...props} fichas={[ficha()]} />);
    abrirFicha();
    preencherRevisao();
    fireEvent.click(screen.getByRole("button", { name: /Conferir e registrar/ }));
    await waitFor(() => expect(aoRevisar).toHaveBeenCalledTimes(1));
    expect(await screen.findByText(/Protocolo conferido/)).toBeTruthy();

    const propAtSameRevision = { ...ficha(), revision: 1 };
    view.rerender(<CatalogoFichasPrescricao {...props} fichas={[propAtSameRevision]} />);
    expect(screen.getByText(/Aguardando/)).toBeTruthy();
    expect(screen.queryByText(/Protocolo conferido/)).toBeNull();

    const changedContent = { ...ficha(), contentHash: "c".repeat(64) };
    view.rerender(<CatalogoFichasPrescricao {...props} fichas={[changedContent]} />);
    expect(screen.getByText(/Aguardando/)).toBeTruthy();
    expect(screen.queryByText(/Protocolo conferido/)).toBeNull();
  });

  it("clears the local overlay after successful reload so removed versions disappear", async () => {
    const aoRevisar = vi.fn(async (pedido: RevisarFichaPedido) => validada(ficha(), pedido));
    const aoRecarregar = vi.fn(async () => {});
    const props = { contextoChave: "ctx-reload", aoRecarregar, aoRevisar, aoUsar: vi.fn(async () => {}) };
    const view = render(<CatalogoFichasPrescricao {...props} fichas={[ficha()]} />);
    abrirFicha();
    preencherRevisao();
    fireEvent.click(screen.getByRole("button", { name: /Conferir e registrar/ }));
    await waitFor(() => expect(aoRevisar).toHaveBeenCalledTimes(1));
    expect(await screen.findByText(/Protocolo conferido/)).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /Atualizar cat/ }));
    await waitFor(() => expect(aoRecarregar).toHaveBeenCalledTimes(1));
    expect(screen.getByText(/Aguardando/)).toBeTruthy();
    expect(screen.queryByText(/Protocolo conferido/)).toBeNull();
    view.rerender(<CatalogoFichasPrescricao {...props} fichas={[]} />);
    expect(screen.queryByRole("article", { name: /Protocolo de teste/ })).toBeNull();
    expect(screen.getByText(/Nenhuma ficha dispon/)).toBeTruthy();
  });

  it("does not mount source details or review controls while closed and blocks review when unavailable", () => {
    const aoRevisar = vi.fn(async (pedido: RevisarFichaPedido) => validada(ficha(), pedido));
    render(<CatalogoFichasPrescricao fichas={[ficha("PENDENTE", ["Bloqueio sintetico"])]}
      contextoChave="ctx-block" aoRecarregar={vi.fn(async () => {})} aoRevisar={aoRevisar} aoUsar={vi.fn(async () => {})} />);
    expect(screen.queryByLabelText(/Motivo da revis/)).toBeNull();
    expect(screen.queryByLabelText(/Confirmo.*ficha/)).toBeNull();
    expect(screen.queryByText(/Fonte.*teste/)).toBeNull();
    abrirFicha();
    expect(screen.getByText(/Fonte.*teste/)).toBeTruthy();
    expect(screen.queryByLabelText(/Motivo da revis/)).toBeNull();
    expect(screen.queryByRole("button", { name: /Conferir e registrar/ })).toBeNull();
    expect(screen.getByText(/Bloqueio sintetico/)).toBeTruthy();
    expect(aoRevisar).not.toHaveBeenCalled();
  });
  it("ignora resposta tardia de revisão quando muda a consulta", async () => {
    let resolve!: (value: FichaProtocoloCatalogo) => void;
    const aoRevisar = vi.fn((pedido: RevisarFichaPedido) => new Promise<FichaProtocoloCatalogo>(done => {
      resolve = () => done(validada(ficha(), pedido));
    }));
    const props = { fichas: [ficha()], contextoChave: "ctx-1", aoRecarregar: vi.fn(async () => {}),
      aoRevisar, aoUsar: vi.fn(async () => {}) };
    const view = render(<CatalogoFichasPrescricao {...props} />);
    abrirFicha();
    preencherRevisao();
    fireEvent.click(screen.getByRole("button", { name: "Conferir e registrar versão" }));
    await waitFor(() => expect(aoRevisar).toHaveBeenCalledTimes(1));
    view.rerender(<CatalogoFichasPrescricao {...props} contextoChave="ctx-2" />);
    await act(async () => { resolve(ficha("CONFERIDA")); });
    expect(screen.getByText("Aguardando revisão médica")).toBeTruthy();
    expect(screen.queryByText("Protocolo conferido por médico")).toBeNull();
    expect(screen.queryByLabelText(/Motivo da revis/)).toBeNull();
  });

  it("bloqueia ações durante ocupado e permite tentar carregar novamente", async () => {
    const aoRecarregar = vi.fn(async () => {});
    const { rerender, props } = renderCatalogo({ fichas: [ficha("CONFERIDA")], ocupado: true,
      erro: "Erro sintético de catálogo", aoRecarregar });
    expect(screen.getByRole("alert").textContent).toContain("Erro sintético de catálogo");
    expect((screen.getByRole("button", { name: "Atualizar catálogo" }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole("button", { name: "Usar ficha em rascunho" }) as HTMLButtonElement).disabled).toBe(true);
    rerender(<CatalogoFichasPrescricao {...props} ocupado={false} />);
    fireEvent.click(screen.getByRole("button", { name: "Atualizar catálogo" }));
    await waitFor(() => expect(aoRecarregar).toHaveBeenCalledTimes(1));
  });
});
