import {createServer} from 'node:http';
import {WebSocket} from 'ws';
import {afterEach,expect,it,vi} from 'vitest';
import {criarDitado,type ConectarVoz} from '../../src/kernel/gateway/ditado.js';
import {criarGerenciadorSessao} from '../../src/server/sessao.js';
import {DitadoResposta} from '../../src/contracts/fase2/ditado.js';
const finais:(()=>Promise<void>)[]=[];afterEach(async()=>{for(const fim of finais.splice(0))await fim();});
async function ambiente(){
 let agora='2026-10-18T12:00:00Z';const sessoes=criarGerenciadorSessao({medicoId:'teste',crm:'CRM-T',senha:'senha-sintetica-longa',agora:()=>agora,duracaoMs:60_000});
 const token=sessoes.login('senha-sintetica-longa')!.token,ctx={patientId:'sintetico',encounterId:'encontro',tumorLotId:'colon'};sessoes.selecionarConsulta(token,ctx);
 let eventos!:Parameters<ConectarVoz>[2];let sinal:AbortSignal|undefined;const enviar=vi.fn(),fechar=vi.fn(),finalizar=vi.fn(()=>eventos.fechado());
 const conectar=vi.fn<ConectarVoz>(async(_chave,signal,e)=>{eventos=e;sinal=signal;setTimeout(e.pronto,0);return{enviar,fechar,finalizar,manter:vi.fn(),pendentes:()=>0};});
 const d=criarDitado(sessoes,{conectar,agora:()=>Date.parse(agora)}),server=createServer();d.anexar(server);server.listen(0,'127.0.0.1');await new Promise<void>(r=>server.once('listening',r));
 const addr=server.address();if(!addr||typeof addr==='string')throw Error('porta');
 finais.push(async()=>{d.fechar();await new Promise<void>(r=>server.close(()=>r()));});
 const pedido={acao:'INICIAR',contexto:ctx,autorizaEnvioAudio:true};
 const ticket=()=>{const r=DitadoResposta.parse(d.rotear(pedido,token).body);if(r.codigo!=='DITADO_TICKET')throw Error('ticket');return r.ticket;};
 const abrir=(t:string,origin?:string)=>{const ws=new WebSocket(`ws://127.0.0.1:${addr.port}/consulta/ditado/stream`,t,origin?{origin}:{});const recebidos:unknown[]=[];ws.on('message',m=>recebidos.push(JSON.parse(m.toString())));return {ws,recebidos};};
 return {d,token,ctx,sessoes,conectar,enviar,fechar,finalizar,abrir,ticket,pedido,eventos:()=>eventos,sinal:()=>sinal,expirar:()=>{agora='2026-10-18T12:02:00Z';},passar16s:()=>{agora='2026-10-18T12:00:16Z';}};
}
const configurar=(a:Awaited<ReturnType<typeof ambiente>>)=>a.d.rotear({acao:'CONFIGURAR',chave:'chave-sintetica-nao-real-123456'},a.token);
it('chave ausente não abre rede; configuração nunca devolve segredo; exige sessão, contexto e envio explícito',async()=>{
 const a=await ambiente();expect(a.d.rotear(a.pedido,a.token).status).toBe(409);expect(a.conectar).not.toHaveBeenCalled();
 const config=configurar(a);expect(JSON.stringify(config)).not.toContain('chave-sintetica');expect(config.status).toBe(200);
 expect(a.d.rotear({...a.pedido,autorizaEnvioAudio:false},a.token).status).toBe(400);
 expect(a.d.rotear({...a.pedido,contexto:{...a.ctx,patientId:'outro'}},a.token).status).toBe(409);
 expect(a.d.rotear(a.pedido,'invalido').status).toBe(401);expect(a.conectar).not.toHaveBeenCalled();
});
it('transmite áudio, distingue parcial/final, deduplica final e encerra sem converter texto em ação',async()=>{
 const a=await ambiente();configurar(a);const {ws,recebidos}=a.abrir(a.ticket());
 await vi.waitFor(()=>expect(recebidos).toContainEqual({tipo:'PRONTO'}));ws.send(Buffer.from([1,2,3]));
 await vi.waitFor(()=>expect(a.enviar).toHaveBeenCalledOnce());
 const m={type:'Results',start:0,duration:1,is_final:false,channel:{alternatives:[{transcript:'Nega dor. Dose 1,2.',confidence:0.8}]}};
 a.eventos().mensagem(m);a.eventos().mensagem({...m,is_final:true});a.eventos().mensagem({...m,is_final:true});
 await vi.waitFor(()=>expect(recebidos).toHaveLength(3));expect(recebidos[2]).toMatchObject({tipo:'TRECHO',final:true,texto:'Nega dor. Dose 1,2.'});
 ws.send('PARAR');await vi.waitFor(()=>expect(recebidos).toContainEqual({tipo:'CONCLUIDO'}));expect(a.finalizar).toHaveBeenCalledOnce();expect(a.sinal()?.aborted).toBe(true);
});
it.each(['paciente','expirada'])('interrompe áudio e resultados tardios com contexto %s',async(modo)=>{
 const a=await ambiente();configurar(a);const {ws,recebidos}=a.abrir(a.ticket());await vi.waitFor(()=>expect(recebidos).toHaveLength(1));
 if(modo==='paciente')a.sessoes.selecionarConsulta(a.token,{...a.ctx,patientId:'outro'});else a.expirar();
 a.eventos().mensagem({type:'Results',start:1,duration:1,is_final:true,channel:{alternatives:[{transcript:'NÃO PODE VAZAR'}]}});
 await vi.waitFor(()=>expect(ws.readyState).toBe(WebSocket.CLOSED));expect(JSON.stringify(recebidos)).not.toContain('NÃO PODE VAZAR');expect(a.sinal()?.aborted).toBe(true);
});
it('ticket só funciona uma vez',async()=>{
 const a=await ambiente();configurar(a);const ticket=a.ticket(),primeiro=a.abrir(ticket);
 await vi.waitFor(()=>expect(primeiro.recebidos).toHaveLength(1));
 const segundo=a.abrir(ticket);const falha=await new Promise<Error>(r=>segundo.ws.on('error',r));expect(falha.message).toContain('403');
 expect(a.conectar).toHaveBeenCalledOnce();
});
it.each(['origem','prazo'])('recusa conexão antes do provedor por %s',async motivo=>{
 const a=await ambiente();configurar(a);const ticket=a.ticket();if(motivo==='prazo')a.passar16s();
 const {ws}=a.abrir(ticket,motivo==='origem'?'https://externo.invalid':undefined);
 const falha=await new Promise<Error>(r=>ws.on('error',r));expect(falha.message).toContain('403');expect(a.conectar).not.toHaveBeenCalled();
});
