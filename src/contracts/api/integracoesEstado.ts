import { z } from 'zod';

export const PedidoEstadoIntegracoes = z.object({}).strict();
export const EstadoIntegracoes = z.object({
  codigo: z.literal('INTEGRACOES_ESTADO'),
  whatsapp: z.object({
    ingressoConfigurado: z.boolean(), saidaConfigurada: z.boolean(), contasIngresso: z.number().int().nonnegative(),
    conectividade: z.literal('NAO_TESTADA'), envioExecutadoNesteDiagnostico: z.literal(false),
    transporteNativo: z.literal('TEXTO'), documentos: z.literal('NAO_IMPLEMENTADO'),
    requerAutorizacaoPorEnvio: z.literal(true),
  }).strict(),
  extensoes: z.object({
    skillsNativas: z.array(z.object({ id: z.string(), versao: z.string() }).strict()),
    pluginsExternos: z.literal('ADAPTADOR_DE_ADMISSAO_NAO_CONFIGURADO'),
    instalacaoAutomatica: z.literal(false),
  }).strict(),
  acervo: z.object({ escopo: z.literal('ITENS_TEXTUAIS_CURADOS'), drive: z.literal('NAO_CONFIGURADO'),
    originaisBinarios: z.literal('NAO_DISPONIVEIS_NESTA_PORTA') }).strict(),
}).strict();
