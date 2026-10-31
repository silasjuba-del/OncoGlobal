// @vitest-environment jsdom
import { createHash } from 'node:crypto';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, it } from 'vitest';
import { RevisaoClinica } from '../../src/ui/consulta/RevisaoClinica.js';
import { adaptarPackDocumental } from '../../src/kernel/corpus/tumorPacks.js';
import { montarLoteCompleto } from '../../src/kernel/corpus/loteCompleto.js';
import type { RevisaoClinicaResposta } from '../../src/contracts/fase2/revisaoClinica.js';
import { montarTelaRevisao } from '../../src/modules/consulta/telaRevisao.js';
import type { PortaConsulta } from '../../src/contracts/api/porta.js';

afterEach(cleanup);
const contexto = { patientId: 'paciente-sintetico-c2', encounterId: 'consulta-sintetica-c2', tumorLotId: 'lote-sintetico-c2' };

function fixture(consultavel: boolean, revisado = false) {
  const original = { header: { id: 'pack-sintetico-c2', versao: '1.0.0' },
    identidade: { tumor: 'Tumor sintético C2', cid10: [] }, status: 'RASCUNHO', consultavel,
    diagnostico: {}, tratamento: { protocolos: [] } };
  const arquivo = 'fixture-sintetica-em-memoria-c2';
  const hash = createHash('sha256').update(JSON.stringify(original)).digest('hex');
  const pack = adaptarPackDocumental(original, arquivo, hash);
  if (revisado) pack.revisaoClinica = { medicoId: 'medico-sintetico-c2', em: '2026-10-19T12:00:00Z',
    hashOriginal: pack.original.hash, hashExtracao: pack.referencia.hash };
  const resposta: RevisaoClinicaResposta = { codigo: 'REVISAO_CLINICA_CARREGADA', contexto, revisao: 'sintetica-c2',
    ficha: [], preQt: { estado: 'PENDENTE', autorizaTratamento: false, pendencias: [] },
    packs: [{ id: pack.referencia.id, titulo: pack.titulo, estado: pack.estado, cids: pack.cids }],
    pack, loteCompleto: montarLoteCompleto(original, arquivo, hash), pendencias: [], estadosDoenca: [],
    respostaTumoral: { criterio: 'RECIST_1_1', aplicabilidade: 'CONFERIR_CRITERIO_DO_TUMOR', series: [], patologica: [], pendencias: [] },
    tela: montarTelaRevisao({}) };
  const porta = { revisaoClinica: async () => resposta } as unknown as PortaConsulta;
  return { resposta, porta };
}

it.each([true, false])('D-F1-05: revisão nula mostra não curado, preservando conteúdo e estado (consultável=%s)', async consultavel => {
  const { resposta, porta } = fixture(consultavel);
  const antes = JSON.stringify(resposta);
  render(<RevisaoClinica porta={porta} contexto={contexto} versaoClinica={0} />);
  const pack = await screen.findByLabelText('Pack documental selecionado');
  const avisos = [...pack.querySelectorAll('p')].map(p => p.textContent ?? '');
  expect(avisos.some(texto => texto.startsWith('Não curado.'))).toBe(true);
  expect(pack.textContent).toContain('Conteúdo consultável');
  expect(screen.getByLabelText('Lote tumoral completo')).toBeTruthy();
  expect(resposta.pack?.estado).toBe(consultavel ? 'CONSULTAVEL' : 'RASCUNHO');
  expect(resposta.preQt.autorizaTratamento).toBe(false);
  expect(JSON.stringify(resposta)).toBe(antes);
});

it('revisão registrada não recebe o rótulo não curado nem ativa o pack pela apresentação', async () => {
  const { resposta, porta } = fixture(true, true);
  const antes = JSON.stringify(resposta);
  render(<RevisaoClinica porta={porta} contexto={contexto} versaoClinica={0} />);
  const pack = await screen.findByLabelText('Pack documental selecionado');
  expect([...pack.querySelectorAll('p')].some(p => p.textContent?.startsWith('Não curado.'))).toBe(false);
  expect(resposta.pack?.estado).toBe('CONSULTAVEL');
  expect(JSON.stringify(resposta)).toBe(antes);
});
