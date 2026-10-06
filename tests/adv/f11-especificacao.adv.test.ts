import { expect, it } from "vitest";
import { hashConteudoExibido } from "../../src/server/sessao.js";
import { hashCanonico } from "../../src/modules/tipos.js";
import { delta } from "../../src/rules/delta.js";
import { salvarDraft } from "../../src/kernel/ledger/drafts.js";
import { ambienteHttp } from "./http-fixture.js";

it("ADV-012 · F11 W4-02 exige hash canônico único na fronteira módulo→servidor", () => {
  const valor = { documentId: "teste", version: 1, texto: "sintético" };
  expect(hashCanonico(valor)).toBe(hashConteudoExibido(valor));
});

it("ADV-010 · F11 W4-05 exige que conflito confirmado continue vermelho no delta", () => {
  const prev = { kind: "CONFIRMED" as const, campos: { campo: { valor: null, estado: "VERMELHO" as const } } };
  const now = { kind: "CURRENT" as const, campos: { campo: { valor: null, estado: "PENDENTE" as const } } };
  expect(delta(prev, now, {}).itens[0]?.estado).toBe("VERMELHO");
});

it("ADV-002 · F11 W4-03 exige produtor HTTP de bundle; confirmar continua barrando sem ele", async () => {
  const f = await ambienteHttp();
  try {
    salvarDraft(f.db, { draftId: "draft-f11", patientId: "Paciente Teste 01",
      sourceId: "sintetico", rawRef: "opaco-f11", diagnostics: [], revision: 0,
      criadoEm: "2026-10-05T12:00:00Z",
      payload: { documentId: "doc-f11", documentVersion: 1,
        documentHash: "declarado", texto: "documento sintético" } });
    const pedido = await f.request("/consulta/bundle", "POST", JSON.stringify({
      patientId: "Paciente Teste 01", encounterId: "encontro-teste", draftIds: ["draft-f11"],
    }), f.token, "application/json");
    expect(pedido.status).toBe(200);
    expect(pedido.body).toContain("doc-f11");
  } finally { await f.close(); }
});
