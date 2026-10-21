// @vitest-environment jsdom
// Dados sinteticos.
import { afterEach, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { RevisaoExtracaoLocal } from "../../src/ui/consulta/RevisaoExtracaoLocal.js";
import { criarPortaFalsa } from "../../src/ui/api/fake.js";
import { FonteRevisao } from "../../src/contracts/api/revisaoExtracao.js";
afterEach(cleanup);
it("RT06: indisponibilidade de RADS fica visivel na revisao da fonte", async () => {
  const contexto = { patientId: "paciente-rads-sintetico", encounterId: "consulta-rads-sintetica", tumorLotId: null };
  const fonte = FonteRevisao.parse({ draft: { draftId: "draft-rads", patientId: contexto.patientId, revision: 1,
    diagnostics: ["RADS_NAO_AVALIADO"], payload: { kind: "EXTRACAO_RASCUNHO", input: { sourceId: "fonte-rads", rawTranscript: "Laudo sintetico" },
    state: { facts: [] }, alertasRads: null, patientLinkReview: contexto } } });
  const porta = criarPortaFalsa();
  porta.oncoassistFontes = async () => ({ fontes: [{ draftId: "draft-rads", rotulo: "Laudo sintetico", criadoEm: "2026-10-20" }] });
  porta.carregarFonteRevisao = async () => fonte;
  render(<RevisaoExtracaoLocal porta={porta} contexto={contexto} />);
  await screen.findByRole("option", { name: "Laudo sintetico" });
  fireEvent.change(screen.getByRole("combobox", { name: /Fonte para revis/ }), { target: { value: "draft-rads" } });
  expect((await screen.findByRole("alert")).textContent).toMatch(/alertas de imagem indispon/);
});
