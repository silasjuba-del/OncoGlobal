// @vitest-environment jsdom
import React from 'react';
import {afterEach,expect,it,vi} from 'vitest';
import {cleanup,fireEvent,render,screen,waitFor} from '@testing-library/react';
import {AnamneseGuiada} from '../../src/ui/consulta/AnamneseGuiada.js';
import {RespostaAnamneseGuiada} from '../../src/contracts/api/anamneseGuiada.js';
import type {PortaConsulta} from '../../src/ui/api/porta.js';
afterEach(cleanup);
const contexto={patientId:'p-sintetico',encounterId:'e-sintetico',tumorLotId:null};
it.each(['roteiro','respostas'] as const)('salvar %s não descarta edição pendente da outra seção',async primeira=>{
 const dados=RespostaAnamneseGuiada.parse({codigo:'ANAMNESE_GUIADA',contexto,packs:[{id:'pack',titulo:'Tumor sintético'}],
 roteiros:[{roteiroId:'roteiro',versao:'1',tumorPackId:'pack',contextoClinico:'PRIMEIRA_CONSULTA',statusCuradoria:'CONFERIDA_MEDICO',aprovadoPor:'medico-sintetico',aprovadoEm:'2026-10-31',fonte:'Fonte sintética',lembretesOrientacoes:[],passos:[{passoId:'passo-1',ordem:1,tipo:'PERGUNTA_SINTOMA',dominioClinico:'anamnese',perguntaCanonica:'Relato sintético?',obrigatorioParaResumo:true}]}],
 mensagens:[{mensagemId:'mensagem',texto:'Resposta sintética',em:'2026-10-31T12:00:00Z',contatoId:'contato'}],historico:[],resumo:null});
 const api=vi.fn(async()=>dados),pendente=vi.fn(),salvando=vi.fn();
 render(<AnamneseGuiada porta={{anamneseGuiada:api} as unknown as PortaConsulta} contexto={contexto} aoPendente={pendente} aoSalvando={salvando}/>);
 await screen.findByRole('option',{name:/Tumor sintético · PRIMEIRA_CONSULTA/});
 fireEvent.change(screen.getByLabelText(/^Tipo de tumor/),{target:{value:'pack'}});
 fireEvent.change(screen.getByLabelText('Perguntas, uma por linha'),{target:{value:'Nova pergunta sintética?'}});
 fireEvent.change(screen.getByLabelText(/^Roteiro conferido/),{target:{value:'roteiro'}});
 fireEvent.change(screen.getByLabelText(/^Contato vinculado/),{target:{value:'contato'}});
 fireEvent.change(screen.getByLabelText(/^Acrescentar mensagem de origem/),{target:{value:'mensagem'}});
 await waitFor(()=>expect(pendente).toHaveBeenLastCalledWith(true));
 const roteiro=screen.getByRole('button',{name:'Conferir e salvar roteiro'}),respostas=screen.getByRole('button',{name:'Preparar e salvar resumo da anamnese'});
 fireEvent.click(primeira==='roteiro'?roteiro:respostas);
 await waitFor(()=>expect(api).toHaveBeenCalledTimes(2));await waitFor(()=>expect(salvando).toHaveBeenLastCalledWith(false));
 expect(pendente).toHaveBeenLastCalledWith(true);
 fireEvent.click(primeira==='roteiro'?respostas:roteiro);await waitFor(()=>expect(api).toHaveBeenCalledTimes(3));
 await waitFor(()=>expect(pendente).toHaveBeenLastCalledWith(false));
});
