import { expect, it, vi } from 'vitest';
import { abrirLedger } from '../../src/kernel/ledger/db.js';
import { criarServidorLocal } from '../../src/server/http.js';
import { criarGerenciadorSessao } from '../../src/server/sessao.js';
import { criarGateway, memoriaIdempotencia } from '../../src/kernel/gateway/gateway.js';
import { criarMotorF1 } from '../../src/kernel/orquestracao/runtime.js';
import { fixturePack, contexto } from './fixtures.js';
import * as canal from '../../src/server/canalReconciliacao.js';

it('fonte autenticada: versão e contexto exatos; zero processamento global ou gravação', async () => {
  const f = fixturePack(), db = abrirLedger(':memory:'), agora = () => '2026-10-16T12:00:00Z';
  const sessoes = criarGerenciadorSessao({ medicoId: 'medico-sintetico', crm: 'CRM-SINTETICO', senha: 'senha-sintetica-longa', duracaoMs: 60000, agora });
  const token = sessoes.login('senha-sintetica-longa')!.token; sessoes.selecionarConsulta(token, contexto);
  const motor = criarMotorF1(db, agora, () => ({ regras: [], biblioteca: { id: 'sintetica', versao: '1', hash: 'sintetico' } }));
  const spyMotor = vi.spyOn(motor, 'processar'), spyCanal = vi.spyOn(canal, 'processarPendenciasClinicasCanal');
  const server = criarServidorLocal({ db, sessoes, motorF1: motor, catalogoTumorPacks: f.catalogo, corpus: null, agora, log: () => {},
    gateway: criarGateway({ agora, auditar: () => {}, store: memoriaIdempotencia(), executores: {} }) });
  await new Promise<void>(r => server.listening ? r() : server.once('listening', r));
  await new Promise<void>(r => setImmediate(r)); spyMotor.mockClear(); spyCanal.mockClear();
  const addr = server.address(); if (!addr || typeof addr === 'string') throw Error('PORTA');
  const post = async (pedido: unknown, auth = token, caminho = '/consulta/pack/fonte') => { const r = await fetch(`http://127.0.0.1:${addr.port}${caminho}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', ...(auth ? { Authorization: `Bearer ${auth}` } : {}) }, body: JSON.stringify(pedido) });
    return { status: r.status, body: await r.json() }; };
  try {
    const antes = db.prepare('SELECT total_changes() AS n').get()?.n;
    expect((await post(f.pedido, '')).status).toBe(401);
    expect((await post({ ...f.pedido, patientId: 'outro' })).status).toBe(409);
    expect((await post({ ...f.pedido, hashOriginal: 'b'.repeat(64) })).status).toBe(409);
    expect((await post({ ...f.pedido, arquivo: '../segredo' })).status).toBe(400);
    const r = await post(f.pedido); expect(r.status).toBe(200);
    expect(r.body).toMatchObject({ conteudoIntegral: f.original, contexto });
    expect((await post(contexto, token, '/consulta/investigacao')).status).toBe(200);
    expect((await post({...contexto,medicamento:'Fármaco sintético'}, token, '/consulta/receita/propor-dose')).status).toBe(200);
    expect(spyMotor).not.toHaveBeenCalled(); expect(spyCanal).not.toHaveBeenCalled();
    expect(db.prepare('SELECT total_changes() AS n').get()?.n).toBe(antes);
  } finally { await new Promise<void>(r => server.close(() => r())); db.close(); vi.restoreAllMocks(); }
});
