import { describe, expect, it } from "vitest";
import type { ClinicalEvent } from "../../src/contracts/operacao.js";
import { labSeries } from "../../src/kernel/projections/series.js";
import { projetarSnapshot, type PropostaCurrent } from "../../src/kernel/projections/snapshot.js";

const PATIENT = "Paciente Teste 03";
const LOT = "tumor-teste-03";
const ENCOUNTER = "consulta-teste-03";
// Campo e unidade já usados pela projeção de LabResult; números são apenas dados sintéticos.
const FIELD = "Hb";

interface LabOptions {
  criadoEm?: string;
  revisao?: ClinicalEvent["revisao"];
  observacaoDatada?: boolean;
}

function lab(
  id: string, valor: number | null, data: string | null, options: LabOptions = {},
): ClinicalEvent {
  const criadoEm = options.criadoEm ?? "2026-10-05T12:00:00.000Z";
  const sourceId = `fonte-${id}`;
  return {
    eventId: id, operationId: `op-${id}`, eventIndex: 0,
    patientId: PATIENT, tumorLotId: LOT, encounterId: ENCOUNTER,
    criadoEm, tipo: "LabResult", revisao: options.revisao ?? "CONFIRMADO",
    criadoPor: { tipo: "SESSAO", id: "medico-teste" }, supersedesEventId: null,
    fontes: [{
      sourceId, classe: "DOCUMENT", localizador: null, dataClinica: data,
      dataCaptura: criadoEm, versao: "fixture-1", contentHash: `hash-${id}`,
    }],
    payload: { data: {
      campo: FIELD, valor, unidade: "g/dL", sourceId,
      ...(data === null ? {} : { data, dataClinica: data }),
      ...(options.observacaoDatada ? { observacaoDatada: true } : {}),
    } },
  };
}

function snapshot(eventos: readonly ClinicalEvent[], propostas: readonly PropostaCurrent[] = []) {
  return projetarSnapshot(eventos, PATIENT, LOT, ENCOUNTER, "w10-temporal-test-v1", propostas);
}

describe("FUGU-EIXO-03 · projeções temporais reais de laboratório", () => {
  it("data e fonte em LabResult não bastam para classificar a medida como VERDE", () => {
    // Caminho adversarial: LabResult confirmado com data, mas sem marcador/critério de validade clínica.
    const evento = lab("lab-somente-data", 12, "2026-10-05");
    expect(labSeries([evento])).toEqual([{
      campo: FIELD, valor: 12, unidade: "g/dL", data: "2026-10-05",
      sourceId: "fonte-lab-somente-data", eventId: evento.eventId, tumorLotId: LOT,
    }]);
    expect(snapshot([evento]).campos[FIELD]).toMatchObject({
      valor: 12, eventIds: [evento.eventId], estado: "PENDENTE",
    });
  });

  it("observações explicitamente datadas conservam o histórico sem validar o valor pela data mais recente", () => {
    const anterior = lab("lab-anterior", 12, "2026-10-05", { observacaoDatada: true });
    const recente = lab("lab-recente", 11, "2026-10-06", {
      observacaoDatada: true, criadoEm: "2026-10-06T12:00:00.000Z",
    });
    const campo = snapshot([recente, anterior]).campos[FIELD];
    expect(campo).toMatchObject({ valor: 11, eventIds: [recente.eventId], estado: "PENDENTE" });
    expect(campo?.observacoes).toEqual([
      { valor: 12, eventId: anterior.eventId, dataClinica: "2026-10-05" },
      { valor: 11, eventId: recente.eventId, dataClinica: "2026-10-06" },
    ]);
  });

  it("medida RAW datada não vira fato; proposta CURRENT preserva ausência confirmada", () => {
    const bruto = lab("lab-rascunho", 12, "2026-10-05", { revisao: "RAW" });
    expect(labSeries([bruto])).toEqual([]);
    expect(snapshot([bruto]).campos[FIELD]).toBeUndefined();
    expect(snapshot([bruto]).eventIds).toEqual([]);

    const atual = snapshot([bruto], [{
      campo: FIELD, valor: 12, sourceId: "fonte-lab-rascunho",
    }]);
    expect(atual.kind).toBe("CURRENT");
    expect(atual.campos[FIELD]).toEqual({
      valor: null, eventIds: [], estado: "PENDENTE",
      proposta: { valor: 12, sourceId: "fonte-lab-rascunho" },
    });
  });

  it("valor nulo ou data clínica ausente não são completados pela projeção", () => {
    const semValor = lab("lab-sem-valor", null, "2026-10-05", { observacaoDatada: true });
    expect(labSeries([semValor])).toEqual([]);
    expect(snapshot([semValor]).campos[FIELD]).toMatchObject({
      valor: null, eventIds: [semValor.eventId], estado: "PENDENTE",
    });

    const semData = lab("lab-sem-data", 12, null);
    expect(labSeries([semData])).toEqual([]);
    expect(snapshot([semData]).campos[FIELD]).toMatchObject({
      valor: 12, eventIds: [semData.eventId], estado: "PENDENTE",
    });
  });

  it("valores divergentes no mesmo dia seguem em conflito após observação posterior", () => {
    const a = lab("lab-conflito-a", 11, "2026-10-05", { observacaoDatada: true });
    const b = lab("lab-conflito-b", 12, "2026-10-05", {
      observacaoDatada: true, criadoEm: "2026-10-05T13:00:00.000Z",
    });
    const posterior = lab("lab-posterior", 13, "2026-10-06", {
      observacaoDatada: true, criadoEm: "2026-10-06T12:00:00.000Z",
    });
    const candidatos = [
      { valor: 11, eventId: a.eventId },
      { valor: 12, eventId: b.eventId },
    ];

    const mesmoDia = snapshot([b, a]).campos[FIELD];
    expect(mesmoDia).toMatchObject({ valor: null, estado: "VERMELHO" });
    expect(mesmoDia?.candidatos).toEqual(candidatos);

    const comPosterior = snapshot([posterior, b, a]).campos[FIELD];
    expect(comPosterior).toMatchObject({ valor: null, estado: "VERMELHO" });
    expect(comPosterior?.candidatos).toEqual(candidatos);
    expect(comPosterior?.observacoes).toEqual([
      { valor: 11, eventId: a.eventId, dataClinica: "2026-10-05" },
      { valor: 12, eventId: b.eventId, dataClinica: "2026-10-05" },
      { valor: 13, eventId: posterior.eventId, dataClinica: "2026-10-06" },
    ]);
    expect(labSeries([posterior, b, a])
      .map(({ eventId, sourceId, data }) => ({ eventId, sourceId, data }))
      .sort((x, y) => x.eventId.localeCompare(y.eventId))).toEqual([
      { eventId: a.eventId, sourceId: "fonte-lab-conflito-a", data: "2026-10-05" },
      { eventId: b.eventId, sourceId: "fonte-lab-conflito-b", data: "2026-10-05" },
      { eventId: posterior.eventId, sourceId: "fonte-lab-posterior", data: "2026-10-06" },
    ]);
  });
});
