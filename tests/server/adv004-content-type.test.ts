import { expect, it } from "vitest";
import { ambienteHttp } from "./http-fixture.js";

const action = {
  verbo: "IMPRIMIR", objeto: { tipo: "DOCUMENTO", id: "doc-sintetico", versao: 1 },
  escopo: { patientId: "Paciente Teste 01", encounterId: "encontro-teste" },
  destino: null, idempotencyKey: "tipo-errado-01",
};

it("ADV-004 · content-type text/plain não é aceito como JSON em rota de ação", async () => {
  const f = await ambienteHttp();
  try {
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

it("ADV-004 · tipo errado é recusado antes do parse do corpo", async () => {
  const f = await ambienteHttp();
  try {
    for (const tipo of ["text/plain", "application/jsonp", "application/json; charset=iso-8859-1"]) {
      const r = await f.request("/acao", "POST", '{"verbo":', f.token, tipo);
      expect(r.status).toBe(415);
      expect(JSON.parse(r.body).codigo).toBe("CONTENT_TYPE_INVALIDO");
    }
    expect(f.efeitos()).toBe(0);
  } finally { await f.close(); }
});

it("ADV-004 · application/json com charset UTF-8 alcança validação normal, sem disparar ação inválida", async () => {
  const f = await ambienteHttp();
  try {
    const r = await f.request("/acao", "POST", "{}", f.token, "application/json; charset=UTF-8");
    expect(r.status).toBe(400);
    expect(JSON.parse(r.body).codigo).toBe("PAYLOAD_INVALIDO");
    expect(f.efeitos()).toBe(0);
  } finally { await f.close(); }
});
