// @vitest-environment jsdom
// provenance: dados sintéticos - não utilizar em produção
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import type { PortaConsulta } from "../../src/ui/api/porta.js";
import { RevisaoExtracaoLocal } from "../../src/ui/consulta/RevisaoExtracaoLocal.js";

afterEach(() => cleanup());

it("mostra qualificadores e identifica metadados ausentes em fatos legados", async () => {
  const draft = {
    draftId: "draft-synthetic", patientId: "patient-synthetic", revision: 1,
    payload: { kind: "EXTRACAO_RASCUNHO", input: { sourceId: "source-synthetic", rawTranscript: "A mãe tinha lesão em L5 medindo 12 mm." },
      state: { facts: [
        { id: "fact-qualified", segmentId: "segment-synthetic", patientCandidateId: null, domain: "imaging",
          value: { siteRaw: "L5", measureRaw: "12 mm" }, sourceType: "imaging_report", evidence: "EXPLICIT",
          sourceId: "source-synthetic", rawEvidence: "A mãe tinha lesão em L5 medindo 12 mm.", confidence: 1,
          requiresConfirmation: true, qualificadores: { polaridade: "AFIRMADA", sujeito: "TERCEIRO", temporalidade: "HISTORICA" } },
        { id: "fact-legacy", segmentId: "segment-synthetic", patientCandidateId: null, domain: "imaging",
          value: { siteRaw: "L5", measureRaw: "12 mm" }, sourceType: "imaging_report", evidence: "EXPLICIT",
          sourceId: "source-synthetic", rawEvidence: "Lesão antiga em L5.", confidence: 1, requiresConfirmation: false },
      ] }, patientLinkReview: { patientId: "patient-synthetic", encounterId: "encounter-synthetic", tumorLotId: null } },
  };
  const porta = {
    oncoassistFontes: vi.fn(async () => ({ fontes: [{ draftId: draft.draftId, rotulo: "Laudo sintético" }], fontesSemVinculo: [] })),
    carregarFonteRevisao: vi.fn(async () => ({ draft })),
  } as unknown as PortaConsulta;
  const contexto = { patientId: "patient-synthetic", encounterId: "encounter-synthetic", tumorLotId: null };
  render(<RevisaoExtracaoLocal porta={porta} contexto={contexto as never} />);
  await waitFor(() => expect(screen.getByRole("option", { name: /Laudo sintético/ })).toBeTruthy());
  fireEvent.change(screen.getByLabelText("Fonte para revisão"), { target: { value: draft.draftId } });
  await screen.findByText(/temporalidade HISTORICA/);
  expect(screen.getByText(/Qualificadores não registrados \(registro legado\)/)).toBeTruthy();
  expect(screen.getByText("A mãe tinha lesão em L5 medindo 12 mm.")).toBeTruthy();
});
