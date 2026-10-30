import { expect, it, vi } from 'vitest';
import { abrirServidorHttpG2, semearPacienteELoteG2, G2_CONTEXTO } from '../fixtures/g2-integridade.js';
import * as leituras from '../../src/server/leituras.js';

it('salvar e preparar Flash leem consulta uma vez por requisição; revisão conflitante continua recusada', async () => {
  const a = await abrirServidorHttpG2();
  const spy = vi.spyOn(leituras, 'lerConsulta');
  const plano = { acoesMarcadas: [], receitasMarcadas: [], apac: { cid: '', sigtap: '', finalidade: '', competencia: '', estado: 'PENDENTE', pendencias: [], emitir: false },
    retorno: { dias: 14, examesAntesDoRetorno: [] }, solicitacoes: { laboratorio: [], imagem: [] } };
  try {
    semearPacienteELoteG2(a.db, a.sessao, a.obterAgora(), G2_CONTEXTO);
    await a.post('/consulta/carregar', G2_CONTEXTO);
    spy.mockClear();
    const salvo = await a.post('/consulta/flash/rascunho', { ...G2_CONTEXTO, plano, expectedRevision: null });
    expect(salvo.status).toBe(201); expect(spy).toHaveBeenCalledTimes(1);
    expect((await a.post('/consulta/flash/rascunho', { ...G2_CONTEXTO, plano, expectedRevision: null })).status).toBe(409);
    spy.mockClear();
    const preparo = await a.post('/consulta/flash/preparar', { ...G2_CONTEXTO, plano, idempotencyKey: 'sintetico-eficiencia-flash' });
    expect(preparo.status, JSON.stringify(preparo.data)).toBe(200); expect(spy).toHaveBeenCalledTimes(1);
    const eventos = a.eventosDoPaciente();
    expect(eventos.some(e => e.tipo === 'DOCUMENTO')).toBe(false);
  } finally { spy.mockRestore(); await a.fechar(); }
});
