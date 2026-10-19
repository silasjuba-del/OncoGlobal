import { afterEach, expect, it } from "vitest";
import { abrirAmbiente, cadastrarPaciente, criarDiretorio, removerDiretorio, PACIENTE, ENCONTRO } from "../../f0-fecha/fixtures/consulta-completa.js";
import { lerDraft } from "../../../src/kernel/ledger/drafts.js";
let ambiente: Awaited<ReturnType<typeof abrirAmbiente>> | undefined;
afterEach(async()=>{if(ambiente){await ambiente.close();removerDiretorio(ambiente.dir);ambiente=undefined;}});
async function abrir(){ambiente=await abrirAmbiente(criarDiretorio());cadastrarPaciente(ambiente);
  await ambiente.request("/consulta/carregar",{patientId:PACIENTE,encounterId:ENCONTRO,tumorLotId:null});return ambiente;}
const pedido={contexto:{patientId:PACIENTE,encounterId:ENCONTRO,tumorLotId:null},recordingId:"ditado-sintetico",sourceId:"fonte-ditado",
  sourceType:"medical_note",captureMethod:"LOCAL_DICTATION",capturedTranscript:"Creatinina 12. Nega dor.",rawTranscript:"Creatinina 1,2 mg/dL. Nega dor."};
const globalPedido=pedido;
it.each(['LOCAL_DICTATION','DEEPGRAM_CLOUD'])("ditado %s mantém original, edição e contexto como rascunho sem vínculo nem assinatura; retry não duplica",async(captureMethod)=>{
  const pedido={...globalPedido,captureMethod};
  const a=await abrir(),r=await a.request("/consulta/extrair",pedido);expect(r.status).toBe(201);
  const draft=lerDraft(a.db,r.data.draftId)!;expect(draft.patientId).toBeNull();
  expect(draft.payload).toMatchObject({kind:"EXTRACAO_RASCUNHO",input:pedido});
  expect(a.eventos().filter(e=>e.revisao==="ASSINADO")).toHaveLength(0);
  const replay=await a.request("/consulta/extrair",pedido);expect(replay.status,JSON.stringify(replay.data)).toBe(200);
  expect(replay.data).toMatchObject({codigo:"REPLAY",draftId:draft.draftId,requiresMedicalReview:true,linkedPatientId:null});
  expect((await a.request("/consulta/extrair",{...pedido,rawTranscript:"texto diferente"})).status).toBe(409);
  const fontes=await a.request("/consulta/oncoassist/fontes",pedido.contexto);
  expect(fontes.status).toBe(200);
  expect(fontes.data.fontesSemVinculo).toEqual(expect.arrayContaining([expect.objectContaining({draftId:draft.draftId})]));
  // A fonte continua acessível pelo leitor de rascunho mesmo sem confirmação de paciente.
  expect((await a.request("/consulta/rascunho",{draftId:draft.draftId})).status).toBe(200);
});
it("recusa contexto antigo, metadados incompletos e transcrição vazia",async()=>{
  const a=await abrir();
  expect((await a.request("/consulta/extrair",{...pedido,contexto:{...pedido.contexto,encounterId:"outro"}})).status).toBe(409);
  expect((await a.request("/consulta/extrair",{...pedido,capturedTranscript:undefined})).status).toBe(400);
  expect((await a.request("/consulta/extrair",{...pedido,rawTranscript:"   "})).status).toBe(400);
});
