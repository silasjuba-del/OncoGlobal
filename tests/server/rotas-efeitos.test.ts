import {expect,it,vi} from "vitest";
import {abrirLedger} from "../../src/kernel/ledger/db.js";
import {criarServidorLocal} from "../../src/server/http.js";
import {criarGerenciadorSessao} from "../../src/server/sessao.js";
import {criarGateway,memoriaIdempotencia} from "../../src/kernel/gateway/gateway.js";
import {criarMotorF1} from "../../src/kernel/orquestracao/runtime.js";
it("leitura HTTP nao dispara pos-processamento; escrita declarada continua disparando",async()=>{
 const db=abrirLedger(":memory:"),agora=()=>"2026-10-20T12:00:00Z",sessoes=criarGerenciadorSessao({medicoId:"sintetico",crm:"CRM-T",senha:"senha-sintetica-longa",duracaoMs:60000,agora});
 const token=sessoes.login("senha-sintetica-longa")!.token,motor=criarMotorF1(db,agora,()=>({regras:[],biblioteca:{id:"sintetica",versao:"1",hash:"sintetico"}}));
 const processar=vi.spyOn(motor,"processar");const server=criarServidorLocal({db,sessoes,agora,log:()=>{},motorF1:motor,gateway:criarGateway({agora,store:memoriaIdempotencia(),auditar:()=>{},executores:{}})});
 await new Promise<void>(r=>server.listening?r():server.once("listening",r));const addr=server.address();if(!addr||typeof addr==="string")throw Error("PORTA");
 const post=async(url:string,body:unknown)=>{const r=await fetch(`http://127.0.0.1:${addr.port}${url}`,{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${token}`},body:JSON.stringify(body)});await r.json();return r.status;};
 try{expect(processar).toHaveBeenCalledTimes(1);expect(await post("/consulta/agenda",{})).toBe(200);await new Promise<void>(r=>setImmediate(r));expect(processar).toHaveBeenCalledTimes(1);
 expect(await post("/consulta/extrair",{recordingId:"sintetico",sourceId:"fonte",sourceType:"medical_note",rawTranscript:"Nota sintetica de teste."})).toBe(201);
 await vi.waitFor(()=>expect(processar).toHaveBeenCalledTimes(2));expect(db.prepare("SELECT COUNT(*) AS n FROM clinical_event").get()?.n).toBe(0);
 }finally{server.closeIdleConnections();await new Promise<void>(r=>server.close(()=>r()));processar.mockRestore();db.close();}
});
