import { describe, expect, it } from "vitest";
import { projetarEstatistica, projetarEstatisticaLedger } from "../../src/estatistica/index.js";
import { abrirLedger } from "../../src/kernel/ledger/db.js";
import { evento, persistirFixture } from "./fixtures.js";

const periodoClinico = { inicio: "2026-01-01", fim: "2026-01-31" };
function administracao(inicio: string | null, status: "COMPLETA" | "PARCIAL" = "COMPLETA") {
  return { adminId: "admin-sintetica", cicloId: "ciclo-sintetico",
    prescricaoRef: { documentId: "doc-sintetico", documentVersion: 1 }, item: 1,
    droga: "SEGREDO-SINTETICO", quantidadeEfetivaMg: 50, status,
    motivo: status === "PARCIAL" ? "motivo sintético" : null, inicio, fim: null,
    fonte: { sourceId: "fonte-sintetica", classe: "MANUAL", localizador: null,
      dataClinica: "2026-01-15", dataCaptura: "2026-01-15T10:00:00Z", versao: "1", contentHash: "hash" } };
}

describe("F08 — período clínico explícito e contagem sem PHI", () => {
  it("filtra limites inclusivos, deduplica pacientes e discrimina exclusões", () => {
    const dentro = evento("primeiro", { dataClinica: "2026-01-01", nome: "SEGREDO-SINTETICO" });
    const ultimo = evento("ultimo", { dataClinica: "2026-01-31" });
    const fora = evento("fora", { dataClinica: "2026-02-01" }, { patientId: "p-fora" });
    const ausente = evento("ausente", {}, { patientId: "p-ausente", criadoEm: "2026-01-15T12:00:00Z" });
    const invalido = evento("invalido", { dataClinica: "2026-01" }, { patientId: "p-invalido" });
    const proposto = evento("proposto", { dataClinica: "2026-01-15" }, { revisao: "REVISAR" });
    const result = projetarEstatistica([dentro, ultimo, fora, ausente, invalido, proposto, dentro], { periodoClinico });
    expect(result).toMatchObject({ escopo: "PERIODO_CLINICO", periodoClinico, denominadorPacientes: 1,
      totalPacientes: 1, eventosPorCategoria: { FATO: 2 },
      exclusoes: { eventosNaoConfirmados: 1, eventosSupersedidos: 0, linhasDuplicadas: 1,
        eventosForaPeriodo: 1, eventosSemDataClinica: 1, eventosDataClinicaInvalida: 1 } });
    for (const proibido of ["SEGREDO-SINTETICO", "paciente-sintetico", "p-fora", "primeiro"])
      expect(JSON.stringify(result)).not.toContain(proibido);
  });

  it("resolve supersessão antes do recorte: predecessor dentro não reaparece", () => {
    const antes = evento("antes", { dataClinica: "2026-01-10" });
    const depois = evento("depois", { dataClinica: "2026-02-10" }, { supersedesEventId: antes.eventId });
    expect(projetarEstatistica([depois, antes], { periodoClinico })).toMatchObject({
      denominadorPacientes: 0, eventosPorCategoria: { FATO: 0 },
      exclusoes: { eventosSupersedidos: 1, eventosForaPeriodo: 1 } });
  });

  it("modo legado conserva ledger completo sem exclusões temporais", () => {
    const result = projetarEstatistica([evento("sem-dia", {})]);
    expect(result).toMatchObject({ escopo: "LEDGER_COMPLETO", periodoClinico: null,
      denominadorPacientes: 1, exclusoes: { eventosSemDataClinica: 0, eventosDataClinicaInvalida: 0, eventosForaPeriodo: 0 } });
  });

  it.each([
    { inicio: "2026-02-30", fim: "2026-03-01" },
    { inicio: "2026-02-01", fim: "2026-01-01" },
    { inicio: "2026-01", fim: "2026-01-31" },
  ])("recusa período inválido %j", (periodo) => {
    expect(() => projetarEstatistica([], { periodoClinico: periodo })).toThrow("PERIODO_CLINICO_INVALIDO");
  });

  it("usa início da administração no dia civil declarado, nunca captura ou fonte", () => {
    const administrada = evento("admin", administracao("2026-01-31T23:30:00-03:00"), { tipo: "TreatmentAdministration" });
    const result = projetarEstatistica([administrada], { periodoClinico });
    expect(result.administracoesPorStatus.COMPLETA).toBe(1);
    const semInicio = evento("sem-inicio", administracao(null), { tipo: "TreatmentAdministration" });
    expect(projetarEstatistica([semInicio], { periodoClinico })).toMatchObject({
      denominadorPacientes: 0, exclusoes: { eventosSemDataClinica: 1 }, administracoesPorStatus: { COMPLETA: 0 } });
  });

  it("intervalo não esconde versão concorrente de administração fora do período", () => {
    const dentro = evento("admin-a", administracao("2026-01-15T12:00:00Z"), { tipo: "TreatmentAdministration" });
    const fora = evento("admin-b", administracao("2026-02-15T12:00:00Z", "PARCIAL"), { tipo: "TreatmentAdministration" });
    expect(projetarEstatistica([dentro, fora], { periodoClinico })).toMatchObject({
      administracoesConflito: 1, administracoesPendentes: 1,
      administracoesPorStatus: { COMPLETA: 0, PARCIAL: 0 }, exclusoes: { eventosForaPeriodo: 1 } });
  });

  it("leitor SQLite aplica o mesmo recorte sem gravar contadores", () => {
    const db = abrirLedger(":memory:");
    try {
      persistirFixture(db, evento("incluido", { dataClinica: "2026-01-15" }));
      persistirFixture(db, evento("excluido", { dataClinica: "2026-02-15" }));
      const antes = db.prepare("SELECT * FROM clinical_event").all();
      const result = projetarEstatisticaLedger(db, { periodoClinico });
      expect(result.eventosPorCategoria.FATO).toBe(1);
      expect(result.exclusoes.eventosForaPeriodo).toBe(1);
      expect(projetarEstatisticaLedger(db, { periodoClinico })).toEqual(result);
      expect(db.prepare("SELECT * FROM clinical_event").all()).toEqual(antes);
    } finally { db.close(); }
  });
});
