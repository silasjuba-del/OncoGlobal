import { describe,it,expect,vi } from 'vitest';
import { ambienteHttp } from '../../server/http-fixture.js';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { abrirLedger } from '../../../src/kernel/ledger/db.js';
import { criarGerenciadorSessao } from '../../../src/server/sessao.js';
import { rotearBiblioteca, referenciaBibliotecaAtiva, hashCuradoriaPacote } from '../../../src/server/biblioteca.js';
import { sha256Biblioteca } from '../../../src/kernel/corpus/biblioteca.js';
import { respostaHttpValida } from '../../../src/contracts/api/saidasHttp.js';
function pacote(versao='1.0.0'){
 const item={schema:'ItemBiblioteca@1',id:'item',versao,pilar:6,tipo:'REGRA',titulo:'Fixture pública sintética',texto:'Texto manual, sem regra médica executável.',aplicabilidade:{tumor:['sintetico'],histologia:[],estadio:[],biomarcador:[],linha:[]},proveniencia:{fonte:'https://example.org/fixture',trecho:'Fixture pública',publicadoEm:'2026-01-01',recuperadoEm:'2026-01-01T00:00:00Z',licenca:'Fixture'},dependencias:[]};
 const texto=JSON.stringify(item);return {manifesto:{schema:'PacoteBiblioteca@1',id:'sintetico',versao,origem:'GENSPARK_MANUAL',classificacao:'PUBLIC',criadoEm:'2026-01-01T00:00:00Z',itens:[{id:'item',versao,arquivo:'item.json',sha256:sha256Biblioteca(texto)}]},arquivos:{'item.json':{texto}}};
}
async function ambiente(){
 let instante='2026-10-12T10:00:00Z';
 const db=abrirLedger(':memory:'),agora=()=> instante;
 const sessoes=criarGerenciadorSessao({medicoId:'medico',crm:'SINTETICO',senha:'segredo-sintetico-123',duracaoMs:3600000,agora});
 const auth=sessoes.login('segredo-sintetico-123')!;const deps={db,sessoes,agora};
 const server=createServer(async(req,res)=>{let raw='';for await(const part of req)raw+=part;const token=String(req.headers.authorization??'').replace('Bearer ','');const result=rotearBiblioteca(deps,token,req.url!,JSON.parse(raw),sessoes.obter(token)??auth.sessao);res.writeHead(result?.status??404,{'Content-Type':'application/json'});res.end(JSON.stringify(result?.body??{}));});
 await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));const base=`http://127.0.0.1:${(server.address() as AddressInfo).port}`;
 return {db,auth,async curar(body: Record<string, unknown>, token = auth.token) { const r = await fetch(base + '/biblioteca/curar', {method:'POST',headers:{authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify({expectedCuradoriaHash:hashCuradoriaPacote(db,String(body.pacoteId)),...body})}); return {status:r.status,body:await r.json() as Record<string,any>}; }, novaSessao:()=>sessoes.login('segredo-sintetico-123')!,relogio(valor:string){instante=valor;},async post(rota:string,body:unknown,token=auth.token){const r=await fetch(base+rota,{method:'POST',headers:{authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify(body)});return {status:r.status,body:await r.json() as Record<string,any>};},async close(){await new Promise<void>((resolve,reject)=>server.close(e=>e?reject(e):resolve()));db.close();}};
}
describe('S3 biblioteca manual no HTTP real',()=>{
 it('revisão antiga não restaura um item tornado obsoleto por outra sessão',async()=>{
  const a=await ambiente();try{
   const imp=await a.post('/biblioteca/importar',pacote());
   const base={pacoteId:imp.body.pacoteId,itemId:'item',expectedHash:imp.body.hash};
   const antigo=(await a.post('/biblioteca/estado',{pacoteId:base.pacoteId})).body.curadoriaHash;
   expect((await a.curar({...base,estado:'CONSULTAVEL',expectedCuradoriaHash:antigo})).status).toBe(200);
   const tela=(await a.post('/biblioteca/estado',{pacoteId:base.pacoteId})).body.curadoriaHash;
   expect((await a.post('/biblioteca/ativar',{pacoteId:base.pacoteId,expectedHash:base.expectedHash,expectedCuradoriaHash:tela})).status).toBe(200);
   expect((await a.curar({...base,estado:'OBSOLETO',expectedCuradoriaHash:tela},a.novaSessao().token)).status).toBe(200);
   expect((await a.curar({...base,estado:'CONSULTAVEL',expectedCuradoriaHash:tela})).body.codigo).toBe('BIBLIOTECA_REVISAO_DIVERGENTE');
   expect((await a.post('/biblioteca/consultar',{filtros:{}})).body.itens).toEqual([]);
   expect((await a.post('/biblioteca/curar',{...base,estado:'CONSULTAVEL'})).status).toBe(400);
  }finally{await a.close();}
 });
 it('rollback confere alvo e curadoria exibidos e não escolhe outra versão silenciosamente',async()=>{
  const a=await ambiente();try{
   const p1=await a.post('/biblioteca/importar',pacote()),p2=await a.post('/biblioteca/importar',pacote('2.0.0'));
   for(const p of [p1,p2]){
    await a.curar({pacoteId:p.body.pacoteId,itemId:'item',expectedHash:p.body.hash,estado:'CONSULTAVEL'});
    await a.post('/biblioteca/ativar',{pacoteId:p.body.pacoteId,expectedHash:p.body.hash,expectedCuradoriaHash:(await a.post('/biblioteca/estado',{pacoteId:p.body.pacoteId})).body.curadoriaHash});
   }
   const alvo=await a.post('/biblioteca/estado',{pacoteId:p1.body.pacoteId});
   const pedido={expectedAtiva:p2.body.pacoteId,expectedHash:p2.body.hash,expectedAnterior:p1.body.pacoteId,expectedAnteriorHash:p1.body.hash,expectedAnteriorCuradoriaHash:alvo.body.curadoriaHash};
   const antes=a.db.prepare('SELECT count(*) n FROM biblioteca_ativacao').get()!.n;
   for(const estado of ['OBSOLETO','CONSULTAVEL']){
    await a.curar({pacoteId:p1.body.pacoteId,itemId:'item',expectedHash:p1.body.hash,estado},a.novaSessao().token);
    expect(await a.post('/biblioteca/rollback',pedido)).toEqual({status:409,body:{codigo:'BIBLIOTECA_REVISAO_DIVERGENTE'}});
    expect(a.db.prepare('SELECT count(*) n FROM biblioteca_ativacao').get()!.n).toBe(antes);
   }
   const atual=await a.post('/biblioteca/estado',{pacoteId:p1.body.pacoteId});
   expect((await a.post('/biblioteca/rollback',{...pedido,expectedAnteriorCuradoriaHash:atual.body.curadoriaHash})).status).toBe(200);
   expect(referenciaBibliotecaAtiva(a.db)?.versao).toBe('1.0.0');
  }finally{await a.close();}
 });
 it('roteador real importa pacote Unicode acima de 1 MB sem perder bytes',async()=>{
  const a=await ambienteHttp();try{
   const base=pacote();const original=JSON.parse(base.arquivos['item.json'].texto);
   const arquivos:Record<string,{texto:string}>={};
   const itens=Array.from({length:8},(_,i)=>{const id=`item-${i}`,arquivo=`${id}.json`;
    const texto=JSON.stringify({...original,id,texto:'á'.repeat(100_000)});arquivos[arquivo]={texto};
    return {id,versao:'1.0.0',arquivo,sha256:sha256Biblioteca(texto)};});
   const raw=JSON.stringify({manifesto:{...base.manifesto,itens},arquivos});
   expect(Buffer.byteLength(raw)).toBeGreaterThan(1_000_000);
   const r=await a.request('/biblioteca/importar','POST',raw,a.token,'application/json');
   expect(r.status,r.body).toBe(201);
   expect(a.db.prepare('SELECT count(*) n FROM biblioteca_pacote').get()?.n).toBe(1);
   const excesso:Record<string,{texto:string}>={};
   const refs=Array.from({length:46},(_,i)=>{const id=`excesso-${i}`,arquivo=`${id}.json`,texto=JSON.stringify({...original,id,texto:'x'.repeat(180_000)});excesso[arquivo]={texto};return {id,versao:'1.0.0',arquivo,sha256:sha256Biblioteca(texto)};});
   const negado=await a.request('/biblioteca/importar','POST',JSON.stringify({manifesto:{...base.manifesto,id:'excesso',itens:refs},arquivos:excesso}),a.token,'application/json');
   expect(negado.status).toBe(409);expect(JSON.parse(negado.body).codigo).toBe('PACOTE_EXCESSIVO');
   expect(a.db.prepare('SELECT count(*) n FROM biblioteca_pacote').get()?.n).toBe(1);
  }finally{await a.close();}
 });
 it('inventário lê curadoria em lote e só hidrata conteúdo do pacote selecionado',async()=>{
  const a=await ambiente();try{
   const base=pacote(),original=JSON.parse(base.arquivos['item.json'].texto);
   const arquivos:Record<string,{texto:string}>={};
   const itens=Array.from({length:120},(_,i)=>{const id=`item-${i}`,arquivo=`${id}.json`,texto=JSON.stringify({...original,id});arquivos[arquivo]={texto};return {id,versao:'1.0.0',arquivo,sha256:sha256Biblioteca(texto)};});
   const imp=await a.post('/biblioteca/importar',{manifesto:{...base.manifesto,itens},arquivos});expect(imp.status).toBe(201);
   await a.curar({pacoteId:imp.body.pacoteId,itemId:'item-0',expectedHash:imp.body.hash,estado:'OBSOLETO'});
   const spy=vi.spyOn(a.db,'prepare');
   try{
    const estado=await a.post('/biblioteca/estado',{});expect(estado.body.itens).toEqual([]);
    expect(estado.body.pacotes[0].itens).toHaveLength(120);
    expect(estado.body.pacotes[0].itens[0].estado).toBe('OBSOLETO');
    expect(spy.mock.calls.filter(([sql])=>/SELECT .*biblioteca_curadoria/.test(sql)).length).toBeLessThan(5);
    spy.mockClear();
    const detalhe=await a.post('/biblioteca/estado',{pacoteId:imp.body.pacoteId});expect(detalhe.body.itens).toHaveLength(120);
    expect(spy.mock.calls.filter(([sql])=>/SELECT .*biblioteca_curadoria/.test(sql)).length).toBeLessThan(6);
   }finally{spy.mockRestore();}
  }finally{await a.close();}
 });
 it('recusa ativação com curadoria alterada por outra sessão, inclusive retorno ao mesmo estado',async()=>{
  const a=await ambiente();try {
   const outra=a.novaSessao();const p=await a.post('/biblioteca/importar',pacote());
   const pedido={pacoteId:p.body.pacoteId,itemId:'item',expectedHash:p.body.hash};
   await a.curar({...pedido,estado:'CONSULTAVEL'},outra.token);
   const exibido=await a.post('/biblioteca/estado',{pacoteId:pedido.pacoteId});
   const ativar={pacoteId:pedido.pacoteId,expectedHash:pedido.expectedHash,expectedCuradoriaHash:exibido.body.curadoriaHash};
   await a.curar({...pedido,estado:'OBSOLETO'},outra.token);
   expect(await a.post('/biblioteca/ativar',ativar)).toEqual({status:409,body:{codigo:'BIBLIOTECA_REVISAO_DIVERGENTE'}});
   await a.curar({...pedido,estado:'CONSULTAVEL'},outra.token);
   expect(await a.post('/biblioteca/ativar',ativar)).toEqual({status:409,body:{codigo:'BIBLIOTECA_REVISAO_DIVERGENTE'}});
   expect(a.db.prepare('SELECT count(*) n FROM biblioteca_ativacao').get()?.n).toBe(0);
   expect((await a.post('/biblioteca/ativar',{pacoteId:pedido.pacoteId,expectedHash:pedido.expectedHash})).status).toBe(400);
   const atual=await a.post('/biblioteca/estado',{pacoteId:pedido.pacoteId});
   expect(atual.body.hash).toBe(exibido.body.hash);
   expect(atual.body.curadoriaHash).not.toBe(exibido.body.curadoriaHash);
   expect((await a.post('/biblioteca/ativar',{...ativar,expectedCuradoriaHash:atual.body.curadoriaHash})).status).toBe(200);
  }finally{await a.close();}
 });
 it('relógio inválido recusa leitura e curadoria sem efeitos e se recupera',async()=>{
  const a=await ambiente();try {
   const p=await a.post('/biblioteca/importar',pacote());
   a.relogio('instante-invalido');
   const pedido={pacoteId:p.body.pacoteId,itemId:'item',expectedHash:p.body.hash,estado:'CONSULTAVEL'};
   for(const rota of ['/biblioteca/estado','/biblioteca/curar']){
    const r=await a.post(rota,rota.endsWith('/curar')?pedido:{});
    expect(r).toEqual({status:503,body:{codigo:'RELOGIO_SERVICO_INVALIDO'}});
   }
   expect(a.db.prepare('SELECT count(*) n FROM biblioteca_curadoria').get()?.n).toBe(0);
   a.relogio('2026-10-12T10:01:00Z');
   expect((await a.curar(pedido)).status).toBe(200);
  }finally{await a.close();}
 });
 it('importa texto/base64, cura manualmente, ativa, consulta e restaura sem promover regra textual',async()=>{
  const a=await ambiente();try {
   const p=pacote(),first=await a.post('/biblioteca/importar',p);expect(first.status).toBe(201);const id=first.body.pacoteId,hash=first.body.hash;
   const estado=await a.post('/biblioteca/estado',{pacoteId:id});
   expect(respostaHttpValida('/biblioteca/estado',estado.status,estado.body)).toBe(true);
   expect(estado.body.itens).toMatchObject([{id:'item',estado:'RASCUNHO',titulo:'Fixture pública sintética',texto:'Texto manual, sem regra médica executável.',proveniencia:{fonte:'https://example.org/fixture'}}]);
   expect(estado.body.itens[0].curadoria).toBeNull();
   expect(estado.body.pacotes).toEqual([{pacoteId:id,versao:'1.0.0',hash,ativo:false,itens:[{id:'item',estado:'RASCUNHO'}]}]);
   expect((await a.post('/biblioteca/ativar',{pacoteId:id,expectedHash:hash,expectedCuradoriaHash:(await a.post('/biblioteca/estado',{pacoteId:id})).body.curadoriaHash})).body.codigo).toBe('SEM_ITEM_APROVADO');
   expect((await a.curar({pacoteId:id,itemId:'item',expectedHash:hash,estado:'ALERTA'})).body.codigo).toBe('ALERTA_SEM_SCHEMA_EXECUTAVEL');
   expect((await a.curar({pacoteId:id,itemId:'item',expectedHash:hash,estado:'CONSULTAVEL'})).status).toBe(200);
   const active=await a.post('/biblioteca/ativar',{pacoteId:id,expectedHash:hash,expectedCuradoriaHash:(await a.post('/biblioteca/estado',{pacoteId:id})).body.curadoriaHash});expect(active.status).toBe(200);expect(active.body.referencia.hash).toMatch(/^[a-f0-9]{64}$/);
   const aud=await a.post('/biblioteca/estado',{pacoteId:id});
   expect(respostaHttpValida('/biblioteca/estado',aud.status,aud.body)).toBe(true);
   expect(aud.body.itens[0].curadoria).toEqual({ator:'medico',registradoEm:'2026-10-12T10:00:00Z'});
   expect(aud.body.ativacao).toEqual({pacote:id,anterior:null,motivo:'ATIVACAO',ator:'medico',registradoEm:'2026-10-12T10:00:00Z'});
   const consulta=await a.post('/biblioteca/consultar',{filtros:{tumor:'sintetico'}});expect(consulta.body.itens).toHaveLength(1);
   expect((await a.post('/biblioteca/consultar',{filtros:{tumor:'sintetico'},modo:'ALERTA'})).body.itens).toEqual([]);
   const p2=pacote('2.0.0'),b64={...p2,arquivos:{'item.json':{base64:Buffer.from(p2.arquivos['item.json'].texto).toString('base64')}}};
   const second=await a.post('/biblioteca/importar',b64);expect(second.status).toBe(201);
   await a.curar({pacoteId:second.body.pacoteId,itemId:'item',expectedHash:second.body.hash,estado:'CONSULTAVEL'});
   await a.post('/biblioteca/ativar',{pacoteId:second.body.pacoteId,expectedHash:second.body.hash,expectedCuradoriaHash:(await a.post('/biblioteca/estado',{pacoteId:second.body.pacoteId})).body.curadoriaHash});
   const rollback=await a.post('/biblioteca/rollback',{expectedAtiva:second.body.pacoteId,expectedHash:second.body.hash,expectedAnterior:id,expectedAnteriorHash:hash,expectedAnteriorCuradoriaHash:(await a.post('/biblioteca/estado',{pacoteId:id})).body.curadoriaHash});expect(rollback.body.referencia).toEqual(active.body.referencia);
   expect(a.db.prepare('SELECT count(*) AS n FROM estimulo_tecnico').get()?.n).toBe(3);
   expect(a.db.prepare('SELECT count(*) AS n FROM clinical_event').get()?.n).toBe(0);
   expect(a.db.prepare('SELECT DISTINCT ator FROM biblioteca_curadoria').all()).toEqual([{ator:'medico'}]);
  }finally{await a.close();}
 });
 it('estado sem pacote lista os drafts e qualquer adulteração falha fechado',async()=>{
  const a=await ambiente();try {
   const p=await a.post('/biblioteca/importar',pacote());
   const inventario=await a.post('/biblioteca/estado',{});
   expect(inventario.status).toBe(200);expect(inventario.body.pacotes).toMatchObject([{pacoteId:p.body.pacoteId,versao:'1.0.0',ativo:false,itens:[{id:'item',estado:'RASCUNHO'}]}]);
   expect(inventario.body.itens).toEqual([]);
   a.db.exec('DROP TRIGGER biblioteca_pacote_no_update');
   a.db.prepare('UPDATE biblioteca_pacote SET conteudo=? WHERE id=?').run('adulterado',p.body.pacoteId);
   expect((await a.post('/biblioteca/estado',{pacoteId:p.body.pacoteId})).body.codigo).toBe('PACOTE_HASH_DIVERGENTE');
   expect((await a.post('/biblioteca/estado',{})).body.codigo).toBe('PACOTE_HASH_DIVERGENTE');
  }finally{await a.close();}
 });
 it('rejeita hash desconhecido, caminhos de arquivo, campos de autoridade e sessão inválida',async()=>{
  const a=await ambiente();try {
   expect((await a.post('/biblioteca/importar',pacote(),'forjado')).status).toBe(401);
   expect((await a.post('/biblioteca/importar',{...pacote(),atorId:'forjado'})).status).toBe(400);
   expect((await a.post('/biblioteca/importar',{...pacote(),arquivos:{'item.json':{path:'/etc/passwd'}}})).status).toBe(400);
   const p=pacote();p.manifesto.itens[0]!.sha256='0'.repeat(64);expect((await a.post('/biblioteca/importar',p)).body.codigo).toBe('HASH_DIVERGENTE');
   const imported=await a.post('/biblioteca/importar',pacote());
   expect((await a.curar({pacoteId:imported.body.pacoteId,itemId:'item',expectedHash:'f'.repeat(64),estado:'CONSULTAVEL'})).body.codigo).toBe('PACOTE_HASH_DIVERGENTE');
   expect(a.db.prepare('SELECT count(*) AS n FROM biblioteca_curadoria').get()?.n).toBe(0);
   expect((await a.post('/biblioteca/rollback',{expectedAtiva:imported.body.pacoteId,expectedHash:imported.body.hash})).status).toBe(400);
  }finally{await a.close();}
 });
 it('falha ao persistir estímulo desfaz ativação e mantém referência anterior',async()=>{
  const a=await ambiente();try {
   const p=await a.post('/biblioteca/importar',pacote());await a.curar({pacoteId:p.body.pacoteId,itemId:'item',expectedHash:p.body.hash,estado:'CONSULTAVEL'});
   a.db.exec("CREATE TRIGGER falha_emitir BEFORE INSERT ON estimulo_tecnico BEGIN SELECT RAISE(ABORT,'falha sintetica'); END;");
   expect((await a.post('/biblioteca/ativar',{pacoteId:p.body.pacoteId,expectedHash:p.body.hash,expectedCuradoriaHash:(await a.post('/biblioteca/estado',{pacoteId:p.body.pacoteId})).body.curadoriaHash})).status).toBe(409);
   expect(referenciaBibliotecaAtiva(a.db)).toBeNull();expect(a.db.prepare('SELECT count(*) AS n FROM biblioteca_ativacao').get()?.n).toBe(0);
  }finally{await a.close();}
 });
 it('curadoria de item ativo muda hash e publica estímulo na mesma transação',async()=>{
  const a=await ambiente();try {
   const p=await a.post('/biblioteca/importar',pacote());await a.curar({pacoteId:p.body.pacoteId,itemId:'item',expectedHash:p.body.hash,estado:'CONSULTAVEL'});
   await a.post('/biblioteca/ativar',{pacoteId:p.body.pacoteId,expectedHash:p.body.hash,expectedCuradoriaHash:(await a.post('/biblioteca/estado',{pacoteId:p.body.pacoteId})).body.curadoriaHash});const before=referenciaBibliotecaAtiva(a.db);
   await a.curar({pacoteId:p.body.pacoteId,itemId:'item',expectedHash:p.body.hash,estado:'OBSOLETO'});
   expect(referenciaBibliotecaAtiva(a.db)?.hash).not.toBe(before?.hash);expect(a.db.prepare('SELECT count(*) AS n FROM estimulo_tecnico').get()?.n).toBe(2);
   expect((await a.post('/biblioteca/consultar',{filtros:{tumor:'sintetico'}})).body.itens).toEqual([]);
  }finally{await a.close();}
 });
});
