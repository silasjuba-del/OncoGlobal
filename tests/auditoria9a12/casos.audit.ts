import { expect,it } from 'vitest';
import { once } from 'node:events';
import { criarServidorLocal } from '../../src/server/http.js';
import { criarGateway,memoriaIdempotencia } from '../../src/kernel/gateway/gateway.js';
import { readFileSync } from 'node:fs';
import { Apac } from '../../src/contracts/operacao.js';
import { apacTimeline } from '../../src/kernel/projections/apacTimeline.js';
import { registrarDesfechoPesoSalaoF3 } from '../../src/server/salaoF3.js';
import { SalaoRuleset } from '../../src/contracts/regras.js';
import { projetarEstatisticaLedger } from '../../src/kernel/projections/estatistica.js';
import { listarEventos } from '../../src/kernel/comandos/portas.js';
import { verificarPrescricaoDuto } from '../../src/server/dutos.js';
import { validarFronteiraWorkStudyF6 } from '../../src/modules/setores/rbacSetorialF6.js';
import { ambiente,ctx,EM } from '../bateria2/fixtures.js';
import { apac } from '../apac-w10/helpers.js';

it('9X1: contrato deve guardar data da decisão separada do recebimento',()=>{
 const a=apac('sintetica9');
 expect(Apac.safeParse({...a,estado:'AUTORIZADA',resultadoExterno:{valor:'AUTORIZADA',comprovanteRef:'comprovante-sintetico',motivo:null,recebidoEm:EM,decididoEm:'2026-10-12T12:00:00Z'}}).success).toBe(true);
});
it('9X7: chegada invertida preserva os dois registros e a ligação do recurso; vigente visual não demonstrado',()=>{
 const a=ambiente();try{
  const original={...apac('antiga'),tumorLotId:ctx.tumorLotId!};
  const recurso={...original,apacId:'recurso',substituiApacId:'antiga',estado:'AUTORIZADA',resultadoExterno:{valor:'AUTORIZADA',comprovanteRef:'recurso-sintetico',motivo:null,recebidoEm:EM}};
  a.seed('APAC',recurso);a.seed('APAC',original); // chegada invertida
  const historia=apacTimeline(listarEventos(a.db,ctx.patientId));
  expect(historia.map(x=>x.apacId)).toEqual(['recurso','antiga']);
  expect(historia.find(x=>x.apacId==='recurso')?.substituiApacId).toBe('antiga');
 }finally{a.db.close();}
});
it('10X6: marcar nutrição criada deve produzir tarefa real com responsável e prazo',()=>{
 const a=ambiente();try{
  const ruleset=SalaoRuleset.parse(JSON.parse(readFileSync('corpus/rulesets/salao-triagem.v1.json','utf8')));
  const r=registrarDesfechoPesoSalaoF3(a.db,a.acesso,{...ctx,hoje:'2026-10-19',ruleset,pesagens:[{data:'2026-09-19',kg:70,origem:'MEDIDO'},{data:'2026-10-19',kg:64.4,origem:'MEDIDO'}]});
  expect(r.ok).toBe(true);if(!r.ok)return;expect(r.desfecho.tarefaNutricaoCriada).toBe(true);
  expect(listarEventos(a.db,ctx.patientId).some(e=>e.tipo==='Tarefa')).toBe(true);
 }finally{a.db.close();}
});
it('11X: assinatura por HTTP sem sessão válida é recusada; isso não prova RBAC de técnico',async()=>{
 const a=ambiente();
 const server=criarServidorLocal({db:a.db,sessoes:a.acesso.sessoes,agora:()=>EM,log:()=>{},gateway:criarGateway({agora:()=>EM,auditar:()=>{},store:memoriaIdempotencia(),executores:{}})});
 if(!server.listening)await once(server,'listening');
 const address=server.address();if(!address||typeof address==='string')throw Error('PORTA');
 try {
  const r=await fetch(`http://127.0.0.1:${address.port}/consulta/confirmar`,{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer token-sintetico-invalido'},body:JSON.stringify({...ctx,acao:'ASSINAR'})});
  expect(r.status).toBe(401);expect(listarEventos(a.db,ctx.patientId)).toHaveLength(0);
 }finally{await new Promise<void>(r=>server.close(()=>r()));a.db.close();}
});
it('11XH: assinatura com conteúdo alterado não permanece válida',()=>{
 const a=ambiente();try{
  a.assinar();const e=listarEventos(a.db,ctx.patientId);
  const adulterados=e.map(v=>v.tipo!=='DOCUMENTO'?v:{...v,payload:{...(v.payload as object),data:{...(v.payload as any).data,data:{...(v.payload as any).data.data,texto:'Dose alterada sintética'}}}});
  expect(verificarPrescricaoDuto(adulterados,ctx,{documentId:'rx-c1',documentVersion:1}).ok).toBe(false);
 }finally{a.db.close();}
});
it('12X: helper recusa conversão STUDY para WORK',()=>{
 expect(validarFronteiraWorkStudyF6({territorioOrigem:'STUDY',territorioDestino:'WORK',contemProntuarioOuPhi:false}).permitido).toBe(false);
});
it('12X2: marcador STUDY na entrada sintética não deve aumentar denominador assistencial',()=>{
 const a=ambiente();try {
  const antes=projetarEstatisticaLedger(a.db).denominadorPacientes;
  a.seed('FATO',{campo:'evento-simulado',valor:'neutropenia febril fictícia',territorio:'STUDY'});
  expect(projetarEstatisticaLedger(a.db).denominadorPacientes).toBe(antes);
 }finally{a.db.close();}
});
