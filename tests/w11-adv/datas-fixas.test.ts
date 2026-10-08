// W11-H14 · datas fixas do cabeçalho clínico (decisão Dr. Silas): projeção pura sobre fatos confirmados.
import { describe, expect, it } from "vitest";
import { ClinicalEvent } from "../../src/contracts/operacao.js";
import { projetarDatasFixas } from "../../src/kernel/projections/datasFixas.js";

const REF = "2026-10-08";

function ev(eventId: string, tipo: string, data: Record<string, unknown>, patch: Partial<ClinicalEvent> = {}): ClinicalEvent {
  return ClinicalEvent.parse({
    eventId, operationId: `op-${eventId}`, eventIndex: 0, patientId: "paciente-sintetico",
    tumorLotId: "lote-sintetico", encounterId: "consulta-sintetica", tipo,
    payload: { reviewDecisionId: "revisao-sintetica", data }, fontes: [], revisao: "CONFIRMADO",
    criadoEm: "2026-10-07T12:00:00Z", criadoPor: { tipo: "SESSAO", id: "medico-sintetico" },
    supersedesEventId: null, ...patch,
  });
}

const biopsia = (id: string, dataClinica: string, patch: Partial<ClinicalEvent> = {}) =>
  ev(id, "Biopsy", { dataClinica }, patch);
const estadiamento = (id: string, tipo: "STAGING" | "RESTAGING", dataClinica: string, patch: Partial<ClinicalEvent> = {}) =>
  ev(id, "Staging", { tipo, dataClinica, valor: "cT2 cN1 cM0" }, patch);
const ciclo = (id: string, linha: number, ciclo: number, dataClinica: string, patch: Partial<ClinicalEvent> = {}) =>
  ev(id, "TreatmentCycle", { linha, ciclo, dataClinica }, patch);
const administracao = (id: string, adminId: string, dataClinica: string, status: "COMPLETA" | "OMITIDA" = "COMPLETA", patch: Partial<ClinicalEvent> = {}) =>
  ev(id, "TreatmentAdministration", {
    dataClinica, adminId, cicloId: "ciclo-sintetico", prescricaoRef: { documentId: "doc-sintetico", documentVersion: 1 },
    item: 1, droga: "droga-sintetica", quantidadeEfetivaMg: status === "OMITIDA" ? 0 : 100, status, motivo: null,
    inicio: null, fim: null,
    fonte: { sourceId: "fonte-sintetica", classe: "MANUAL", localizador: null, dataClinica: null,
      dataCaptura: "2026-10-07T12:00:00Z", versao: "1", contentHash: "hash-sintetico" },
  }, patch);

describe("W11-H14 datas fixas do cabeçalho", () => {
  it("caso completo: quatro datas preenchidas com fonte e dias desde calculados contra a referência", () => {
    const eventos = [
      biopsia("b1", "2026-01-10"),
      estadiamento("s1", "STAGING", "2026-01-20"),
      estadiamento("r1", "RESTAGING", "2026-06-01"),
      ciclo("c1", 1, 1, "2026-03-01"),
      ciclo("c2", 1, 2, "2026-03-22"),
      administracao("a1", "adm-1", "2026-03-01"),
      administracao("a2", "adm-2", "2026-09-15"),
    ];
    const r = projetarDatasFixas(eventos, REF);
    expect(r.biopsyDate).toEqual({ data: "2026-01-10", estado: "PREENCHIDO", motivo: null, fonte: "b1", fontesConflitantes: [] });
    expect(r.c1d1Date).toEqual({ data: "2026-03-01", estado: "PREENCHIDO", motivo: null, fonte: "c1", fontesConflitantes: [] });
    expect(r.lastStagingDate).toEqual({ data: "2026-06-01", estado: "PREENCHIDO", motivo: null, fonte: "r1", fontesConflitantes: [], tipo: "RESTAGING" });
    expect(r.lastRestagingDate).toEqual({ data: "2026-06-01", estado: "PREENCHIDO", motivo: null, fonte: "r1", fontesConflitantes: [] });
    expect(r.lastTreatmentDate).toEqual({ data: "2026-09-15", estado: "PREENCHIDO", motivo: null, fonte: "a2", fontesConflitantes: [] });
    expect(r.dataReferencia).toBe(REF);
  });

  it("sem biópsia: biopsyDate fica PENDENTE com data null, nunca inventada", () => {
    const r = projetarDatasFixas([estadiamento("s1", "STAGING", "2026-01-20")], REF);
    expect(r.biopsyDate).toEqual({ data: null, estado: "PENDENTE", motivo: "AUSENTE", fonte: null, fontesConflitantes: [] });
    expect(r.diasDesde.c1d1).toBeNull();
    expect(r.lastStagingDate.estado).toBe("PREENCHIDO");
  });

  it("reestadiamento mais recente que estadiamento: último estadiamento tem tipo RESTAGING", () => {
    const r = projetarDatasFixas([
      estadiamento("s1", "STAGING", "2026-01-20"),
      estadiamento("r1", "RESTAGING", "2026-05-05"),
    ], REF);
    expect(r.lastStagingDate.data).toBe("2026-05-05");
    expect(r.lastStagingDate.tipo).toBe("RESTAGING");
    expect(r.lastStagingDate.fonte).toBe("r1");
    expect(r.lastRestagingDate.data).toBe("2026-05-05");
  });

  it("estadiamento mais recente que reestadiamento: tipo STAGING e reestadiamento preserva a data antiga", () => {
    const r = projetarDatasFixas([
      estadiamento("r1", "RESTAGING", "2026-02-02"),
      estadiamento("s1", "STAGING", "2026-04-04"),
    ], REF);
    expect(r.lastStagingDate.tipo).toBe("STAGING");
    expect(r.lastStagingDate.data).toBe("2026-04-04");
    expect(r.lastRestagingDate.data).toBe("2026-02-02");
  });

  it("sem reestadiamento: lastRestagingDate PENDENTE e dias desde reestadiamento null", () => {
    const r = projetarDatasFixas([estadiamento("s1", "STAGING", "2026-01-20")], REF);
    expect(r.lastRestagingDate.estado).toBe("PENDENTE");
    expect(r.lastRestagingDate.motivo).toBe("AUSENTE");
    expect(r.diasDesde.lastRestaging).toBeNull();
  });

  it("troca de linha: c1d1 é o C1 da nova linha, nunca o da linha anterior", () => {
    const r = projetarDatasFixas([
      ciclo("l1c1", 1, 1, "2025-11-01"),
      ciclo("l1c4", 1, 4, "2026-01-01"),
      ciclo("l2c1", 2, 1, "2026-07-10"),
    ], REF);
    expect(r.c1d1Date.data).toBe("2026-07-10");
    expect(r.c1d1Date.fonte).toBe("l2c1");
  });

  it("troca de linha sem C1 da nova linha: c1d1 PENDENTE AUSENTE, não cai na linha antiga", () => {
    const r = projetarDatasFixas([
      ciclo("l1c1", 1, 1, "2025-11-01"),
      ciclo("l2c2", 2, 2, "2026-07-30"),
    ], REF);
    expect(r.c1d1Date).toEqual({ data: null, estado: "PENDENTE", motivo: "AUSENTE", fonte: null, fontesConflitantes: [] });
  });

  it("administração não confirmada é ignorada para última exposição", () => {
    const r = projetarDatasFixas([
      administracao("a1", "adm-1", "2026-03-01"),
      administracao("a2", "adm-2", "2026-09-30", "COMPLETA", { revisao: "REVISAR" }),
      administracao("a3", "adm-3", "2026-08-01", "COMPLETA", { revisao: "INFERIDO" }),
    ], REF);
    expect(r.lastTreatmentDate.data).toBe("2026-03-01");
    expect(r.lastTreatmentDate.fonte).toBe("a1");
  });

  it("administração OMITIDA não conta como exposição", () => {
    const r = projetarDatasFixas([
      administracao("a1", "adm-1", "2026-03-01"),
      administracao("a2", "adm-2", "2026-09-30", "OMITIDA"),
    ], REF);
    expect(r.lastTreatmentDate.data).toBe("2026-03-01");
  });

  it("fato substituído por correção confirmada não conta", () => {
    const r = projetarDatasFixas([
      biopsia("b1", "2026-01-10"),
      biopsia("b2", "2026-01-12", { supersedesEventId: "b1" }),
    ], REF);
    expect(r.biopsyDate.data).toBe("2026-01-12");
    expect(r.biopsyDate.motivo).toBeNull();
  });

  it("conflito: biópsias confirmadas com datas diferentes ficam PENDENTE CONFLITO sem escolher", () => {
    const r = projetarDatasFixas([
      biopsia("b2", "2026-02-02"),
      biopsia("b1", "2026-01-10"),
    ], REF);
    expect(r.biopsyDate).toEqual({ data: null, estado: "PENDENTE", motivo: "CONFLITO", fonte: null, fontesConflitantes: ["b1", "b2"] });
    expect(r.diasDesde.c1d1).toBeNull();
  });

  it("conflito: mesma administração com datas diferentes bloqueia a última exposição", () => {
    const r = projetarDatasFixas([
      administracao("a1", "adm-1", "2026-03-01"),
      administracao("a1b", "adm-1", "2026-03-09"),
      administracao("a2", "adm-2", "2026-02-01"),
    ], REF);
    expect(r.lastTreatmentDate.estado).toBe("PENDENTE");
    expect(r.lastTreatmentDate.motivo).toBe("CONFLITO");
    expect(r.lastTreatmentDate.fontesConflitantes).toEqual(["a1", "a1b"]);
  });

  it("conflito: estadiamento e reestadiamento na mesma data não elegem tipo", () => {
    const r = projetarDatasFixas([
      estadiamento("s1", "STAGING", "2026-04-04"),
      estadiamento("r1", "RESTAGING", "2026-04-04"),
    ], REF);
    expect(r.lastStagingDate.estado).toBe("PENDENTE");
    expect(r.lastStagingDate.motivo).toBe("CONFLITO");
    expect(r.lastStagingDate.tipo).toBeNull();
    expect(r.lastStagingDate.fontesConflitantes).toEqual(["r1", "s1"]);
  });

  it("dias desde C1D1, último tratamento e último reestadiamento são calculados contra dataReferencia", () => {
    const eventos = [
      ciclo("c1", 1, 1, "2026-09-28"),
      administracao("a1", "adm-1", "2026-10-01"),
      estadiamento("r1", "RESTAGING", "2026-07-08"),
    ];
    const r = projetarDatasFixas(eventos, "2026-10-08");
    expect(r.diasDesde).toEqual({ c1d1: 10, lastTreatment: 7, lastRestaging: 92 });
    const mesmoDia = projetarDatasFixas(eventos, "2026-10-01");
    expect(mesmoDia.diasDesde.lastTreatment).toBe(0);
  });

  it("dataReferencia inválida é recusada explicitamente, não substituída pelo relógio", () => {
    expect(() => projetarDatasFixas([], "2026-02-30")).toThrow(/dataReferencia civil inválida/);
    expect(() => projetarDatasFixas([], "08/10/2026")).toThrow(/dataReferencia civil inválida/);
  });

  it("determinismo e pureza: mesma entrada, mesmo resultado, ordem dos eventos irrelevante e entrada intacta", () => {
    const eventos = [
      biopsia("b1", "2026-01-10"),
      ciclo("c1", 1, 1, "2026-03-01"),
      estadiamento("r1", "RESTAGING", "2026-06-01"),
      administracao("a1", "adm-1", "2026-03-01"),
      administracao("a2", "adm-2", "2026-09-15"),
    ];
    const antes = JSON.stringify(eventos);
    const primeiro = projetarDatasFixas(eventos, REF);
    const segundo = projetarDatasFixas(eventos, REF);
    const invertido = projetarDatasFixas([...eventos].reverse(), REF);
    expect(segundo).toEqual(primeiro);
    expect(invertido).toEqual(primeiro);
    expect(JSON.stringify(eventos)).toBe(antes);
  });
});
