import {afterEach,expect,it,vi} from "vitest";
import {readFileSync} from "node:fs";
import {DatabaseSync} from "node:sqlite";
import {abrirAmbiente,cadastrarPaciente,carregarConsulta,finalizarFlash,criarDiretorio,removerDiretorio,PACIENTE,ENCONTRO,AGORA} from "../f0-fecha/fixtures/consulta-completa.js";
import {salvarDraft,lerDraft} from "../../src/kernel/ledger/drafts.js";
import {confirmar} from "../../src/kernel/ledger/writeRouter.js";
import {carregarDicionarioPacienteDoLedger} from "../../src/server/canalResposta.js";
import {registrarLogOperacional} from "../../src/app/oncoassistLocal.js";
import {carregarCorpusServidor} from "../../src/server/corpus.js";
import {processarUploadLocal} from "../../src/server/upload.js";
let a:Awaited<ReturnType<typeof abrirAmbiente>>;
afterEach(async()=>{vi.restoreAllMocks();if(a){await a.close();removerDiretorio(a.dir);a=undefined!;}});
async function abrir(){a=await abrirAmbiente(criarDiretorio());cadastrarPaciente(a);await carregarConsulta(a);return a;}
function evento(tipo:string,payload:unknown,id:string,patientId=PACIENTE){
 salvarDraft(a.db,{draftId:id,patientId,sourceId:`fonte-${id}`,rawRef:"fixture-sintetica",payload:{},diagnostics:[],revision:0,criadoEm:AGORA});
 const r=confirmar(a.db,{operationId:`op-${id}`,patientId,encounterId:ENCONTRO,tumorLotId:null,reviewDecisionId:`rev-${id}`,sessao:a.sessoes.obter(a.token)!,em:AGORA,registros:[{draftId:id,expectedRevision:0,eventId:id,tipo,payload,fontes:[],revisao:"CONFIRMADO"}]});expect(r.estado).toBe("GRAVADA");
}
const alerta={alertaId:"original",alvo:{patientId:PACIENTE},natureza:"AMEACA_IMEDIATA",classeRisco:null,texto:"Alerta sintetico confirmado",origemRegra:"regra-sintetica",evidencias:[],presentationOverride:true,authorityOverride:false,reconhecidoEm:null,destino:"CHAT"};
it("consulta e agenda exibem alerta confirmado; ciencia e duravel sem virar evolucao",async()=>{
 await abrir();evento("Alerta",alerta,"alerta-1");evento("AgendaEntry",{patientId:PACIENTE,encounterId:ENCONTRO,data:"2026-10-09",horario:"12:00"},"agenda-1");
 const c=await carregarConsulta(a);expect(c.data.alertas).toHaveLength(1);const id=c.data.alertas[0].alertaId;
 const agenda=await a.request("/consulta/agenda",{});expect(agenda.data.itens[0].temE1).toBe(true);
 const {context,preparada}=await finalizarFlash(a,"ciencia-sintetica");expect(preparada.status).toBe(200);
 await a.request("/consulta/bundle",context);
 const pedido={...context,bloco:"TUDO",registros:preparada.data.registros,documentosExibidos:preparada.data.documentos.map(d=>({documentId:d.documentId,documentVersion:d.documentVersion})),reconhecerAlertas:[id],idempotencyKey:"ciencia-confirmar"};
 expect((await a.request("/consulta/confirmar",{...pedido,reconhecerAlertas:["outro-paciente"]})).status).toBe(409);
 expect((await a.request("/consulta/confirmar",pedido)).status).toBe(200);
 expect((await a.request("/consulta/confirmar",pedido)).status).toBe(200);
 const rows=a.db.prepare("SELECT * FROM alerta_reconhecimento").all();expect(rows).toHaveLength(1);expect(rows[0]).toMatchObject({alertaId:id,patientId:PACIENTE,encounterId:ENCONTRO,medicoId:a.sessoes.obter(a.token)!.medicoId});
 const recarregado=await carregarConsulta(a);expect(recarregado.data.alertas[0].reconhecidoEm).toBe(AGORA);
 const nova=new DatabaseSync(`${a.dir}/consulta.sqlite`,{readOnly:true});try{expect(nova.prepare("SELECT COUNT(*) AS n FROM alerta_reconhecimento").get()?.n).toBe(1);}finally{nova.close();}
 expect(a.eventos().filter(e=>e.tipo==="DOCUMENTO").every(e=>!JSON.stringify(e.payload).includes(alerta.texto))).toBe(true);
});
it("rascunho e alerta de outro paciente nao viram E1 nesta consulta",async()=>{
 await abrir();salvarDraft(a.db,{draftId:"alerta-rascunho",patientId:PACIENTE,sourceId:"fonte",rawRef:"local",payload:alerta,diagnostics:[],revision:0,criadoEm:AGORA});
 evento("Alerta",{...alerta,alvo:{patientId:"outro"}},"alerta-outro","outro");expect((await carregarConsulta(a)).data.alertas).toEqual([]);
});
it("dicionario ausente ou ilegivel nao recebe identidade sintetica",async()=>{
 await abrir();expect(carregarDicionarioPacienteDoLedger(a.db,"ausente","destino")).toBeNull();
 expect(carregarDicionarioPacienteDoLedger(a.db,PACIENTE,"destino")?.nomes.length).toBeGreaterThan(0);
 const quebrado=new DatabaseSync(":memory:");try{expect(carregarDicionarioPacienteDoLedger(quebrado,PACIENTE,"destino")).toBeNull();}finally{quebrado.close();}
});
it("log operacional registra falha sem corpo ou credencial",()=>{
 const spy=vi.spyOn(console,"error").mockImplementation(()=>{});
 registrarLogOperacional({rota:"canal",codigo:"PROCESSAMENTO_PENDENTE",status:503});expect(spy).toHaveBeenCalledWith(JSON.stringify({evento:"HTTP_LOCAL",rota:"canal",codigo:"PROCESSAMENTO_PENDENTE",status:503}));
 registrarLogOperacional({rota:"Paciente teste / segredo",codigo:"senha secreta",status:NaN});expect(spy.mock.calls[1]?.[0]).not.toContain("segredo");
});
it("upload radiologico preserva RADS com trecho e fonte sem promover fato",async()=>{
 await abrir();const texto=readFileSync(new URL("../../docs/referencias/modelos/laudos-sinteticos/PT08-tc-abdome-pelve.txt",import.meta.url),"utf8");
 const r=await processarUploadLocal({db:a.db,sessoes:a.sessoes,agora:()=>AGORA,corpus:carregarCorpusServidor(),converterUpload:async entrada=>({status:"PRONTO",documento:{...entrada,hash:"hash-sintetico",paginas:[{n:1,texto}]}})},a.token,a.sessoes.obter(a.token)!,{patientId:PACIENTE,encounterId:ENCONTRO,tumorLotId:null,id:"rads-upload",sourceId:"fonte-rads",sourceType:"imaging_report",tipo:"PDF",bytesBase64:Buffer.from("pdf sintetico").toString("base64")});
 expect(r.status).toBe(201);const d=lerDraft(a.db,String(r.body.draftId))!;expect(d.patientId).toBeNull();expect((d.payload as any).alertasRads.map((x:any)=>x.linha)).toEqual([7,27]);expect((d.payload as any).alertasRads.every((x:any)=>x.sourceId==="fonte-rads" && texto.includes(x.trecho))).toBe(true);
});
