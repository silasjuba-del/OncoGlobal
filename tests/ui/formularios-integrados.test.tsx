// @vitest-environment jsdom
// Somente contexto e conteúdo sintéticos.
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { LaudoAcesso } from "../../src/ui/consulta/LaudoAcesso.js";
import { AnamneseGuiada } from "../../src/ui/consulta/AnamneseGuiada.js";
import { criarPortaFalsa } from "../../src/ui/api/fake.js";
import type { RespostaLaudoAcesso } from "../../src/contracts/api/laudoAcesso.js";
import type { RespostaAnamneseGuiada } from "../../src/contracts/api/anamneseGuiada.js";
afterEach(cleanup);
const contexto = { patientId: "paciente-sintetico", encounterId: "encontro-sintetico", tumorLotId: "lote-sintetico" };
it("recarregar a base do laudo preserva texto em edição e não libera a navegação como se estivesse salvo", async () => {
  const base: RespostaLaudoAcesso = { codigo: "LAUDO_ACESSO", contexto, baseHash: "a".repeat(64), fontes: [], pendencias: [], historico: [], minuta: null, conteudoHash: null };
  const api = vi.fn(async () => base), pendente = vi.fn(), salvando = vi.fn();
  render(<LaudoAcesso porta={{ ...criarPortaFalsa(), laudoAcesso: api }} contexto={contexto} aoPendente={pendente} aoSalvando={salvando} />);
  await waitFor(() => expect(api).toHaveBeenCalledTimes(1));
  fireEvent.change(screen.getByLabelText("Medicamento solicitado"), { target: { value: "Medicamento sintético em edição" } });
  fireEvent.click(screen.getByRole("button", { name: "Recarregar base do laudo" }));
  await waitFor(() => expect(api).toHaveBeenCalledTimes(2));
  await waitFor(() => expect(salvando).toHaveBeenLastCalledWith(false));
  expect((screen.getByLabelText("Medicamento solicitado") as HTMLInputElement).value).toBe("Medicamento sintético em edição");
  expect(pendente).toHaveBeenLastCalledWith(true);
});
it("anamnese permite repetir a leitura sem perder perguntas nem conferir roteiro automaticamente", async () => {
  const base: RespostaAnamneseGuiada = { codigo: "ANAMNESE_GUIADA", contexto, packs: [], roteiros: [], mensagens: [], historico: [], resumo: null };
  const api = vi.fn(async () => base), pendente = vi.fn(), salvando = vi.fn();
  render(<AnamneseGuiada porta={{ ...criarPortaFalsa(), anamneseGuiada: api }} contexto={contexto} aoPendente={pendente} aoSalvando={salvando} />);
  await waitFor(() => expect(api).toHaveBeenCalledTimes(1));
  fireEvent.change(screen.getByLabelText("Perguntas, uma por linha"), { target: { value: "Pergunta sintética ainda não conferida?" } });
  fireEvent.click(screen.getByRole("button", { name: "Recarregar dados da anamnese" }));
  await waitFor(() => expect(api).toHaveBeenCalledTimes(2));
  await waitFor(() => expect(salvando).toHaveBeenLastCalledWith(false));
  expect((screen.getByLabelText("Perguntas, uma por linha") as HTMLTextAreaElement).value).toContain("ainda não conferida");
  expect(pendente).toHaveBeenLastCalledWith(true);
});
