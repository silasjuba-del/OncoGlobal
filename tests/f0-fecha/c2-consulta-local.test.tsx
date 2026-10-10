// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { ConsultaPersistida } from "../../src/ui/consulta/ConsultaPersistida.js";
import { criarPortaHttp } from "../../src/ui/api/http.js";
import { listarDrafts, salvarDraft } from "../../src/kernel/ledger/drafts.js";
import { abrirAmbiente, cadastrarPaciente, criarDiretorio, removerDiretorio, ENCONTRO, PACIENTE, SENHA } from "./fixtures/consulta-completa.js";

const ambientes: Awaited<ReturnType<typeof abrirAmbiente>>[] = [];
const contexto = { patientId: PACIENTE, encounterId: ENCONTRO, tumorLotId: null };
afterEach(async () => {
  cleanup(); vi.unstubAllGlobals();
  for (const ambiente of ambientes.splice(0)) { await ambiente.close(); removerDiretorio(ambiente.dir); }
});

async function abrir(aoAbrirApac?: () => void) {
  const ambiente = await abrirAmbiente(criarDiretorio()); ambientes.push(ambiente);
  cadastrarPaciente(ambiente);
  const transporte = globalThis.fetch;
  vi.stubGlobal("fetch", (input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]) =>
    transporte(typeof input === "string" && input.startsWith("/") ? `${ambiente.baseUrl}${input}` : input, init));
  const porta = criarPortaHttp({ onSessaoExpirada: () => {} });
  expect((await porta.login(SENHA)).ok).toBe(true);
  const view = render(<ConsultaPersistida porta={porta} contexto={contexto} {...(aoAbrirApac ? { aoAbrirApac } : {})} />);
  await screen.findByRole("button", { name: "Consulta Flash" });
  return Object.assign(ambiente, { rerender: view.rerender, porta });
}

async function preparar() {
  fireEvent.click(screen.getByRole("button", { name: "Consulta Flash" }));
  fireEvent.change(screen.getByLabelText("Prazo do retorno em dias"), { target: { value: "30" } });
  fireEvent.click(screen.getByRole("button", { name: "Revisar documentos para assinatura" }));
  return screen.findByRole("region", { name: "Conteúdo para assinatura" });
}

// F0C: evolução + retorno + conjunto de impressão são três documentos exibidos e assinados.
describe("C2 · consulta local real e conteúdo visível antes de assinar", () => {
  it("exibe textos reais, assina por HTTP e reabre o histórico persistido sem dados de demonstração", async () => {
    const ambiente = await abrir();
    expect(ambiente.eventos().filter((e) => e.revisao === "ASSINADO")).toHaveLength(0);
    const exibicao = await preparar();
    expect(exibicao.querySelectorAll("article")).toHaveLength(3);
    expect(exibicao.textContent).toContain("30");
    expect(ambiente.eventos().filter((e) => e.revisao === "ASSINADO")).toHaveLength(0);
    const textos = [...exibicao.querySelectorAll("pre")].map((p) => p.textContent);
    expect(textos.every((t) => t && t.length > 10)).toBe(true);
    fireEvent.click(within(exibicao).getByRole("button", { name: "Confirmar e assinar conteúdo exibido" }));
    await waitFor(() => expect(ambiente.eventos().filter((e) => e.revisao === "ASSINADO")).toHaveLength(3));
    await waitFor(() => expect(screen.getByRole("region", { name: "Histórico de documentos assinados" }).querySelectorAll("article")).toHaveLength(3));
    const historico = screen.getByRole("region", { name: "Histórico de documentos assinados" });
    for (const texto of textos) expect(historico.textContent).toContain(texto!);
    fireEvent.click(screen.getByRole("button", { name: "Reabrir histórico" }));
    await waitFor(() => expect(screen.getByRole("region", { name: "Histórico de documentos assinados" }).querySelectorAll("article")).toHaveLength(3));
    const src = readFileSync("src/ui/consulta/ConsultaPersistida.tsx", "utf8");
    expect(src).not.toMatch(/cadastroSintetico|timelineSintetica|prescricaoSintetica|api\/fake/);
  });

  it("não reexibe silenciosamente conteúdo alterado entre a prévia e o clique de assinatura", async () => {
    const ambiente = await abrir();
    const exibicao = await preparar();
    const documento = listarDrafts(ambiente.db, PACIENTE).find((d) => {
      const p = d.payload as Record<string, unknown>;
      return p.tipoDocumento === "FLASH_RETORNO";
    })!;
    expect(documento).toBeDefined();
    salvarDraft(ambiente.db, { ...documento, revision: documento.revision + 1,
      payload: { ...(documento.payload as Record<string, unknown>), texto: "Conteúdo sintético alterado após a exibição." } });
    fireEvent.click(within(exibicao).getByRole("button", { name: "Confirmar e assinar conteúdo exibido" }));
    await screen.findByText(/CONTEUDO_ALTERADO_APOS_EXIBICAO/);
    expect(ambiente.eventos().filter((e) => e.revisao === "ASSINADO")).toHaveLength(0);
  });

  it("reutiliza a mesma preparação após resposta perdida sem duplicar documentos", async () => {
    const ambiente = await abrir();
    const transporte = globalThis.fetch;
    let perderUmaResposta = true;
    vi.stubGlobal("fetch", async (input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]) => {
      const resposta = await transporte(input, init);
      if (typeof input === "string" && input.endsWith("/consulta/flash/preparar") && perderUmaResposta) {
        perderUmaResposta = false; await resposta.text(); throw new Error("RESPOSTA_PERDIDA_SIMULADA");
      }
      return resposta;
    });
    fireEvent.click(screen.getByRole("button", { name: "Consulta Flash" }));
    fireEvent.change(screen.getByLabelText("Prazo do retorno em dias"), { target: { value: "30" } });
    fireEvent.click(screen.getByRole("button", { name: "Revisar documentos para assinatura" }));
    await screen.findByText(/Operação não concluída/);
    const documentos = () => listarDrafts(ambiente.db, PACIENTE).filter((d) =>
      typeof (d.payload as Record<string, unknown>).documentId === "string").map((d) => d.draftId).sort();
    const antes = documentos(); expect(antes).toHaveLength(3);
    fireEvent.click(screen.getByRole("button", { name: "Revisar documentos para assinatura" }));
    await screen.findByRole("region", { name: "Conteúdo para assinatura" });
    expect(documentos()).toEqual(antes);
    expect(ambiente.eventos().filter((e) => e.revisao === "ASSINADO")).toHaveLength(0);
  });

  it("calcula instrumento como rascunho, abre APAC e não reassina quando a impressão falha", async () => {
    const aoAbrirApac = vi.fn();
    const ambiente = await abrir(aoAbrirApac);
    expect(screen.getByRole("region", { name: "Instrumentos clínicos" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Calcular" }));
    expect((await screen.findByLabelText("Resultado do instrumento")).textContent).toMatch(/rascunho/);
    expect(screen.getByLabelText("Resultado do instrumento").textContent).toMatch(/kpsDocumentado/);
    expect(ambiente.eventos().filter((e) => e.revisao === "ASSINADO")).toHaveLength(0);
    fireEvent.click(screen.getByRole("button", { name: "Consulta Flash" }));
    fireEvent.click(screen.getByRole("button", { name: "Abrir APAC ↗" }));
    expect(aoAbrirApac).toHaveBeenCalledTimes(1);
    fireEvent.change(screen.getByLabelText("Prazo do retorno em dias"), { target: { value: "30" } });
    fireEvent.click(screen.getByRole("button", { name: "Revisar documentos para assinatura" }));
    const exibicao = await screen.findByRole("region", { name: "Conteúdo para assinatura" });
    const acoes: Array<{ verbo?: string; idempotencyKey?: string; objeto?: { id?: string; versao?: number } }> = [];
    const transporte = globalThis.fetch;
    vi.stubGlobal("fetch", async (input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]) => {
      if (typeof input === "string" && input.endsWith("/acao") && typeof init?.body === "string")
        acoes.push(JSON.parse(init.body) as typeof acoes[number]);
      return transporte(input, init);
    });
    fireEvent.click(within(exibicao).getByRole("button", { name: "Confirmar e assinar conteúdo exibido" }));
    await waitFor(() => expect(ambiente.eventos().filter((e) => e.revisao === "ASSINADO")).toHaveLength(3));
    const repetir = await screen.findByRole("button", { name: "Solicitar impressão novamente" });
    await waitFor(() => {
      expect((repetir as HTMLButtonElement).disabled).toBe(false);
      expect(screen.getByRole("region", { name: "Histórico de documentos assinados" }).querySelectorAll("article")).toHaveLength(3);
    });
    expect(acoes).toHaveLength(1);
    const primeira = acoes[0]!;
    expect(primeira.verbo).toBe("IMPRIMIR");
    expect(primeira.objeto?.id).toBeTruthy();
    expect(primeira.objeto?.versao).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole("button", { name: "Solicitar impressão novamente" }));
    await waitFor(() => expect(acoes).toHaveLength(2));
    expect(acoes[1]).toEqual(primeira);
    expect(ambiente.eventos().filter((e) => e.revisao === "ASSINADO")).toHaveLength(3);
    ambiente.rerender(<ConsultaPersistida porta={ambiente.porta} contexto={{ patientId: "paciente-troca-sintetica", encounterId: "consulta-troca", tumorLotId: null }} />);
    await waitFor(() => expect(screen.queryByRole("button", { name: "Solicitar impressão novamente" })).toBeNull());
    expect(acoes).toHaveLength(2);
  });
});

