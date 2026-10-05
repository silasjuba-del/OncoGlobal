import { afterEach, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { abrirLedger } from "../../src/kernel/ledger/db.js";
import { lerDraft, salvarDraft } from "../../src/kernel/ledger/drafts.js";
import { gravarOperacao, hashPayload, listarEventos } from "../../src/kernel/ledger/ledger.js";
import { confirmar } from "../../src/kernel/ledger/writeRouter.js";

const em = "2026-10-05T12:00:00.000Z";
const sessao = { medicoId: "medico-teste", crm: "CRM-TESTE", emitidaEm: em, expiraEm: "2026-10-05T13:00:00.000Z" };
const dirs: string[] = [];
function fixture() {
  const dir = mkdtempSync(join(tmpdir(), "oncoglobal-ledger-"));
  dirs.push(dir);
  const path = join(dir, "test.sqlite");
  return { db: abrirLedger(path), path };
}
function draft(id: string) {
  return { draftId: id, patientId: "Paciente Teste 01", sourceId: "fonte-teste",
    rawRef: "opaque-ref", payload: { state: "ENTREGUE", texto: "dado sintético" },
    diagnostics: [], revision: 0, criadoEm: em };
}
function request(operationId: string, ids: string[]) {
  return { operationId, patientId: "Paciente Teste 01", tumorLotId: "tumor-01",
    encounterId: "consulta-01", reviewDecisionId: "revisao-humana-01", sessao, em,
    registros: ids.map((id, i) => ({
      draftId: id, expectedRevision: 0, eventId: `evento-${operationId}-${i}`,
      tipo: "FATO", payload: { campo: id }, fontes: [],
      revisao: "CONFIRMADO" as const,
    })) };
}
afterEach(() => { for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true }); });

describe("W2-01 ledger", () => {
  it("N07 salva payload inerte e o recupera ao reabrir sem promovê-lo", () => {
    const { db, path } = fixture();
    salvarDraft(db, draft("draft-1"));
    db.close();
    const reopened = abrirLedger(path);
    expect(lerDraft(reopened, "draft-1")).toEqual(draft("draft-1"));
    expect(listarEventos(reopened, "Paciente Teste 01")).toEqual([]);
    reopened.close();
  });

  it("N05 confirma N eventos em uma operação; replay não duplica nem incrementa revision", () => {
    const { db } = fixture();
    salvarDraft(db, draft("a")); salvarDraft(db, draft("b"));
    const req = request("op-1", ["a", "b"]);
    expect(confirmar(db, req).estado).toBe("GRAVADA");
    expect(confirmar(db, req).estado).toBe("REPLAY");
    expect(db.prepare("SELECT COUNT(*) AS n FROM operation").get()?.n).toBe(1);
    expect(listarEventos(db, req.patientId).map((e) => e.eventIndex)).toEqual([0, 1]);
    expect(lerDraft(db, "a")?.revision).toBe(1);
    db.close();
  });

  it("N04 uma aba com expectedRevision antiga não sobrescreve; preserva draft", () => {
    const { db } = fixture();
    salvarDraft(db, draft("a"));
    expect(confirmar(db, request("op-1", ["a"])).estado).toBe("GRAVADA");
    expect(confirmar(db, request("op-2", ["a"]))).toMatchObject({
      estado: "NEGADA", motivo: "EXPECTED_REVISION_CONFLICT",
    });
    expect(lerDraft(db, "a")?.payload).toEqual(draft("a").payload);
    expect(listarEventos(db, "Paciente Teste 01")).toHaveLength(1);
    expect(db.prepare("SELECT motivoCodigo FROM audit_event").get()?.motivoCodigo).toBe("EXPECTED_REVISION_CONFLICT");
    db.close();
  });

  it("salva edição stale como novo draft conflitante sem descartar nenhuma versão", () => {
    const { db } = fixture();
    salvarDraft(db, draft("a"));
    const stale = salvarDraft(db, { ...draft("a"), payload: { texto: "segunda aba" } });
    expect(stale.draftId).not.toBe("a");
    expect(stale.diagnostics).toContain("EXPECTED_REVISION_CONFLICT");
    expect(lerDraft(db, "a")?.payload).toEqual(draft("a").payload);
    expect(lerDraft(db, stale.draftId)?.payload).toEqual({ texto: "segunda aba" });
    db.close();
  });

  it("N06 mesmo operationId com outro hash nega e audita, sem alterar eventos", () => {
    const { db } = fixture();
    salvarDraft(db, draft("a"));
    expect(confirmar(db, request("op-1", ["a"])).estado).toBe("GRAVADA");
    expect(confirmar(db, { ...request("op-1", ["a"]), reviewDecisionId: "outra-revisao" })).toMatchObject({
      estado: "NEGADA", motivo: "OPERATION_HASH_CONFLICT",
    });
    expect(listarEventos(db, "Paciente Teste 01")).toHaveLength(1);
    expect(db.prepare("SELECT motivoCodigo FROM audit_event").get()?.motivoCodigo).toBe("OPERATION_HASH_CONFLICT");
    db.close();
  });

  it("A12 rejeita RAW e mantém operação atômica quando a segunda inserção falha", () => {
    const { db } = fixture();
    const event = { eventId: "e1", operationId: "o1", eventIndex: 0,
      patientId: "Paciente Teste 01", tumorLotId: null, encounterId: "consulta-01",
      tipo: "FATO", payload: {}, fontes: [], revisao: "RAW" as const,
      criadoEm: em, criadoPor: { tipo: "SESSAO" as const, id: "medico-teste" }, supersedesEventId: null };
    expect(gravarOperacao(db, { operationId: "o1", payloadHash: hashPayload([event]), resultRef: "e1", criadoEm: em }, [event]).estado).toBe("NEGADA");
    expect(db.prepare("SELECT COUNT(*) AS n FROM operation").get()?.n).toBe(0);
    const first = { ...event, payload: { reviewDecisionId: "rd-1" }, revisao: "CONFIRMADO" as const };
    const second = { ...first, eventIndex: 1, eventId: "e1" }; // duplicate PK
    expect(() => gravarOperacao(db,
      { operationId: "o1", payloadHash: hashPayload([first, second]), resultRef: "e1", criadoEm: em },
      [first, second])).toThrow();
    expect(db.prepare("SELECT COUNT(*) AS n FROM operation").get()?.n).toBe(0);
    expect(db.prepare("SELECT COUNT(*) AS n FROM clinical_event").get()?.n).toBe(0);
    db.close();
  });
});
