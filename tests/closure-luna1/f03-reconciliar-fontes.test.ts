import { describe, expect, it } from "vitest";
import { executarPipelineExtracao } from "../../src/orchestration/pipeline-extracao.js";
import { normalizarDataCivil } from "../../src/kernel/extracao/normalizacao.js";
import { lerDraft, salvarDraft } from "../../src/kernel/ledger/drafts.js";
import { confirmar } from "../../src/kernel/ledger/writeRouter.js";
import { ambienteHttp } from "../server/http-fixture.js";

const AGORA = "2026-10-08T12:00:00Z";
const PACIENTE = "paciente-sintetico-reconciliacao";
const ENCONTRO = "encontro-sintetico-reconciliacao";

async function post<T>(ambiente: Awaited<ReturnType<typeof ambienteHttp>>, rota: string, entrada: unknown) {
  const response = await ambiente.request(rota, "POST", JSON.stringify(entrada), ambiente.token, "application/json");
  return { status: response.status, data: JSON.parse(response.body) as T };
}

function cadastrarPaciente(ambiente: Awaited<ReturnType<typeof ambienteHttp>>) {
  salvarDraft(ambiente.db, { draftId: "seed-recon-paciente", patientId: PACIENTE,
    sourceId: "seed-recon-source", rawRef: "fixture-local-sintetica", payload: {}, diagnostics: [],
    revision: 0, criadoEm: AGORA });
  confirmar(ambiente.db, { operationId: "seed-recon-operation", patientId: PACIENTE, tumorLotId: null,
    encounterId: ENCONTRO, reviewDecisionId: "seed-recon-review", sessao: ambiente.sessoes.obter(ambiente.token)!,
    em: AGORA, registros: [{ draftId: "seed-recon-paciente", expectedRevision: 0,
      eventId: "seed-recon-paciente-event", tipo: "Paciente", payload: { patientId: PACIENTE,
        identificadores: [], nome: "Paciente Sintético Reconciliação", nascimento: null,
        sexoCadastral: "NAO_INFORMADO", divergencia: false }, fontes: [], revisao: "CONFIRMADO" }] });
}

async function vincularFonte(ambiente: Awaited<ReturnType<typeof ambienteHttp>>, draftId: string) {
  const draft = lerDraft(ambiente.db, draftId)!;
  const payload = draft.payload as { input: { sourceId: string }; state: {
    confirmationRequired: Array<{ id: string; kind: string }> } };
  const exception = payload.state.confirmationRequired.find((item) => item.kind === "UNLINKED_PATIENT");
  if (!exception) throw new Error("EXCECAO_UNLINKED_PENDENTE_AUSENTE");
  const response = await post<{ codigo: string }>(ambiente, "/consulta/rascunho/revisar", {
    exceptionId: exception.id, acao: "LIGAR_PACIENTE", patientId: PACIENTE,
    sourceId: payload.input.sourceId, draftId, expectedRevision: 0,
    encounterId: ENCONTRO, tumorLotId: null, idempotencyKey: `vinculo-${draftId}`,
  });
  expect(response).toMatchObject({ status: 200, data: { codigo: "VINCULO_REVISTO" } });
}

function salvarFonte(ambiente: Awaited<ReturnType<typeof ambienteHttp>>, args: {
  draftId: string; recordingId: string; sourceId: string; texto: string;
  sourceType?: "pathology" | "imaging_report" | "prescription" | "medical_note" | "nursing" | "plaud" | "administration";
  dataClinica?: string;
}) {
  const input = { recordingId: args.recordingId, sourceId: args.sourceId,
    sourceType: args.sourceType ?? "medical_note" as const, rawTranscript: args.texto };
  const state = executarPipelineExtracao(input);
  if (!state.segments[0]) throw new Error("SEGMENTO_SINTETICO_AUSENTE");
  if (args.dataClinica && !state.facts.some((fact) => normalizarDataCivil(fact.date) === normalizarDataCivil(args.dataClinica)))
    throw new Error("DATA_CLINICA_SINTETICA_NAO_EXTRAIDA");
  salvarDraft(ambiente.db, { draftId: args.draftId, patientId: null, sourceId: args.sourceId,
    rawRef: `fixture-local:${args.recordingId}`, payload: { kind: "EXTRACAO_RASCUNHO", input,
      state, alerts: [], alertasRads: [] }, diagnostics: ["VINCULO_MEDICO_PENDENTE"],
    revision: 0, criadoEm: AGORA });
}

describe("F03 HTTP · reconciliação local de fontes explicitamente vinculadas", () => {
  it("retorna proposta com repetição preservada, sem escrever fatos ou operações", async () => {
    const ambiente = await ambienteHttp();
    try {
      cadastrarPaciente(ambiente);
      await post(ambiente, "/consulta/contexto/selecionar", { patientId: PACIENTE,
        encounterId: ENCONTRO, tumorLotId: null });
      for (const suffix of ["a", "b"]) {
        salvarFonte(ambiente, { draftId: `draft-recon-${suffix}`, recordingId: `recording-recon-${suffix}`,
          sourceId: "documento-repetido-sintetico", texto: "Creatinina: 1,1 mg/dL em 08/10/2026.",
          dataClinica: "08/10/2026" });
        await vincularFonte(ambiente, `draft-recon-${suffix}`);
      }
      const beforeEvents = Number((ambiente.db.prepare("SELECT COUNT(*) AS n FROM clinical_event").get() as { n: number }).n);
      const beforeOperations = Number((ambiente.db.prepare("SELECT COUNT(*) AS n FROM operation").get() as { n: number }).n);
      const result = await post<{ codigo: string; decisaoClinicaTomada: boolean;
        fontes: Array<{ draftId: string; segmentId: string }>; fatos: Array<{ id: string }>;
        deduplicacao: { repeticoes: Array<{ fatoRepetidoIds: string[] }>; fatoRepetidoIds: string[] } }>(
        ambiente, "/consulta/rascunho/reconciliar", { draftIds: ["draft-recon-a", "draft-recon-b"] });
      expect(result).toMatchObject({ status: 200, data: { codigo: "RECONCILIACAO_PROPOSTA", decisaoClinicaTomada: false,
        contexto: { patientId: PACIENTE, encounterId: ENCONTRO, tumorLotId: null, dataClinica: "2026-10-08" },
        fontes: [{ draftId: "draft-recon-a" }, { draftId: "draft-recon-b" }] } });
      expect(result.data.fontes.every((source) => source.segmentId.length > 0)).toBe(true);
      expect(result.data.deduplicacao.repeticoes.length).toBeGreaterThan(0);
      expect(ambiente.db.prepare("SELECT COUNT(*) AS n FROM clinical_event").get()).toMatchObject({ n: beforeEvents });
      expect(ambiente.db.prepare("SELECT COUNT(*) AS n FROM operation").get()).toMatchObject({ n: beforeOperations });
      expect(lerDraft(ambiente.db, "draft-recon-a")?.revision).toBe(1);
      expect(result.data.fatos.length).toBeGreaterThanOrEqual(2);
      expect(result.data.deduplicacao.fatoRepetidoIds.every((id) => result.data.fatos.some((fact) => fact.id === id))).toBe(true);
    } finally { await ambiente.close(); }
  });

  it("mantém fontes vinculadas sem data clínica pendentes e não aceita contexto/autor do cliente", async () => {
    const ambiente = await ambienteHttp();
    try {
      cadastrarPaciente(ambiente);
      await post(ambiente, "/consulta/contexto/selecionar", { patientId: PACIENTE,
        encounterId: ENCONTRO, tumorLotId: null });
      salvarFonte(ambiente, { draftId: "draft-date-pending", recordingId: "recording-date-pending",
        sourceId: "source-date-pending", sourceType: "medical_note",
        texto: "Plano: fazer cisplatina.\nHemoglobina 12 g/dL em 08/10/2026." });
      await vincularFonte(ambiente, "draft-date-pending");
      salvarFonte(ambiente, { draftId: "draft-date-pending-2", recordingId: "recording-date-pending-2",
        sourceId: "source-date-pending-2", sourceType: "prescription",
        texto: "Carboplatina AUC 6 D1 em 08/10/2026." });
      await vincularFonte(ambiente, "draft-date-pending-2");
      const beforeEvents = Number((ambiente.db.prepare("SELECT COUNT(*) AS n FROM clinical_event").get() as { n: number }).n);
      const beforeOperations = Number((ambiente.db.prepare("SELECT COUNT(*) AS n FROM operation").get() as { n: number }).n);
      const invalid = await post<{ codigo: string }>(ambiente, "/consulta/rascunho/reconciliar", {
        draftIds: ["draft-date-pending", "draft-date-pending-2"], patientId: PACIENTE, medicoId: "falso",
      });
      expect(invalid.status).toBe(400);
      const result = await post<{ codigo: string }>(ambiente, "/consulta/rascunho/reconciliar", {
        draftIds: ["draft-date-pending", "draft-date-pending-2"],
      });
      expect(result).toMatchObject({ status: 409, data: { codigo: "DATA_CLINICA_PENDENTE" } });
      expect(lerDraft(ambiente.db, "draft-date-pending")).toMatchObject({ patientId: PACIENTE, revision: 1 });
      expect(ambiente.db.prepare("SELECT COUNT(*) AS n FROM clinical_event").get()).toMatchObject({ n: beforeEvents });
      expect(ambiente.db.prepare("SELECT COUNT(*) AS n FROM operation").get()).toMatchObject({ n: beforeOperations });
      expect(ambiente.db.prepare("SELECT COUNT(*) AS n FROM clinical_event WHERE tipo='ReviewDecision'").get())
        .toMatchObject({ n: 2 });
    } finally { await ambiente.close(); }
  });

  it("confronta plano e prescrição HTTP apenas com ambas as decisões persistidas e a mesma data clínica", async () => {
    const ambiente = await ambienteHttp();
    try {
      cadastrarPaciente(ambiente);
      await post(ambiente, "/consulta/contexto/selecionar", { patientId: PACIENTE,
        encounterId: ENCONTRO, tumorLotId: null });
      salvarFonte(ambiente, { draftId: "draft-plan-http", recordingId: "recording-plan-http",
        sourceId: "source-plan-http", texto: "Plano: cisplatina em 08/10/2026.",
        sourceType: "medical_note", dataClinica: "08/10/2026" });
      await vincularFonte(ambiente, "draft-plan-http");
      salvarFonte(ambiente, { draftId: "draft-prescription-http", recordingId: "recording-prescription-http",
        sourceId: "source-prescription-http", texto: "Carboplatina AUC 6 D1 em 08/10/2026.",
        sourceType: "prescription", dataClinica: "08/10/2026" });
      await vincularFonte(ambiente, "draft-prescription-http");
      const beforeEvents = Number((ambiente.db.prepare("SELECT COUNT(*) AS n FROM clinical_event").get() as { n: number }).n);
      const proposal = await post<{ codigo: string; decisaoClinicaTomada: boolean;
        conflitos: Array<{ reason: string; factIds: string[]; sourceIds: string[] }> }>(
        ambiente, "/consulta/rascunho/reconciliar", { draftIds: ["draft-plan-http", "draft-prescription-http"] });
      expect(proposal).toMatchObject({ status: 200, data: { codigo: "RECONCILIACAO_PROPOSTA", decisaoClinicaTomada: false } });
      const planned = proposal.data.conflitos.find((item) => item.reason.includes("planned_regimen"));
      expect(planned).toBeDefined();
      expect(planned?.sourceIds).toEqual(expect.arrayContaining(["source-plan-http", "source-prescription-http"]));
      expect(ambiente.db.prepare("SELECT COUNT(*) AS n FROM clinical_event").get()).toMatchObject({ n: beforeEvents });
    } finally { await ambiente.close(); }
  });
});
