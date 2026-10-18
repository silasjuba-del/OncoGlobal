// @vitest-environment jsdom
import {cleanup,fireEvent,render,screen,act} from '@testing-library/react';
import {afterEach,expect,it,vi} from 'vitest';
import {LoteTumoralCompleto} from '../../src/ui/consulta/LoteTumoralCompleto.js';
import {montarLoteCompleto} from '../../src/kernel/corpus/loteCompleto.js';
import {DitadoDeepgram} from '../../src/ui/consulta/DitadoDeepgram.js';
import {criarPortaFalsa} from '../../src/ui/api/fake.js';
import {contexto} from './fixtures.js';
import type {PortaConsulta} from '../../src/ui/api/porta.js';
const canal=vi.hoisted(()=>({abrir:vi.fn()}));
vi.mock('../../src/ui/api/ditado.js',()=>({abrirCanalDitado:canal.abrir}));
afterEach(()=>{cleanup();vi.unstubAllGlobals();vi.restoreAllMocks();});
it('as três fases mantêm protocolos antigos, cenários e suporte; busca é reversível',()=>{
 const lote=montarLoteCompleto({header:{id:'teste',versao:'1'},identidade:{tumor:'Cólon sintético',cid10:['C18'],cenarios:['Adjuvância']},
  diagnostico:{imagem:[{nome:'TC sintética'}]},tratamento:{protocolos:[{nome:'Mayo'},{nome:'Roswell Park'}],suporte:[{nome:'Suporte sintético'}]}},'teste.json','a'.repeat(64));
 render(<LoteTumoralCompleto lote={lote}/>);
 for(const value of ['primeira','retorno','seguimento']){fireEvent.change(screen.getByLabelText('Momento da consulta'),{target:{value}});
  expect(screen.getByText('Mayo')).toBeTruthy();expect(screen.getByText('Roswell Park')).toBeTruthy();expect(screen.getByText('Suporte sintético')).toBeTruthy();expect(screen.getByText('TC sintética')).toBeTruthy();}
 fireEvent.change(screen.getByLabelText('Buscar no pack completo'),{target:{value:'Mayo'}});expect(screen.queryByText('Roswell Park')).toBeNull();
 fireEvent.click(screen.getByText('Limpar busca'));expect(screen.getByText('Roswell Park')).toBeTruthy();
});
it('microfone e API só começam com clique; cancelar permissão pendente fecha tracks sem transmitir',async()=>{
 const porta=criarPortaFalsa();porta.ditado=vi.fn<NonNullable<PortaConsulta['ditado']>>(async()=>({codigo:'DITADO_CONFIGURACAO',configurada:true,provedor:'DEEPGRAM',modelo:'nova-3',idioma:'pt-BR'}));
 let liberar!:(s:MediaStream)=>void;const getUserMedia=vi.fn(()=>new Promise<MediaStream>(r=>{liberar=r;}));
 Object.defineProperty(navigator,'mediaDevices',{value:{getUserMedia},configurable:true});
 vi.stubGlobal('MediaRecorder',{isTypeSupported:()=>true});const stop=vi.fn();
 render(<DitadoDeepgram porta={porta} contexto={contexto} desabilitado={false} aoTrecho={vi.fn()} aoAtividade={vi.fn()}/>);
 await act(async()=>{});expect(getUserMedia).not.toHaveBeenCalled();
 fireEvent.click(screen.getByText('Iniciar ditado Deepgram'));expect(getUserMedia).toHaveBeenCalledOnce();
 fireEvent.click(screen.getByText('Cancelar conexão'));
 await act(async()=>liberar({getTracks:()=>[{stop}]} as unknown as MediaStream));
 expect(stop).toHaveBeenCalled();expect(porta.ditado).toHaveBeenCalledTimes(1);expect(canal.abrir).not.toHaveBeenCalled();
});
it('não grava parcial e descarta resultado tardio após desmontar/trocar contexto',async()=>{
 const porta=criarPortaFalsa();porta.ditado=vi.fn<NonNullable<PortaConsulta['ditado']>>(async p=>p.acao==='INICIAR'?{codigo:'DITADO_TICKET',ticket:'a'.repeat(64),caminho:'/consulta/ditado/stream',expiraEm:123}:
  {codigo:'DITADO_CONFIGURACAO',configurada:true,provedor:'DEEPGRAM',modelo:'nova-3',idioma:'pt-BR'});
 const trackStop=vi.fn();Object.defineProperty(navigator,'mediaDevices',{value:{getUserMedia:async()=>({getTracks:()=>[{stop:trackStop}]})},configurable:true});
 class Recorder{static isTypeSupported(){return true;}state='inactive';ondataavailable=null;onstop:null|(()=>void)=null;onerror=null;start(){this.state='recording';}stop(){this.state='inactive';this.onstop?.();}}
 vi.stubGlobal('MediaRecorder',Recorder);const close=vi.fn();let eventos!:{mensagem:(s:string)=>void};
 canal.abrir.mockImplementation((_t,e)=>{eventos=e;return{fechar:close,aberto:()=>true,pendentes:()=>0,enviar:vi.fn()};});
 const aoTrecho=vi.fn(),t=render(<DitadoDeepgram porta={porta} contexto={contexto} desabilitado={false} aoTrecho={aoTrecho} aoAtividade={vi.fn()}/>);
 await act(async()=>{});await act(async()=>fireEvent.click(screen.getByText('Iniciar ditado Deepgram')));
 act(()=>eventos.mensagem(JSON.stringify({tipo:'PRONTO'})));
 const trecho={tipo:'TRECHO',id:'1',texto:'Nega dor. Dose 1,2.',final:false,confianca:0.9};
 act(()=>eventos.mensagem(JSON.stringify(trecho)));expect(aoTrecho).not.toHaveBeenCalled();
 act(()=>{eventos.mensagem(JSON.stringify({...trecho,final:true}));eventos.mensagem(JSON.stringify({...trecho,final:true}));});expect(aoTrecho).toHaveBeenCalledExactlyOnceWith(trecho.texto);
 t.unmount();eventos.mensagem(JSON.stringify({...trecho,id:'2',final:true}));expect(aoTrecho).toHaveBeenCalledOnce();expect(trackStop).toHaveBeenCalled();expect(close).toHaveBeenCalled();
});
