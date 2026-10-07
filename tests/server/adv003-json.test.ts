import { artefatoAssinado } from "./_artefatoAssinado.js";
import { expect, it } from "vitest";
import { ambienteHttp } from "./http-fixture.js";

it("ADV-003 · JSON malformado em POST autenticado retorna 400, não erro interno 500", async () => {
  const f = await ambienteHttp();
  try {
    const r = await f.request("/acao", "POST", '{"verbo":', f.token, "application/json");
    expect(r.status).toBe(400);
    expect(f.efeitos()).toBe(0);
  } finally { await f.close(); }
});

it("ADV-003 · JSON truncado em login, bundle e confirmação é erro de entrada, sem efeito", async () => {
  const f = await ambienteHttp();
  try {
    for (const path of ["/login", "/consulta/bundle", "/consulta/confirmar"]) {
      const r = await f.request(path, "POST", '{"patientId":', f.token, "application/json");
      expect(r.status).toBe(400);
      expect(JSON.parse(r.body).codigo).toBe("JSON_INVALIDO");
    }
    expect(f.efeitos()).toBe(0);
  } finally { await f.close(); }
});

it("ADV-003 · falha interna não é reclassificada como JSON inválido", async () => {
  const f = await ambienteHttp();
  try {
    // action_idempotency é o store real de /acao: registro deliberadamente
    // corrompido, sem identificador clínico real, para exercitar o catch interno.
    f.db.prepare(`INSERT INTO action_idempotency(chave,payloadHash,resultado,atualizadoEm)
      VALUES (?,?,?,?)`).run("erro-interno-01", "hash-sintetico", "{quebrado", "2026-10-05T12:00:00Z");
    artefatoAssinado(f.db, { patientId: "Paciente Teste 01", encounterId: "encontro-teste", documentId: "doc-sintetico" });
    const r = await f.request("/acao", "POST", JSON.stringify({
      verbo: "IMPRIMIR", objeto: { tipo: "DOCUMENTO", id: "doc-sintetico", versao: 1 },
      escopo: { patientId: "Paciente Teste 01", encounterId: "encontro-teste" },
      destino: null, idempotencyKey: "erro-interno-01",
    }), f.token, "application/json");
    expect(r.status).toBe(500);
    expect(JSON.parse(r.body).codigo).toBe("ERRO_INTERNO");
    expect(f.efeitos()).toBe(0);
  } finally { await f.close(); }
});
