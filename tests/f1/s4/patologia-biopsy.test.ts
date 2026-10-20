import { describe, it, expect, afterEach } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
// proveniência: dados sintéticos - não utilizar em produção
import { avaliarPatologia } from '../../../src/modules/setores/index.js';
import { validarPayloadEvento } from '../../../src/contracts/envelope.js';
import { abrirLedger } from '../../../src/kernel/ledger/db.js';
import { salvarDraft } from '../../../src/kernel/ledger/drafts.js';
import { confirmar } from '../../../src/kernel/ledger/writeRouter.js';
import { listarEventos } from '../../../src/kernel/ledger/ledger.js';
import { projetarRetrato } from '../../../src/kernel/projections/retrato/index.js';
import { fato, retrato, contexto, fonte } from '../../fase2/fixtures.js';
import type { Correlacao } from '../../../src/contracts/f1/correlacao.js';
import type { Retrato } from '../../../src/contracts/f1/retrato.js';

const agora = '2026-10-19T12:00:00Z';
const regraRef = { id: 'regra-biopsy-sintetica', versao: '1', hash: 'hash-biopsy-sintetica' };
const biomarcRule = { referencia: regraRef, status: 'CONFERIDA_MEDICO' as const, fonte: 'FONTE_SINTETICA', conteudo: ['HER2'] };
const correlacao = (r: Retrato): Correlacao => ({ patientId: r.patientId, encounterId: r.encounterId, tumorLotId: r.tumorLotId,
  operationId: 'op-biopsy-sintetica', revisaoFatos: r.revisao, regras: r.regras, biblioteca: r.biblioteca, proposta: null });
const dirs: string[] = [];
afterEach(() => { for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true }); });

function gravar(db: ReturnType<typeof abrirLedger>, tipo: string, payload: unknown, sufixo: string, revisao: 'CONFIRMADO' | 'RAW' = 'CONFIRMADO') {
  const draftId = `draft-${sufixo}`;
  salvarDraft(db, { draftId, patientId: contexto.patientId, sourceId: `fonte-${sufixo}`,
    rawRef: 'SINTETICO_SEM_PHI', payload, diagnostics: [], revision: 0, criadoEm: agora });
  return confirmar(db, { operationId: `op-${sufixo}`, ...contexto, reviewDecisionId: `rev-${sufixo}`, em: agora,
    sessao: { medicoId: 'medico-sintetico', crm: 'CRM-SYN', emitidaEm: agora, expiraEm: '2026-10-19T13:00:00Z' },
    registros: [{ draftId, expectedRevision: 0, eventId: `evento-${sufixo}`, tipo, payload,
      fontes: [{ ...fonte, sourceId: `fonte-${sufixo}` }], revisao: revisao as "CONFIRMADO" }] });
}

describe('Biopsy canônica -> PATOLOGIA (ARQ-01)', () => {
  it('Biopsy confirmada WriteRouter->Retrato->Patologia preserva referência e fonte; biópsia não sustenta pT', () => {
    const payload = { dataClinica: '2026-10-19', histologia: 'HISTOLOGIA_SINTETICA', specimenRole: 'BIOPSIA', pT: 'pT2' };
    expect(validarPayloadEvento('Biopsy', payload).ok).toBe(true);
    const db = abrirLedger(':memory:');
    try {
      expect(gravar(db, 'Biopsy', payload, 'biopsia').estado).toBe('GRAVADA');
      const r = projetarRetrato(listarEventos(db, contexto.patientId), { ...contexto, agora, regras: [regraRef], biblioteca: retrato().biblioteca });
      const fatoBiopsy = r.fatos.find(f => f.tipo === 'Biopsy');
      expect(fatoBiopsy?.ref.eventId).toBe('evento-biopsia');
      expect(fatoBiopsy?.fontes[0]?.sourceId).toBe('fonte-biopsia');
      const s = avaliarPatologia(r, correlacao(r), { biomarcadoresObrigatorios: biomarcRule });
      expect(s.entradas.some(e => e.eventId === 'evento-biopsia')).toBe(true);
      expect(s.lacunas.some(l => l.codigo === 'PATOLOGIA_AUSENTE')).toBe(false);
      expect(s.lacunas.some(l => l.codigo === 'PT:evento-biopsia')).toBe(true);
      expect(s.lacunas.some(l => l.codigo === 'BIOMARCADOR_HER2')).toBe(true);
      expect(s.achados).toHaveLength(0);
    } finally { db.close(); }
  });

  it('RAW, outro paciente e outro lote não atravessam para PATOLOGIA', () => {
    const db = abrirLedger(':memory:');
    try {
      gravar(db, 'Biopsy', { dataClinica: '2026-10-19', histologia: 'RAW_SINTETICO', specimenRole: 'BIOPSIA' }, 'raw', 'RAW');
      const rRaw = projetarRetrato(listarEventos(db, contexto.patientId), { ...contexto, agora, regras: [], biblioteca: retrato().biblioteca });
      expect(rRaw.fatos.some(f => f.tipo === 'Biopsy')).toBe(false);
      expect(avaliarPatologia(rRaw, correlacao(rRaw)).lacunas.some(l => l.codigo === 'PATOLOGIA_AUSENTE')).toBe(true);
    } finally { db.close(); }
    const outroPaciente = fato('patologia', { specimenRole: 'BIOPSIA' }, { tipo: 'Biopsy', patientId: 'outro-paciente', ref: { eventId: 'ev-outro-paciente', revisao: '1' } });
    expect(() => avaliarPatologia(retrato([outroPaciente]), correlacao(retrato([outroPaciente])))).toThrow('FATO_FORA_ESCOPO');
    // Outro lote: a projeção do Retrato (escopo tumoral da Biopsy) não inclui o fato no lote consultado.
    const eventoOutroLote = { eventId: 'ev-outro-lote', operationId: 'op-outro-lote', eventIndex: 0, patientId: contexto.patientId,
      encounterId: contexto.encounterId, tumorLotId: 'outro-lote', tipo: 'Biopsy',
      payload: { reviewDecisionId: 'rev', data: { dataClinica: '2026-10-19', histologia: 'SINTETICA', specimenRole: 'BIOPSIA' } },
      fontes: [fonte], revisao: 'CONFIRMADO', criadoEm: agora, criadoPor: { tipo: 'SESSAO', id: 'medico-sintetico' }, supersedesEventId: null } as never;
    const rLote = projetarRetrato([eventoOutroLote], { ...contexto, agora, regras: [], biblioteca: retrato().biblioteca });
    expect(rLote.fatos.some(f => f.ref.eventId === 'ev-outro-lote')).toBe(false);
    expect(avaliarPatologia(rLote, correlacao(rLote)).entradas).toHaveLength(0);
  });

  it('ressecção válida intacta: specimenRole RESSECCAO com pT não gera lacuna PT', () => {
    const f = fato('patologia', { specimenRole: 'RESSECCAO', pT: 'pT2' }, { tipo: 'PathologyReport', ref: { eventId: 'ev-resseccao', revisao: '1' } });
    const r = retrato([f]);
    const s = avaliarPatologia(r, correlacao(r));
    expect(s.entradas.some(e => e.eventId === 'ev-resseccao')).toBe(true);
    expect(s.lacunas.some(l => l.codigo.startsWith('PT:'))).toBe(false);
  });

  it('Biopsy com campo laboratorial preserva conflito tipo/campo e não sustenta biomarcador', () => {
    const f = fato('extracao.lab', { nome: 'HER2', resultado: 'POSITIVO_SINTETICO', specimenRole: 'BIOPSIA' },
      { tipo: 'Biopsy', ref: { eventId: 'ev-biopsy-lab', revisao: '1' } });
    const r = { ...retrato([f]), regras: [regraRef] };
    const s = avaliarPatologia(r, correlacao(r), { biomarcadoresObrigatorios: biomarcRule as never });
    expect(s.entradas.some(e => e.eventId === 'ev-biopsy-lab')).toBe(true);
    expect(s.lacunas.some(l => l.codigo === 'CONFLITO_TIPO_CAMPO')).toBe(true);
    expect(s.cobertura.avaliados).toBe(0);
    expect(s.achados).toHaveLength(0);
  });

  it('reabertura do ledger preserva fonte e referência da Biopsy em PATOLOGIA', () => {
    const dir = mkdtempSync(join(tmpdir(), 'og-biopsy-')); dirs.push(dir);
    const path = join(dir, 'ledger.sqlite');
    const payload = { dataClinica: '2026-10-19', histologia: 'HISTOLOGIA_SINTETICA', specimenRole: 'BIOPSIA' };
    const db = abrirLedger(path);
    expect(gravar(db, 'Biopsy', payload, 'reabertura').estado).toBe('GRAVADA');
    db.close();
    const reaberto = abrirLedger(path);
    try {
      const r = projetarRetrato(listarEventos(reaberto, contexto.patientId), { ...contexto, agora, regras: [], biblioteca: retrato().biblioteca });
      const s = avaliarPatologia(r, correlacao(r));
      expect(s.entradas.some(e => e.eventId === 'evento-reabertura')).toBe(true);
      expect(r.fatos.find(f => f.tipo === 'Biopsy')?.fontes[0]?.sourceId).toBe('fonte-reabertura');
    } finally { reaberto.close(); }
  });
});
