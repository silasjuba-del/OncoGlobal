import { expect, it } from 'vitest';
import { abrirLedger } from '../../../src/kernel/ledger/db.js';
import { gravarOperacao, hashPayload } from '../../../src/kernel/ledger/ledger.js';
import type { ClinicalEvent } from '../../../src/contracts/operacao.js';

it('exceção de lista global não autoriza outro paciente, tipo ou campo entre lotes', () => {
  const db = abrirLedger(':memory:');
  const evento = (id: string, ajustes: Partial<ClinicalEvent> = {}): ClinicalEvent => ({
    eventId:id, operationId:id, eventIndex:0, patientId:'paciente-sintetico',
    tumorLotId:'lote-a', encounterId:'consulta-sintetica', tipo:'FATO',
    payload:{reviewDecisionId:'decisao-sintetica',data:{campo:'medicamentos',valor:['Um']}},
    fontes:[], revisao:'CONFIRMADO', criadoEm:'2026-10-13T12:00:00Z',
    criadoPor:{tipo:'SESSAO',id:'medico-sintetico'}, supersedesEventId:null, ...ajustes });
  const gravar = (e:ClinicalEvent) => gravarOperacao(db,{operationId:e.operationId,
    payloadHash:hashPayload([e]),resultRef:null,criadoEm:e.criadoEm},[e]);
  try {
    expect(gravar(evento('original')).estado).toBe('GRAVADA');
    for (const [i, ajustes] of [
      {patientId:'outro-paciente'}, {tipo:'Paciente'},
      {payload:{reviewDecisionId:'decisao-sintetica',data:{campo:'alergias',valor:['Um']}}},
      {payload:{reviewDecisionId:'decisao-sintetica',data:{campo:'medicamentos',valor:[123]}}},
    ].entries()) {
      expect(() => gravar(evento(`ataque-${i}`, {tumorLotId:'lote-b',supersedesEventId:'original',...ajustes})))
        .toThrow('SUPERSEDES_CONTEXT_INVALID');
      expect(db.prepare('SELECT COUNT(*) AS n FROM clinical_event').get()?.n).toBe(1);
      expect(db.prepare('SELECT COUNT(*) AS n FROM operation').get()?.n).toBe(1);
    }
    expect(gravar(evento('global-valida',{tipo:'FATO@1',tumorLotId:'lote-b',supersedesEventId:'original'})).estado).toBe('GRAVADA');
  } finally { db.close(); }
});
