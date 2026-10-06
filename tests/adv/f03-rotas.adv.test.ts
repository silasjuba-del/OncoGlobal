import { expect, it } from "vitest";
import { salvarDraft } from "../../src/kernel/ledger/drafts.js";
import { ambienteHttp } from "./http-fixture.js";

it("ADV-002 · bundle deve ser exibido por rota real antes de qualquer confirmação (K-25/A13)", async () => {
  const f = await ambienteHttp();
  try {
    salvarDraft(f.db, { draftId: "draft-bundle", patientId: "Paciente Teste 01",
      sourceId: "sintetico", rawRef: "opaco-teste", diagnostics: [], revision: 0,
      criadoEm: "2026-10-05T12:00:00Z",
      payload: { documentId: "doc-bundle", documentVersion: 1,
        documentHash: "hash-declarado-teste", texto: "documento sintético" } });
    const r = await f.request("/consulta/bundle", "POST",
      JSON.stringify({ patientId: "Paciente Teste 01", encounterId: "encontro-teste", draftIds: ["draft-bundle"] }),
      f.token, "application/json");
    expect(r.status).toBe(200);
    expect(r.body).toContain("doc-bundle");
    expect(r.body).toMatch(/[a-f0-9]{64}/);
  } finally { await f.close(); }
});

it("ADV-002 · RESISTIU: ausência da rota não libera assinatura sem bundle exibido", async () => {
  const f = await ambienteHttp();
  try {
    const confirmar = { patientId: "Paciente Teste 01", tumorLotId: "tumor-teste",
      encounterId: "encontro-teste", bloco: "TUDO",
      registros: [{ id: "draft-teste", expectedRevision: 0 }],
      documentosExibidos: [], reconhecerAlertas: [], idempotencyKey: "sem-bundle-01" };
    const r = await f.request("/consulta/confirmar", "POST", JSON.stringify(confirmar),
      f.token, "application/json");
    expect(r.status).toBe(409);
    expect(JSON.parse(r.body).codigo).toBe("BUNDLE_NAO_EXIBIDO");
    expect(f.efeitos()).toBe(0);
  } finally { await f.close(); }
});

it("ADV-003 · JSON malformado em POST autenticado retorna 400, não erro interno 500", async () => {
  const f = await ambienteHttp();
  try {
    const r = await f.request("/acao", "POST", '{"verbo":', f.token, "application/json");
    expect(r.status).toBe(400);
    expect(f.efeitos()).toBe(0);
  } finally { await f.close(); }
});

it("ADV-004 · content-type text/plain não é aceito como JSON em rota de ação", async () => {
  const f = await ambienteHttp();
  try {
    const action = { verbo: "IMPRIMIR", objeto: { tipo: "DOCUMENTO", id: "doc-sintetico", versao: 1 },
      escopo: { patientId: "Paciente Teste 01", encounterId: "encontro-teste" },
      destino: null, idempotencyKey: "tipo-errado-01" };
    const r = await f.request("/acao", "POST", JSON.stringify(action), f.token, "text/plain");
    expect([400, 415]).toContain(r.status);
    expect(f.efeitos()).toBe(0);
  } finally { await f.close(); }
});

it("ADV-004 · RESISTIU: ação sem token não dispara efeito", async () => {
  const f = await ambienteHttp();
  try {
    const r = await f.request("/acao", "POST", "{}", undefined, "application/json");
    expect(r.status).toBe(401);
    expect(f.efeitos()).toBe(0);
  } finally { await f.close(); }
});
