// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { OncoassistLocal } from "../../src/ui/OncoassistLocal.js";
import { TranscricaoLocal } from "../../src/ui/consulta/TranscricaoLocal.js";
import { criarPortaFalsa } from "../../src/ui/api/fake.js";
import type { OpcoesHttp } from "../../src/ui/api/http.js";
import type { PedidoBundle, ResultadoTranscricaoLocal } from "../../src/ui/api/porta.js";

const ditadoMock = vi.hoisted(() => ({ emitirTrecho: null as ((trecho: string) => void) | null }));
vi.mock("../../src/ui/consulta/DitadoDeepgram.js", () => ({
  DitadoDeepgram: (props: { aoTrecho: (trecho: string) => void }) => { ditadoMock.emitirTrecho = props.aoTrecho; return null; },
}));

afterEach(cleanup);

const contextos: [PedidoBundle, PedidoBundle] = [
  { patientId: "pt-multi", encounterId: "en-multi", tumorLotId: "lot-multi-a" },
  { patientId: "pt-e1", encounterId: "en-e1", tumorLotId: "lot-e1" },
];

function fixture() {
  const porta = criarPortaFalsa();
  porta.login = vi.fn(async () => ({ ok: true, expiraEm: null }));
  porta.importarTranscricaoLocal = vi.fn(async () => ({ codigo: "RASCUNHO_SALVO", draftId: "rascunho-sintetico", revision: 0,
    linkedPatientId: null, requiresMedicalReview: true } as ResultadoTranscricaoLocal));
  porta.oncoassistStatus = vi.fn(async () => ({ status: "PENDENTE" as const, motivo: "CHAVE_AUSENTE" }));
  porta.oncoassistFontes = vi.fn(async () => ({ fontes: [] }));
  let opcoes!: OpcoesHttp;
  const fabrica = vi.fn((o: OpcoesHttp) => { opcoes = o; return porta; });
  return { porta, fabrica, expirar: () => opcoes.onSessaoExpirada() };
}

function entrar() {
  fireEvent.change(screen.getByLabelText("Senha do servidor"), { target: { value: "senha-sintetica-para-teste" } });
  fireEvent.click(screen.getByRole("button", { name: "Entrar" }));
}

async function abrirPaciente(encounterId = "en-multi") {
  fireEvent.change(await screen.findByLabelText("Paciente da agenda"), { target: { value: encounterId } });
  await screen.findByLabelText("Texto da transcrição");
  await waitFor(() => {
    if ((screen.getByLabelText("Paciente da agenda") as HTMLSelectElement).disabled) throw new Error("agenda ainda ocupada");
  });
}

async function escrever(texto = "Texto sintético não salvo.") {
  await waitFor(() => {
    if ((screen.getByLabelText("Texto da transcrição") as HTMLTextAreaElement).disabled) throw new Error("editor ainda ocupado");
  });
  fireEvent.change(screen.getByLabelText("Texto da transcrição"), { target: { value: texto } });
  fireEvent.click(screen.getByLabelText("Revisei o texto para salvar como rascunho"));
  await waitFor(() => {
    if ((screen.getByLabelText("Paciente da agenda") as HTMLSelectElement).disabled) throw new Error("agenda ainda ocupada");
  });
}

function dialogo() {
  return screen.getByRole("dialog", { name: "Transcrição não salva" });
}

describe("navegação com transcrição não salva", () => {
  it("preserva bytes, revisão e contexto ao continuar; Escape equivale a continuar editando", async () => {
    const f = fixture();
    render(<OncoassistLocal fabricaPorta={f.fabrica} />);
    entrar(); await abrirPaciente(); await escrever("linha 1\n  linha 2  ");

    const apac=screen.getByRole("button", { name: "APAC" }); apac.focus(); fireEvent.click(apac);
    expect(dialogo().getAttribute("aria-modal")).toBe("true");
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Continuar editando" }));
    fireEvent.keyDown(screen.getByRole("button", { name: "Continuar editando" }), { key: "Tab", shiftKey: true });
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Descartar e sair" }));
    fireEvent.keyDown(screen.getByRole("button", { name: "Descartar e sair" }), { key: "Tab" });
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Continuar editando" }));
    fireEvent.keyDown(dialogo(), { key: "Escape" });

    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "APAC" }));
    expect((screen.getByLabelText("Texto da transcrição") as HTMLTextAreaElement).value).toBe("linha 1\n  linha 2  ");
    expect((screen.getByLabelText("Revisei o texto para salvar como rascunho") as HTMLInputElement).checked).toBe(true);
    expect(screen.getByRole("region", { name: "Identificação da consulta" }).textContent).toContain("Paciente pt-multi");
    expect(f.porta.importarTranscricaoLocal).not.toHaveBeenCalled();
  });

  it("guarda troca de paciente e de lote até descarte explicitamente confirmado", async () => {
    const f = fixture();
    render(<OncoassistLocal fabricaPorta={f.fabrica} />);
    entrar(); await abrirPaciente(); await escrever("não mover para outro contexto");

    const agenda = screen.getByLabelText("Paciente da agenda") as HTMLSelectElement;
    fireEvent.change(agenda, { target: { value: "en-e1" } });
    expect(dialogo()).toBeTruthy();
    expect((screen.getByLabelText("Paciente da agenda") as HTMLSelectElement).value).toBe("en-multi");
    fireEvent.click(screen.getByRole("button", { name: "Continuar editando" }));
    expect((screen.getByLabelText("Texto da transcrição") as HTMLTextAreaElement).value).toBe("não mover para outro contexto");

    fireEvent.change(screen.getByLabelText("Lote tumoral"), { target: { value: "lot-multi-b" } });
    expect(dialogo()).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Descartar e sair" }));
    await waitFor(() => expect((screen.getByLabelText("Lote tumoral") as HTMLSelectElement).value).toBe("lot-multi-b"));
    expect((screen.getByLabelText("Texto da transcrição") as HTMLTextAreaElement).value).toBe("");
    expect(f.porta.importarTranscricaoLocal).not.toHaveBeenCalled();

    await escrever("novo texto no lote B");
    fireEvent.change(screen.getByLabelText("Paciente da agenda"), { target: { value: "en-e1" } });
    expect(dialogo()).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Descartar e sair" }));
    await waitFor(() => expect((screen.getByLabelText("Paciente da agenda") as HTMLSelectElement).value).toBe("en-e1"));
    await screen.findByLabelText("Texto da transcrição");
    await waitFor(() => {
      if ((screen.getByLabelText("Paciente da agenda") as HTMLSelectElement).disabled) throw new Error("agenda ainda ocupada");
    });
    expect((screen.getByLabelText("Texto da transcrição") as HTMLTextAreaElement).value).toBe("");
    expect(screen.getByRole("region", { name: "Identificação da consulta" }).textContent).toContain("Paciente pt-e1");
  });

  it("não abre diálogo sem pendência e descarte confirmado efetiva a navegação voluntária", async () => {
    const f = fixture();
    render(<OncoassistLocal fabricaPorta={f.fabrica} />);
    entrar(); await abrirPaciente();
    fireEvent.click(screen.getByRole("button", { name: "APAC" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Consulta" }));
    await escrever();
    fireEvent.click(screen.getByRole("button", { name: "APAC" }));
    expect(dialogo()).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Descartar e sair" }));
    expect(screen.queryByLabelText("Texto da transcrição")).toBeNull();
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("manter Consulta ativa ou a mesma seleção preserva a pendência", async () => {
    const f = fixture();
    render(<OncoassistLocal fabricaPorta={f.fabrica} />);
    entrar(); await abrirPaciente(); await escrever("não descartar em uma navegação sem mudança");
    fireEvent.click(screen.getByRole("button", { name: "Consulta" }));
    fireEvent.change(screen.getByLabelText("Paciente da agenda"), { target: { value: "en-multi" } });
    fireEvent.change(screen.getByLabelText("Lote tumoral"), { target: { value: "lot-multi-a" } });
    expect(screen.queryByRole("dialog")).toBeNull();
    expect((screen.getByLabelText("Texto da transcrição") as HTMLTextAreaElement).value).toBe("não descartar em uma navegação sem mudança");
    expect((screen.getByLabelText("Revisei o texto para salvar como rascunho") as HTMLInputElement).checked).toBe(true);
  });

  it("guarda o link de retorno à demonstração e o botão Sair", async () => {
    const f = fixture();
    render(<OncoassistLocal fabricaPorta={f.fabrica} />);
    entrar(); await abrirPaciente(); await escrever("texto sintético em edição");

    fireEvent.click(screen.getByRole("link", { name: "Voltar à demonstração" }));
    expect(dialogo()).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Continuar editando" }));
    expect((screen.getByLabelText("Texto da transcrição") as HTMLTextAreaElement).value).toBe("texto sintético em edição");

    fireEvent.click(screen.getByRole("button", { name: "Sair" }));
    expect(dialogo()).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Descartar e sair" }));
    expect(await screen.findByLabelText("Senha do servidor")).toBeTruthy();
    expect(screen.queryByLabelText("Texto da transcrição")).toBeNull();
  });

  it("salvar com sucesso limpa a pendência; falha de porta substituída preserva o texto", async () => {
    const f = fixture();
    f.porta.importarTranscricaoLocal = vi.fn(async () => ({ codigo: "RASCUNHO_SALVO", draftId: "d", revision: 0, linkedPatientId: null, requiresMedicalReview: true } as ResultadoTranscricaoLocal));
    const tela = render(<OncoassistLocal fabricaPorta={f.fabrica} />);
    entrar(); await abrirPaciente(); await escrever("texto para salvar");
    fireEvent.click(screen.getByRole("button", { name: "Salvar transcrição para revisão clínica" }));
    await screen.findByText(/Rascunho salvo/);
    fireEvent.click(screen.getByRole("button", { name: "APAC" }));
    expect(screen.queryByRole("dialog")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Consulta" }));
    await escrever("texto retido após falha");
    let rejeitar!: (erro: Error) => void;
    const portaNova = { ...f.porta, importarTranscricaoLocal: vi.fn(() => new Promise<never>((_, reject) => { rejeitar = reject; })) };
    const novaFabrica: typeof f.fabrica = vi.fn((opcoes) => { void opcoes; return portaNova; });
    tela.rerender(<OncoassistLocal fabricaPorta={novaFabrica} />);
    fireEvent.click(screen.getByRole("button", { name: "Salvar transcrição para revisão clínica" }));
    await waitFor(() => expect(rejeitar).toBeTypeOf("function"));
    await act(async () => rejeitar(new Error("falha sintética")));
    expect((screen.getByLabelText("Texto da transcrição") as HTMLTextAreaElement).value).toBe("texto retido após falha");
    fireEvent.click(screen.getByRole("button", { name: "APAC" }));
    expect(dialogo()).toBeTruthy();
  });

  it("ignora sucesso tardio da porta substituída durante o save e habilita retry no mesmo contexto", async () => {
    const portaAntiga = criarPortaFalsa();
    let resolver!: (resultado: ResultadoTranscricaoLocal) => void;
    portaAntiga.importarTranscricaoLocal = vi.fn(() => new Promise<ResultadoTranscricaoLocal>(resolve => { resolver = resolve; }));
    const portaNova = { ...portaAntiga, importarTranscricaoLocal: vi.fn(async () => ({ codigo: "RASCUNHO_SALVO", draftId: "novo",
      revision: 0, linkedPatientId: null, requiresMedicalReview: true } as ResultadoTranscricaoLocal)) };
    const aoSalvar = vi.fn();
    const contexto = contextos[0];
    const tela = render(<TranscricaoLocal porta={portaAntiga} contexto={contexto} aoSalvar={aoSalvar} />);
    fireEvent.change(screen.getByLabelText("Texto da transcrição"), { target: { value: "texto sintético durante troca de porta" } });
    fireEvent.click(screen.getByLabelText("Revisei o texto para salvar como rascunho"));
    const salvar = screen.getByRole("button", { name: "Salvar transcrição para revisão clínica" });
    fireEvent.click(salvar);
    expect(portaAntiga.importarTranscricaoLocal).toHaveBeenCalledOnce();

    tela.rerender(<TranscricaoLocal porta={portaNova} contexto={contexto} aoSalvar={aoSalvar} />);
    await act(async () => resolver({ codigo: "RASCUNHO_SALVO", draftId: "antigo", revision: 0, linkedPatientId: null, requiresMedicalReview: true }));
    expect((screen.getByLabelText("Texto da transcrição") as HTMLTextAreaElement).value).toBe("texto sintético durante troca de porta");
    expect(aoSalvar).not.toHaveBeenCalled();
    await waitFor(() => {
      if ((screen.getByRole("button", { name: "Salvar transcrição para revisão clínica" }) as HTMLButtonElement).disabled)
        throw new Error("retry ainda ocupado");
    });

    fireEvent.click(screen.getByRole("button", { name: "Salvar transcrição para revisão clínica" }));
    await screen.findByText(/Rascunho salvo/);
    expect(portaNova.importarTranscricaoLocal).toHaveBeenCalledOnce();
    expect(aoSalvar).toHaveBeenCalledOnce();
  });

  it("mantém contexto e esconde descarte enquanto salva; sucesso libera navegação sem diálogo", async () => {
    const f = fixture();
    let resolver!: (resultado: ResultadoTranscricaoLocal) => void;
    f.porta.importarTranscricaoLocal = vi.fn(() => new Promise<ResultadoTranscricaoLocal>(resolve => { resolver = resolve; }));
    render(<OncoassistLocal fabricaPorta={f.fabrica} />);
    entrar(); await abrirPaciente(); await escrever("texto em salvamento");
    fireEvent.click(screen.getByRole("button", { name: "Salvar transcrição para revisão clínica" }));
    await waitFor(() => expect(f.porta.importarTranscricaoLocal).toHaveBeenCalledOnce());

    fireEvent.click(screen.getByRole("button", { name: "APAC" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.queryByRole("button", { name: "Descartar e sair" })).toBeNull();
    expect((screen.getByLabelText("Paciente da agenda") as HTMLSelectElement).value).toBe("en-multi");
    expect((screen.getByLabelText("Texto da transcrição") as HTMLTextAreaElement).value).toBe("texto em salvamento");

    await act(async () => resolver({ codigo: "RASCUNHO_SALVO", draftId: "save-race", revision: 0, linkedPatientId: null, requiresMedicalReview: true }));
    await screen.findByText(/Rascunho salvo/);
    fireEvent.click(screen.getByRole("button", { name: "APAC" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.queryByLabelText("Texto da transcrição")).toBeNull();
  });

  it("captura retida continua protegendo a navegação mesmo após limpar a transcrição editada", async () => {
    const f = fixture();
    render(<OncoassistLocal fabricaPorta={f.fabrica} />);
    entrar(); await abrirPaciente();
    act(() => ditadoMock.emitirTrecho?.("relato original capturado"));
    fireEvent.click(screen.getByLabelText("Revisei o texto para salvar como rascunho"));
    fireEvent.change(screen.getByLabelText("Texto da transcrição"), { target: { value: "" } });
    expect(screen.getByText("relato original capturado")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "APAC" }));
    expect(dialogo()).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Continuar editando" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect((screen.getByLabelText("Texto da transcrição") as HTMLTextAreaElement).value).toBe("");
    expect(screen.getByText("relato original capturado")).toBeTruthy();
    expect(f.porta.importarTranscricaoLocal).not.toHaveBeenCalled();
  });

  it("falha durante o salvamento preserva o texto e restaura a guarda após resolver", async () => {
    const f = fixture();
    let rejeitar!: (erro: Error) => void;
    f.porta.importarTranscricaoLocal = vi.fn(() => new Promise<ResultadoTranscricaoLocal>((_, reject) => { rejeitar = reject; }));
    render(<OncoassistLocal fabricaPorta={f.fabrica} />);
    entrar(); await abrirPaciente(); await escrever("texto após falha de salvamento");
    fireEvent.click(screen.getByRole("button", { name: "Salvar transcrição para revisão clínica" }));
    await waitFor(() => expect(f.porta.importarTranscricaoLocal).toHaveBeenCalledOnce());

    fireEvent.click(screen.getByRole("link", { name: "Voltar à demonstração" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect((screen.getByLabelText("Texto da transcrição") as HTMLTextAreaElement).value).toBe("texto após falha de salvamento");

    await act(async () => rejeitar(new Error("falha sintética")));
    expect((screen.getByLabelText("Texto da transcrição") as HTMLTextAreaElement).value).toBe("texto após falha de salvamento");
    fireEvent.click(screen.getByRole("button", { name: "APAC" }));
    expect(dialogo()).toBeTruthy();
  });

  it("expiração forçada limpa texto sem pedir confirmação", async () => {
    const f = fixture();
    render(<OncoassistLocal fabricaPorta={f.fabrica} />);
    entrar(); await abrirPaciente(); await escrever("texto sintético confidencial");
    f.expirar();
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(await screen.findByText("Sessão expirada. Entre novamente.")).toBeTruthy();
    expect(screen.queryByLabelText("Texto da transcrição")).toBeNull();
  });
});
