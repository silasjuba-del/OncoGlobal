import {z} from 'zod';
export const ContextoDitado=z.object({patientId:z.string().min(1),encounterId:z.string().min(1),tumorLotId:z.string().nullable()}).strict();
export const DitadoPedido=z.discriminatedUnion('acao',[
 z.object({acao:z.literal('STATUS')}).strict(),
 z.object({acao:z.literal('CONFIGURAR'),chave:z.string().trim().min(20).max(256).regex(/^[A-Za-z0-9_-]+$/),persistir:z.boolean().optional()}).strict(),
 z.object({acao:z.literal('SALVAR_CHAVE_ATUAL')}).strict(),
 z.object({acao:z.literal('ESQUECER_CHAVE_SALVA')}).strict(),
 z.object({acao:z.literal('REMOVER_CHAVE')}).strict(),
 z.object({acao:z.literal('INICIAR'),contexto:ContextoDitado,autorizaEnvioAudio:z.literal(true)}).strict(),
]);
export const DitadoResposta=z.discriminatedUnion('codigo',[
 z.object({codigo:z.literal('DITADO_CONFIGURACAO'),configurada:z.boolean(),salva:z.boolean().optional(),origem:z.enum(['SESSAO','COFRE','AMBIENTE','AUSENTE']).optional(),persistenciaDisponivel:z.boolean().optional(),cofreIndisponivel:z.boolean().optional(),provedor:z.literal('DEEPGRAM'),modelo:z.literal('nova-3'),idioma:z.literal('pt-BR')}).strict(),
 z.object({codigo:z.literal('DITADO_TICKET'),ticket:z.string().regex(/^[a-f0-9]{64}$/),caminho:z.literal('/consulta/ditado/stream'),expiraEm:z.number().int()}).strict(),
]);
export const EventoDitado=z.discriminatedUnion('tipo',[
 z.object({tipo:z.literal('PRONTO')}).strict(),
 z.object({tipo:z.literal('TRECHO'),id:z.string(),texto:z.string().max(200_000),final:z.boolean(),confianca:z.number().min(0).max(1).nullable()}).strict(),
 z.object({tipo:z.literal('CONCLUIDO')}).strict(),
 z.object({tipo:z.literal('ERRO'),codigo:z.string().min(1)}).strict(),
]);
export type DitadoPedido=z.infer<typeof DitadoPedido>;
export type DitadoResposta=z.infer<typeof DitadoResposta>;
export type EventoDitado=z.infer<typeof EventoDitado>;
