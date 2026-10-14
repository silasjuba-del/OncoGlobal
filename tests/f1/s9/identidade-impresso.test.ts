import { afterEach, expect, it } from "vitest";
import { mkdtempSync,readFileSync,rmSync,mkdirSync,writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { criarExecutorImprimir } from "../../../src/kernel/gateway/executores/imprimir.js";
import { DatabaseSync } from "node:sqlite";
import { criarSchema } from "../../../src/kernel/ledger/schema.js";
import { criarResolverDocumentoLedger } from "../../../src/kernel/ledger/documentos.js";
import { hashCanonico } from "../../../src/rules/conteudoCanonico.js";
const dbs:DatabaseSync[]=[],diretorios:string[]=[];afterEach(()=>{dbs.splice(0).forEach(db=>db.close());diretorios.splice(0).forEach(dir=>rmSync(dir,{recursive:true,force:true}));});
const pacienteId="pt-opaque-uuid-001",assinadoEm="2026-10-10T08:00:00-03:00";
function db(){const d=new DatabaseSync(":memory:");criarSchema(d);dbs.push(d);return d;}
function evento(d:DatabaseSync,id:string,tipo:string,data:unknown,em:string,patientId=pacienteId,revisao="CONFIRMADO"){
 d.prepare("INSERT INTO operation VALUES (?,?,?,?)").run(id,"hash",null,em);
 d.prepare("INSERT INTO clinical_event VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)").run(id,id,0,patientId,null,"encontro-opaco",tipo,JSON.stringify({data}),"[]",revisao,em,JSON.stringify({tipo:"SESSAO",id:"medico-opaco"}),null);
}
function cadastro(d:DatabaseSync,id:string,nome:string,em:string,patientId=pacienteId){evento(d,id,"Paciente",{patientId,nome,identificadores:[],nascimento:null,sexoCadastral:"NAO_INFORMADO",divergencia:false},em,patientId);}
function documento(d:DatabaseSync,extra:Record<string,unknown>={}){
 const corpo={documentId:"doc-identidade",documentVersion:1,titulo:"Receita",texto:"Conteúdo sintético preservado",...extra};
 evento(d,"assinatura","DOCUMENTO",{data:corpo,signature:{documentId:corpo.documentId,documentVersion:1,documentHash:hashCanonico(corpo),serverActorId:"medico-opaco",reviewDecisionId:"review"}},assinadoEm,pacienteId,"ASSINADO");
}
it("ID opaco imprime nome legível histórico e atualização posterior não altera HTML, texto ou hash",async()=>{
 const d=db();cadastro(d,"cadastro-original","Paciente Sintético Original","2026-10-09T10:00:00-03:00");documento(d,{identidadePaciente:{patientId:pacienteId,nome:"Paciente Sintético Original",cadastroEventId:"cadastro-original"}});
 const resolver=criarResolverDocumentoLedger(d),original=await resolver.resolver({id:"doc-identidade",version:1});
 expect(original?.html).toContain("Paciente: Paciente Sintético Original");expect(original?.html).toContain(`Prontuário: ${pacienteId}`);
 const assinado=d.prepare("SELECT * FROM clinical_event WHERE eventId='assinatura'").get();
 cadastro(d,"cadastro-posterior","Nome Atualizado Posteriormente","2026-10-11T08:00:00-03:00");
 const reimpresso=await resolver.resolver({id:"doc-identidade",version:1});expect(reimpresso).toEqual(original);
 expect(d.prepare("SELECT * FROM clinical_event WHERE eventId='assinatura'").get()).toEqual(assinado);
});
it("snapshot assinado usa cadastro referenciado, nunca nome atual ou cadastro de outro paciente",async()=>{
 const d=db();cadastro(d,"cadastro-original","Paciente Sintético Original","2026-10-09T10:00:00-03:00");
 cadastro(d,"cadastro-no-dia","Nome Clínico Conferido","2026-10-10T07:00:00-03:00");
 documento(d,{identidadePaciente:{patientId:pacienteId,nome:"Paciente Sintético Original",cadastroEventId:"cadastro-original"},identidadeResponsavel:{medicoId:"medico-opaco",crm:"CRM TESTE"}});
 const r=await criarResolverDocumentoLedger(d).resolver({id:"doc-identidade",version:1});expect(r?.html).toContain("Paciente: Paciente Sintético Original");expect(r?.html).toContain("CRM TESTE");
});
it("snapshot divergente não é mascarado por fallback; cadastro futuro não prova identidade histórica",async()=>{
 const d=db();cadastro(d,"cadastro-original","Paciente Sintético Original","2026-10-09T10:00:00-03:00");
 documento(d,{identidadePaciente:{patientId:"outro",nome:"Paciente Sintético Original",cadastroEventId:"cadastro-original"}});
 expect(await criarResolverDocumentoLedger(d).resolver({id:"doc-identidade",version:1})).toBeNull();
 const futuro=db();cadastro(futuro,"cadastro-futuro","Nome Futuro","2026-10-11T08:00:00-03:00");documento(futuro);
 const r=await criarResolverDocumentoLedger(futuro).resolver({id:"doc-identidade",version:1});expect(r?.html).not.toContain("Nome Futuro");
});

it("arquivo impresso existente permanece imutável após atualização cadastral ou mudança de cabeçalho",async()=>{
 const d=db();cadastro(d,"cadastro-original","Paciente Sintético Original","2026-10-09T10:00:00-03:00");documento(d);
 const dir=mkdtempSync(join(tmpdir(),"identidade-impresso-"));diretorios.push(dir);
 const executor=criarExecutorImprimir({dataDir:dir,agora:()=>assinadoEm,resolverDocumento:criarResolverDocumentoLedger(d)});
 const intent={verbo:"IMPRIMIR" as const,objeto:{tipo:"DOCUMENTO",id:"doc-identidade",versao:1},escopo:{patientId:pacienteId,encounterId:"encontro-opaco"},destino:null,idempotencyKey:"print-sintetico"};
 const primeira=await executor.executar(intent);expect(primeira.ok).toBe(true);
 const arquivo=join(dir,"impressao","2026-10-10",`${intent.objeto.id}@${intent.objeto.versao}.html`);const original=readFileSync(arquivo,"utf8");
 cadastro(d,"cadastro-novo","Nome Posterior","2026-10-11T08:00:00-03:00");
 expect((await executor.executar({...intent,idempotencyKey:"print-sintetico-replay"})).ok).toBe(true);
 expect(readFileSync(arquivo,"utf8")).toBe(original);
 const antigo=mkdtempSync(join(tmpdir(),"identidade-legado-"));diretorios.push(antigo);mkdirSync(join(antigo,"impressao","2026-10-10"),{recursive:true});
 const legado=join(antigo,"impressao","2026-10-10",`${intent.objeto.id}@${intent.objeto.versao}.html`);writeFileSync(legado,"HTML legado imutável");
 const execAntigo=criarExecutorImprimir({dataDir:antigo,agora:()=>assinadoEm,resolverDocumento:criarResolverDocumentoLedger(d)});
 expect(await execAntigo.executar(intent)).toMatchObject({ok:false,erro:"VERSAO_DOCUMENTO_JA_GRAVADA_COM_OUTRO_CONTEUDO"});
 expect(readFileSync(legado,"utf8")).toBe("HTML legado imutável");
});
