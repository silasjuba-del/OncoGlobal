// proveniência: dados sintéticos — não utilizar em produção
import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { abrirLedger } from "../../src/kernel/ledger/db.js";
import { salvarDraft } from "../../src/kernel/ledger/drafts.js";
import { listarEventos } from "../../src/kernel/ledger/ledger.js";
import { confirmar, type Confirmacao } from "../../src/kernel/ledger/writeRouter.js";

const AGORA = "2026-10-07T12:00:00.000Z";
const PACIENTE = "Paciente Teste 01";
const sessao = { medicoId: "medico-01", crm: "CRM-TESTE", emitidaEm: "2026-10-07T10:00:00.000Z",
  expiraEm: "2026-10-07T14:00:00.000Z" };
const fonte = { sourceId: "fonte-lab-01", classe: "LAB_FEED" as const, localizador: "linha 1",
  dataClinica: "2026-10-07", dataCaptura: AGORA, versao: "v1",
  contentHash: createHash("sha256").update("Creatinina 1,1 mg/dL").digest("hex") };

function pedido(db: ReturnType<typeof abrirLedger>, id: string, extra: Partial<Confirmacao> = {},
  registro: Partial<Confirmacao["registros"][number]> = {}): Confirmacao {
  salvarDraft(db, { draftId: `draft-${id}`, patientId: PACIENTE, sourceId: "fonte-lab-01", rawRef: "referencia-local",
    payload: { campo: "creatinina", valor: 1.1 }, diagnostics: [], revision: 0, criadoEm: AGORA });
  return { operationId: `op-${id}`, patientId: PACIENTE, tumorLotId: null, encounterId: "enc-01",
    reviewDecisionId: `rev-${id}`, sessao, em: AGORA, ...extra,
    registros: [{ draftId: `draft-${id}`, expectedRevision: 0, eventId: `ev-${id}`, tipo: "FATO",
      payload: { campo: "creatinina", valor: 1.1 }, fontes: [fonte], revisao: "CONFIRMADO", ...registro }] };
}

// RT-ADV-04: rotas HTTP chamam writeRouter.confirmar direto; as invariantes do writer
// clínico precisam valer ali, não só no gateway.
describe("RT-ADV-04 · funil único de escrita clínica", () => {
  it("nega carimbo anterior à emissão da sessão médica", () => {
    const db = abrirLedger(":memory:");
    try {
      const r = confirmar(db, pedido(db, "antes-da-sessao", { em: "2026-10-07T09:59:59.000Z" }));
      expect(r).toEqual({ estado: "NEGADA", resultRef: null, motivo: "SESSAO_NAO_INICIADA" });
      expect(listarEventos(db, PACIENTE)).toEqual([]);
      expect(db.prepare("SELECT motivoCodigo FROM audit_event").all()).toEqual([{ motivoCodigo: "SESSAO_NAO_INICIADA" }]);
    } finally { db.close(); }
  });

  it("nega sessão expirada mesmo sem passar pelo writer do gateway", () => {
    const db = abrirLedger(":memory:");
    try {
      const r = confirmar(db, pedido(db, "expirada", { sessao: { ...sessao, expiraEm: "2026-10-07T11:59:59.000Z" } }));
      expect(r).toEqual({ estado: "NEGADA", resultRef: null, motivo: "SESSAO_EXPIRADA" });
      expect(listarEventos(db, PACIENTE)).toEqual([]);
      expect(db.prepare("SELECT motivoCodigo FROM audit_event").all()).toEqual([{ motivoCodigo: "SESSAO_EXPIRADA" }]);
    } finally { db.close(); }
  });

  it("nega sessão com identidade inválida", () => {
    const db = abrirLedger(":memory:");
    try {
      const r = confirmar(db, pedido(db, "sem-crm", { sessao: { ...sessao, crm: "" } }));
      expect(r.motivo).toBe("IDENTIDADE_MEDICA_INVALIDA");
      expect(listarEventos(db, PACIENTE)).toEqual([]);
    } finally { db.close(); }
  });

  it("grava com sessão válida e o mesmo pedido devolve REPLAY sem duplicar", () => {
    const db = abrirLedger(":memory:");
    try {
      const p = pedido(db, "ok");
      expect(confirmar(db, p).estado).toBe("GRAVADA");
      expect(confirmar(db, p).estado).toBe("REPLAY");
      expect(listarEventos(db, PACIENTE)).toHaveLength(1);
    } finally { db.close(); }
  });
});
