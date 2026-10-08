import { describe, expect, it } from "vitest";
import { marcadoInicialmente, type DocumentoBundleVisao } from "../../src/ui/consulta/Bundle.js";

// Decisão Dr. Silas (2026-10-08): só pré-marca o que vem do modelo salvo pelo médico.
const doc = (p: Partial<DocumentoBundleVisao>): DocumentoBundleVisao =>
  ({ documentId: "d1", documentVersion: 1, titulo: "receita", preMarcado: true, visivel: true, ...p });

describe("W11 · pré-marcação só do modelo do médico", () => {
  it("modelo do médico com preMarcado nasce marcado", () => {
    expect(marcadoInicialmente(doc({ origem: "MODELO_MEDICO" }))).toBe(true);
  });
  it("sugestão nasce desmarcada mesmo com preMarcado", () => {
    expect(marcadoInicialmente(doc({ origem: "SUGESTAO" }))).toBe(false);
  });
  it("origem ausente nasce desmarcada", () => {
    expect(marcadoInicialmente(doc({}))).toBe(false);
  });
  it("modelo do médico sem preMarcado nasce desmarcado", () => {
    expect(marcadoInicialmente(doc({ origem: "MODELO_MEDICO", preMarcado: false }))).toBe(false);
  });
});
