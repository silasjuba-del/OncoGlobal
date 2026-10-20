import { afterEach, describe, expect, it } from "vitest";
import type { ClinicalEvent } from "../../src/contracts/operacao.js";
import { Fonte } from "../../src/contracts/base.js";
import { abrirLedger } from "../../src/kernel/ledger/db.js";
import { lerTimelineMulticamadas } from "../../src/server/timelineMulticamadas.js";

// Casos sintéticos: projeção somente leitura, sem regras clínicas ou coordenadas inferidas.
const contexto = { patientId: "paciente-sintetico", encounterId: "consulta-atual", tumorLotId: "lote-a" };
const agora = "2026-11-20T12:00:00-03:00";
const fonte = (id: string, dataClinica: string | null = null) => Fonte.parse({
  sourceId: id, classe: "DOCUMENT", localizador: "pagina:1", dataClinica,
  dataCaptura: "2026-11-20T10:00:00-03:00", versao: "sintetica-v1", contentHash: `hash-${id}`,
});

let dbs: ReturnType<typeof abrirLedger>[] = [];
afterEach(() => { for (const db of dbs.splice(0)) db.close(); });

function db() { const value = abrirLedger(":memory:"); dbs.push(value); return value; }
function evento(input: {
  id: string; tipo: string; dados: unknown; patientId?: string; encounterId?: string; tumorLotId?: string | null;
  criadoEm?: string; revisao?: "CONFIRMADO" | "ASSINADO"; supersedesEventId?: string | null; fontes?: ReturnType<typeof fonte>[];
}): ClinicalEvent {
  return { eventId: input.id, operationId: `op-${input.id}`, eventIndex: 0,
    patientId: input.patientId ?? contexto.patientId, encounterId: input.encounterId ?? contexto.encounterId,
    tumorLotId: input.tumorLotId === undefined ? contexto.tumorLotId : input.tumorLotId,
    tipo: input.tipo, payload: { data: input.dados, reviewDecisionId: `review-${input.id}` },
    fontes: input.fontes ?? [fonte(`source-${input.id}`)], revisao: input.revisao ?? "CONFIRMADO",
    criadoEm: input.criadoEm ?? "2026-11-19T10:00:00-03:00",
    criadoPor: { tipo: "SESSAO", id: "medico-sintetico" }, supersedesEventId: input.supersedesEventId ?? null };
}
function seed(database: ReturnType<typeof abrirLedger>, ...events: ClinicalEvent[]) {
  for (const event of events) {
    database.prepare("INSERT INTO operation (operationId,payloadHash,resultRef,criadoEm) VALUES (?,?,?,?)")
      .run(event.operationId, `hash-${event.operationId}`, null, event.criadoEm);
    database.prepare(`INSERT INTO clinical_event
      (eventId,operationId,eventIndex,patientId,tumorLotId,encounterId,tipo,payload,fontes,revisao,criadoEm,criadoPor,supersedesEventId)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(event.eventId, event.operationId, event.eventIndex, event.patientId,
      event.tumorLotId, event.encounterId, event.tipo, JSON.stringify(event.payload), JSON.stringify(event.fontes),
      event.revisao, event.criadoEm, JSON.stringify(event.criadoPor), event.supersedesEventId);
  }
}

describe("timeline multicamadas real", () => {
  it.each([
    { caso: "reprogramação posterior não reescreve atraso histórico", criadoEm: "2026-11-15T10:00:00-03:00",
      versao: 1, substitui: true, lote: contexto.tumorLotId, esperada: "2026-11-01", atraso: 9 },
    { caso: "outra versão de prescrição não muda a administração original", criadoEm: "2026-11-09T10:00:00-03:00",
      versao: 2, substitui: true, lote: contexto.tumorLotId, esperada: "2026-11-01", atraso: 9 },
    { caso: "ciclo de lote nulo não substitui o planejamento do lote", criadoEm: "2026-11-09T10:00:00-03:00",
      versao: 1, substitui: false, lote: null, esperada: "2026-11-01", atraso: 9 },
    { caso: "planejamentos concorrentes sem substituição ficam indeterminados", criadoEm: "2026-11-09T10:00:00-03:00",
      versao: 1, substitui: false, lote: contexto.tumorLotId, esperada: null, atraso: null },
    { caso: "operações no mesmo instante não provam a ordem da reprogramação", criadoEm: "2026-11-10T12:00:00-03:00",
      versao: 1, substitui: true, lote: contexto.tumorLotId, esperada: null, atraso: null },
    { caso: "reprogramação anterior conhecida fornece a data revisada", criadoEm: "2026-11-09T10:00:00-03:00",
      versao: 1, substitui: true, lote: contexto.tumorLotId, esperada: "2026-11-08", atraso: 2 },
  ])("$caso", ({ criadoEm, versao, substitui, lote, esperada, atraso }) => {
    const database = db();
    const ciclo = { cicloId: "ciclo-historico", episodioId: "ep1", numero: 1, previstoEm: "2026-11-01",
      prescricaoRef: { documentId: "rx-historica", documentVersion: 1 }, itens: [], comMedico: true };
    seed(database,
      evento({ id: "ciclo-original", tipo: "Ciclo", criadoEm: "2026-10-20T10:00:00-03:00", dados: ciclo }),
      evento({ id: "ciclo-revisado", tipo: "Ciclo", criadoEm, tumorLotId: lote,
        supersedesEventId: substitui ? "ciclo-original" : null,
        dados: { ...ciclo, previstoEm: "2026-11-08",
          prescricaoRef: { documentId: "rx-historica", documentVersion: versao } } }),
      evento({ id: "admin-historica", tipo: "TreatmentAdministration", criadoEm: "2026-11-10T12:00:00-03:00",
        dados: { adminId: "admin-historica", cicloId: "ciclo-historico", prescricaoRef: ciclo.prescricaoRef,
          item: 1, droga: "Fármaco sintético", quantidadeEfetivaMg: 100, status: "COMPLETA",
          motivo: null, inicio: "2026-11-10T10:00:00-03:00", fim: null, fonte: fonte("admin-historica") } }),
    );
    expect(lerTimelineMulticamadas(database, contexto, agora).eventos.find(e => e.eventId === "admin-historica"))
      .toMatchObject({ dataPlanejada: esperada, tratamento: { atrasoDias: atraso }, dataClinica: "2026-11-10T10:00:00-03:00" });
  });

  it("data prevista explícita inválida não é substituída silenciosamente pela data do ciclo", () => {
    const database = db();
    const prescricaoRef = { documentId: "rx-sintetica", documentVersion: 1 };
    seed(database,
      evento({ id: "ciclo", tipo: "Ciclo", dados: { cicloId: "ciclo", previstoEm: "2026-11-01", prescricaoRef } }),
      evento({ id: "admin", tipo: "TreatmentAdministration", dados: {
        adminId: "admin", cicloId: "ciclo", prescricaoRef, item: 1, droga: "Fármaco sintético",
        quantidadeEfetivaMg: 100, status: "COMPLETA", motivo: null, inicio: "2026-11-10T10:00:00-03:00",
        fim: null, fonte: fonte("admin"), dataPrevista: "não consta",
      } }),
    );
    expect(lerTimelineMulticamadas(database, contexto, agora).eventos.find(e => e.eventId === "admin"))
      .toMatchObject({ dataPlanejada: null, tratamento: { atrasoDias: null } });
  });

  it("mantém encontros históricos do lote, inclui escopo paciente e exclui outro paciente/lote", () => {
    const database = db();
    seed(database,
      evento({ id: "biopsy-old-encounter", tipo: "Biopsy", encounterId: "consulta-anterior",
        dados: { dataClinica: "2026-09-01", tipo: "Biópsia pulmonar" } }),
      evento({ id: "weight-other-lot", tipo: "Weight", encounterId: "consulta-anterior", tumorLotId: "lote-b",
        dados: { kg: 64, origem: "MEDIDO", data: "2026-10-01", sourceId: "source-weight" } }),
      evento({ id: "lab-other-lot", tipo: "LabResult", encounterId: "consulta-anterior", tumorLotId: "lote-b",
        dados: { campo: "hemoglobina", valor: 8.2, unidade: "g/dL", data: "2026-10-02", sourceId: "source-hb" } }),
      evento({ id: "comorbidity-global", tipo: "FATO", encounterId: "consulta-anterior", tumorLotId: "lote-b",
        dados: { campo: "comorbidades", valor: ["comorbidade sintética"] } }),
      evento({ id: "document-global", tipo: "DOCUMENTO", encounterId: "consulta-anterior", tumorLotId: null,
        dados: { data: { documentId: "doc-global", documentVersion: 1, texto: "Documento do paciente sintético." }, signature: {} } }),
      evento({ id: "admin-other-lot", tipo: "TreatmentAdministration", encounterId: "consulta-anterior", tumorLotId: "lote-b",
        dados: { adminId: "admin-other-lot", cicloId: "ciclo-b", prescricaoRef: { documentId: "rx-b", documentVersion: 1 },
          item: 1, droga: "Fármaco de outro lote", quantidadeEfetivaMg: 80, status: "COMPLETA", motivo: null,
          inicio: "2026-10-02T10:00:00-03:00", fim: null, fonte: fonte("source-admin-other-lot") } }),
      evento({ id: "staging-other-lot", tipo: "Staging", encounterId: "consulta-anterior", tumorLotId: "lote-b",
        dados: { dataClinica: "2026-10-02", tipo: "STAGING", tnm: "cT1N0M0" } }),
      evento({ id: "other-patient-biopsy", tipo: "Biopsy", patientId: "outro-paciente", tumorLotId: "lote-a",
        dados: { dataClinica: "2026-10-03" } }),
      evento({ id: "old-encounter-symptom", tipo: "FATO", encounterId: "consulta-anterior",
        dados: { campo: "extracao.symptom", domain: "symptom", valor: "náusea", rawEvidence: "Paciente relata náusea." } }),
    );

    const view = lerTimelineMulticamadas(database, contexto, agora);
    expect(view.contexto).toEqual(contexto);
    expect(view.eventos.map(item => item.eventId)).toContain("biopsy-old-encounter");
    expect(view.eventos.map(item => item.eventId)).toContain("old-encounter-symptom");
    expect(view.eventos.find(item => item.eventId === "weight-other-lot")).toMatchObject({ trilha: "FISIOLOGIA" });
    expect(view.eventos.find(item => item.eventId === "lab-other-lot")).toMatchObject({ trilha: "FISIOLOGIA", dataClinica: "2026-10-02" });
    expect(view.eventos.find(item => item.eventId === "comorbidity-global")).toMatchObject({ trilha: "DEFINIDORES" });
    expect(view.eventos.map(item => item.eventId)).toContain("document-global");
    expect(view.eventos.map(item => item.eventId)).not.toContain("admin-other-lot");
    expect(view.eventos.map(item => item.eventId)).not.toContain("staging-other-lot");
    expect(view.eventos.map(item => item.eventId)).not.toContain("other-patient-biopsy");
  });

  it("preserva superseded, trecho/fonte e não usa data de registro como data clínica", () => {
    const database = db();
    const old = evento({ id: "stage-old", tipo: "FATO", criadoEm: "2026-10-01T10:00:00-03:00",
      dados: { campo: "TNM", domain: "stage", valor: "cT2N1M0", rawEvidence: "Estadiamento sintético antigo." } });
    seed(database, old,
      evento({ id: "stage-new", tipo: "FATO", criadoEm: "2026-11-01T10:00:00-03:00", supersedesEventId: old.eventId,
        fontes: [fonte("source-stage-new", "2026-10-25")],
        dados: { campo: "TNM", domain: "stage", valor: "cT3N1M0", rawEvidence: "Estadiamento sintético revisado.", dataClinica: "2026-10-25" } }),
      evento({ id: "stage-future-invalid", tipo: "FATO", supersedesEventId: "stage-new",
        dados: { campo: "TNM", domain: "stage", valor: "cT4N1M0", dataClinica: "2026-12-01" } }),
      evento({ id: "document-unknown-date", tipo: "DOCUMENTO", revisao: "ASSINADO", criadoEm: "2026-11-05T10:00:00-03:00",
        fontes: [fonte("source-document-unknown")],
        dados: { data: { documentId: "doc-synthetic", documentVersion: 1, texto: "Documento sintético sem data clínica." }, signature: {} } }),
    );

    const view = lerTimelineMulticamadas(database, contexto, agora);
    expect(view.eventos.find(item => item.eventId === "stage-old")).toMatchObject({ supersedido: true,
      dataClinica: null, dataRegistro: old.criadoEm, trecho: "Estadiamento sintético antigo." });
    expect(view.eventos.find(item => item.eventId === "stage-new")).toMatchObject({ supersedido: false,
      dataClinica: "2026-10-25", fontes: [fonte("source-stage-new", "2026-10-25")] });
    expect(view.eventos.map(item => item.eventId)).not.toContain("stage-future-invalid");
    expect(view.eventos.find(item => item.eventId === "document-unknown-date")).toMatchObject({ dataClinica: null,
      dataRegistro: "2026-11-05T10:00:00-03:00", trecho: "Documento sintético sem data clínica." });
    expect(view.revisao).toMatch(/^[a-f0-9]{64}$/);
  });

  it("distingue planejado, prescrito, administrado, omitido e atraso observado sem inferir adiamento", () => {
    const database = db();
    seed(database,
      evento({ id: "cycle-planned", tipo: "Ciclo", dados: { cicloId: "ciclo-planejado", episodioId: "ep1", numero: 1,
        previstoEm: "2026-12-01", prescricaoRef: null, itens: [], comMedico: false } }),
      evento({ id: "cycle-prescribed", tipo: "Ciclo", dados: { cicloId: "ciclo-prescrito", episodioId: "ep1", numero: 2,
        previstoEm: "2026-11-01", prescricaoRef: { documentId: "rx-sintetica", documentVersion: 1 }, itens: [], comMedico: true } }),
      evento({ id: "admin-late", tipo: "TreatmentAdministration", dados: { adminId: "admin-late", cicloId: "ciclo-prescrito",
        prescricaoRef: { documentId: "rx-sintetica", documentVersion: 1 }, item: 1, droga: "Fármaco sintético",
        quantidadeEfetivaMg: 100, status: "COMPLETA", motivo: null, inicio: "2026-11-10T10:00:00-03:00",
        fim: null, fonte: fonte("source-admin"), dataClinica: "2026-11-10", dataPrevista: "2026-11-01" } }),
      evento({ id: "admin-omitted", tipo: "TreatmentAdministration", dados: { adminId: "admin-omitted", cicloId: "ciclo-omitido",
        prescricaoRef: { documentId: "rx-sintetica", documentVersion: 1 }, item: 1, droga: "Fármaco sintético",
        quantidadeEfetivaMg: 0, status: "OMITIDA", motivo: "Motivo sintético", inicio: null, fim: null,
        fonte: fonte("source-omitted"), dataClinica: "2026-11-15" } }),
      evento({ id: "delay-explicit", tipo: "FATO", dados: { campo: "plano.acaoComposta", valor: {
        tipo: "ADIAR_CICLO", motivo: "Decisão sintética assinada", antes: { previstoEm: "2026-11-21" },
        depois: { previstoEm: "2026-11-28" },
      } } }),
      evento({ id: "future-clinical-lab", tipo: "LabResult", dados: { campo: "hemoglobina", valor: 9, unidade: "g/dL",
        data: "2026-12-01", sourceId: "source-future-lab" } }),
      evento({ id: "future-superseded-base", tipo: "Biopsy", dados: { dataClinica: "2026-11-01" } }),
      evento({ id: "future-created", tipo: "Biopsy", criadoEm: "2026-11-21T10:00:00-03:00",
        supersedesEventId: "future-superseded-base", dados: { dataClinica: "2026-11-02" } }),
    );

    const view = lerTimelineMulticamadas(database, contexto, agora);
    expect(view.eventos.find(item => item.eventId === "cycle-planned")).toMatchObject({
      dataClinica: null, dataPlanejada: "2026-12-01", tratamento: { estado: "PLANEJADO" },
    });
    expect(view.eventos.find(item => item.eventId === "cycle-prescribed")?.tratamento?.estado).toBe("PRESCRITO");
    expect(view.eventos.find(item => item.eventId === "admin-late")?.tratamento)
      .toMatchObject({ estado: "ADMINISTRADO", atrasoDias: 9 });
    expect(view.eventos.find(item => item.eventId === "admin-omitted")?.tratamento?.estado).toBe("OMITIDO");
    expect(view.eventos.find(item => item.eventId === "delay-explicit")).toMatchObject({
      categoria: "ADIAMENTO", tratamento: { estado: "ADIADO" }, dataClinica: null, dataPlanejada: "2026-11-28",
    });
    expect(view.eventos.map(item => item.eventId)).not.toContain("future-clinical-lab");
    expect(view.eventos.map(item => item.eventId)).not.toContain("future-created");
    expect(view.eventos.find(item => item.eventId === "future-superseded-base")?.supersedido).toBe(false);
  });
});
