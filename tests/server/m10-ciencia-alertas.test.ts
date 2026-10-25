// M10 (decisão do Dr. Silas, 24/10/2026): assinar exige ciência de todo alerta vermelho exibido e vigente.
// Testes escritos ANTES da implementação: os casos de recusa falham na main 7d7ae2d.
import {afterEach,expect,it} from "vitest";
import {abrirAmbiente,cadastrarPaciente,carregarConsulta,finalizarFlash,criarDiretorio,removerDiretorio,PACIENTE,ENCONTRO,AGORA} from "../f0-fecha/fixtures/consulta-completa.js";
import {salvarDraft} from "../../src/kernel/ledger/drafts.js";
import {confirmar} from "../../src/kernel/ledger/writeRouter.js";
import {registrarCienciaAlertas} from "../../src/server/alertasConsulta.js";
let a:Awaited<ReturnType<typeof abrirAmbiente>>;
afterEach(async()=>{if(a){await a.close();removerDiretorio(a.dir);a=undefined!;}});
async function abrir(){a=await abrirAmbiente(criarDiretorio());cadastrarPaciente(a);await carregarConsulta(a);
 gravar("agenda-m10","AgendaEntry",{patientId:PACIENTE,encounterId:ENCONTRO,data:"2026-10-09",horario:"12:00"});return a;}
function gravar(id:string,tipo:string,payload:unknown){
 salvarDraft(a.db,{draftId:id,patientId:PACIENTE,sourceId:`fonte-${id}`,rawRef:"fixture-sintetica",payload:{},diagnostics:[],revision:0,criadoEm:AGORA});
 const r=confirmar(a.db,{operationId:`op-${id}`,patientId:PACIENTE,encounterId:ENCONTRO,tumorLotId:null,reviewDecisionId:`rev-${id}`,sessao:a.sessoes.obter(a.token)!,em:AGORA,registros:[{draftId:id,expectedRevision:0,eventId:id,tipo,payload,fontes:[],revisao:"CONFIRMADO"}]});
 expect(r.estado).toBe("GRAVADA");
}
/** A projeção atribui o alertaId exibido; a fixture localiza cada alerta pelo texto sintético. */
async function exibidos(){const c=await carregarConsulta(a);return new Map<string,string>(c.data.alertas.map((x:{texto:string;alertaId:string})=>[x.texto.replace("Alerta sintetico ",""),x.alertaId]));}
function gravarAlerta(id:string,vermelho=true){
 const payload={alertaId:id,alvo:{patientId:PACIENTE},natureza:"AMEACA_IMEDIATA",classeRisco:null,texto:`Alerta sintetico ${id}`,origemRegra:"regra-sintetica",evidencias:[],presentationOverride:vermelho,authorityOverride:false,reconhecidoEm:null,destino:"CHAT"};
 gravar(id,"Alerta",payload);
}
it('contingência deriva E1 do servidor mesmo com flag cliente falsa e recusa replay desatualizado',async()=>{
 await abrir();
 const p={patientId:PACIENTE,encounterId:ENCONTRO,operationId:'contingencia-sem-e1',destino:'SALAO',emergenciaAtiva:false,alertasOperacionaisE1:[],resumoTriagem:{observacao:'Registro sintético'}};
 expect((await a.request('/consulta/salao/contingencia/gerar',p)).status).toBe(200);
 gravarAlerta('e1-servidor');
 expect(await a.request('/consulta/salao/contingencia/gerar',p)).toMatchObject({status:409,data:{codigo:'FOLHA_DESATUALIZADA_POR_E1'}});
 const atual=await a.request('/consulta/salao/contingencia/gerar',{...p,operationId:'contingencia-com-e1'});
 expect(atual.status).toBe(200);expect(atual.data.folha.emergenciaAtiva).toBe(true);
 expect(atual.data.folha.htmlImprimivel).toContain('E1 — EMERGÊNCIA ATIVA');
});
async function pedidoAssinatura(chave:string,reconhecerAlertas:string[]){
 const {context,preparada}=await finalizarFlash(a,chave);expect(preparada.status).toBe(200);
 await a.request("/consulta/bundle",context);
 return {...context,bloco:"TUDO",registros:preparada.data.registros,
  documentosExibidos:preparada.data.documentos.map((d:{documentId:string;documentVersion:number})=>({documentId:d.documentId,documentVersion:d.documentVersion})),
  reconhecerAlertas,idempotencyKey:`${chave}:assinar`};
}
/** A tabela de ciência é criada na primeira ciência; ausência da tabela significa zero ciências. */
const nCiencias=()=>a.db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='alerta_reconhecimento'").get()
 ? a.db.prepare("SELECT COUNT(*) AS n FROM alerta_reconhecimento").get()!.n as number : 0;
const nDocumentos=()=>a.eventos().filter(e=>e.tipo==="DOCUMENTO").length;

it("M10 replay preserva resultado após vermelho novo sem gravar ciência ou eventos novamente",async()=>{
 await abrir();gravarAlerta("vermelho-original");const ids=await exibidos();
 const pedido=await pedidoAssinatura("m10-replay",[ids.get("vermelho-original")!]);
 const primeira=await a.request("/consulta/confirmar",pedido);expect(primeira.status).toBe(200);
 gravarAlerta("vermelho-posterior");
 const eventos=a.eventos(),ciencias=nCiencias();
 const auditorias=a.db.prepare("SELECT COUNT(*) AS n FROM audit_event").get()!.n;
 const replay=await a.request("/consulta/confirmar",pedido);
 expect(replay.status).toBe(200);expect(replay.data.codigo).toBe("REPLAY");
 expect(replay.data.resultRef).toBe(primeira.data.resultRef);
 expect(a.eventos()).toEqual(eventos);expect(nCiencias()).toBe(ciencias);
 expect(a.db.prepare("SELECT COUNT(*) AS n FROM audit_event").get()!.n).toBe(auditorias);
 const adulterado=await a.request("/consulta/confirmar",{...pedido,reconhecerAlertas:[]});
 expect(adulterado.status).toBe(409);expect(a.eventos()).toEqual(eventos);expect(nCiencias()).toBe(ciencias);
});

it("M10-01 recusa assinatura sem ciência quando há alerta vermelho exibido, sem gravar nada",async()=>{
 await abrir();gravarAlerta("vermelho-1");
 expect((await exibidos()).size).toBe(1);
 const antes=nDocumentos();
 const r=await a.request("/consulta/confirmar",await pedidoAssinatura("ciencia-m10-01",[]));
 expect(r.status).toBe(409);expect(r.data.codigo).toBe("CIENCIA_ALERTA_OBRIGATORIA");
 expect(nDocumentos()).toBe(antes);expect(nCiencias()).toBe(0);
});

it("M10-02 recusa ciência parcial: dois vermelhos exibidos, só um reconhecido",async()=>{
 await abrir();gravarAlerta("vermelho-1");gravarAlerta("vermelho-2");const ids=await exibidos();
 const r=await a.request("/consulta/confirmar",await pedidoAssinatura("ciencia-m10-02",[ids.get("vermelho-1")!]));
 expect(r.status).toBe(409);expect(r.data.codigo).toBe("CIENCIA_ALERTA_OBRIGATORIA");expect(nCiencias()).toBe(0);
});

it("M10-03 aceita quando todos os vermelhos exibidos são reconhecidos (comportamento atual preservado)",async()=>{
 await abrir();gravarAlerta("vermelho-1");gravarAlerta("vermelho-2");const ids=await exibidos();
 const r=await a.request("/consulta/confirmar",await pedidoAssinatura("ciencia-m10-03",[ids.get("vermelho-1")!,ids.get("vermelho-2")!]));
 expect(r.status).toBe(200);expect(nCiencias()).toBe(2);
});

it("M10-04 sem alerta vermelho, lista vazia continua aceita",async()=>{
 await abrir();
 const r=await a.request("/consulta/confirmar",await pedidoAssinatura("ciencia-m10-04",[]));
 expect(r.status).toBe(200);
});

it("M10-05 alerta já reconhecido antes (ciência registrada) não exige nova ciência",async()=>{
 await abrir();gravarAlerta("vermelho-1");const ids=await exibidos();
 // Ciência anterior gravada pelo mesmo mecanismo da rota; uma segunda assinatura no mesmo encontro é recusada pelo fluxo.
 registrarCienciaAlertas(a.db,{patientId:PACIENTE,encounterId:ENCONTRO,tumorLotId:null},[ids.get("vermelho-1")!],a.sessoes.obter(a.token)!.medicoId,AGORA,"ciencia-previa-m10");
 expect((await carregarConsulta(a)).data.alertas[0].reconhecidoEm).toBe(AGORA);
 const r=await a.request("/consulta/confirmar",await pedidoAssinatura("ciencia-m10-05",[]));
 expect(r.status).toBe(200);expect(nCiencias()).toBe(1);
});

it("M10-06 o que já era recusado continua recusado (id não exibido)",async()=>{
 await abrir();gravarAlerta("vermelho-1");const ids=await exibidos();
 const r=await a.request("/consulta/confirmar",await pedidoAssinatura("ciencia-m10-06",[ids.get("vermelho-1")!,"nao-exibido"]));
 expect(r.status).toBe(409);expect(r.data.codigo).toBe("ALERTA_NAO_EXIBIDO_OU_ALTERADO");
});

// Decisões do Dr. Silas (24/10/2026): Q1 só vermelhos; Q2 recusar vermelho novo não exibido.
it("M10-07 [Q1] alerta não vermelho exibido não exige ciência",async()=>{
 await abrir();gravarAlerta("amarelo-1",false);await exibidos();
 const r=await a.request("/consulta/confirmar",await pedidoAssinatura("ciencia-m10-07",[]));
 expect(r.status).toBe(200);expect(nCiencias()).toBe(0);
});

it("M10-08 [Q2] vermelho novo, vigente mas não exibido, recusa a assinatura sem gravar nada",async()=>{
 await abrir();gravarAlerta("vermelho-1");const ids=await exibidos();
 const pedido=await pedidoAssinatura("ciencia-m10-08",[ids.get("vermelho-1")!]);
 gravarAlerta("vermelho-novo");const antes=nDocumentos();
 const r=await a.request("/consulta/confirmar",pedido);
 expect(r.status).toBe(409);expect(r.data.codigo).toBe("ALERTA_NOVO_NAO_EXIBIDO");
 expect(nDocumentos()).toBe(antes);expect(nCiencias()).toBe(0);
});
