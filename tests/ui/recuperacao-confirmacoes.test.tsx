// @vitest-environment jsdom
import {afterEach,expect,it,vi} from 'vitest';
import {cleanup,render,screen,fireEvent,waitFor} from '@testing-library/react';
import {RecuperarConfirmacoes} from '../../src/ui/consulta/RecuperarConfirmacoes.js';
import {criarPortaHttp} from '../../src/ui/api/http.js';
import {guardarPendente,pendente} from '../../src/ui/api/confirmacoesPendentes.js';
import {App} from '../../src/ui/App.js';
const contexto={patientId:'sintetico-a',encounterId:'consulta-a',tumorLotId:null};
const pedido={contexto,draftId:'draft-a',expectedRevision:0,conteudoHash:'a'.repeat(64),idempotencyKey:'intencao-original'};
afterEach(()=>{cleanup();sessionStorage.clear();vi.unstubAllGlobals();});
it('entrada principal exige login real, sem prontuário de demonstração',()=>{
 render(<App/>);expect(screen.getByLabelText(/senha/i)).toBeTruthy();expect(screen.queryByText(/Pacientes sintéticos/i)).toBeNull();
});
it.each(['PRESCRICAO','APAC'] as const)('resposta perdida e porta recriada preservam chave e consultam sem nova escrita: %s',async tipo=>{
 const resultado=tipo==='PRESCRICAO'?{codigo:'REPLAY',documentId:'doc',documentVersion:1,eventoId:'event',cicloId:'ciclo',episodioId:'episodio'}:{codigo:'REPLAY',apacId:'apac',versao:1,eventId:'event',estado:'RASCUNHO',permiteExportar:false};
 const fetchMock=vi.fn().mockRejectedValueOnce(new TypeError('queda de rede')).mockResolvedValue(new Response(JSON.stringify({estado:'CONFIRMADA',resultado}),{status:200}));vi.stubGlobal('fetch',fetchMock);
 let porta=criarPortaHttp({onSessaoExpirada:()=>{}});
 await expect(tipo==='PRESCRICAO'?porta.confirmarPrescricaoExecutavel!(pedido):porta.confirmarApacRascunho!(pedido)).rejects.toThrow();
 expect(pendente(tipo,contexto)?.pedido.idempotencyKey).toBe('intencao-original');
 porta=criarPortaHttp({onSessaoExpirada:()=>{}});const atualizar=vi.fn();render(<RecuperarConfirmacoes porta={porta} contexto={contexto} aoAtualizar={atualizar}/>);
 fireEvent.click(screen.getByRole('button',{name:`Conferir resultado · ${tipo}`}));
 await screen.findByText(/já havia confirmado/);expect(atualizar).toHaveBeenCalledOnce();expect(pendente(tipo,contexto)).toBeNull();
 expect(fetchMock.mock.calls[1]?.[0]).toBe('/consulta/confirmacao/recuperar');
 expect(JSON.parse(fetchMock.mock.calls[1]?.[1].body).pedido).toEqual(pedido);expect(fetchMock).toHaveBeenCalledTimes(2);
});
it('prévia recuperada exige clique explícito e não aparece para outro paciente',async()=>{
 guardarPendente({tipo:'PRESCRICAO',pedido});
 const http=vi.fn().mockResolvedValue(new Response(JSON.stringify({estado:'PREVIA',texto:'Prescrição sintética revisável',avisos:['Rever dose']}),{status:200}));vi.stubGlobal('fetch',http);
 const porta=criarPortaHttp({onSessaoExpirada:()=>{}}),r=render(<RecuperarConfirmacoes porta={porta} contexto={{...contexto,patientId:'outro'}} aoAtualizar={()=>{}}/>);
 expect(screen.queryByRole('button')).toBeNull();r.rerender(<RecuperarConfirmacoes porta={porta} contexto={contexto} aoAtualizar={()=>{}}/>);
 fireEvent.click(screen.getByRole('button',{name:/Conferir resultado/}));await screen.findByText('Prescrição sintética revisável');
 expect(http).toHaveBeenCalledTimes(1);expect(screen.getByRole('button',{name:/Revisei esta prévia/})).toBeTruthy();
});
it('nova intenção é bloqueada enquanto o resultado anterior não foi reconciliado',async()=>{
 guardarPendente({tipo:'PRESCRICAO',pedido});const http=vi.fn();vi.stubGlobal('fetch',http);const porta=criarPortaHttp({onSessaoExpirada:()=>{}});
 await expect(porta.confirmarPrescricaoExecutavel!({...pedido,idempotencyKey:'outra'})).rejects.toMatchObject({codigo:'CONFIRMACAO_PENDENTE_RECONCILIAR'});expect(http).not.toHaveBeenCalled();
});
