import { afterEach, expect, it } from "vitest";
import { CAMPOS_OBRIGATORIOS_PADRAO } from "../../src/apac/antiglosa.js";
import { DatabaseSync } from "node:sqlite";
import { criarSchema } from "../../src/kernel/ledger/schema.js";
import { lerConsulta, lerEventosComIntegridade, lerApacs } from "../../src/server/leituras.js";
import type { Sessao } from "../../src/contracts/base.js";
const dbs: DatabaseSync[]=[];
afterEach(()=>dbs.splice(0).forEach(d=>d.close()));
const sessao: Sessao={medicoId:"m",crm:"CRM TESTE",emitidaEm:"2026-10-01T08:00:00-03:00",expiraEm:"2026-10-30T08:00:00-03:00"};
function banco(){const d=new DatabaseSync(":memory:");criarSchema(d);dbs.push(d);return d;}
function add(d:DatabaseSync,id:string,tipo:string,data:unknown,encontro="atual",em="2026-10-12T08:00:00-03:00",lote:string|null=null){
 d.prepare("INSERT INTO operation VALUES(?,?,?,?)").run(id,"hash",null,em);
 d.prepare("INSERT INTO clinical_event VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)").run(id,id,0,"p",lote,encontro,tipo,JSON.stringify({data}),"[]","CONFIRMADO",em,JSON.stringify({tipo:"SESSAO",id:"m"}),null);
}
function paciente(d:DatabaseSync){add(d,"cadastro","Paciente",{patientId:"p",identificadores:[],nome:"Paciente Teste",nascimento:null,sexoCadastral:"NAO_INFORMADO",divergencia:false});}
it("payload de tipo conhecido inválido fica visível sem divulgar seu conteúdo",()=>{
 const d=banco();add(d,"quebrado","Paciente",{patientId:"p",nome:"CONTEUDO PRIVADO"});
 const r=lerEventosComIntegridade(d);expect(r.itens).toEqual([]);
 expect(r.pendenciasIntegridade).toEqual([{eventoId:"quebrado",patientId:"p",tipo:"Paciente",motivo:"PAYLOAD_FORA_DO_CONTRATO",schema:"Paciente@1"}]);
 expect(JSON.stringify(r.pendenciasIntegridade)).not.toContain("CONTEUDO PRIVADO");
});