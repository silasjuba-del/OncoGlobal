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
it("APAC rotula tabela presente e conserva último aviso confirmado da mesma competência",()=>{
 const d=banco();paciente(d);const vazio={valor:null,estado:"PENDENTE",campo:"AUSENTE",motivo:"não consta",fontes:[],revisao:"RAW"};
 add(d,"lot","TumorLot",{tumorLotId:"l",patientId:"p",cid:vazio,topografia:vazio,histologia:vazio,estadiamentos:[],finalidadeApac:vazio,marcos:[]},"atual",undefined,"l");
 add(d,"apac","APAC",{apacId:"ap",tumorLotId:"l",prescricaoAssinadaRef:{documentId:"rx",documentVersion:1},dataGeracaoApp:"2026-07-01",competencia:"2026-10",campos:{},estado:"RASCUNHO",resultadoExterno:null,versao:1,substituiApacId:null},"atual",undefined,"l");
 add(d,"aviso","ApacAviso",{apacId:"ap",competencia:"2026-10"},"atual",undefined,"l");
 const caixas=CAMPOS_OBRIGATORIOS_PADRAO.map((nome,n)=>({numero:n+1,chave:`apac.${nome}`,nome,significado:nome,ondeAparece:["apac"],tipo:"TEXTO" as const,editavelPor:"MEDICO" as const}));
 const r=lerApacs(d,"2026-10-12T10:00:00-03:00",{caixas,sigtap:{"2026-10":{competencia:"2026-10",procedimentos:{}}},cnesConfigurado:""});
 expect(r.itens[0]?.antiglosaEstado).toBe("AVALIADA_COM_TABELA_SIGTAP");
 expect(r.itens[0]?.ultimoAvisoEm).toBe("2026-10-12T08:00:00-03:00");
 expect(r.itens[0]?.prazo).toHaveProperty("aviso",false);
});
