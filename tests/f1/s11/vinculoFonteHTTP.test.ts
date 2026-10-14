import { describe, expect, it } from "vitest";
import { executarPipelineExtracao } from "../../../src/orchestration/pipeline-extracao.js";
import { normalizarDataCivil } from "../../../src/kernel/extracao/normalizacao.js";
import { lerDraft, salvarDraft } from "../../../src/kernel/ledger/drafts.js";
import { confirmar } from "../../../src/kernel/ledger/writeRouter.js";
import { ambienteHttp } from "../../server/http-fixture.js";

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
  dataClinica?: string; versao?: string;
}) {
  const input = { recordingId: args.recordingId, sourceId: args.sourceId,
    sourceType: args.sourceType ?? "medical_note" as const, rawTranscript: args.texto,
    ...(args.versao ? { examIdentity: { tipo: "OUTRO" as const, versao: args.versao } } : {}) };
  const state = executarPipelineExtracao(input);
  if (!state.segments[0]) throw new Error("SEGMENTO_SINTETICO_AUSENTE");
  if (args.dataClinica && !state.facts.some((fact) => normalizarDataCivil(fact.date) === normalizarDataCivil(args.dataClinica)))
    throw new Error("DATA_CLINICA_SINTETICA_NAO_EXTRAIDA");
  salvarDraft(ambiente.db, { draftId: args.draftId, patientId: null, sourceId: args.sourceId,
    rawRef: `fixture-local:${args.recordingId}`, payload: { kind: "EXTRACAO_RASCUNHO", input,
      state, alerts: [], alertasRads: [] }, diagnostics: ["VINCULO_MEDICO_PENDENTE"],
    revision: 0, criadoEm: AGORA });
}

describe("S11 HTTP source-bound persistido", () => {
  async function fontes(ambiente: Awaited<ReturnType<typeof ambienteHttp>>) {
    cadastrarPaciente(ambiente);
    await post(ambiente, "/consulta/contexto/selecionar", {patientId:PACIENTE,encounterId:ENCONTRO,tumorLotId:null});
    for(const suffix of ["a","b"]){
      salvarFonte(ambiente,{draftId:`draft-recon-${suffix}`,recordingId:`recording-recon-${suffix}`,sourceId:`source-recon-${suffix}`,
        texto:"Creatinina: 1,1 mg/dL em 08/10/2026.",versao:"2"});
      await vincularFonte(ambiente,`draft-recon-${suffix}`);
    }
  }
  it("loader autenticado fornece ações e provas atuais, preservando timeline", async()=>{
    const ambiente=await ambienteHttp();try{
      await fontes(ambiente);
      const antes=(ambiente.db.prepare("SELECT COUNT(*) n FROM clinical_event").get() as {n:number}).n;
      const out=await post<{codigo:string;timelines:Array<{patientId:string}>}>(ambiente,"/consulta/rascunho/reconciliar",{draftIds:["draft-recon-a","draft-recon-b"]});
      expect(out.status).toBe(200);expect(out.data.timelines).toHaveLength(2);expect(out.data.timelines.every(t=>t.patientId===PACIENTE)).toBe(true);
      expect(ambiente.db.prepare("SELECT COUNT(*) n FROM clinical_event").get()).toMatchObject({n:antes});
    } finally{await ambiente.close();}
  });
  it.each(["texto","versao"])("fonte vinculada com %s alterado não reaproveita decisão persistida", async(alteracao)=>{
    const ambiente=await ambienteHttp();try{
      await fontes(ambiente);
      const draft=lerDraft(ambiente.db,"draft-recon-a")!;
      const payload=draft.payload as {input:{rawTranscript:string;examIdentity:{tipo:string;versao:string}}};
      if(alteracao==="texto")payload.input.rawTranscript="Creatinina: 2,4 mg/dL em 08/10/2026.";
      else payload.input.examIdentity.versao="3";
      salvarDraft(ambiente.db,{...draft,payload,revision:draft.revision+1});
      const antes=(ambiente.db.prepare("SELECT COUNT(*) n FROM clinical_event").get() as {n:number}).n;
      const out=await post<{codigo:string}>(ambiente,"/consulta/rascunho/reconciliar",{draftIds:["draft-recon-a","draft-recon-b"]});
      expect(out).toMatchObject({status:409,data:{codigo:"FONTE_ALTERADA"}});
      expect(ambiente.db.prepare("SELECT COUNT(*) n FROM clinical_event").get()).toMatchObject({n:antes});
    } finally{await ambiente.close();}
  });
});
