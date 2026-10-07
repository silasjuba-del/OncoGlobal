import { describe, expect, it } from "vitest";
import { ClinicalEvent } from "../../src/contracts/operacao.js";
import { abrirLedger } from "../../src/kernel/ledger/db.js";
import { listarEventos } from "../../src/kernel/ledger/ledger.js";
import { salvarDraft } from "../../src/kernel/ledger/drafts.js";
import { confirmar } from "../../src/kernel/ledger/writeRouter.js";
import { projetarEstatistica, projetarEstatisticaLedger } from "../../src/estatistica/index.js";

function treatment(status: "COMPLETA" | "PARCIAL" | "OMITIDA" | "INTERROMPIDA") {
  return {
    adminId: "admin-1", cicloId: "ciclo-1", prescricaoRef: { documentId: "doc-1", documentVersion: 1 },
    item: 1, droga: "Fármaco sintético - Paciente Teste 99", quantidadeEfetivaMg: status === "OMITIDA" ? 0 : 50,
    status, motivo: status === "COMPLETA" ? null : "motivo sintético", inicio: null, fim: null,
    fonte: { sourceId: "fonte-admin", classe: "MANUAL", localizador: null, dataClinica: null,
      dataCaptura: "2026-10-01T10:00:00-03:00", versao: "1", contentHash: "hash-sintetico" },
  };
}
function ledgerEvent(id: string, patientId: string, tipo: string, data: unknown, patch: Record<string, unknown> = {}) {
  return ClinicalEvent.parse({
    eventId: id, operationId: `op-${id}`, eventIndex: 0, patientId, tumorLotId: "tumor-01",
    encounterId: `enc-${id}`, tipo,
    payload: { reviewDecisionId: "review-sintetico", data }, fontes: [], revisao: "CONFIRMADO",
    criadoEm: "2026-10-01T10:00:00-03:00", criadoPor: { tipo: "SESSAO", id: "sessao-sintetica" },
    supersedesEventId: null, ...patch,
  });
}
function confirmRealLedgerRecord(db: ReturnType<typeof abrirLedger>, input: {
  eventId: string; tipo: string; payload: unknown; revisao: "CONFIRMADO" | "ASSINADO"; patientId: string;
  em?: string; supersedesEventId?: string | null;
}) {
  const em = input.em ?? "2026-10-01T10:00:00-03:00";
  salvarDraft(db, { draftId: `draft-${input.eventId}`, patientId: input.patientId,
    sourceId: `source-${input.eventId}`, rawRef: `opaque-${input.eventId}`, payload: input.payload,
    diagnostics: [], revision: 0, criadoEm: em });
  return {
    operationId: `operation-${input.eventId}`, patientId: input.patientId, tumorLotId: "tumor-01",
    encounterId: `encounter-${input.eventId}`, reviewDecisionId: `review-${input.eventId}`,
    sessao: { medicoId: "medico-teste", crm: "CRM-SINTETICO", emitidaEm: em,
      expiraEm: new Date(Date.parse(em) + 86_400_000).toISOString() }, em,
    registros: [{ draftId: `draft-${input.eventId}`, expectedRevision: 0, eventId: input.eventId,
      tipo: input.tipo, payload: input.payload, fontes: [], revisao: input.revisao,
      supersedesEventId: input.supersedesEventId ?? null }],
  };
}

describe("W10-LUNA4 F08 · projeção estatística do ledger", () => {
  it("deduplica pessoas entre eventos/tumores, lê contratos conhecidos e nunca expõe payload ou ids", () => {
    const patient1 = "paciente-teste-01";
    const facts = ledgerEvent("fato-1", patient1, "FATO", { nome: "Paciente Teste 99", texto: "PHI-SINTETICA" });
    const document = ledgerEvent("doc-1", patient1, "DOCUMENTO", { data: { texto: "PHI-SINTETICA" }, signature: {
      documentId: "doc-ref", documentVersion: 1, documentHash: "hash", reviewDecisionId: "review", serverActorId: "server",
    } }, { revisao: "ASSINADO" });
    const admin = ledgerEvent("admin-event", patient1, "TreatmentAdministration", treatment("COMPLETA"));
    const otherTumor = ledgerEvent("fato-2", patient1, "FATO", { dataLivre: "PHI-SINTETICA" }, { tumorLotId: "tumor-02" });
    const unknown = ledgerEvent("unknown", "paciente-teste-02", "PHI-SINTETICA-TIPO", { texto: "NAO-RETORNAR" });
    const projection = projetarEstatistica([facts, document, admin, otherTumor, unknown, facts]);
    const json = JSON.stringify(projection);
    expect(projection.totalPacientes).toBe(2);
    expect(projection.eventosPorCategoria).toEqual({ FATO: 2, DOCUMENTO: 1, ADMINISTRACAO: 1, OUTRO: 1 });
    expect(projection.pacientesPorCategoria).toEqual({ FATO: 1, DOCUMENTO: 1, ADMINISTRACAO: 1, OUTRO: 1 });
    expect(projection.documentosAssinados).toBe(1);
    expect(projection.pacientesComDocumentoAssinado).toBe(1);
    expect(projection.administracoesPorStatus.COMPLETA).toBe(1);
    for (const forbidden of [patient1, "Paciente Teste 99", "PHI-SINTETICA", "NAO-RETORNAR", "admin-1", "Fármaco sintético"])
      expect(json).not.toContain(forbidden);
    expect(Object.keys(projection)).toEqual([
      "versao", "escopo", "periodoClinico", "denominadorPacientes", "exclusoes", "totalPacientes", "eventosPorCategoria", "pacientesPorCategoria", "documentosAssinados",
      "pacientesComDocumentoAssinado", "administracoesPorStatus", "pacientesPorStatusDeAdministracao", "administracoesPendentes", "administracoesConflito",
    ]);
  });

  it("tira evento supersedido da projeção sem perder paciente e rejeita vínculo cruzado", () => {
    const old = ledgerEvent("old", "paciente-teste-01", "DOCUMENTO", {});
    const replacement = ledgerEvent("replacement", "paciente-teste-01", "FATO", {}, { supersedesEventId: "old" });
    const result = projetarEstatistica([replacement, old]);
    expect(result.totalPacientes).toBe(1);
    expect(result.eventosPorCategoria).toEqual({ FATO: 1, DOCUMENTO: 0, ADMINISTRACAO: 0, OUTRO: 0 });
    const crossPatient = ledgerEvent("bad-replacement", "paciente-teste-02", "FATO", {}, { supersedesEventId: "old" });
    expect(() => projetarEstatistica([old, crossPatient])).toThrow("SUPERSESSION_CONTEXT_INVALID");
  });

  it("preserva semântica de correção entre encontros e falha fechado em ciclo ou alvo temporal futuro", () => {
    const old = ledgerEvent("old-cross-encounter", "paciente-teste-01", "DOCUMENTO", {}, {
      encounterId: "encounter-1", criadoEm: "2026-10-01T10:00:00-03:00",
    });
    const corrected = ledgerEvent("corrected-cross-encounter", "paciente-teste-01", "FATO", {}, {
      encounterId: "encounter-2", criadoEm: "2026-10-02T10:00:00-03:00", supersedesEventId: old.eventId,
    });
    expect(projetarEstatistica([old, corrected]).eventosPorCategoria)
      .toEqual({ FATO: 1, DOCUMENTO: 0, ADMINISTRACAO: 0, OUTRO: 0 });

    const self = ledgerEvent("self", "paciente-teste-01", "FATO", {}, { supersedesEventId: "self" });
    expect(() => projetarEstatistica([self])).toThrow("SUPERSESSION_CYCLE");
    const a = ledgerEvent("cycle-a", "paciente-teste-01", "FATO", {}, { supersedesEventId: "cycle-b" });
    const b = ledgerEvent("cycle-b", "paciente-teste-01", "FATO", {}, { supersedesEventId: "cycle-a" });
    expect(() => projetarEstatistica([a, b])).toThrow("SUPERSESSION_CYCLE");

    const future = ledgerEvent("future-target", "paciente-teste-01", "DOCUMENTO", {}, {
      criadoEm: "2026-10-03T10:00:00-03:00",
    });
    const backdated = ledgerEvent("backdated-successor", "paciente-teste-01", "FATO", {}, {
      criadoEm: "2026-10-02T10:00:00-03:00", supersedesEventId: future.eventId,
    });
    expect(() => projetarEstatistica([future, backdated])).toThrow("SUPERSESSION_TARGET_IS_FUTURE");
  });

  it("mantém status clínico e conflito de administração em contagem pendente sem vazar texto livre", () => {
    const malformed = ledgerEvent("admin-invalid", "paciente-teste-01", "TreatmentAdministration", {
      status: "TEXTO-LIVRE-PHI", droga: "Paciente Teste 99",
    });
    const projection = projetarEstatistica([malformed]);
    expect(projection.administracoesPendentes).toBe(1);
    expect(JSON.stringify(projection)).not.toContain("TEXTO-LIVRE-PHI");
    expect(JSON.stringify(projection)).not.toContain("Paciente Teste 99");
  });

  it("regenera diretamente do SQLite local e não soma replay duas vezes", () => {
    const db = abrirLedger(":memory:");
    const patientId = "paciente-teste-01";
    const payloadFato = { texto: "segredo sintético" };
    const requestFato = { eventId: "db-fato", tipo: "FATO", payload: payloadFato, revisao: "CONFIRMADO" as const, patientId };
    const fatoRequest = confirmRealLedgerRecord(db, requestFato);
    expect(confirmar(db, fatoRequest).estado).toBe("GRAVADA");
    expect(confirmar(db, fatoRequest).estado).toBe("REPLAY");
    const reference = { documentId: "doc-ref", documentVersion: 1, documentHash: "hash",
      reviewDecisionId: "review-db-document", serverActorId: "medico-teste" };
    const signedDocument = { data: { texto: "conteúdo sintético" }, signature: reference };
    expect(confirmar(db, confirmRealLedgerRecord(db, { eventId: "db-document", tipo: "DOCUMENTO", payload: signedDocument,
      revisao: "ASSINADO", patientId })).estado).toBe("GRAVADA");
    expect(confirmar(db, confirmRealLedgerRecord(db, { eventId: "db-admin", tipo: "TreatmentAdministration",
      payload: treatment("COMPLETA"), revisao: "CONFIRMADO", patientId })).estado).toBe("GRAVADA");
    const events = listarEventos(db, patientId);
    const first = projetarEstatisticaLedger(db);
    const second = projetarEstatisticaLedger(db);
    expect(second).toEqual(first);
    expect(first.totalPacientes).toBe(1);
    expect(first.eventosPorCategoria).toEqual({ FATO: 1, DOCUMENTO: 1, ADMINISTRACAO: 1, OUTRO: 0 });
    expect(first.documentosAssinados).toBe(1);
    expect(first.administracoesPorStatus.COMPLETA).toBe(1);
    expect(projetarEstatistica(events)).toEqual(first);
    expect(JSON.stringify(first)).not.toContain("segredo sintético");
    db.close();
  });

  it("não conta sucessores incompatíveis do mesmo adminId; cadeia linear mantém só a versão vigente", () => {
    const db = abrirLedger(":memory:");
    const patientId = "paciente-teste-01";
    const writeAdmin = (eventId: string, status: "COMPLETA" | "PARCIAL" | "OMITIDA" | "INTERROMPIDA",
      em: string, supersedesEventId: string | null = null) => confirmar(db, confirmRealLedgerRecord(db, {
      eventId, tipo: "TreatmentAdministration", payload: treatment(status), revisao: "CONFIRMADO",
      patientId, em, supersedesEventId,
    }));

    expect(writeAdmin("admin-A", "COMPLETA", "2026-10-01T10:00:00-03:00").estado).toBe("GRAVADA");
    expect(writeAdmin("admin-B", "COMPLETA", "2026-10-02T10:00:00-03:00", "admin-A").estado).toBe("GRAVADA");
    expect(writeAdmin("admin-C", "OMITIDA", "2026-10-03T10:00:00-03:00", "admin-A").estado).toBe("GRAVADA");
    const forked = projetarEstatisticaLedger(db);
    expect(forked.totalPacientes).toBe(1);
    expect(forked.eventosPorCategoria.ADMINISTRACAO).toBe(2); // dois eventos atuais, uma administração conflitante não contabilizada
    expect(forked.administracoesPorStatus).toEqual({ COMPLETA: 0, PARCIAL: 0, OMITIDA: 0, INTERROMPIDA: 0 });
    expect(forked.administracoesPendentes).toBe(1);
    expect(forked.administracoesConflito).toBe(1);
    db.close();

    const linear = abrirLedger(":memory:");
    expect(confirmar(linear, confirmRealLedgerRecord(linear, {
      eventId: "linear-A", tipo: "TreatmentAdministration", payload: treatment("COMPLETA"),
      revisao: "CONFIRMADO", patientId, em: "2026-10-01T10:00:00-03:00",
    })).estado).toBe("GRAVADA");
    expect(confirmar(linear, confirmRealLedgerRecord(linear, {
      eventId: "linear-B", tipo: "TreatmentAdministration", payload: treatment("OMITIDA"),
      revisao: "CONFIRMADO", patientId, em: "2026-10-02T10:00:00-03:00", supersedesEventId: "linear-A",
    })).estado).toBe("GRAVADA");
    expect(confirmar(linear, confirmRealLedgerRecord(linear, {
      eventId: "linear-C", tipo: "TreatmentAdministration", payload: treatment("PARCIAL"),
      revisao: "CONFIRMADO", patientId, em: "2026-10-03T10:00:00-03:00", supersedesEventId: "linear-B",
    })).estado).toBe("GRAVADA");
    const current = projetarEstatisticaLedger(linear);
    expect(current.administracoesPorStatus).toEqual({ COMPLETA: 0, PARCIAL: 1, OMITIDA: 0, INTERROMPIDA: 0 });
    expect(current.administracoesPendentes).toBe(0);
    expect(current.administracoesConflito).toBe(0);
    linear.close();
  });
});
