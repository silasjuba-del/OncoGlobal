import { spawn } from 'node:child_process';
import { createServer, type Server } from 'node:http';
import { once } from 'node:events';
import { resolve } from 'node:path';
import { readFileSync } from 'node:fs';
import { afterEach, expect, it } from 'vitest';
import { z } from 'zod';
import { PedidoBuscaAcervo, PedidoLeituraAcervo, BuscaAcervoResposta, LeituraAcervoResposta } from '../../../src/contracts/api/consultaAcervo.js';
import { EstadoIntegracoes } from '../../../src/contracts/api/integracoesEstado.js';
// @ts-expect-error CLI JavaScript executable, tested as subprocess and schema boundary.
import { catalogo, configuracao } from '../../../scripts/integrations/leitura-local.mjs';

const servidores: Server[] = [];
const proveniencia={fonte:'SINTETICO',trecho:'Trecho sintético',publicadoEm:'2026-10-26',recuperadoEm:'2026-10-26',licenca:'SINTETICA'};
const ref={schema:'DocumentRef@1',docId:'documento-sintetico',pacoteId:'pacote-sintetico',itemId:'item-sintetico',versao:'1.0.0',hashSha256:'b'.repeat(64),revisaoAcervo:'c'.repeat(64),titulo:'SINTETICO',natureza:'ITEM_TEXTUAL_CURADO',classificacao:'NAO_DECLARADA',originalBinarioDisponivel:false,localizador:{campo:'TEXTO',inicio:0,fim:9,unidade:'UTF16'},trecho:'SINTETICO',proveniencia};
const referenciaBiblioteca={id:'pacote-sintetico',versao:'1.0.0',hash:'a'.repeat(64)};
const busca={codigo:'ACERVO_RESULTADOS',referenciaBiblioteca,revisaoAcervo:'c'.repeat(64),cobertura:{escopo:'ITENS_CONSULTAVEIS_DO_PACOTE_ATIVO',metodo:'LITERAL_SENSIVEL_A_CAIXA',completudeFontesExternas:'NAO_GARANTIDA',itensConsultaveis:1,encontrados:1,retornados:1,truncado:false},resultados:[ref]};
const leituraValida={codigo:'ACERVO_DOCUMENTO',referenciaBiblioteca,revisaoAcervo:'c'.repeat(64),documento:ref,conteudo:{schema:'ItemBiblioteca@1',id:'item-sintetico',versao:'1.0.0',pilar:1,tipo:'REFERENCIA',titulo:'SINTETICO',texto:'SINTETICO',aplicabilidade:{tumor:[],histologia:[],estadio:[],biomarcador:[],linha:[]},proveniencia,dependencias:[]}};
const estado={codigo:'INTEGRACOES_ESTADO',whatsapp:{ingressoConfigurado:false,saidaConfigurada:false,contasIngresso:0,conectividade:'NAO_TESTADA',envioExecutadoNesteDiagnostico:false,transporteNativo:'TEXTO',documentos:'NAO_IMPLEMENTADO',requerAutorizacaoPorEnvio:true},extensoes:{skillsNativas:[],pluginsExternos:'ADAPTADOR_DE_ADMISSAO_NAO_CONFIGURADO',instalacaoAutomatica:false},acervo:{escopo:'ITENS_TEXTUAIS_CURADOS',drive:'NAO_CONFIGURADO',originaisBinarios:'NAO_DISPONIVEIS_NESTA_PORTA'}};
afterEach(async () => { for (const s of servidores.splice(0)) { s.closeAllConnections(); await new Promise<void>(r => s.close(() => r())); } });
async function servidor(saida?: unknown) {
  const recebidos: { url: string; auth: string | undefined; body: unknown }[] = [];
  const s = createServer(async (req, res) => {
    const chunks: Buffer[] = []; for await (const c of req) chunks.push(c);
    const body = JSON.parse(Buffer.concat(chunks).toString());
    recebidos.push({ url: req.url!, auth: req.headers.authorization, body });
    if (req.headers.authorization !== 'Bearer TOKEN-SINTETICO') { res.writeHead(401, {'content-type':'application/json'}); res.end(JSON.stringify({ segredo: 'NUNCA-EXIBIR' })); return; }
    if (body.consulta === 'REDIRECT') { res.writeHead(302, {location:'http://127.0.0.1:1/segredo'}); res.end(); return; }
    if (body.consulta === 'EXCESSIVO') { res.writeHead(200, {'content-type':'application/json'}); res.end(JSON.stringify({texto:'x'.repeat(4_000_001)})); return; }
    res.writeHead(200, {'content-type':'application/json'}); res.end(JSON.stringify(saida ?? (req.url==='/acervo/buscar'?busca:req.url==='/acervo/ler'?leituraValida:estado)));
  });
  servidores.push(s); s.listen(0, '127.0.0.1'); await once(s, 'listening');
  return { url: `http://127.0.0.1:${(s.address() as {port:number}).port}`, recebidos };
}
async function processo(script: string, args: string[], entrada: string, env: Record<string,string> = {}) {
  const p = spawn(process.execPath, [resolve('scripts', script), ...args], { env: { ...process.env, ONCOGLOBAL_API_TOKEN:'', ONCOGLOBAL_API_URL:'http://127.0.0.1:4181', ...env }, stdio:['pipe','pipe','pipe'], windowsHide:true });
  let out='', err=''; p.stdout.setEncoding('utf8'); p.stderr.setEncoding('utf8'); p.stdout.on('data', c=>out+=c); p.stderr.on('data',c=>err+=c);
  const fim = once(p,'close'); p.stdin.on('error',()=>{}); p.stdin.end(entrada);
  const timer=setTimeout(()=>p.kill(), 20_000);
  try { const [code]=await fim; return {code,out,err}; } finally {clearTimeout(timer);}
}
const init = {jsonrpc:'2.0',id:1,method:'initialize',params:{protocolVersion:'2025-06-18',capabilities:{},clientInfo:{name:'teste-sintetico',version:'1'}}};
const ready = {jsonrpc:'2.0',method:'notifications/initialized'};
const linha = (v: unknown) => JSON.stringify(v)+'\n';

it('catálogo MCP conserva schemas canônicos e só lista capacidades readonly', () => {
  const c=catalogo();
  expect(c.map((x:{name:string})=>x.name)).toEqual(['acervo_buscar','acervo_ler','integracoes_estado']);
  expect(c[0].inputSchema).toEqual(z.toJSONSchema(PedidoBuscaAcervo,{unrepresentable:'any'}));
  expect(c[1].inputSchema).toEqual(z.toJSONSchema(PedidoLeituraAcervo,{unrepresentable:'any'}));
  expect(c.every((x:{annotations:{readOnlyHint:boolean}})=>x.annotations.readOnlyHint)).toBe(true);
  expect(JSON.parse(readFileSync('scripts/integrations/saidas-canonicas.json','utf8'))).toEqual(Object.fromEntries(Object.entries({acervo_buscar:BuscaAcervoResposta,acervo_ler:LeituraAcervoResposta,integracoes_estado:EstadoIntegracoes}).map(([nome,schema])=>[nome,z.toJSONSchema(schema,{unrepresentable:'any'})])));
});

it('recusa JSON200 fora do contrato e campos inesperados aninhados sem ecoar a sentinela', async () => {
  const casos=[{}, {codigo:'OUTRO_SERVICO',segredo:'SENTINELA-NAO-EXIBIR'}, {...busca,segredo:'SENTINELA-NAO-EXIBIR'}, {...busca,cobertura:{...busca.cobertura,segredo:'SENTINELA-NAO-EXIBIR'}}, {...busca,resultados:[{...ref,proveniencia:{...proveniencia,segredo:'SENTINELA-NAO-EXIBIR'}}]}, {...busca,resultados:[{...ref,localizador:{...ref.localizador,inicio:20,fim:9}}]}];
  for(const corpo of casos) {
    const s=await servidor(corpo),env={ONCOGLOBAL_API_URL:s.url,ONCOGLOBAL_API_TOKEN:'TOKEN-SINTETICO'};
    const cli=await processo('oncoglobal-cli.mjs',['acervo','buscar'],'{"consulta":"teste"}',env);
    const mcp=await processo('oncoglobal-mcp.mjs',[],linha(init)+linha(ready)+linha({jsonrpc:'2.0',id:2,method:'tools/call',params:{name:'acervo_buscar',arguments:{consulta:'teste'}}}),env);
    expect(cli.code).toBe(1);expect(cli.out).toBe('');expect(cli.err).toContain('RESPOSTA_INVALIDA');
    expect(JSON.parse(mcp.out.trim().split('\n')[1]!).result).toEqual({content:[{type:'text',text:'RESPOSTA_INVALIDA'}],isError:true});
    expect(cli.err+mcp.out+mcp.err).not.toContain('SENTINELA-NAO-EXIBIR');
  }
  for(const [args,nome,corpo,input] of [[['acervo','ler'],'acervo_ler',{...leituraValida,conteudo:{...leituraValida.conteudo,aplicabilidade:{...leituraValida.conteudo.aplicabilidade,segredo:'SENTINELA-NAO-EXIBIR'}}},{docId:ref.docId,versao:ref.versao,hashSha256:ref.hashSha256,revisaoAcervo:ref.revisaoAcervo}],[['integracoes','estado'],'integracoes_estado',{...estado,whatsapp:{...estado.whatsapp,segredo:'SENTINELA-NAO-EXIBIR'}},{}]] as const) {
    const s=await servidor(corpo),env={ONCOGLOBAL_API_URL:s.url,ONCOGLOBAL_API_TOKEN:'TOKEN-SINTETICO'};
    const cli=await processo('oncoglobal-cli.mjs',[...args],JSON.stringify(input),env);
    const mcp=await processo('oncoglobal-mcp.mjs',[],linha(init)+linha(ready)+linha({jsonrpc:'2.0',id:2,method:'tools/call',params:{name:nome,arguments:input}}),env);
    expect(cli.code).toBe(1);expect(cli.out).toBe('');expect(cli.err).toContain('RESPOSTA_INVALIDA');
    expect(JSON.parse(mcp.out.trim().split('\n')[1]!).result.isError).toBe(true);
    expect(cli.err+mcp.out+mcp.err).not.toContain('SENTINELA-NAO-EXIBIR');
  }
});

it('CLI e MCP subprocess retornam o mesmo JSON pela API autenticada, sem efeito externo', async () => {
  const s=await servidor(), env={ONCOGLOBAL_API_URL:s.url,ONCOGLOBAL_API_TOKEN:'TOKEN-SINTETICO'};
  const input={consulta:'SINTETICO',limite:3};
  const cli=await processo('oncoglobal-cli.mjs',['acervo','buscar'],JSON.stringify(input),env);
  expect(cli.code).toBe(0); expect(cli.err).toBe('');
  const mcp=await processo('oncoglobal-mcp.mjs',[],linha(init)+linha(ready)+linha({jsonrpc:'2.0',id:2,method:'tools/list'})+linha({jsonrpc:'2.0',id:3,method:'tools/call',params:{name:'acervo_buscar',arguments:input}}),env);
  expect(mcp.code).toBe(0); expect(mcp.err).toBe('');
  const results=mcp.out.trim().split('\n').map(x=>JSON.parse(x));
  expect(results[1].result.tools).toHaveLength(3);
  expect(results[2].result.structuredContent).toEqual(JSON.parse(cli.out));
  expect(JSON.parse(results[2].result.content[0].text)).toEqual(JSON.parse(cli.out));
  expect(s.recebidos).toEqual([{url:'/acervo/buscar',auth:'Bearer TOKEN-SINTETICO',body:input},{url:'/acervo/buscar',auth:'Bearer TOKEN-SINTETICO',body:input}]);
  expect(mcp.out+cli.out+cli.err+mcp.err).not.toContain('TOKEN-SINTETICO');
});

it('CLI recusa comandos/argumentos, endpoints não literais, redirects e erros sem refletir segredos', async () => {
  const s=await servidor();
  expect(configuracao({ONCOGLOBAL_API_URL:'http://127.0.0.1:80',ONCOGLOBAL_API_TOKEN:'TOKEN-SINTETICO'}).url).toBe('http://127.0.0.1');
  expect(configuracao({ONCOGLOBAL_API_URL:'http://[::1]:80',ONCOGLOBAL_API_TOKEN:'TOKEN-SINTETICO'}).url).toBe('http://[::1]');
  const ajuda=await processo('oncoglobal-cli.mjs',['--help'],'');expect(ajuda.code).toBe(0);
  // Numeric IPv4 representation of 127.0.0.1, not a telephone fixture.
  const ipv4Numerico = String(0x7f000001);
  for(const endpoint of ['http://localhost:4181',`http://${ipv4Numerico}:4181`,'http://127.0.0.1:4181/?x=1','http://user:pass@127.0.0.1:4181']) {
    const r=await processo('oncoglobal-cli.mjs',['integracoes','estado'],'{}',{ONCOGLOBAL_API_URL:endpoint,ONCOGLOBAL_API_TOKEN:'TOKEN-SINTETICO'});
    expect(r.code).toBe(1);expect(r.err).toContain('ENDPOINT_LOCAL_INVALIDO');
  }
  const denied=await processo('oncoglobal-cli.mjs',['acervo','buscar'],'{"consulta":"x"}',{ONCOGLOBAL_API_URL:s.url,ONCOGLOBAL_API_TOKEN:'errado'});
  expect(denied.err).toContain('SESSAO_INVALIDA');expect(denied.err).not.toContain('NUNCA-EXIBIR');
  const redirect=await processo('oncoglobal-cli.mjs',['acervo','buscar'],'{"consulta":"REDIRECT"}',{ONCOGLOBAL_API_URL:s.url,ONCOGLOBAL_API_TOKEN:'TOKEN-SINTETICO'});
  expect(redirect.err).toContain('API_LOCAL_INDISPONIVEL');
  const large=await processo('oncoglobal-cli.mjs',['acervo','buscar'],'{"consulta":"EXCESSIVO"}',{ONCOGLOBAL_API_URL:s.url,ONCOGLOBAL_API_TOKEN:'TOKEN-SINTETICO'});
  expect(large.err).toContain('RESPOSTA_EXCESSIVA');
  expect((await processo('oncoglobal-cli.mjs',['paciente','assinar'],'{}')).err).toContain('COMANDO_INVALIDO');
  expect((await processo('oncoglobal-cli.mjs',['acervo','buscar'],'{')).err).toContain('JSON_INVALIDO');
  expect((await processo('oncoglobal-cli.mjs',['integracoes','estado'],'x'.repeat(65_537))).err).toContain('ENTRADA_EXCESSIVA');
});

it('leitura preserva hashes/localizador e diagnóstico só aceita objeto vazio nas duas portas', async () => {
  const s=await servidor(), env={ONCOGLOBAL_API_URL:s.url,ONCOGLOBAL_API_TOKEN:'TOKEN-SINTETICO'};
  const leitura={docId:'documento-sintetico',versao:'1.0.0',hashSha256:'b'.repeat(64),revisaoAcervo:'c'.repeat(64),localizador:{campo:'TEXTO',inicio:0,fim:9,unidade:'UTF16'}};
  for(const [args,nome,input] of [[['acervo','ler'],'acervo_ler',leitura],[['integracoes','estado'],'integracoes_estado',{}]] as const) {
    const cli=await processo('oncoglobal-cli.mjs',[...args],JSON.stringify(input),env);
    const mcp=await processo('oncoglobal-mcp.mjs',[],linha(init)+linha(ready)+linha({jsonrpc:'2.0',id:2,method:'tools/call',params:{name:nome,arguments:input}}),env);
    expect(cli.code).toBe(0);expect(mcp.code).toBe(0);
    expect(JSON.parse(mcp.out.trim().split('\n')[1]!).result.structuredContent).toEqual(JSON.parse(cli.out));
  }
  expect(s.recebidos.map(x=>x.url)).toEqual(['/acervo/ler','/acervo/ler','/integracoes/estado','/integracoes/estado']);
  expect(s.recebidos[0]!.body).toEqual(leitura);
  expect((await processo('oncoglobal-cli.mjs',['integracoes','estado'],'{"patientId":"não-permitido"}',env)).err).toContain('ARGUMENTOS_INVALIDOS');
  const errado={...leitura,localizador:{...leitura.localizador,fim:0}};
  expect((await processo('oncoglobal-cli.mjs',['acervo','ler'],JSON.stringify(errado),env)).err).toContain('ARGUMENTOS_INVALIDOS');
  expect(s.recebidos).toHaveLength(4);
});

it('MCP trata lifecycle, JSON inválido, ferramenta desconhecida e limite sem chamar API', async () => {
  const s=await servidor();
  const input='{\n'+linha({jsonrpc:'2.0',id:0,method:'tools/list'})+linha(init)+linha(ready)+linha({jsonrpc:'2.0',id:2,method:'tools/call',params:{name:'prescrever'}})+linha({jsonrpc:'2.0',id:3,method:'inexistente'})+linha({jsonrpc:'2.0',id:4,method:'tools/call',params:{name:'acervo_buscar',arguments:{consulta:' ',patientId:'x'}}})+linha({jsonrpc:'2.0',id:5,method:'ping'});
  const r=await processo('oncoglobal-mcp.mjs',[],input,{ONCOGLOBAL_API_URL:s.url,ONCOGLOBAL_API_TOKEN:'TOKEN-SINTETICO'});
  const responses=r.out.trim().split('\n').map(x=>JSON.parse(x));
  expect(responses.map(x=>x.error?.code??x.result?.isError??'ok')).toEqual([-32700,-32002,'ok',-32602,-32601,true,'ok']);
  expect(s.recebidos).toHaveLength(0);
  const long=await processo('oncoglobal-mcp.mjs',[],'x'.repeat(65_537));
  expect(long.code).toBe(1);expect(JSON.parse(long.out).error.code).toBe(-32600);
});
