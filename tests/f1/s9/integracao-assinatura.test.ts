import { afterEach, expect, it } from "vitest";
import { abrirAmbiente,cadastrarPaciente,criarDiretorio,removerDiretorio,carregarConsulta,PACIENTE,ENCONTRO } from "../../f0-fecha/fixtures/consulta-completa.js";
let a:Awaited<ReturnType<typeof abrirAmbiente>>|undefined;
afterEach(async()=>{if(a){await a.close();removerDiretorio(a.dir);a=undefined;}});
const contexto={patientId:PACIENTE,encounterId:ENCONTRO,tumorLotId:null};
const plano={acoesMarcadas:[],receitasMarcadas:[],apac:{cid:"",sigtap:"",finalidade:"",competencia:"",estado:"PENDENTE",pendencias:[],emitir:false},retorno:{dias:14,examesAntesDoRetorno:[]},solicitacoes:{laboratorio:["Hemograma","Creatinina"],imagem:[]}};
it("assinatura Flash registra marcador e tarefa das referências exibidas uma vez, sem novo encontro",async()=>{
 a=await abrirAmbiente(criarDiretorio());cadastrarPaciente(a);await carregarConsulta(a);
 const preparada=await a.request("/consulta/flash/preparar",{...contexto,plano,idempotencyKey:"s9-prepare-assinatura"});expect(preparada.status).toBe(200);
 expect(a.eventos().filter(e=>e.tipo==="Tarefa")).toHaveLength(0);
 const bundle=await a.request("/consulta/bundle",{...contexto,draftIds:preparada.data.registros.map((r:{id:string})=>r.id)});expect(bundle.status).toBe(200);
 const input={...contexto,bloco:"TUDO",registros:preparada.data.registros,documentosExibidos:preparada.data.documentos.map((d:{documentId:string;documentVersion:number})=>({documentId:d.documentId,documentVersion:d.documentVersion})),reconhecerAlertas:[],idempotencyKey:"s9-confirm-assinatura"};
 const gravada=await a.request("/consulta/confirmar",input);expect(gravada.data.codigo).toBe("GRAVADA");
 const antes=a.eventos();expect(antes.filter(e=>e.tipo==="DOCUMENTO")).toHaveLength(4);expect(antes.filter(e=>e.tipo==="ConsultaConfirmada")).toHaveLength(1);expect(antes.filter(e=>e.tipo==="Tarefa")).toHaveLength(1);
 const t=antes.find(e=>e.tipo==="Tarefa")?.payload as {data:Record<string,unknown>};expect(t.data).toMatchObject({estado:"CONFIRMADA",dataAlvo:"2026-10-23",prazo:null,recebidoEm:null});
 expect(antes.every(e=>e.encounterId===ENCONTRO)).toBe(true);
 const replay=await a.request("/consulta/confirmar",input);expect(replay.data.codigo).toBe("REPLAY");expect(a.eventos()).toEqual(antes);
});
it("fato confirmado após preparação invalida assinatura sem marcador, tarefa ou documento",async()=>{
 a=await abrirAmbiente(criarDiretorio());cadastrarPaciente(a);await carregarConsulta(a);
 const preparada=await a.request("/consulta/flash/preparar",{...contexto,plano,idempotencyKey:"s9-stale-preparar"});expect(preparada.status).toBe(200);
 await a.request("/consulta/bundle",{...contexto,draftIds:preparada.data.registros.map((r:{id:string})=>r.id)});
 a.db.prepare("INSERT INTO operation VALUES (?,?,?,?)").run("fato-novo","hash",null,"2026-10-09T12:00:00-03:00");
 a.db.prepare("INSERT INTO clinical_event VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)").run("fato-novo","fato-novo",0,PACIENTE,null,ENCONTRO,"FATO",JSON.stringify({data:{campo:"medicamentos",valor:["medicamento sintético novo"]}}),"[]","CONFIRMADO","2026-10-09T12:00:00-03:00",JSON.stringify({tipo:"SESSAO",id:"medico-teste-e6b"}),null);
 const r=await a.request("/consulta/confirmar",{...contexto,bloco:"TUDO",registros:preparada.data.registros,documentosExibidos:preparada.data.documentos.map((d:{documentId:string;documentVersion:number})=>({documentId:d.documentId,documentVersion:d.documentVersion})),reconhecerAlertas:[],idempotencyKey:"s9-stale-assinar"});
 expect(r).toMatchObject({status:409,data:{codigo:"REVISAO_FATOS_ALTERADA"}});
 expect(a.eventos().filter(e=>["DOCUMENTO","Tarefa","ConsultaConfirmada"].includes(e.tipo))).toEqual([]);
});
it("falha na gravação da tarefa reverte documentos, marcador e drafts auxiliares atomicamente",async()=>{
 a=await abrirAmbiente(criarDiretorio());cadastrarPaciente(a);await carregarConsulta(a);
 const preparada=await a.request("/consulta/flash/preparar",{...contexto,plano,idempotencyKey:"s9-atomic-preparar"});expect(preparada.status).toBe(200);
 await a.request("/consulta/bundle",{...contexto,draftIds:preparada.data.registros.map((r:{id:string})=>r.id)});
 const antes=a.db.prepare("SELECT * FROM draft_envelope ORDER BY draftId").all();
 a.db.exec("CREATE TRIGGER recusar_tarefa_sintetica BEFORE INSERT ON clinical_event WHEN NEW.tipo='Tarefa' BEGIN SELECT RAISE(ABORT,'FALHA_SINTETICA'); END;");
 const r=await a.request("/consulta/confirmar",{...contexto,bloco:"TUDO",registros:preparada.data.registros,documentosExibidos:preparada.data.documentos.map((d:{documentId:string;documentVersion:number})=>({documentId:d.documentId,documentVersion:d.documentVersion})),reconhecerAlertas:[],idempotencyKey:"s9-atomic-assinar"});
 expect(r.status).toBe(500);expect(a.eventos().filter(e=>["DOCUMENTO","Tarefa","ConsultaConfirmada"].includes(e.tipo))).toEqual([]);
 expect(a.db.prepare("SELECT * FROM draft_envelope ORDER BY draftId").all()).toEqual(antes);
 expect(a.db.prepare("SELECT * FROM operation WHERE operationId='s9-atomic-assinar'").get()).toBeUndefined();
});
