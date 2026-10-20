import {RASCUNHOS} from "../../src/contracts/rascunhos.js";
import {readFileSync,readdirSync} from "node:fs";
import {join} from "node:path";
import {afterEach,expect,it} from "vitest";
import {abrirAmbiente,cadastrarPaciente,criarDiretorio,removerDiretorio,PACIENTE,ENCONTRO,AGORA} from "../f0-fecha/fixtures/consulta-completa.js";
import {salvarDraft} from "../../src/kernel/ledger/drafts.js";
import {confirmar} from "../../src/kernel/ledger/writeRouter.js";
let a:Awaited<ReturnType<typeof abrirAmbiente>>;
afterEach(async()=>{if(a){await a.close();removerDiretorio(a.dir);a=undefined!;}});
it.each(Object.keys(RASCUNHOS))("%s nao vira fato por confirmacao generica",async kind=>{
 a=await abrirAmbiente(criarDiretorio());cadastrarPaciente(a);
 const payload={kind,contexto:{patientId:PACIENTE,encounterId:ENCONTRO,tumorLotId:null}};
 salvarDraft(a.db,{draftId:"draft-inerte",patientId:PACIENTE,sourceId:"fonte",rawRef:"local",payload,diagnostics:[],revision:0,criadoEm:AGORA});
 await a.request("/consulta/carregar",{patientId:PACIENTE,encounterId:ENCONTRO,tumorLotId:null});
 const bundle=await a.request("/consulta/bundle",{patientId:PACIENTE,encounterId:ENCONTRO,tumorLotId:null,draftIds:["draft-inerte"]});
 expect(bundle.status).toBe(409);
 const antes=a.eventos().length;
 const r=confirmar(a.db,{operationId:"promocao-generica",patientId:PACIENTE,encounterId:ENCONTRO,tumorLotId:null,reviewDecisionId:"revisao",sessao:a.sessoes.obter(a.token)!,em:AGORA,registros:[{draftId:"draft-inerte",expectedRevision:0,eventId:"evento-indevido",tipo:"FATO",payload,fontes:[],revisao:"CONFIRMADO"}]});
 expect(r.estado).toBe("NEGADA");expect(a.eventos()).toHaveLength(antes);
 const consulta=await a.request("/consulta/carregar",{patientId:PACIENTE,encounterId:ENCONTRO,tumorLotId:null});
 if(kind!=="EVOLUCAO_RASCUNHO") expect(JSON.stringify(consulta.data.fechamento?.registros)).not.toContain("draft-inerte");
});

it("todos os tipos literais de rascunho declarados no produto possuem classe",()=>{
 function visitar(dir:string):string[]{return readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?visitar(join(dir,e.name)):/\.tsx?$/.test(e.name)?[join(dir,e.name)]:[]);}
 const ausentes:string[]=[];
 for(const path of visitar("src"))for(const m of readFileSync(path,"utf8").matchAll(/kind\s*:\s*(?:z\.literal\()?['"]([A-Z0-9_]+)['"]/g)){
   if((m[1]!.endsWith("_RASCUNHO")||m[1]!.startsWith("FICHA_")||m[1]!.endsWith("_AUXILIAR"))&&!Object.hasOwn(RASCUNHOS,m[1]!))ausentes.push(`${path}:${m[1]}`);
 }
 expect(ausentes).toEqual([]);
});
