// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, it } from 'vitest';
import { DutosClinica } from '../../../src/ui/consulta/DutosClinica.js';
import type { DutosClinicaVisao } from '../../../src/contracts/api/dutos.js';
afterEach(cleanup);
const ctx={patientId:'p',encounterId:'e',tumorLotId:'l'},em='2026-10-12T12:00:00Z';
const base:DutosClinicaVisao={schema:'DutosClinicaVisao@1',contexto:ctx,farmacia:[],tarefas:[],apacs:[],administracoes:[],integridade:[]};
it('UI mantém envio e conferência distintos e expõe dados pendentes',()=>{
 render(<DutosClinica dados={{...base,farmacia:[{eventId:'f',registro:{prescricao:{...ctx,documentId:'rx',documentVersion:1,documentHash:'a'.repeat(64),revisao:'ASSINADO'},estado:'ENVIADA',motivo:null,atorId:'m',em},referenciaValida:true,motivo:null}]}}/>);
 expect(screen.getByText('ENVIADA')).toBeTruthy();expect(screen.queryByText('CONFERIDA')).toBeNull();expect(screen.getByRole('region',{name:'Setores da clínica'})).toBeTruthy();
});
it('UI mostra quantidade efetiva e recebimento sem transformar tarefa em concluída',()=>{
 render(<DutosClinica dados={{...base,tarefas:[{eventId:'t',tarefa:{tarefaId:'t',...ctx,operationId:'op',titulo:'Retorno sintético',responsavel:'m',prazo:null,estado:'CONFIRMADA',recebidoEm:em,criadoPor:'m',substituiTarefaId:null,dataAlvo:null,pedidoRefs:[],retornoRef:null,geradaPorEventoId:null,rulesetVersao:null}}]}}/>);
 expect(screen.getByText('CONFIRMADA')).toBeTruthy();expect(screen.queryByText('CONCLUIDA')).toBeNull();expect(screen.getByText(/Recebida em/)).toBeTruthy();
});
it('UI não apresenta conferência antiga como válida; dados malformados ficam pendentes',()=>{
 const v={...base,farmacia:[{eventId:'f',registro:{prescricao:{...ctx,documentId:'rx',documentVersion:1,documentHash:'a'.repeat(64),revisao:'ASSINADO' as const},estado:'CONFERIDA' as const,motivo:null,atorId:'m',em},referenciaValida:false,motivo:'Prescrição substituída.'}]};
 render(<DutosClinica dados={v}/>);expect(screen.getByText('PENDENTE')).toBeTruthy();expect(screen.getByText(/Registro anterior: CONFERIDA/)).toBeTruthy();
 cleanup();render(<DutosClinica dados={{...base,farmacia:[{estado:'forjado'}]} as never}/>);expect(screen.getByText('Dados setoriais pendentes.')).toBeTruthy();
});
