import { describe, it, expect } from 'vitest';
import { avaliarLaboratorio, avaliarImagem, avaliarPatologia, avaliarSetores } from '../../src/modules/setores/index.js';
import { validarPayloadEvento } from '../../src/contracts/envelope.js';
import { abrirLedger } from '../../src/kernel/ledger/db.js';
import { salvarDraft } from '../../src/kernel/ledger/drafts.js';
import { confirmar } from '../../src/kernel/ledger/writeRouter.js';
import { listarEventos } from '../../src/kernel/ledger/ledger.js';
import { projetarRetrato } from '../../src/kernel/projections/retrato/index.js';
import { fato, retrato, contexto, fonte } from '../fase2/fixtures.js';
import type { Correlacao } from '../../src/contracts/f1/correlacao.js';
import type { Retrato } from '../../src/contracts/f1/retrato.js';
import type { LabRuleset, RecistRuleset } from '../../src/rules/tipos-w3.js';

// AF-E / FUGU-R2 setor E: tipo material específico × campo laboratorial.
// Fixtures sintéticas; regra laboratorial sintética conferida e pinada no Retrato do teste.
const ruleRef = { id: 'r2-lab-syn', versao: '1', hash: 'hash-r2-lab-syn' };
const labConteudo: LabRuleset = { id: ruleRef.id, versao: ruleRef.versao, ativo: true,
  analitos: [{ codigo: 'creatinina', threshold: { regraId: 'r2-creatinina', ativo: true, unidade: 'mg/dL', max: 2 }, conversoes: [] }] };
const labRule = { referencia: ruleRef, status: 'CONFERIDA_MEDICO' as const, fonte: 'FONTE_SINTETICA_R2', conteudo: labConteudo };
const recistRef = { id: 'r2-recist-syn', versao: '1', hash: 'hash-r2-recist-syn' };
const recistConteudo: RecistRuleset = { id: recistRef.id, versao: recistRef.versao, ativo: true, regraId: 'r2-recist-syn',
  thresholds: { prPercent: -30, pdPercent: 20, pdAbsoluteMm: 5 } };
const recistRule = { referencia: recistRef, status: 'CONFERIDA_MEDICO' as const, fonte: 'FONTE_SINTETICA_R2', conteudo: recistConteudo };
const biomarcRule = { referencia: ruleRef, status: 'CONFERIDA_MEDICO' as const, fonte: 'FONTE_SINTETICA_R2', conteudo: ['HER2'] };
const lesao10 = [{ codigo: 'L1', diametroMm: 10, confirmadaPorMedico: true }];
const valorRecist = { textoLaudo: 'LAUDO SINTETICO RECIST', recist: { lesoesAtuais: lesao10, baseline: lesao10, nadir: lesao10 } };
const correlacao = (r: Retrato): Correlacao => ({ patientId: r.patientId, encounterId: r.encounterId, tumorLotId: r.tumorLotId,
  operationId: 'op-e-sintetica', revisaoFatos: r.revisao, regras: r.regras, biblioteca: r.biblioteca, proposta: null });
const conflito = (lacunas: { codigo: string; texto: string; fatos: { eventId: string }[] }[], eventId: string) =>
  lacunas.some(l => l.fatos.some(f => f.eventId === eventId) && /CONFLIT|DIVERG/i.test(`${l.codigo} ${l.texto}`));

const agora = '2026-10-19T12:00:00Z';
function gravarCanonica(tipo: string, payload: unknown, sufixo: string) {
  const db = abrirLedger(':memory:');
  const draftId = `e-draft-${sufixo}`;
  salvarDraft(db, { draftId, patientId: contexto.patientId, sourceId: `e-fonte-${sufixo}`,
    rawRef: 'SINTETICO_SEM_PHI', payload, diagnostics: [], revision: 0, criadoEm: agora });
  const gravacao = confirmar(db, { operationId: `e-operacao-${sufixo}`, ...contexto,
    reviewDecisionId: `e-revisao-${sufixo}`, em: agora,
    sessao: { medicoId: 'medico-sintetico-e', crm: 'CRM-SYN-E', emitidaEm: agora, expiraEm: '2026-10-19T13:00:00Z' },
    registros: [{ draftId, expectedRevision: 0, eventId: `e-evento-${sufixo}`, tipo, payload,
      fontes: [{ ...fonte, sourceId: `e-fonte-${sufixo}` }], revisao: 'CONFIRMADO' }] });
  return { db, gravacao };
}
const contextoRetrato = { ...contexto, agora, regras: [ruleRef], biblioteca: retrato().biblioteca };

describe('AF-E: conflito tipo×campo não alimenta VERDE silencioso', () => {
  it('contraprova canônica: ImagingReport + extracao.lab via WriteRouter e Retrato', () => {
    const payload = { campo: 'extracao.lab:creatinina', textoLaudo: 'LAUDO SINTETICO E', dataClinica: '2026-10-19',
      valor: { codigo: 'creatinina', valor: 1, unidade: 'mg/dL', data: '2026-10-19' } };
    expect(validarPayloadEvento('ImagingReport', payload).ok).toBe(true);
    const { db, gravacao } = gravarCanonica('ImagingReport', payload, 'imagem-lab');
    try {
      expect(gravacao.estado).toBe('GRAVADA');
      const eventosAntes = listarEventos(db, contexto.patientId);
      const r = projetarRetrato(eventosAntes, contextoRetrato);
      expect(r.fatos).toHaveLength(1);
      expect(r.fatos[0]).toMatchObject({ tipo: 'ImagingReport', campo: 'extracao.lab:creatinina' });
      const retratoAntes = JSON.stringify(r);
      const c = correlacao(r);
      const lab = avaliarLaboratorio(r, c, { laboratorio: labRule, hoje: '2026-10-19' });
      const imagem = avaliarImagem(r, c);
      expect(lab.cobertura.avaliados).toBe(0);
      expect(lab.achados.some(a => a.estado === 'VERDE')).toBe(false);
      expect(conflito(lab.lacunas, 'e-evento-imagem-lab') || conflito(imagem.lacunas, 'e-evento-imagem-lab')).toBe(true);
      // Dado e origem preservados: laudo continua visível para revisão no setor do tipo.
      expect(imagem.lacunas.some(l => l.texto.includes('LAUDO SINTETICO E'))).toBe(true);
      expect(r.fatos[0]!.fontes[0]?.sourceId).toBe('e-fonte-imagem-lab');
      // Avaliador não cria evento clínico nem altera a entrada.
      expect(listarEventos(db, contexto.patientId)).toHaveLength(eventosAntes.length);
      expect(JSON.stringify(r)).toBe(retratoAntes);
    } finally { db.close(); }
  });

  it('par original não canônico: PathologyReport + extracao.lab não vira VERDE e registra conflito', () => {
    const f = fato('extracao.lab', { codigo: 'creatinina', valor: 1, unidade: 'mg/dL', data: '2026-10-16' },
      { tipo: 'PathologyReport', ref: { eventId: 'e-conflito', revisao: '1' } });
    const r = { ...retrato([f]), regras: [ruleRef] };
    const antes = JSON.stringify(r);
    const c = correlacao(r);
    const lab = avaliarLaboratorio(r, c, { laboratorio: labRule, hoje: '2026-10-16' });
    const path = avaliarPatologia(r, c);
    expect(lab.cobertura.avaliados).toBe(0);
    expect(lab.achados.some(a => a.estado === 'VERDE')).toBe(false);
    expect(conflito(lab.lacunas, 'e-conflito') || conflito(path.lacunas, 'e-conflito')).toBe(true);
    expect(JSON.stringify(r)).toBe(antes);
  });

  it('fato contraditório não contamina série válida do mesmo analito/data', () => {
    const valido = fato('extracao.lab', { codigo: 'creatinina', valor: 1, unidade: 'mg/dL', data: '2026-10-16' },
      { tipo: 'LabResult', ref: { eventId: 'e-valido', revisao: '1' } });
    const contraditorio = fato('extracao.lab', { codigo: 'creatinina', valor: 3, unidade: 'mg/dL', data: '2026-10-16' },
      { tipo: 'ImagingReport', ref: { eventId: 'e-contraditorio', revisao: '1' } });
    const r = { ...retrato([valido, contraditorio]), regras: [ruleRef] };
    const lab = avaliarLaboratorio(r, correlacao(r), { laboratorio: labRule, hoje: '2026-10-16' });
    expect(lab.cobertura.avaliados).toBe(1);
    expect(lab.achados).toHaveLength(1);
    expect(lab.achados[0]?.estado).toBe('VERDE');
    expect(lab.achados[0]?.fatos.map(x => x.eventId)).toEqual(['e-valido']);
    expect(conflito(lab.lacunas, 'e-contraditorio')).toBe(true);
  });

  it('controle válido: LabResult sistêmico histórico de outro encontro/lote continua avaliado e rastreado', () => {
    const f = fato('extracao.lab', { codigo: 'creatinina', valor: 1, unidade: 'mg/dL', data: '2026-10-15' },
      { tipo: 'LabResult', encounterId: 'encontro-historico-syn', tumorLotId: 'lote-historico-syn', escopo: 'PACIENTE' });
    const r = { ...retrato([f]), regras: [ruleRef] };
    const lab = avaliarLaboratorio(r, correlacao(r), { laboratorio: labRule, hoje: '2026-10-16' });
    expect(lab.entradas.some(e => e.eventId === f.ref.eventId)).toBe(true);
    expect(lab.cobertura.avaliados).toBe(1);
    expect(lab.achados.some(a => a.estado === 'VERDE')).toBe(true);
    expect(conflito(lab.lacunas, f.ref.eventId)).toBe(false);
  });

  it('controle válido: portador genérico FATO e ImagingReport legítimo preservam multidomínio', () => {
    const generico = fato('extracao.lab', { codigo: 'creatinina', valor: 1, unidade: 'mg/dL', data: '2026-10-16' });
    const rGen = { ...retrato([generico]), regras: [ruleRef] };
    const labGen = avaliarLaboratorio(rGen, correlacao(rGen), { laboratorio: labRule, hoje: '2026-10-16' });
    expect(labGen.cobertura.avaliados).toBe(1);
    expect(conflito(labGen.lacunas, generico.ref.eventId)).toBe(false);

    const imagemFato = fato('extracao.imaging', { textoLaudo: 'LAUDO SINTETICO LEGITIMO' },
      { tipo: 'ImagingReport', ref: { eventId: 'e-imagem-legitima', revisao: '1' } });
    const rImg = { ...retrato([imagemFato]), regras: [ruleRef] };
    const setores = avaliarSetores(rImg, correlacao(rImg));
    const imagem = setores.find(s => s.setor === 'IMAGEM')!;
    expect(imagem.lacunas.some(l => l.texto.includes('LAUDO SINTETICO LEGITIMO'))).toBe(true);
    expect(conflito(imagem.lacunas, 'e-imagem-legitima')).toBe(false);
    expect(setores.find(s => s.setor === 'LABORATORIO')!.achados.some(a => a.estado === 'VERDE')).toBe(false);
  });

  it('revisão R2: ImagingReport + extracao.lab com RECIST válido não calcula RECIST nem incrementa avaliados', () => {
    const contraditorio = fato('extracao.lab', valorRecist,
      { tipo: 'ImagingReport', ref: { eventId: 'e-recist-conflito', revisao: '1' } });
    const r = { ...retrato([contraditorio]), regras: [recistRef] };
    const antes = JSON.stringify(r);
    const imagem = avaliarImagem(r, correlacao(r), { recist: recistRule });
    expect(imagem.cobertura.avaliados).toBe(0);
    expect(imagem.achados.some(a => a.texto.includes('RECIST proposto'))).toBe(false);
    expect(imagem.achados).toHaveLength(0);
    expect(conflito(imagem.lacunas, 'e-recist-conflito')).toBe(true);
    // Laudo, entrada e origem preservados apesar do bloqueio do cálculo.
    expect(imagem.entradas.some(e => e.eventId === 'e-recist-conflito')).toBe(true);
    expect(imagem.lacunas.some(l => l.texto.includes('LAUDO SINTETICO RECIST'))).toBe(true);
    expect(r.fatos[0]!.fontes[0]?.sourceId).toBe(fonte.sourceId);
    expect(JSON.stringify(r)).toBe(antes);
  });

  it('controle positivo equivalente sem conflito continua avaliando RECIST (SD)', () => {
    const valido = fato('extracao.imaging', valorRecist,
      { tipo: 'ImagingReport', ref: { eventId: 'e-recist-valido', revisao: '1' } });
    const r = { ...retrato([valido]), regras: [recistRef] };
    const imagem = avaliarImagem(r, correlacao(r), { recist: recistRule });
    expect(imagem.cobertura.avaliados).toBe(1);
    expect(imagem.achados).toHaveLength(1);
    expect(imagem.achados[0]?.texto).toContain('RECIST proposto: SD');
    expect(imagem.achados[0]?.estado).toBe('PENDENTE');
    expect(conflito(imagem.lacunas, 'e-recist-valido')).toBe(false);
  });

  it('fonte em conflito tipo×campo não sustenta biomarcador em PATOLOGIA, nem indiretamente', () => {
    const contraditorio = fato('extracao.lab', { nome: 'HER2', resultado: 'POSITIVO_SINTETICO', specimenRole: 'BIOPSIA' },
      { tipo: 'PathologyReport', ref: { eventId: 'e-bio-conflito', revisao: '1' } });
    const r = { ...retrato([contraditorio]), regras: [ruleRef] };
    const path = avaliarPatologia(r, correlacao(r), { biomarcadoresObrigatorios: biomarcRule });
    expect(path.cobertura.avaliados).toBe(0);
    expect(path.achados.some(a => a.texto.includes('HER2'))).toBe(false);
    expect(path.lacunas.some(l => l.codigo === 'BIOMARCADOR_HER2')).toBe(true);
    expect(conflito(path.lacunas, 'e-bio-conflito')).toBe(true);

    const valido = fato('patologia', { nome: 'HER2', resultado: 'POSITIVO_SINTETICO', specimenRole: 'BIOPSIA' },
      { tipo: 'PathologyReport', ref: { eventId: 'e-bio-valido', revisao: '1' } });
    const rVal = { ...retrato([valido]), regras: [ruleRef] };
    const pathVal = avaliarPatologia(rVal, correlacao(rVal), { biomarcadoresObrigatorios: biomarcRule });
    expect(pathVal.cobertura.avaliados).toBe(1);
    expect(pathVal.achados.some(a => a.texto.includes('HER2'))).toBe(true);
    expect(conflito(pathVal.lacunas, 'e-bio-valido')).toBe(false);
  });

  it('EXTRA registrado sem correção nesta fatia: Biopsy canônica permanece preservada no Retrato', () => {
    // Achado extra do R2 (fora dos seis): Biopsy gravada não chega a PATOLOGIA.
    // Aqui apenas se registra/preserva a evidência; a semântica do setor não é alterada nesta fatia.
    const payload = { dataClinica: '2026-10-19', histologia: 'HISTOLOGIA_SINTETICA', specimenRole: 'BIOPSIA' };
    expect(validarPayloadEvento('Biopsy', payload).ok).toBe(true);
    const { db, gravacao } = gravarCanonica('Biopsy', payload, 'biopsia');
    try {
      expect(gravacao.estado).toBe('GRAVADA');
      const r = projetarRetrato(listarEventos(db, contexto.patientId), contextoRetrato);
      expect(r.fatos.some(f => f.tipo === 'Biopsy' && f.ref.eventId === 'e-evento-biopsia')).toBe(true);
      expect(r.fatos.find(f => f.tipo === 'Biopsy')!.fontes[0]?.sourceId).toBe('e-fonte-biopsia');
    } finally { db.close(); }
  });
});
