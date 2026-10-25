import {expect,it,vi} from 'vitest';
import {createHash} from 'node:crypto';
import {createServer} from 'node:http';
import {once} from 'node:events';
import {ambiente,ctx,EM} from '../../bateria2/fixtures.js';
import {hashCanonico} from '../../../src/rules/conteudoCanonico.js';
import {criarResolverDocumentoLedger} from '../../../src/kernel/ledger/documentos.js';
import {autorizarSaida} from '../../../src/server/autorizacao.js';
import {rotear} from '../../../src/server/rotas.js';
import {criarGateway,memoriaIdempotencia} from '../../../src/kernel/gateway/gateway.js';
it('receita legada assinada com dose pendente e conjunto não são reemitidos, inclusive replay',async()=>{
 const a=ambiente();let server:ReturnType<typeof createServer>|undefined;try{
  let n=0;const gravar=(data:Record<string,unknown>)=>a.seed('DOCUMENTO',{data,signature:{documentId:data.documentId,documentVersion:1,documentHash:hashCanonico(data),reviewDecisionId:`review-b2-seed-${++n}`,serverActorId:a.login.sessao.medicoId}},'ASSINADO');
  const rx={documentId:'receita-legada',documentVersion:1,tipoDocumento:'FLASH_RECEITA',titulo:'Receita sintética',texto:'Medicamento: Sintético\nDose: PENDENTE\nVia: PENDENTE'};
  gravar(rx);const conj={documentId:'conjunto-legado',documentVersion:1,tipoDocumento:'FLASH_CONJUNTO_IMPRESSAO',titulo:'Conjunto',texto:`${rx.titulo}\n${rx.texto}`,documentosIncluidos:[{documentId:rx.documentId,documentVersion:1,titulo:rx.titulo}]};gravar(conj);
  const antes=a.db.prepare('SELECT * FROM clinical_event').all();let chamadas=0;
  const operacoesAntes=a.db.prepare('SELECT * FROM operation').all();
  const store=memoriaIdempotencia();
  const gateway=criarGateway({agora:()=>EM,auditar:()=>{},store,executores:{
   IMPRIMIR:{executar:async()=>{chamadas++;return {ok:true,recibo:'impressao-sintetica'};}}
  }});
  const deps={db:a.db,sessoes:a.acesso.sessoes,gateway,agora:()=>EM,log:()=>{}};
  server=createServer((req,res)=>{void rotear(deps,req,res);});
  server.listen(0,'127.0.0.1');await once(server,'listening');
  const address=server.address();if(!address||typeof address==='string')throw Error('PORTA_AUSENTE');
  for(const id of [rx.documentId,conj.documentId]){
   const intent={verbo:'IMPRIMIR' as const,objeto:{tipo:'DOCUMENTO',id,versao:1},escopo:{patientId:ctx.patientId,encounterId:ctx.encounterId},destino:null,idempotencyKey:`recibo-legado-${id}`};
   // Recibo legado existente: o gateway isolado o reproduziria, mas a porta HTTP deve recusá-lo antes.
   store.set(intent.idempotencyKey,{payloadHash:createHash('sha256').update(JSON.stringify(intent)).digest('hex'),
    resultado:{decisao:'EXECUTADA',motivoCodigo:'OK',recibo:'recibo-antigo-sintetico'}},EM);
   expect(await gateway.executar(intent,a.login.sessao)).toMatchObject({decisao:'REPLAY',recibo:'recibo-antigo-sintetico'});
   const executar=vi.spyOn(gateway,'executar');
   expect(autorizarSaida(a.db,intent)).toMatchObject({ok:false,codigo:'RECEITA_DOSE_PENDENTE'});
   expect(await criarResolverDocumentoLedger(a.db).resolver({id,version:1})).toBeNull();
   for(let tentativa=0;tentativa<2;tentativa++){
    const response=await fetch(`http://127.0.0.1:${address.port}/acao`,{method:'POST',headers:{
     authorization:`Bearer ${a.acesso.token}`,'content-type':'application/json'},body:JSON.stringify(intent)});
    const body=await response.json() as {codigo?:string};
    expect(response.status).toBe(409);expect(body.codigo).toBe('RECEITA_DOSE_PENDENTE');
   }
   expect(executar).not.toHaveBeenCalled();executar.mockRestore();
  }
  expect(chamadas).toBe(0);expect(a.db.prepare('SELECT * FROM clinical_event').all()).toEqual(antes);
  expect(a.db.prepare('SELECT * FROM operation').all()).toEqual(operacoesAntes);
 }finally{if(server?.listening)await new Promise<void>(resolve=>server!.close(()=>resolve()));a.db.close();}
});
