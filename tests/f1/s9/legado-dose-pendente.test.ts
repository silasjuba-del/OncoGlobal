import {expect,it} from 'vitest';
import {Readable} from 'node:stream';
import type {IncomingMessage,ServerResponse} from 'node:http';
import {ambiente,ctx,EM} from '../../bateria2/fixtures.js';
import {hashCanonico} from '../../../src/rules/conteudoCanonico.js';
import {criarResolverDocumentoLedger} from '../../../src/kernel/ledger/documentos.js';
import {autorizarSaida} from '../../../src/server/autorizacao.js';
import {rotear,type ServidorDeps} from '../../../src/server/rotas.js';
it('receita legada assinada com dose pendente e conjunto não são reemitidos, inclusive replay',async()=>{
 const a=ambiente();try{
  let n=0;const gravar=(data:Record<string,unknown>)=>a.seed('DOCUMENTO',{data,signature:{documentId:data.documentId,documentVersion:1,documentHash:hashCanonico(data),reviewDecisionId:`review-b2-seed-${++n}`,serverActorId:a.login.sessao.medicoId}},'ASSINADO');
  const rx={documentId:'receita-legada',documentVersion:1,tipoDocumento:'FLASH_RECEITA',titulo:'Receita sintética',texto:'Medicamento: Sintético\nDose: PENDENTE\nVia: PENDENTE'};
  gravar(rx);const conj={documentId:'conjunto-legado',documentVersion:1,tipoDocumento:'FLASH_CONJUNTO_IMPRESSAO',titulo:'Conjunto',texto:`${rx.titulo}\n${rx.texto}`,documentosIncluidos:[{documentId:rx.documentId,documentVersion:1,titulo:rx.titulo}]};gravar(conj);
  const antes=a.db.prepare('SELECT * FROM clinical_event').all();let chamadas=0;
  for(const id of [rx.documentId,conj.documentId]){
   const intent={verbo:'IMPRIMIR' as const,objeto:{tipo:'DOCUMENTO',id,versao:1},escopo:{patientId:ctx.patientId,encounterId:ctx.encounterId},destino:null,idempotencyKey:'recibo-legado-sintetico'};
   expect(autorizarSaida(a.db,intent)).toMatchObject({ok:false,codigo:'RECEITA_DOSE_PENDENTE'});
   expect(await criarResolverDocumentoLedger(a.db).resolver({id,version:1})).toBeNull();
   const req=Object.assign(Readable.from([JSON.stringify(intent)]),{method:'POST',url:'/acao',headers:{authorization:`Bearer ${a.acesso.token}`,'content-type':'application/json'}}) as unknown as IncomingMessage;
   let status=0,body='';const res={writeHead:(s:number)=>{status=s;},end:(s:string)=>{body=s;}} as unknown as ServerResponse;
   const gateway={executar:async()=>{chamadas++;return {decisao:'REPLAY',motivoCodigo:'OK',recibo:'antigo'};}} as unknown as ServidorDeps['gateway'];
   await rotear({db:a.db,sessoes:a.acesso.sessoes,gateway,agora:()=>EM,log:()=>{}},req,res);
   expect(status).toBe(409);expect(body).toContain('RECEITA_DOSE_PENDENTE');
  }
  expect(chamadas).toBe(0);expect(a.db.prepare('SELECT * FROM clinical_event').all()).toEqual(antes);
 }finally{a.db.close();}
});
