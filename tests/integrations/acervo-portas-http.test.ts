import { spawn } from 'node:child_process';
import { expect, it } from 'vitest';
import { ambienteHttp } from '../server/http-fixture.js';
import { criarBiblioteca, sha256Biblioteca } from '../../src/kernel/corpus/biblioteca.js';

it('API real, CLI e MCP devolvem a mesma referência curada sem gravar eventos clínicos', async () => {
  const a = await ambienteHttp();
  try {
    const lib = criarBiblioteca(a.db,{autorizarCuradoria:()=>({atorId:'medico-teste'}),agora:()=> '2026-10-05T12:00:00Z',emitir:()=>{}});
    const item = {schema:'ItemBiblioteca@1',id:'sintetico',versao:'1.0.0',pilar:1,tipo:'REFERENCIA',titulo:'Referência SINTETICA',texto:'ANCORA Sintética: negação e incerteza preservadas.',
      aplicabilidade:{tumor:[],histologia:[],estadio:[],biomarcador:[],linha:[]},proveniencia:{fonte:'https://example.test',trecho:'SINTETICO',publicadoEm:'2026-10-01',recuperadoEm:'2026-10-05T12:00:00Z',licenca:'SINTETICA'},dependencias:[]};
    const texto=JSON.stringify(item);
    const pacoteId=lib.importarPacote({schema:'PacoteBiblioteca@1',id:'sintetico',versao:'1.0.0',origem:'CURADOR_LOCAL',classificacao:'PUBLIC',criadoEm:'2026-10-05T12:00:00Z',itens:[{id:item.id,versao:item.versao,arquivo:'sintetico.json',sha256:sha256Biblioteca(texto)}]},()=>texto);
    lib.revisarItem(pacoteId,item.id,'CONSULTAVEL'); lib.ativar(pacoteId);
    const pedido={consulta:'ANCORA'};
    const resposta=await a.request('/acervo/buscar','POST',JSON.stringify(pedido),a.token);
    expect(resposta.status).toBe(200);
    const direto=JSON.parse(resposta.body);
    expect(direto.resultados).toHaveLength(1);
    const cli=await new Promise<{code:number|null,out:string,err:string}>((resolve,reject)=>{
      const p=spawn(process.execPath,['scripts/oncoglobal-cli.mjs','acervo','buscar'],{cwd:process.cwd(),env:{...process.env,ONCOGLOBAL_API_URL:a.base,ONCOGLOBAL_API_TOKEN:a.token},stdio:['pipe','pipe','pipe']});
      let out='',err='';p.stdout.on('data',b=>out+=b);p.stderr.on('data',b=>err+=b);p.on('error',reject);p.on('close',code=>resolve({code,out,err}));p.stdin.end(JSON.stringify(pedido));
    });
    expect(cli.code,cli.err).toBe(0);expect(JSON.parse(cli.out)).toEqual(direto);
    const mcp=await new Promise<{code:number|null,out:string,err:string}>((resolve,reject)=>{
      const p=spawn(process.execPath,['scripts/oncoglobal-mcp.mjs'],{cwd:process.cwd(),env:{...process.env,ONCOGLOBAL_API_URL:a.base,ONCOGLOBAL_API_TOKEN:a.token},stdio:['pipe','pipe','pipe']});
      let out='',err='';p.stdout.on('data',b=>out+=b);p.stderr.on('data',b=>err+=b);p.on('error',reject);p.on('close',code=>resolve({code,out,err}));
      p.stdin.end([
        {jsonrpc:'2.0',id:1,method:'initialize',params:{protocolVersion:'2025-06-18',capabilities:{},clientInfo:{name:'prova-sintetica',version:'1'}}},
        {jsonrpc:'2.0',method:'notifications/initialized'},
        {jsonrpc:'2.0',id:2,method:'tools/call',params:{name:'acervo_buscar',arguments:pedido}},
      ].map(x=>JSON.stringify(x)+'\n').join(''));
    });
    expect(mcp.code,mcp.err).toBe(0);
    const chamada=mcp.out.trim().split('\n').map(x=>JSON.parse(x)).find(x=>x.id===2);
    expect(chamada.result.isError).toBe(false);expect(chamada.result.structuredContent).toEqual(direto);
    const ref=direto.resultados[0];
    const leitura=await a.request('/acervo/ler','POST',JSON.stringify({docId:ref.docId,versao:ref.versao,hashSha256:ref.hashSha256,revisaoAcervo:ref.revisaoAcervo,localizador:ref.localizador}),a.token);
    expect(leitura.status).toBe(200);expect(JSON.parse(leitura.body).documento).toEqual(ref);
    expect(a.efeitos()).toBe(0);expect(a.db.prepare('SELECT count(*) n FROM clinical_event').get()!.n).toBe(0);
  } finally {await a.close();}
});
