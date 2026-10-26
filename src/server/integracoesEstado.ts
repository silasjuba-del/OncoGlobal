import { Instante, Sessao } from '../contracts/base.js';
import { EstadoIntegracoes, PedidoEstadoIntegracoes } from '../contracts/api/integracoesEstado.js';
import type { ServidorDeps } from './rotas.js';

/** Diagnóstico sem rede, sem leitura de segredos e sem enumerar contas/contatos. */
export function operarEstadoIntegracoes(deps: ServidorDeps, token: string, raw: unknown) {
  const agora = deps.agora();
  if (!Instante.safeParse(agora).success) return { status: 503, body: { codigo: 'RELOGIO_SERVICO_INVALIDO' } };
  const sessao = Sessao.safeParse(deps.sessoes.obter(token));
  if (!sessao.success || Date.parse(sessao.data.emitidaEm) > Date.parse(agora) || Date.parse(sessao.data.expiraEm) <= Date.parse(agora))
    return { status: 401, body: { codigo: 'SESSAO_INVALIDA' } };
  if (!PedidoEstadoIntegracoes.safeParse(raw).success) return { status: 400, body: { codigo: 'PAYLOAD_INVALIDO' } };
  return { status: 200, body: EstadoIntegracoes.parse({
    codigo: 'INTEGRACOES_ESTADO',
    whatsapp: { ingressoConfigurado: !!deps.canal?.contasWebhook.length, saidaConfigurada: !!deps.canal?.transporteSaida,
      contasIngresso: deps.canal?.contasWebhook.length ?? 0, conectividade: 'NAO_TESTADA', envioExecutadoNesteDiagnostico: false,
      transporteNativo: 'TEXTO', documentos: 'NAO_IMPLEMENTADO', requerAutorizacaoPorEnvio: true },
    extensoes: { skillsNativas: [{ id: 'primeira-consulta', versao: '1.0.0' }],
      pluginsExternos: 'ADAPTADOR_DE_ADMISSAO_NAO_CONFIGURADO', instalacaoAutomatica: false },
    acervo: { escopo: 'ITENS_TEXTUAIS_CURADOS', drive: 'NAO_CONFIGURADO', originaisBinarios: 'NAO_DISPONIVEIS_NESTA_PORTA' },
  }) };
}
