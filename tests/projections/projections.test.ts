import { afterEach, expect, it } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { abrirLedger } from "../../src/kernel/ledger/db.js";
import { salvarDraft } from "../../src/kernel/ledger/drafts.js";
import { confirmar } from "../../src/kernel/ledger/writeRouter.js";
import { listarEventos } from "../../src/kernel/ledger/ledger.js";
import { cumulativos } from "../../src/kernel/projections/cumulativos.js";
import { labSeries, weightSeries } from "../../src/kernel/projections/series.js";
import { montarSnapshot } from "../../src/kernel/projections/snapshot.js";
import { lerCache, reconstruir } from "../../src/kernel/projections/reconstruir.js";

const dirs: string[] = [];
const dbs: ReturnType<typeof abrirLedger>[] = [];
const em = "2026-10-05T12:00:00.000Z";
afterEach(() => { dbs.splice(0).forEach((db) => { try { db.close(); } catch { /* already closed */ } });
  dirs.splice(0).forEach((p) => rmSync(p, { force: true, recursive: true })); });
function fixture() {
  const dir = mkdtempSync(join(tmpdir(), "oncoglobal-projection-")); dirs.push(dir);
  const db = abrirLedger(join(dir, "ledger.sqlite")); dbs.push(db);
  return db;
}
function add(db: ReturnType<typeof fixture>, id: string, lot: string | null, campo: string, valor: unknown,
  tipo = "FATO", supersedesEventId: string | null = null, time = em) {
  salvarDraft(db, { draftId: id, patientId: "Paciente Teste 01", sourceId: "synthetic",
    rawRef: `opaque-${id}`, payload: { campo, valor }, diagnostics: [], revision: 0, criadoEm: time });
  expect(confirmar(db, {
    operationId: `op-${id}`, patientId: "Paciente Teste 01", tumorLotId: lot, encounterId: "e1",
    reviewDecisionId: `rd-${id}`, sessao: { medicoId: "medico", crm: "CRM-SINTETICO",
      emitidaEm: em, expiraEm: "2026-10-06T00:00:00.000Z" }, em: time,
    registros: [{ draftId: id, expectedRevision: 0, eventId: id, tipo,
      payload: tipo === "TreatmentAdministration" || (typeof valor === "object" && valor !== null && "campo" in valor)
        ? valor : { campo, valor, rulesetRefs: [{ id: "ruleset", version: "1.0.0", hash: "hash-v1" }] },
      fontes: [], revisao: "CONFIRMADO", supersedesEventId }],
  }).estado).toBe("GRAVADA");
}

it("N10/N15 imutabilidade dos rulesetRefs e isolamento de dois tumores com risco sistêmico", () => {
  const db = fixture();
  add(db, "t1-v1", "tumor-1", "estadio", "I");
  add(db, "t2-v1", "tumor-2", "estadio", "II");
  add(db, "sistemico", null, "alergia", "alergia sintética");
  const before = montarSnapshot(db, "Paciente Teste 01", "tumor-2", "e1", "v1");
  add(db, "t1-v2", "tumor-1", "estadio", "III", "FATO", "t1-v1", "2026-10-05T12:01:00.000Z");
  const corrected = montarSnapshot(db, "Paciente Teste 01", "tumor-1", "e1", "v1");
  expect(corrected.campos.estadio?.valor).toBe("III");
  expect(corrected.rulesetRefs).toEqual([{ id: "ruleset", version: "1.0.0", hash: "hash-v1" }]);
  const unchanged = montarSnapshot(db, "Paciente Teste 01", "tumor-2", "e1", "v1");
  expect(unchanged).toEqual(before);
  expect(unchanged.campos.alergia?.valor).toBe("alergia sintética");
  db.close();
});

it("dados concorrentes sem supersedes não fazem last-write-wins; CURRENT não vira CONFIRMED", () => {
  const db = fixture();
  add(db, "a", "tumor-1", "estadio", "I");
  add(db, "b", "tumor-1", "estadio", "II");
  const confirmed = montarSnapshot(db, "Paciente Teste 01", "tumor-1", "e1", "v1");
  expect(confirmed.campos.estadio).toMatchObject({ estado: "VERMELHO", valor: null });
  expect(confirmed.campos.estadio?.candidatos).toHaveLength(2);
  const current = montarSnapshot(db, "Paciente Teste 01", "tumor-1", "e1", "v1",
    [{ campo: "proposta", valor: "texto", sourceId: "doc" }]);
  expect(current.kind).toBe("CURRENT");
  expect(confirmed.kind).toBe("CONFIRMED");
  expect(confirmed.campos.proposta).toBeUndefined();
  db.close();
});

it("N14 cumulativo usa só administração efetiva; séries guardam origem", () => {
  const db = fixture();
  const base = { adminId: "admin-1", cicloId: "c-1", prescricaoRef: { documentId: "rx", documentVersion: 1 },
    item: 1, droga: "Droga Sintética", quantidadeEfetivaMg: 60, status: "PARCIAL", motivo: "teste",
    inicio: em, fim: em,
    fonte: { sourceId: "manual", classe: "MANUAL", localizador: null,
      dataClinica: "2026-10-05", dataCaptura: em, versao: "1", contentHash: "hash" } };
  add(db, "rx-prescribed", "tumor-1", "prescricao", { doseMg: 100 }, "Prescription");
  add(db, "admin-partial", "tumor-1", "admin", base, "TreatmentAdministration");
  add(db, "admin-omitted", "tumor-1", "admin", { ...base, adminId: "admin-2",
    status: "OMITIDA", quantidadeEfetivaMg: 0 }, "TreatmentAdministration");
  add(db, "weight", null, "weight", { campo: "weight", kg: 71,
    origem: "INFORMADO_PACIENTE", data: "2026-10-05", sourceId: "manual" }, "Weight");
  add(db, "lab", null, "lab", { campo: "Hb", valor: 12,
    unidade: "g/dL", data: "2026-10-05", sourceId: "manual" }, "LabResult");
  const events = listarEventos(db, "Paciente Teste 01");
  expect(cumulativos(events)).toEqual([{ droga: "Droga Sintética", quantidadeEfetivaMg: 60, adminIds: ["admin-1"] }]);
  expect(weightSeries(events)[0]?.origem).toBe("INFORMADO_PACIENTE");
  expect(labSeries(events)[0]?.sourceId).toBe("manual");
  db.close();
});

it("reconstrução descarta cache adulterado e recompõe byte a byte", () => {
  const db = fixture();
  add(db, "e1", "tumor-1", "estadio", "I");
  const ctx = { patientId: "Paciente Teste 01", tumorLotId: "tumor-1", encounterId: "e1", projectionVersion: "v1" };
  reconstruir(db, [ctx]);
  const before = lerCache(db, ctx);
  expect(before).toContain("hash-v1");
  db.prepare("UPDATE projection_cache SET data='corrupt'").run();
  reconstruir(db, [ctx]);
  expect(lerCache(db, ctx)).toBe(before);
  db.close();
});
