// @vitest-environment jsdom
// Somente protocolo e paciente sintéticos. UI, HTTP e SQLite reais.
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { OncoassistLocal } from "../../src/ui/OncoassistLocal.js";
import { executarConfirmacao } from "../../src/kernel/comandos/index.js";
import { salvarDraft } from "../../src/kernel/comandos/portas.js";
import { abrirAmbiente, cadastrarPaciente, criarDiretorio, removerDiretorio,
  PACIENTE, ENCONTRO, AGORA, SENHA } from "../f0-fecha/fixtures/consulta-completa.js";
import { fonteSintetica } from "../fixtures/triagem.js";
const ambientes: Awaited<ReturnType<typeof abrirAmbiente>>[] = [];
afterEach(async () => {
  cleanup(); vi.unstubAllGlobals();
  for (const a of ambientes.splice(0)) { await a.close(); removerDiretorio(a.dir); }
});
const mudar = (label: string, value: string) => fireEvent.change(screen.getByLabelText(label), { target: { value } });

it("importa, revisa e compara estudo pela aba real, preservando protocolo ao cancelar navegação", async () => {
  const a = await abrirAmbiente(criarDiretorio()); ambientes.push(a); cadastrarPaciente(a);
  for (const [i, tipo, payload] of [
    [1, "AgendaEntry", { patientId: PACIENTE, encounterId: ENCONTRO, horario: "10:00", data: AGORA.slice(0, 10) }],
    [2, "FATO", { campo: "ecog", valor: 1 }],
  ] as const) {
    const id = `estudo-ui-${i}`;
    salvarDraft(a.db, { draftId: id, patientId: PACIENTE, sourceId: id, rawRef: "referencia-local",
      payload: {}, diagnostics: [], revision: 0, criadoEm: AGORA });
    executarConfirmacao(a.db, { operationId: id, patientId: PACIENTE, encounterId: ENCONTRO, tumorLotId: null,
      reviewDecisionId: id, sessao: a.sessoes.obter(a.token)!, em: AGORA,
      registros: [{ draftId: id, expectedRevision: 0, eventId: id, tipo, payload, fontes: [fonteSintetica(id)], revisao: "CONFIRMADO" }] });
  }
  const transporte = globalThis.fetch;
  vi.stubGlobal("fetch", (input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]) =>
    transporte(typeof input === "string" && input.startsWith("/") ? `${a.baseUrl}${input}` : input, init));
  render(<OncoassistLocal />);
  mudar("Senha do servidor", SENHA); fireEvent.click(screen.getByRole("button", { name: "Entrar" }));
  await screen.findByLabelText("Paciente da agenda");
  mudar("Paciente da agenda", ENCONTRO);
  await waitFor(() => {
    expect((screen.getByLabelText("Paciente da agenda") as HTMLSelectElement).disabled).toBe(false);
    expect(screen.getByRole("region", { name: "Identificação da consulta" }).textContent).toContain(ENCONTRO);
  });
  fireEvent.click(screen.getByRole("button", { name: "Estudos clínicos" }));
  await waitFor(() => expect((screen.getByLabelText("Nome do arquivo-fonte") as HTMLInputElement).matches(":disabled")).toBe(false));
  const literal = JSON.stringify({ title: "Estudo clínico inteiramente sintético",
    inclusionCriteria: ["ECOG igual a 1"], exclusionCriteria: [], arms: [], outcomes: [] });
  mudar("Nome do arquivo-fonte", "estudo-ui-sintetico.json");
  mudar("Tipo MIME da fonte", "application/json");
  mudar("Conteúdo literal da fonte", literal);
  fireEvent.click(screen.getByRole("button", { name: "Consulta" }));
  await screen.findByRole("dialog", { name: "Estudo em edição" });
  fireEvent.click(screen.getByRole("button", { name: "Continuar editando" }));
  expect((screen.getByLabelText("Conteúdo literal da fonte") as HTMLTextAreaElement).value).toBe(literal);
  const antes = a.eventos().length;
  fireEvent.click(screen.getByRole("button", { name: "Importar fonte local" }));
  await screen.findByRole("button", { name: "Revisar estudo" }, { timeout: 5000 });
  expect(a.eventos()).toHaveLength(antes);
  fireEvent.click(screen.getByRole("button", { name: "Revisar estudo" }));
  mudar("ID do estudo", "ESTUDO-SINTETICO-UI");
  expect((screen.getByLabelText("ID do estudo") as HTMLInputElement).value).toBe("ESTUDO-SINTETICO-UI");
  mudar("Título revisado", "Estudo clínico inteiramente sintético");
  mudar("Evidência exata do título", "title");
  mudar("Aplicabilidade · critério 1", "APLICAVEL");
  mudar("Tipo de vinculação · critério 1", "EQUALS");
  mudar("Fato vinculado · critério 1", "ecog");
  mudar("Tipo do valor EQUALS · critério 1", "NUMERO");
  mudar("Valor igual · critério 1", "1");
  fireEvent.click(screen.getByRole("button", { name: "Confirmar estudo revisado" }));
  await waitFor(() => {
    const diagnostico = screen.queryAllByRole("alert").map(e => e.textContent).join("\n");
    const avaliar = screen.queryByRole("button", { name: "Avaliar critérios" }) as HTMLButtonElement | null;
    expect(avaliar, diagnostico).not.toBeNull();
    expect(avaliar?.disabled, diagnostico).toBe(false);
  },
    { timeout: 5000 });
  fireEvent.click(screen.getByRole("button", { name: "Avaliar critérios" }));
  const resultado = await screen.findByRole("region", { name: "Resultado da avaliação" }, { timeout: 5000 });
  expect(resultado.textContent).toContain("ATENDIDO");
  expect(resultado.textContent).toMatch(/elegibilidade: não determinada/i);
  expect(a.eventos()).toHaveLength(antes);
  const estudos = await a.request("/consulta/trials/listar", {});
  expect(estudos.data.estudos[0].source.originalContent).toBe(literal);
  expect(estudos.data.estudos[0].review.version).toBe(1);
});
