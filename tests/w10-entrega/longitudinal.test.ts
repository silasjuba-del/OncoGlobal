import { describe, expect, it } from "vitest";
import type { ClinicalFact } from "../../src/contracts/w10/extracao.js";
import type { ClinicalEvent } from "../../src/contracts/operacao.js";
import { reconciliarCampos } from "../../src/kernel/extracao/reconciliacao.js";
import { projetarSnapshot } from "../../src/kernel/projections/snapshot.js";
import { avaliarSerieRecist, type RecistPontoSerie, type RecistSerieInput } from "../../src/rules/recist/index.js";
import { projetarEstatistica } from "../../src/estatistica/index.js";

function lab(id: string, value: number, date?: string): ClinicalFact {
  return {
    id, segmentId: "seg-1", patientCandidateId: "patient-1", domain: "lab",
    value: { marker: "CREATININA", normalizado: true, value, unit: "mg/dL" },
    sourceType: "pathology", evidence: "EXPLICIT", sourceId: `src-${id}`, rawEvidence: `Creatinina ${value}`,
    ...(date ? { date } : {}), confidence: 1, requiresConfirmation: false,
  };
}

function event(
  eventId: string, campo: string, valor: unknown, options: {
    criadoEm?: string; supersedesEventId?: string | null; tumorLotId?: string | null;
    encounterId?: string; dataClinica?: string; observacaoDatada?: boolean; sourceId?: string;
  } = {},
): ClinicalEvent {
  const { criadoEm = "2030-01-01T12:00:00Z", supersedesEventId = null,
    tumorLotId = "lot-1", encounterId = "enc-1" } = options;
  return {
    eventId, operationId: `op-${eventId}`, eventIndex: 0, patientId: "patient-1", tumorLotId,
    encounterId, tipo: "FATO", payload: { data: { campo, valor,
      ...(options.dataClinica ? { dataClinica: options.dataClinica } : {}),
      ...(options.observacaoDatada ? { observacaoDatada: true } : {}),
      ...(options.sourceId ? { sourceId: options.sourceId } : {}) } },
    fontes: options.sourceId ? [{ sourceId: options.sourceId, classe: "DOCUMENT", localizador: null,
      dataClinica: options.dataClinica ?? null, dataCaptura: criadoEm, versao: "1", contentHash: `hash-${options.sourceId}` }] : [],
    revisao: "CONFIRMADO", criadoEm, criadoPor: { tipo: "SESSAO", id: "medico-1" },
    supersedesEventId,
  };
}

const snapshot = (events: readonly ClinicalEvent[], encounterId = "enc-1", lotId: string | null = "lot-1") =>
  projetarSnapshot(events, "patient-1", lotId, encounterId, "w10-test-v1");

describe("W10 longitudinal delivery", () => {
  it("keeps different clinical lab dates as separate observations for one marker", () => {
    const fields = reconciliarCampos([lab("lab-1", 1.1, "2030-01-01"), lab("lab-2", 1.4, "2030-01-02")]);
    expect(Object.keys(fields)).toHaveLength(2);
    expect(Object.values(fields).every((field) => field.conflict === false)).toBe(true);
  });

  it("keeps same-day divergent lab results in conflict and never resolves unknown dates", () => {
    const sameDay = reconciliarCampos([lab("lab-1", 1.1, "2030-01-01"), lab("lab-2", 1.4, "2030-01-01")]);
    expect(Object.values(sameDay)).toHaveLength(1);
    expect(Object.values(sameDay)[0]?.conflict).toBe(true);
    const unknown = reconciliarCampos([lab("lab-3", 1.1), lab("lab-4", 1.4)]);
    expect(Object.values(unknown)).toHaveLength(1);
    expect(Object.values(unknown)[0]?.conflict).toBe(true);
    expect(Object.values(unknown)[0]?.resolvedFactId).toBeNull();
  });

  it("uses only explicit clinical dates for observation history and preserves same-day conflicts", () => {
    const dated = snapshot([
      event("obs-1", "peso", 70, { dataClinica: "2030-01-01", observacaoDatada: true }),
      event("obs-2", "peso", 68, { criadoEm: "2030-01-01T13:00:00Z", dataClinica: "2030-02-01", observacaoDatada: true }),
    ]).campos.peso;
    expect(dated?.valor).toBe(68);
    // Data clínica não é uma regra de validade ou normalidade do serviço.
    expect(dated?.estado).toBe("PENDENTE");
    expect(dated?.observacoes?.map((item) => item.valor)).toEqual([70, 68]);

    const sameDayConflict = snapshot([
      event("obs-3", "peso", 70, { dataClinica: "2030-01-01", observacaoDatada: true }),
      event("obs-4", "peso", 68, { criadoEm: "2030-01-02T13:00:00Z", dataClinica: "2030-01-01", observacaoDatada: true }),
    ]).campos.peso;
    expect(sameDayConflict).toMatchObject({ valor: null, estado: "VERMELHO" });

    const generic = snapshot([
      event("generic-1", "regimen", "A"), event("generic-2", "regimen", "B", { criadoEm: "2030-02-01T12:00:00Z" }),
    ]).campos.regimen;
    expect(generic).toMatchObject({ valor: null, estado: "VERMELHO" });

    const datedAndUndated = snapshot([
      event("obs-5", "dose", 100, { dataClinica: "2030-01-01", observacaoDatada: true }),
      event("generic-3", "dose", 120, { criadoEm: "2030-02-01T12:00:00Z" }),
    ]).campos.dose;
    expect(datedAndUndated).toMatchObject({ valor: null, estado: "VERMELHO" });
  });

  it("keeps TNM supersession history within patient, encounter, lot, and snapshot horizon", () => {
    const events: ClinicalEvent[] = [
      event("tnm-old", "TNM", "cT2N0M0", { dataClinica: "2030-01-01", sourceId: "doc-old" }),
      event("tnm-new", "TNM", "cT3N1M0", { criadoEm: "2030-02-01T12:00:00Z", dataClinica: "2030-02-01", sourceId: "doc-new", supersedesEventId: "tnm-old" }),
      event("other-lot", "TNM", "pT4N2M1", { tumorLotId: "lot-2", criadoEm: "2030-02-02T12:00:00Z" }),
      event("other-encounter", "TNM", "pT4N2M1", { encounterId: "enc-2", criadoEm: "2030-02-03T12:00:00Z" }),
      { ...event("raw-stage", "TNM", "pT4N2M1", { criadoEm: "2030-01-15T12:00:00Z" }), revisao: "RAW" as const },
    ];
    const result = snapshot(events);
    expect(result.campos.TNM?.valor).toBe("cT3N1M0");
    expect(result.stageHistory).toEqual([
      { valor: "cT2N0M0", eventId: "tnm-old", data: "2030-01-01", sourceIds: ["doc-old"], revisaoOriginal: "CONFIRMADO", superseded: true },
      { valor: "cT3N1M0", eventId: "tnm-new", data: "2030-02-01", sourceIds: ["doc-new"], revisaoOriginal: "CONFIRMADO", superseded: false },
    ]);
  });

  it("does not make a 14 mm short-axis lymph node an eligible target", () => {
    const baseline: RecistPontoSerie = {
      eventId: "recist-base", patientId: "patient-1", tumorLotId: "lot-1", episodioId: "episode-1",
      data: "2030-01-01", metodo: "TC", tecnicaId: "tc-1", espessuraCorteMm: 5,
      qualidadeMedicao: "ADEQUADA", lesoes: [{ codigo: "ln-1", diametroMm: 14, fonteIds: ["src-base"] }],
      novasLesoes: false, naoAlvos: "AUSENTE_DOCUMENTADO", fonteIds: ["src-base"],
    };
    const result = avaliarSerieRecist({
      patientId: "patient-1", tumorLotId: "lot-1", episodioId: "episode-1", baselineEventId: "recist-base",
      alvos: [{ codigo: "ln-1", tipo: "LINFONODO", eixo: "CURTO", orgaoId: "node-1",
        elegibilidadeBasal: "NAO_ELEGIVEL", fonteElegibilidadeIds: ["src-rule"] }], pontos: [baseline],
    } satisfies RecistSerieInput);
    expect(result.estadoInterpretacao).toBe("PENDENTE");
    expect(result.pendencias).toContain("ALVO_BASAL_NAO_ELEGIVEL");
    expect(result.pontos.every((point) => point.categoriaGlobal === null && point.avaliacao === null)).toBe(true);
  });

  it("does not propose PD for 36 percent growth when the absolute increase is below 5 mm", () => {
    const point = (eventId: string, data: string, diameter: number): RecistPontoSerie => ({
      eventId, patientId: "patient-1", tumorLotId: "lot-1", episodioId: "episode-1", data,
      metodo: "TC", tecnicaId: "tc-1", espessuraCorteMm: 5, qualidadeMedicao: "ADEQUADA",
      lesoes: [{ codigo: "mass-1", diametroMm: diameter, fonteIds: [`src-${eventId}`] }],
      novasLesoes: false, naoAlvos: "AUSENTE_DOCUMENTADO", fonteIds: [`src-${eventId}`],
    });
    const result = avaliarSerieRecist({
      patientId: "patient-1", tumorLotId: "lot-1", episodioId: "episode-1", baselineEventId: "recist-base",
      alvos: [{ codigo: "mass-1", tipo: "NAO_NODAL", eixo: "MAIOR", orgaoId: "organ-1",
        elegibilidadeBasal: "ELEGIVEL", fonteElegibilidadeIds: ["src-rule"] }],
      pontos: [point("recist-base", "2030-01-01", 12), point("recist-followup", "2030-02-01", 16.3)],
    } satisfies RecistSerieInput);
    const followup = result.pontos.find((item) => item.eventId === "recist-followup");
    expect(followup?.calculo?.deltaNadirPct).toBeCloseTo(35.833, 2);
    expect(followup?.calculo?.deltaNadirMm).toBeCloseTo(4.3, 2);
    expect(followup?.calculo?.progressaoAlvos).toBeNull();
  });

  it("labels the statistical denominator and exclusions without claiming a clinical period", () => {
    const output = projetarEstatistica([]);
    expect(output).toMatchObject({ escopo: "LEDGER_COMPLETO", periodoClinico: null, denominadorPacientes: 0,
      exclusoes: { eventosNaoConfirmados: 0, eventosSupersedidos: 0, linhasDuplicadas: 0,
        administracoesInvalidas: 0, administracoesConflito: 0 } });
  });
});
