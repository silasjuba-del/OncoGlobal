// Revisão documental real preparada por HTTP; ataques ao funil comum sem contornar o ledger.
import { afterEach,expect,it } from "vitest";
import { executarConfirmacao } from "../../src/kernel/comandos/index.js";
import { lerDraft } from "../../src/kernel/comandos/portas.js";
import { prepararRevisaoExtracao, type RevisaoExtracaoPreparada } from "../../src/kernel/extracao/prepararRevisao.js";
import type { Confirmacao } from "../../src/kernel/ledger/writeRouter.js";
import { abrirAmbiente,cadastrarPaciente,carregarConsulta,criarDiretorio,removerDiretorio,extrair,confirmarFatos,PACIENTE,ENCONTRO } from "../f0-fecha/fixtures/consulta-completa.js";
let a:Awaited<ReturnType<typeof abrirAmbiente>>|undefined;
afterEach(async()=>{if(a){await a.close();removerDiretorio(a.dir);a=undefined;}});
async function preparar(){
 a=await abrirAmbiente(criarDiretorio());cadastrarPaciente(a);await carregarConsulta(a);
 const extraido=await extrair(a,{sourceId:"documento-sintetico",sourceType:"medical_note",text:`Paciente: ${PACIENTE}\n01/10/2026 Hemoglobina 11,5 g/dL.`});
 const ids=extraido.facts.filter(f=>f.domain==="lab").map(f=>f.id);expect(ids.length).toBeGreaterThan(0);
 const fluxo=await confirmarFatos(a,extraido,ids,"l4-revisao-documental");expect(fluxo.preview.status).toBe(200);
 const sid=fluxo.preview.data.comprovanteExibicao.documentId;
 const sum=lerDraft(a.db,sid)!.payload as RevisaoExtracaoPreparada["payload"];
 if(!sum.origem)throw Error("ORIGEM_SINTETICA_AUSENTE");
 const orig=lerDraft(a.db,extraido.draftId)!;
 const payload=orig.payload as {input:{sourceId:string;sourceType:string};state:{segments:{id:string;rawTranscript:string}[];facts:unknown[];confirmationRequired:unknown[]};patientLinkReview:{segmentId:string}};
 const texto=payload.state.segments.find(s=>s.id===payload.patientLinkReview.segmentId)!.rawTranscript;
 const preparada=prepararRevisaoExtracao({draftId:orig.draftId,sourceId:orig.sourceId,sourceType:payload.input.sourceType,rawTranscript:texto,
  vinculoConfirmado:true,facts:payload.state.facts.filter(f=>f&&typeof f==="object"&&"segmentId" in f&&f.segmentId===payload.patientLinkReview.segmentId),
  exceptions:payload.state.confirmationRequired.filter(f=>f&&typeof f==="object"&&"segmentId" in f&&f.segmentId===payload.patientLinkReview.segmentId),
  patientId:PACIENTE,encounterId:ENCONTRO,tumorLotId:null,factIds:sum.selectedFactIds,
  operationId:sum.review.operationId,medicoId:sum.review.medicoId,em:sum.review.em,origem:sum.origem});
 expect(preparada.payload).toEqual(sum);
 const req:Confirmacao={operationId:sum.review.operationId,reviewDecisionId:sum.review.operationId,patientId:PACIENTE,encounterId:ENCONTRO,tumorLotId:null,
  sessao:a.sessoes.obter(a.token)!,em:sum.review.em,registros:preparada.registros.map(r=>({...r,fontes:[...r.fontes],draftId:sid,expectedRevision:0,revisao:"CONFIRMADO"}))};
 return {a,req,sid,orig,fluxo};
}
it.each(["sem-fonte","hash-alheio","fonte-alheia","hash-curto","sem-recibo","recibo-forjado","review-divergente","registro-extra","valor-alterado","fonte-alterada"])("proveniência documental recusa %s antes de qualquer evento ou revisão",async ataque=>{
 const {a,req,sid,orig}=await preparar();
 let registros=req.registros.map(r=>({...r,fontes:[...r.fontes]}));
 if(ataque==="registro-extra")registros.push({...registros[0]!,eventId:"evento-extra",draftId:orig.draftId,expectedRevision:orig.revision});
 if(ataque==="sem-fonte")registros[0]!.fontes=[];
 if(ataque==="hash-alheio")registros[0]!.fontes=registros[0]!.fontes.map(f=>({...f,contentHash:"b".repeat(64)}));
 if(ataque==="fonte-alheia")registros[0]!.fontes=registros[0]!.fontes.map(f=>({...f,sourceId:"outro-documento"}));
 if(ataque==="hash-curto")registros[0]!.fontes=registros[0]!.fontes.map(f=>({...f,contentHash:"hash-curto"}));
 if(ataque==="valor-alterado")registros[0]!.payload={...(registros[0]!.payload as Record<string,unknown>),valor:999};
 if(ataque==="recibo-forjado")registros[registros.length-1]!.payload={...(registros.at(-1)!.payload as Record<string,unknown>),sourceContentHash:"b".repeat(64)};
 if(ataque==="sem-recibo")registros=registros.filter(r=>r.tipo!=="ReviewDecision");
 if(ataque==="fonte-alterada"){
  const p=structuredClone(orig.payload) as {input:{rawTranscript:string}};p.input.rawTranscript+=" Fonte alterada.";
  a.db.prepare("UPDATE draft_envelope SET payload=? WHERE draftId=?").run(JSON.stringify(p),orig.draftId);
 }
 const antes=a.eventos();expect(()=>executarConfirmacao(a.db,{...req,registros,...(ataque==="review-divergente"?{reviewDecisionId:"outra-revisao"}:{})})).toThrow("PROVENIENCIA_DOCUMENTAL_DIVERGENTE");
 expect(a.eventos()).toEqual(antes);expect(lerDraft(a.db,sid)!.revision).toBe(0);
 expect(a.db.prepare("SELECT 1 FROM operation WHERE operationId=?").get(req.operationId)).toBeUndefined();
});
it("revisão HTTP íntegra preserva fontes e recibo; replay não modifica os eventos",async()=>{
 const {a,req,fluxo}=await preparar();
 expect((await fluxo.confirmar(fluxo.preview.data.comprovanteExibicao)).status).toBe(200);
 const antes=a.eventos(),gravados=antes.filter(e=>e.operationId===req.operationId);
 expect(gravados.some(e=>e.tipo==="FATO")).toBe(true);expect(gravados.some(e=>e.tipo==="ReviewDecision")).toBe(true);
 expect(gravados.every(e=>e.fontes.length>0&&e.fontes.every(f=>/^[a-f0-9]{64}$/.test(f.contentHash)))).toBe(true);
 expect((await fluxo.confirmar(fluxo.preview.data.comprovanteExibicao)).status).toBe(200);expect(a.eventos()).toEqual(antes);
});
it("lote íntegro também passa diretamente pela porta comum",async()=>{
 const {a,req}=await preparar();expect(executarConfirmacao(a.db,req).estado).toBe("GRAVADA");
 expect(executarConfirmacao(a.db,req).estado).toBe("REPLAY");
});
