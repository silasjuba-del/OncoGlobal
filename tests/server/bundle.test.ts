import { expect, it } from "vitest";
import { salvarDraft } from "../../src/kernel/ledger/drafts.js";
import { listarEventos } from "../../src/kernel/ledger/ledger.js";
import { ambienteHttp } from "./http-fixture.js";

const patientId = "Paciente Teste 01";
const encounterId = "encontro-teste";
const draft = (patient = patientId) => ({
  draftId: "draft-bundle", patientId: patient, sourceId: "sintetico",
  rawRef: "opaco-teste", diagnostics: [], revision: 0, criadoEm: "2026-10-05T12:00:00Z",
  payload: { documentId: "doc-bundle", documentVersion: 1,
    documentHash: "hash-declarado-teste", texto: "documento sintético" },
});
const pedidoBundle = () => ({ patientId, encounterId, draftIds: ["draft-bundle"] });
const confirmar = (key: string, docId = "doc-bundle", rev = 0) => ({
  patientId, tumorLotId: "tumor-teste", encounterId, bloco: "TUDO",
  registros: [{ id: "draft-bundle", expectedRevision: rev }],
  documentosExibidos: [{ documentId: docId, documentVersion: 1 }],
  reconhecerAlertas: [], idempotencyKey: key,
});

it("ADV-002 · bundle deve ser exibido por rota real antes de qualquer confirmação (K-25/A13)", async () => {
  const f = await ambienteHttp();
  try {
    salvarDraft(f.db, draft());
    const r = await f.request("/consulta/bundle", "POST", JSON.stringify(pedidoBundle()),
      f.token, "application/json");
    expect(r.status).toBe(200);
    expect(r.body).toContain("doc-bundle");
    expect(r.body).toMatch(/[a-f0-9]{64}/);
  } finally { await f.close(); }
});

it("ADV-002 · RESISTIU: ausência da rota não libera assinatura sem bundle exibido", async () => {
  const f = await ambienteHttp();
  try {
    const payload = { patientId, tumorLotId: "tumor-teste", encounterId, bloco: "TUDO",
      registros: [{ id: "draft-teste", expectedRevision: 0 }],
      documentosExibidos: [], reconhecerAlertas: [], idempotencyKey: "sem-bundle-01" };
    const r = await f.request("/consulta/confirmar", "POST", JSON.stringify(payload),
      f.token, "application/json");
    expect(r.status).toBe(409);
    expect(JSON.parse(r.body).codigo).toBe("BUNDLE_NAO_EXIBIDO");
    expect(f.efeitos()).toBe(0);
  } finally { await f.close(); }
});

it("W4-03 · login → bundle → confirmar usa hash servidor e grava assinatura sem imprimir", async () => {
  const f = await ambienteHttp();
  try {
    salvarDraft(f.db, draft());
    const r = await f.request("/consulta/bundle", "POST", JSON.stringify(pedidoBundle()),
      f.token, "application/json");
    expect(r.status).toBe(200);
    const result = JSON.parse(r.body) as { documentos: { documentId: string;
      documentVersion: number; conteudoHash: string; conteudo: unknown }[] };
    expect(result.documentos).toHaveLength(1);
    expect(result.documentos[0]).toMatchObject({
      documentId: "doc-bundle", documentVersion: 1, conteudo: draft().payload,
    });
    expect(result.documentos[0]?.conteudoHash).toMatch(/^[a-f0-9]{64}$/);
    const gravado = await f.request("/consulta/confirmar", "POST",
      JSON.stringify(confirmar("bundle-confirmar-01")), f.token, "application/json");
    expect(gravado.status).toBe(200);
    expect(JSON.parse(gravado.body).codigo).toBe("GRAVADA");
    expect(listarEventos(f.db, patientId)).toMatchObject([{ revisao: "ASSINADO" }]);
    expect(f.efeitos()).toBe(0);
    expect(JSON.stringify(f.logs)).not.toContain("documento sintético");
  } finally { await f.close(); }
});

it("W4-03/A13 · draft alterado depois da exibição não é assinado", async () => {
  const f = await ambienteHttp();
  try {
    salvarDraft(f.db, draft());
    expect((await f.request("/consulta/bundle", "POST", JSON.stringify(pedidoBundle()),
      f.token, "application/json")).status).toBe(200);
    salvarDraft(f.db, { ...draft(), revision: 1,
      payload: { ...draft().payload, texto: "texto sintético alterado" } });
    const r = await f.request("/consulta/confirmar", "POST",
      JSON.stringify(confirmar("bundle-alterado-01", "doc-bundle", 1)),
      f.token, "application/json");
    expect(r.status).toBe(409);
    expect(JSON.parse(r.body).codigo).toBe("CONTEUDO_ALTERADO_APOS_EXIBICAO");
    expect(listarEventos(f.db, patientId)).toHaveLength(0);
  } finally { await f.close(); }
});

it("W4-03 · escopo de paciente, documento e sessão não é ampliado pelo cliente", async () => {
  const f = await ambienteHttp();
  try {
    salvarDraft(f.db, draft("Paciente Teste 02"));
    expect((await f.request("/consulta/bundle", "POST", JSON.stringify(pedidoBundle()),
      f.token, "application/json")).status).toBe(409);
    expect((await f.request("/consulta/confirmar", "POST",
      JSON.stringify(confirmar("bundle-nao-visto-01")), f.token, "application/json")).status).toBe(409);
    expect((await f.request("/consulta/bundle", "POST",
      JSON.stringify({ ...pedidoBundle(), medicoId: "forjado" }), f.token, "application/json")).status).toBe(400);
    f.now("2026-10-05T12:01:01Z");
    expect((await f.request("/consulta/bundle", "POST", JSON.stringify(pedidoBundle()),
      f.token, "application/json")).status).toBe(401);
  } finally { await f.close(); }
});

it("W4-03/G-25 · documento fora do bundle segue rejeitado", async () => {
  const f = await ambienteHttp();
  try {
    salvarDraft(f.db, draft());
    expect((await f.request("/consulta/bundle", "POST", JSON.stringify(pedidoBundle()),
      f.token, "application/json")).status).toBe(200);
    const r = await f.request("/consulta/confirmar", "POST",
      JSON.stringify(confirmar("bundle-forjado-01", "doc-nao-exibido")), f.token, "application/json");
    expect(r.status).toBe(409);
    expect(JSON.parse(r.body).codigo).toBe("ESCOPO_ASSINATURA_INVALIDO");
  } finally { await f.close(); }
});
