import { describe, expect, it, vi } from 'vitest';
import { operarEstadoIntegracoes } from '../../src/server/integracoesEstado.js';
import { EstadoIntegracoes } from '../../src/contracts/api/integracoesEstado.js';
import { criarGerenciadorSessao } from '../../src/server/sessao.js';
import type { ServidorDeps } from '../../src/server/rotas.js';
import { ambienteHttp } from '../server/http-fixture.js';

describe('diagnóstico integrações não ativa nem envia', () => {
  it('HTTP exige sessão, recusa parâmetros e não confunde ausência com conexão validada', async () => {
    const a = await ambienteHttp();
    try {
      expect((await a.request('/integracoes/estado','POST','{}')).status).toBe(401);
      expect((await a.request('/integracoes/estado','POST','{"enviar":true}',a.token)).status).toBe(400);
      const r = await a.request('/integracoes/estado','POST','{}',a.token);
      expect(r.status).toBe(200);
      const estado = EstadoIntegracoes.parse(JSON.parse(r.body));
      expect(estado.whatsapp).toMatchObject({ ingressoConfigurado:false, saidaConfigurada:false, conectividade:'NAO_TESTADA', envioExecutadoNesteDiagnostico:false });
      expect(estado.extensoes.pluginsExternos).toBe('ADAPTADOR_DE_ADMISSAO_NAO_CONFIGURADO');
      expect(a.efeitos()).toBe(0);
    } finally { await a.close(); }
  });
  it('configuração presente não revela segredos nem chama transporte', () => {
    const agora = () => '2026-10-26T12:00:00Z';
    const sessoes = criarGerenciadorSessao({medicoId:'SINTETICO',crm:'CRM-SINTETICO',senha:'senha-sintetica-123',duracaoMs:60000,agora});
    const token = sessoes.login('senha-sintetica-123')!.token;
    const transporteSaida = vi.fn();
    const deps = {sessoes,agora,canal:{contasWebhook:[{accountId:'CONTA-PRIVADA',canal:'WHATSAPP_SERVICO',keyId:'chave',segredo:'SEGREDO-SENTINELA',verifyToken:'TOKEN-SENTINELA'}],transporteSaida}} as unknown as ServidorDeps;
    const r = operarEstadoIntegracoes(deps,token,{});
    expect(r.status).toBe(200);
    expect(EstadoIntegracoes.parse(r.body).whatsapp).toMatchObject({ingressoConfigurado:true,saidaConfigurada:true,contasIngresso:1,conectividade:'NAO_TESTADA'});
    expect(JSON.stringify(r)).not.toMatch(/SENTINELA|CONTA-PRIVADA/);
    expect(transporteSaida).not.toHaveBeenCalled();
    expect(operarEstadoIntegracoes({...deps,agora:()=> '2026-10-27T12:00:00Z'},token,{}).status).toBe(401);
  });
});
