import { performance } from 'node:perf_hooks';
import { once } from 'node:events';
import { expect, it } from 'vitest';
import { abrirLedger } from '../../../src/kernel/ledger/db.js';
import { salvarDraft } from '../../../src/kernel/comandos/portas.js';
import { executarConfirmacao } from '../../../src/kernel/comandos/index.js';
import { criarMotorF1, type ConfigMotor } from '../../../src/kernel/orquestracao/runtime.js';
import { criarGateway, memoriaIdempotencia } from '../../../src/kernel/gateway/gateway.js';
import { criarGerenciadorSessao } from '../../../src/server/sessao.js';
import { criarServidorLocal } from '../../../src/server/http.js';
import { ConsultaResposta } from '../../../src/ui/api/respostas.js';
import { Retrato } from '../../../src/contracts/f1/retrato.js';
import { VisaoIntegrada } from '../../../src/contracts/f1/visaoIntegrada.js';
import { hashCanonico } from '../../../src/rules/conteudoCanonico.js';
import { fonteSintetica } from '../../fixtures/triagem.js';

/** p95 nearest-rank; nenhum descarte de amostras, arredondamento ou ajuste de orçamento. */
function percentil95(amostras:readonly number[]):number {
 if(!amostras.length)throw new Error('DENOMINADOR_VAZIO');
 return [...amostras].sort((a,b)=>a-b)[Math.ceil(amostras.length*.95)-1]!;
}
interface Medida {totalMs:number;primeiroTextoResumoMs:number;cabecalhosMs:number;revisao:string;resumo:string;visao:string}

it('S12 latência HTTP local com Retrato, sete setores e resumo determinístico: 30 amostras, p95 ≤ 2s',async()=>{
 const inicioStartup=performance.now(),em='2026-10-12T12:00:00-03:00',ctx={patientId:'paciente-latencia-sintetico',encounterId:'consulta-latencia-sintetica',tumorLotId:null};
 const db=abrirLedger(':memory:');
 const sessoes=criarGerenciadorSessao({medicoId:'medico-latencia-sintetico',crm:'CRM-SINTETICO',senha:'senha-latencia-sintetica',duracaoMs:3600000,agora:()=>em});
 const login=sessoes.login('senha-latencia-sintetica')!;
 // Fixture de software explicitamente conferida, sem uso assistencial ou paciente real.
 const regra={id:'fixture-latencia',versao:'1',ativo:true,analitos:[{codigo:'creatinina',threshold:{regraId:'fixture-latencia',ativo:true,unidade:'mg/dL',max:2},conversoes:[]}]};
 const ref={id:'fixture-latencia',versao:'1',hash:hashCanonico(regra)},biblioteca={id:'biblioteca-fixture-latencia',versao:'1',hash:hashCanonico({fixture:true})};
 const config:ConfigMotor={regras:[ref],biblioteca,opcoes:{laboratorio:{referencia:ref,status:'CONFERIDA_MEDICO',fonte:'Fixture sintética aprovada exclusivamente para prova de software',conteudo:regra},validadeExame:{referencia:ref,status:'CONFERIDA_MEDICO',fonte:'Fixture sintética; não é protocolo clínico',conteudo:{bioquimicaHoras:72}}}};
 const motorF1=criarMotorF1(db,()=>em,()=>config);
 const payloads=[{tipo:'Paciente',payload:{patientId:ctx.patientId,identificadores:[],nome:'Paciente exclusivamente sintético',nascimento:null,sexoCadastral:'NAO_INFORMADO',divergencia:false}},
  {tipo:'FATO',payload:{campo:'histologia',valor:'histologia exclusivamente sintética'}},
  {tipo:'LabResult',payload:{campo:'creatinina',valor:1,unidade:'mg/dL',data:'2026-10-12T11:00:00-03:00',sourceId:'fonte-latencia'}}];
 for(const [i,item] of payloads.entries()){
  const id=`latencia-fixture-${i}`,draft=salvarDraft(db,{draftId:id,patientId:ctx.patientId,sourceId:id,rawRef:'fixture-local',payload:{contexto:ctx},diagnostics:[],revision:0,criadoEm:em});
  expect(executarConfirmacao(db,{...ctx,operationId:id,reviewDecisionId:`review-${id}`,sessao:login.sessao,em,registros:[{draftId:draft.draftId,expectedRevision:0,eventId:`event-${id}`,tipo:item.tipo,payload:item.payload,fontes:[fonteSintetica(id)],revisao:'CONFIRMADO'}]}).estado).toBe('GRAVADA');
 }
 // Nenhum executor externo ou provider LLM: toda avaliação percorre código local real.
 const gateway=criarGateway({store:memoriaIdempotencia(),agora:()=>em,auditar:()=>{},executores:{}});
 const server=criarServidorLocal({db,sessoes,gateway,motorF1,agora:()=>em,log:()=>{}});
 if(!server.listening)await once(server,'listening');
 const endereco=server.address();if(!endereco||typeof endereco==='string')throw new Error('PORTA_LOOPBACK_AUSENTE');
 const startupMs=performance.now()-inicioStartup,url=`http://127.0.0.1:${endereco.port}/consulta/carregar`;
 async function medir():Promise<Medida>{
  const inicio=performance.now();
  const resposta=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${login.token}`},body:JSON.stringify(ctx)});
  const cabecalhosMs=performance.now()-inicio;
  expect(resposta.status).toBe(200);
  const consulta=ConsultaResposta.parse(JSON.parse(await resposta.text()));
  const retrato=Retrato.parse(consulta.retrato);
  expect(retrato.resumo.length).toBeGreaterThan(0);
  const primeiroTextoResumoMs=performance.now()-inicio;
  const visao=VisaoIntegrada.parse(consulta.visaoIntegrada);
  expect(visao.cobertura.setoresAvaliados).toHaveLength(7);
  const totalMs=performance.now()-inicio;
  return {totalMs,primeiroTextoResumoMs,cabecalhosMs,revisao:retrato.revisao,resumo:hashCanonico(retrato.resumo),visao:hashCanonico(visao)};
 }
 try{
  const frio=await medir();
  const aquecimento=3;for(let i=0;i<aquecimento;i++)await medir();
  const medidas:Medida[]=[];const denominador=30;
  for(let i=0;i<denominador;i++)medidas.push(await medir());
  expect(medidas).toHaveLength(30);
  expect(new Set(medidas.map(m=>m.revisao)).size).toBe(1);
  expect(new Set(medidas.map(m=>m.resumo)).size).toBe(1);
  expect(new Set(medidas.map(m=>m.visao)).size).toBe(1);
  const p95HttpMs=percentil95(medidas.map(m=>m.totalMs)),p95PrimeiroTextoResumoMs=percentil95(medidas.map(m=>m.primeiroTextoResumoMs));
  const maiorPrimeiroTextoMs=Math.max(frio.primeiroTextoResumoMs,...medidas.map(m=>m.primeiroTextoResumoMs)),maiorTotalMs=Math.max(frio.totalMs,...medidas.map(m=>m.totalMs));
  console.info(JSON.stringify({prova:'F1-S12-HTTP-LOOPBACK',escopo:'HTTP+SQLite em memoria+Retrato+7 setores+resumo JSON; nao mede pintura de navegador nem streaming LLM',startupIncluiSeedELogin:true,startupMs,frioMs:frio.totalMs,aquecimento,denominador,metodoPercentil:'nearest-rank',p95HttpMs,p95PrimeiroTextoResumoMs,maiorPrimeiroTextoMs,maiorTotalMs,amostras:medidas.map(({revisao,resumo,visao,...numeros})=>numeros)}));
  expect(p95HttpMs).toBeLessThanOrEqual(2000);
  expect(maiorPrimeiroTextoMs).toBeLessThanOrEqual(4000);
  expect(maiorTotalMs).toBeLessThanOrEqual(20000);
 }finally{await new Promise<void>(resolve=>server.close(()=>resolve()));db.close();}
},60_000);
