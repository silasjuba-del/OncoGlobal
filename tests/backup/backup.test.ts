import { afterEach, expect, it } from "vitest";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { abrirLedger } from "../../src/kernel/ledger/db.js";
import { confirmar } from "../../src/kernel/ledger/writeRouter.js";
import { salvarDraft } from "../../src/kernel/ledger/drafts.js";
import { listarEventos } from "../../src/kernel/ledger/ledger.js";
import { lerCache, reconstruir } from "../../src/kernel/projections/reconstruir.js";
// @ts-expect-error native .mjs scripts intentionally have no declaration in this worktree
import { criarBackup } from "../../scripts/backup.mjs";
// @ts-expect-error native .mjs scripts intentionally have no declaration in this worktree
import { restaurarBackup } from "../../scripts/backup-restore.mjs";

const dirs: string[] = [];
afterEach(() => { for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true }); });
it("N20 backup inclui WAL, eventos, projeções e arquivo referenciado; restauração íntegra", async () => {
  const dir = mkdtempSync(join(tmpdir(), "oncoglobal-backup-")); dirs.push(dir);
  const dbPath = join(dir, "origem.sqlite"), root = join(dir, "files"), dest = join(dir, "externo");
  mkdirSync(root); mkdirSync(dest); mkdirSync(join(root, "opacos"));
  writeFileSync(join(root, "opacos", "anexo-1"), "Anexo sintético");
  const db = abrirLedger(dbPath);
  const em = "2026-10-05T12:00:00.000Z";
  salvarDraft(db, { draftId: "d1", patientId: "Paciente Teste 01", sourceId: "s1",
    rawRef: "opacos/anexo-1", payload: { campo: "estadio", valor: "I" },
    diagnostics: [], revision: 0, criadoEm: em });
  expect(confirmar(db, {
    operationId: "op-1", patientId: "Paciente Teste 01", tumorLotId: "t1", encounterId: "e1",
    reviewDecisionId: "rd-1", sessao: { medicoId: "medico", crm: "CRM-TESTE", emitidaEm: em,
      expiraEm: "2026-10-06T00:00:00.000Z" }, em,
    registros: [{ draftId: "d1", expectedRevision: 0, eventId: "evento-1", tipo: "FATO",
      payload: { campo: "estadio", valor: "I" }, fontes: [], revisao: "CONFIRMADO" }],
  }).estado).toBe("GRAVADA");
  const ctx = { patientId: "Paciente Teste 01", tumorLotId: "t1", encounterId: "e1", projectionVersion: "v1" };
  reconstruir(db, [ctx]);
  const expected = lerCache(db, ctx), events = listarEventos(db, ctx.patientId);
  const archive = await criarBackup({ dbPath, filesRoot: root,
    destino: dest, nome: "backup-teste", senha: "senha-de-teste-sintetica" });
  expect(readFileSync(archive, "utf8")).not.toContain("Paciente Teste 01");
  db.close();
  const output = join(dir, "restaurado");
  expect(() => restaurarBackup({ arquivo: archive, destino: output, senha: "senha-errada" })).toThrow();
  const restored = restaurarBackup({ arquivo: archive, destino: output, senha: "senha-de-teste-sintetica" });
  expect(restored.arquivos).toBe(1);
  const reopened = abrirLedger(restored.database);
  expect(listarEventos(reopened, ctx.patientId)).toEqual(events);
  expect(lerCache(reopened, ctx)).toBe(expected);
  expect(readFileSync(join(output, "opacos", "anexo-1"), "utf8")).toBe("Anexo sintético");
  reopened.close();
});
