// provenance: dados sintéticos - não utilizar em produção
import { afterEach, expect, it } from "vitest";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { abrirAmbiente, cadastrarPaciente, carregarConsulta, criarDiretorio, removerDiretorio,
  PACIENTE, ENCONTRO, AGORA } from "../f0-fecha/fixtures/consulta-completa.js";
import { listarDrafts, listarDraftsSemVinculo } from "../../src/kernel/ledger/drafts.js";

let ambiente: Awaited<ReturnType<typeof abrirAmbiente>> | undefined;
afterEach(async () => {
  if (ambiente) { const dir = ambiente.dir; await ambiente.close(); ambiente = undefined; removerDiretorio(dir); }
});
function semVinculo(id: string) {
  return JSON.stringify({ kind: "EXTRACAO_RASCUNHO",
    input: { sourceId: `fonte-${id}`, rawTranscript: "Trecho sintético sem vínculo." },
    state: { segments: [], confirmationRequired: [] } });
}
async function preparar(total: number) {
  ambiente = await abrirAmbiente(criarDiretorio()); cadastrarPaciente(ambiente); await carregarConsulta(ambiente);
  const insert = ambiente.db.prepare(`INSERT INTO draft_envelope
    (draftId,patientId,sourceId,rawRef,payload,diagnostics,revision,criadoEm) VALUES (?,?,?,?,?,'[]',0,?)`);
  ambiente.db.exec("BEGIN");
  try {
    for (let n = 0; n < total; n++)
      insert.run(`vinculado-${String(n).padStart(5, "0")}`, "outro-paciente-sintetico", "fonte-sintetica",
        "referencia-local", JSON.stringify({ kind: "EXTRACAO_RASCUNHO", texto: "x".repeat(256) }), AGORA);
    for (const id of ["sem-vinculo-002", "sem-vinculo-001"])
      insert.run(id, null, `fonte-${id}`, "referencia-local", semVinculo(id), AGORA);
    ambiente.db.exec("COMMIT");
  } catch (error) { ambiente.db.exec("ROLLBACK"); throw error; }
  return ambiente;
}

it("draft inválido de outro paciente não é materializado pela fila sem vínculo", async () => {
  const a = await preparar(1);
  a.db.prepare("UPDATE draft_envelope SET payload=? WHERE draftId=?").run("{json-invalido", "vinculado-00000");
  const result = await a.request("/consulta/oncoassist/fontes", { patientId: PACIENTE, encounterId: ENCONTRO, tumorLotId: null });
  expect(result.status).toBe(200);
  expect(result.data.fontesSemVinculo.map((d: { draftId: string }) => d.draftId))
    .toEqual(["sem-vinculo-001", "sem-vinculo-002"]);
});

it.each([100, 1000, 10000])("mede rota e leitura global com %i drafts vinculados sem perder desconhecidos", async (total) => {
  const a = await preparar(total);
  const memoryBefore = process.memoryUsage().heapUsed, globalStart = performance.now();
  const global = listarDrafts(a.db);
  const globalMs = performance.now() - globalStart, globalHeapDelta = process.memoryUsage().heapUsed - memoryBefore;
  expect(global.filter(d => d.patientId === null).map(d => d.draftId)).toEqual(["sem-vinculo-001", "sem-vinculo-002"]);
  const filteredMemoryBefore = process.memoryUsage().heapUsed, filteredStart = performance.now();
  const filtered = listarDraftsSemVinculo(a.db);
  const filteredMs = performance.now() - filteredStart, filteredHeapDelta = process.memoryUsage().heapUsed - filteredMemoryBefore;
  expect(filtered.map(d => d.draftId)).toEqual(["sem-vinculo-001", "sem-vinculo-002"]);
  const routeStart = performance.now();
  const result = await a.request("/consulta/oncoassist/fontes", { patientId: PACIENTE, encounterId: ENCONTRO, tumorLotId: null });
  const routeMs = performance.now() - routeStart;
  expect(result.status).toBe(200);
  expect(result.data.fontesSemVinculo.map((d: { draftId: string }) => d.draftId))
    .toEqual(["sem-vinculo-001", "sem-vinculo-002"]);
  expect(result.data.fontes).toEqual([]);
  const metrics = { total, globalCount: global.length, globalMs, globalHeapDelta, filteredMs,
    filteredHeapDelta, routeMs, unlinkedCount: result.data.fontesSemVinculo.length };
  if (process.env.ONCOGLOBAL_TEST_EVIDENCE_DIR)
    writeFileSync(join(process.env.ONCOGLOBAL_TEST_EVIDENCE_DIR, `f09-size-${total}.json`), JSON.stringify(metrics, null, 2));
});
