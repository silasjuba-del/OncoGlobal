import { expect, it } from "vitest";
import { salvarDraft, lerDraft } from "../../src/kernel/ledger/drafts.js";
import { listarEventos } from "../../src/kernel/ledger/ledger.js";
import { ambienteHttp } from "./http-fixture.js";

const scope = { patientId: "Paciente Teste 01", encounterId: "consulta-01", tumorLotId: "lote-01" };
const doc = { documentId: "doc-01", documentVersion: 1, documentHash: "declarado", texto: "conteúdo sintético" };
const envelope = (id: string, payload: unknown) => ({ draftId: id, patientId: scope.patientId,
  payload, sourceId: "fonte-teste", rawRef: "local", revision: 0, diagnostics: [], criadoEm: "2026-10-05T12:00:00Z" });

it.each(["vazio", "fato-oculto", "documento-oculto", "desmarcado", "duplicado", "lote", "alias"])(
  "reauditoria: rejeita %s atomicamente", async (cenario) => {
    const f = await ambienteHttp();
    const post = (path: string, payload: unknown) => f.request(path, "POST", JSON.stringify(payload), f.token, "application/json");
    try {
      salvarDraft(f.db, envelope("visivel", doc));
      salvarDraft(f.db, envelope("oculto", cenario === "fato-oculto" || cenario === "vazio"
        ? { campo: "sintetico", valor: "não exibido" } : cenario === "alias" ? doc : { ...doc, documentId: "doc-02" }));
      const bundle = await post("/consulta/bundle", { ...scope, draftIds: cenario === "vazio" ? [] : ["visivel"] });
      expect(bundle.status).toBe(200);
      const registros = cenario === "vazio" || cenario === "alias" ? [{ id: "oculto", expectedRevision: 0 }]
        : cenario === "duplicado" ? [{ id: "visivel", expectedRevision: 0 }, { id: "visivel", expectedRevision: 0 }]
          : cenario === "lote" || cenario === "desmarcado" ? [{ id: "visivel", expectedRevision: 0 }]
            : [{ id: "visivel", expectedRevision: 0 }, { id: "oculto", expectedRevision: 0 }];
      const antes = f.db.prepare("SELECT * FROM operation").all();
      const result = await post("/consulta/confirmar", { ...scope,
        ...(cenario === "lote" ? { tumorLotId: "outro-lote" } : {}), bloco: "TUDO", registros,
        documentosExibidos: cenario === "vazio" || cenario === "desmarcado" ? [] : [{ documentId: "doc-01", documentVersion: 1 }],
        reconhecerAlertas: [], idempotencyKey: `reat-${cenario}` });
      expect(result.status).toBe(409);
      expect(listarEventos(f.db, scope.patientId)).toEqual([]);
      expect(lerDraft(f.db, "visivel")?.revision).toBe(0);
      expect(lerDraft(f.db, "oculto")?.revision).toBe(0);
      expect(f.db.prepare("SELECT * FROM operation").all()).toEqual(antes);
    } finally { await f.close(); }
  });

it("fato genérico exibido e selecionado pode ser confirmado, sem assinatura documental", async () => {
  const f = await ambienteHttp();
  const post = (path: string, payload: unknown) => f.request(path, "POST", JSON.stringify(payload), f.token, "application/json");
  try {
    salvarDraft(f.db, envelope("fato", { campo: "sintetico", valor: "revisado" }));
    const bundle = await post("/consulta/bundle", { ...scope, draftIds: ["fato"] });
    expect(bundle.status).toBe(200);
    const exibidos = JSON.parse(bundle.body).documentos;
    expect(exibidos[0].conteudo).toEqual({ campo: "sintetico", valor: "revisado" });
    const pedido = { ...scope, bloco: "EVOLUCAO", registros: [{ id: "fato", expectedRevision: 0 }],
      documentosExibidos: exibidos.map(({ documentId, documentVersion }: typeof doc) => ({ documentId, documentVersion })),
      reconhecerAlertas: [], idempotencyKey: "fato-exibido-01" };
    expect(JSON.parse((await post("/consulta/confirmar", pedido)).body).codigo).toBe("GRAVADA");
    expect(JSON.parse((await post("/consulta/confirmar", pedido)).body).codigo).toBe("REPLAY");
    expect(listarEventos(f.db, scope.patientId)).toMatchObject([{ tipo: "FATO", revisao: "CONFIRMADO" }]);
  } finally { await f.close(); }
});
