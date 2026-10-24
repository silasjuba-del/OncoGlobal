import { z } from 'zod';
import { ConfirmarPrescricaoExecutavelPedido, PrescricaoExecutavelConfirmada } from './operacaoPrescricaoExecutavel.js';
import { ApacRascunhoConfirmadoSchema } from './apacRascunho.js';
/** Ponteiros opacos: não persistir texto clínico nem credenciais no navegador. */
export const ConfirmacaoPendente = z.object({tipo:z.enum(['PRESCRICAO','APAC']),pedido:ConfirmarPrescricaoExecutavelPedido}).strict();
export type ConfirmacaoPendente = z.infer<typeof ConfirmacaoPendente>;
export const PedidoRecuperacaoConfirmacao = ConfirmacaoPendente.extend({cancelar:z.literal(true).optional()});
export const RecuperacaoConfirmacao = z.discriminatedUnion('estado',[
 z.object({estado:z.literal('CANCELADA')}).strict(),
 z.object({estado:z.literal('CONFIRMADA'),resultado:z.union([PrescricaoExecutavelConfirmada,ApacRascunhoConfirmadoSchema])}).strict(),
 z.object({estado:z.literal('PREVIA'),texto:z.string().min(1),avisos:z.array(z.string())}).strict(),
]);
export type RecuperacaoConfirmacao = z.infer<typeof RecuperacaoConfirmacao>;
