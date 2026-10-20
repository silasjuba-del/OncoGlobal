import {expect,it} from "vitest";
import {createServer} from "node:http";
import {abrirLedger} from "../../src/kernel/ledger/db.js";
import {salvarDraft} from "../../src/kernel/ledger/drafts.js";
import {confirmar} from "../../src/kernel/ledger/writeRouter.js";
import {criarGerenciadorSessao} from "../../src/server/sessao.js";
import {criarGateway,memoriaIdempotencia} from "../../src/kernel/gateway/gateway.js";
import {criarOncoassistJev} from "../../src/kernel/llm/jev/oncoassist.js";
import {rotear} from "../../src/server/rotas.js";
it("classificar fonte percorre HTTP real com provedor exclusivamente sintetico",async()=>{
 const db=abrirLedger(":memory:"),agora=()=>"2026-10-19T12:00:00Z",ctx={patientId:"paciente-sintetico-prova",encounterId:"encontro-sintetico",tumorLotId:null};
 const sessoes=criarGerenciadorSessao({medicoId:"medico-sintetico",crm:"CRM-SINTETICO",senha:"senha-sintetica-longa",duracaoMs:60_000,agora});
 const token=sessoes.login("senha-sintetica-longa")!.token;sessoes.selecionarConsulta(token,ctx);
 salvarDraft(db,{draftId:"cad",patientId:ctx.patientId,sourceId:"cad",rawRef:"local",payload:{},diagnostics:[],revision:0,criadoEm:agora()});
 confirmar(db,{...ctx,operationId:"cadastro",reviewDecisionId:"revisao",sessao:sessoes.obter(token)!,em:agora(),registros:[{draftId:"cad",expectedRevision:0,eventId:"cad",tipo:"Paciente",fontes:[],revisao:"CONFIRMADO",payload:{patientId:ctx.patientId,nome:"Paciente Sintetico",identificadores:[],nascimento:null,sexoCadastral:"NAO_INFORMADO",divergencia:false}}]});
 salvarDraft(db,{draftId:"fonte",patientId:ctx.patientId,sourceId:"doc",rawRef:"fixture",diagnostics:[],revision:0,criadoEm:agora(),payload:{kind:"EXTRACAO_RASCUNHO",input:{sourceId:"doc",rawTranscript:"Hemograma sintetico"},patientLinkReview:{...ctx,segmentId:"s1"},state:{segments:[{id:"s1",sourceId:"doc",rawTranscript:"Hemograma sintetico"}]}}});
 const deps={db,sessoes,agora,log:()=>{},gateway:criarGateway({agora,store:memoriaIdempotencia(),auditar:()=>{},executores:{}}),oncoassistJev:criarOncoassistJev({env:{ONCOASSIST_JEV_ENABLED:"true",TYPESAFE_API_KEY:"fixture-sem-rede"},transporte:{avaliar:async()=>({model:"jev-1.0",answers:{categoria:{type:"choice",choice:"LAB",confidence:1,probabilities:{LAB:1,RADS:0,PATH:0,NOTA:0,OUTRO:0,INDETERMINADO:0}}},usage:{input_tokens:1,output_tokens:1}})}})};
 const server=createServer((req,res)=>{void rotear(deps,req,res);});server.listen(0,"127.0.0.1");await new Promise<void>(r=>server.once("listening",r));
 try{const addr=server.address();if(!addr||typeof addr==="string")throw Error("PORTA");const r=await fetch(`http://127.0.0.1:${addr.port}/consulta/oncoassist/classificar-fonte`,{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${token}`},body:JSON.stringify({...ctx,draftId:"fonte",operationId:"classificacao-sintetica"})});const body=await r.json();expect(r.status).toBe(200);expect(body).toMatchObject({status:"PROPOSTA",categoria:"LAB"});expect(db.prepare("SELECT COUNT(*) AS n FROM clinical_event").get()?.n).toBe(1);}
 finally{server.closeIdleConnections();await new Promise<void>(r=>server.close(()=>r()));db.close();}
});
