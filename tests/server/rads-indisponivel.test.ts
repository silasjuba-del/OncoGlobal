// Dados sinteticos; nenhuma chamada externa.
import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
import { ambienteHttp } from "./http-fixture.js";
import { lerDraft, salvarDraft, listarEventos } from "../../src/kernel/comandos/portas.js";
import { processarUploadLocal } from "../../src/server/upload.js";
import { FonteRevisao } from "../../src/contracts/api/revisaoExtracao.js";
const contexto = { patientId: "paciente-rads-sintetico", encounterId: "consulta-rads-sintetica", tumorLotId: null };
const texto = "Laudo sintetico: pneumoperitonio e liquido livre na cavidade abdominal.";

it.each(["upload", "extracao", "reabertura"])("RT06: %s sem corpus informa RADS_NAO_AVALIADO", async caminho => {
  const a = await ambienteHttp({ corpus: null });
  try {
    a.sessoes.selecionarConsulta(a.token, contexto);
    const r = await processarUploadLocal({ db: a.db, sessoes: a.sessoes, agora: () => "2026-10-05T12:00:00Z", corpus: null,
      converterUpload: async entrada => ({ status: "PRONTO", documento: { ...entrada, hash: "hash-sintetico", paginas: [{ n: 1, texto }] } }),
    }, a.token, a.sessoes.obter(a.token)!, { ...contexto, id: "rads-upload-sem-corpus", sourceId: "fonte-rads",
      sourceType: "imaging_report", tipo: "PDF", bytesBase64: Buffer.from("pdf sintetico").toString("base64") });
    expect(r.status).toBe(201);
    let draft = lerDraft(a.db, String(r.body.draftId))!;
    if (caminho === "extracao") {
      const res = await a.request("/consulta/extrair", "POST", JSON.stringify({ recordingId: "rads-sem-corpus", sourceId: "fonte-rads",
        sourceType: "imaging_report", rawTranscript: texto }), a.token, "application/json");
      expect(res.status).toBe(201);
      const data = JSON.parse(res.body);
      expect(data.alertasRads).toBeNull();
      draft = lerDraft(a.db, data.draftId)!;
    } else if (caminho === "reabertura") {
      const payload = draft.payload as any;
      salvarDraft(a.db, { ...draft, patientId: contexto.patientId, revision: 1,
        payload: { ...payload, patientLinkReview: { ...contexto, segmentId: payload.state.segments[0].id } } });
      const res = await a.request("/consulta/rascunho", "POST", JSON.stringify({ draftId: draft.draftId }), a.token, "application/json");
      expect(res.status).toBe(200);
      draft = JSON.parse(res.body).draft;
      expect(FonteRevisao.safeParse({ draft }).success).toBe(true);
    }
    expect((draft.payload as any).alertasRads).toBeNull();
    expect(draft.diagnostics).toContain("RADS_NAO_AVALIADO");
    expect(listarEventos(a.db, contexto.patientId)).toEqual([]);
  } finally { await a.close(); }
});


it("RT06: reabertura com corpus recuperado avalia o segmento e remove pendencia apenas da leitura", async () => {
  const a = await ambienteHttp();
  try {
    a.sessoes.selecionarConsulta(a.token, contexto);
    const texto = readFileSync(new URL("../../docs/referencias/modelos/laudos-sinteticos/PT08-tc-abdome-pelve.txt", import.meta.url), "utf8");
    const r = await processarUploadLocal({ db: a.db, sessoes: a.sessoes, agora: () => "2026-10-05T12:00:00Z", corpus: null,
      converterUpload: async entrada => ({ status: "PRONTO", documento: { ...entrada, hash: "hash-sintetico", paginas: [{ n: 1, texto }] } }),
    }, a.token, a.sessoes.obter(a.token)!, { ...contexto, id: "rads-recuperacao", sourceId: "fonte-rads",
      sourceType: "imaging_report", tipo: "PDF", bytesBase64: Buffer.from("pdf sintetico").toString("base64") });
    const draft = lerDraft(a.db, String(r.body.draftId))!, payload = draft.payload as any;
    expect(payload.alertasRads).toBeNull();
    salvarDraft(a.db, { ...draft, patientId: contexto.patientId, revision: 1,
      payload: { ...payload, patientLinkReview: { ...contexto, segmentId: payload.state.segments[0].id } } });
    const res = await a.request("/consulta/rascunho", "POST", JSON.stringify({ draftId: draft.draftId }), a.token, "application/json");
    expect(res.status).toBe(200);
    const atual = JSON.parse(res.body).draft;
    expect(atual.payload.alertasRads.map((a: { linha: number }) => a.linha)).toEqual([7, 27]);
    expect(atual.diagnostics).not.toContain("RADS_NAO_AVALIADO");
    expect(lerDraft(a.db, draft.draftId)!.diagnostics).toContain("RADS_NAO_AVALIADO");
    expect(listarEventos(a.db, contexto.patientId)).toEqual([]);
  } finally { await a.close(); }
});
