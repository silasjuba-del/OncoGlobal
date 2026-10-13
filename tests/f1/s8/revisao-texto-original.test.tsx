// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { RevisaoExtracaoLocal } from "../../../src/ui/consulta/RevisaoExtracaoLocal.js";
import { criarPortaFalsa } from "../../../src/ui/api/fake.js";
import type { PortaConsulta } from "../../../src/ui/api/porta.js";
import type { FonteRevisao } from "../../../src/ui/api/revisaoExtracao.js";

afterEach(cleanup);
it("texto sem fatos exige checkbox inicialmente desmarcada, preview literal e nova prova após mudar seleção", async () => {
  const contexto = { patientId: "paciente-texto-sintetico", encounterId: "consulta-texto", tumorLotId: null };
  const texto = "Narrativa integral sintética ainda não convertida em fatos.";
  const fonte: FonteRevisao = { draft: { draftId: "draft-texto", patientId: contexto.patientId, revision: 1,
    payload: { kind: "EXTRACAO_RASCUNHO", input: { sourceId: "fonte-texto", rawTranscript: texto },
      state: { facts: [] }, patientLinkReview: { ...contexto, segmentId: "segmento-texto" } } } };
  const porta = criarPortaFalsa();
  porta.oncoassistFontes = async () => ({ fontes: [{ draftId: fonte.draft.draftId, rotulo: "Texto sintético", criadoEm: "2026-10-12" }] });
  porta.carregarFonteRevisao = async () => fonte;
  const preparar = vi.fn<NonNullable<PortaConsulta["prepararRevisaoExtracao"]>>(async (pedido) => ({ codigo: "REVISAO_PREPARADA",
    criaEventoClinico: false, conteudo: { kind: "EVOLUCAO_RASCUNHO", status: "RASCUNHO", resumo: texto, contexto,
      selectedFactIds: pedido.factIds, facts: [], incluirTextoOriginal: true },
    comprovanteExibicao: { documentId: `preview-${pedido.operationId}`, documentVersion: 1, conteudoHash: "a".repeat(64) } }));
  const confirmar = vi.fn<NonNullable<PortaConsulta["confirmarRevisaoExtracao"]>>(async () => ({ codigo: "GRAVADA" }));
  porta.prepararRevisaoExtracao = preparar; porta.confirmarRevisaoExtracao = confirmar;
  render(<RevisaoExtracaoLocal porta={porta} contexto={contexto} />);
  await screen.findByRole("option", { name: "Texto sintético" });
  fireEvent.change(screen.getByLabelText("Fonte para revisão"), { target: { value: fonte.draft.draftId } });
  const checkbox = await screen.findByRole("checkbox", { name: "Incluir texto original deste trecho na evolução" }) as HTMLInputElement;
  expect(checkbox.checked).toBe(false);
  expect((screen.getByRole("button", { name: "Preparar revisão" }) as HTMLButtonElement).disabled).toBe(true);
  fireEvent.click(checkbox);
  fireEvent.click(screen.getByRole("button", { name: "Preparar revisão" }));
  const preview = await screen.findByRole("region", { name: "Conteúdo preparado para revisão" });
  expect(within(preview).getByText(texto)).toBeTruthy();
  expect(preparar.mock.calls[0]?.[0]).toMatchObject({ factIds: [], incluirTextoOriginal: true });
  expect(preparar.mock.calls[0]?.[0]).not.toHaveProperty("rawTranscript");
  expect(confirmar).not.toHaveBeenCalled();
  fireEvent.click(checkbox);
  expect(screen.queryByRole("button", { name: "Confirmar revisão exibida" })).toBeNull();
  fireEvent.click(checkbox);
  fireEvent.click(screen.getByRole("button", { name: "Preparar revisão" }));
  fireEvent.click(await screen.findByRole("button", { name: "Confirmar revisão exibida" }));
  await screen.findByText(/Revisão registrada/);
  expect(preparar.mock.calls[1]?.[0].operationId).not.toBe(preparar.mock.calls[0]?.[0].operationId);
  expect(confirmar).toHaveBeenCalledTimes(1);
  expect(confirmar.mock.calls[0]?.[0]).toMatchObject({ ...preparar.mock.calls[1]?.[0],
    comprovanteExibicao: { documentId: `preview-${preparar.mock.calls[1]?.[0].operationId}`, conteudoHash: "a".repeat(64) } });
});
