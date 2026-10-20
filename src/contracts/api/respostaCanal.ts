import {z} from 'zod';
import {ContextoRespostaCanal,RascunhoRespostaCanal} from '../f2/caixaRespostaCanal.js';
const Id=z.string().trim().min(1).max(250);
export const PrepararRespostaCanal=z.object({respostaId:Id,versao:z.number().int().positive(),mensagemOrigemId:Id,patientId:Id,encounterId:Id,tumorLotId:Id.nullable(),texto:z.string().trim().min(1).max(10_000)}).strict();
export type PrepararRespostaCanal=z.infer<typeof PrepararRespostaCanal>;
export const ConfirmarRespostaCanal=z.object({respostaId:Id,versao:z.number().int().positive(),comprovanteExibicao:z.object({destinatario:Id,conteudoSha256:z.string().regex(/^[a-f0-9]{64}$/),contexto:ContextoRespostaCanal}).strict()}).strict();
export type ConfirmarRespostaCanal=z.infer<typeof ConfirmarRespostaCanal>;
export const RespostaCanalPreparada=z.object({codigo:z.literal('RESPOSTA_PREPARADA'),rascunho:RascunhoRespostaCanal}).strict();
export const RespostaCanalConfirmada=z.object({codigo:z.literal('RESPOSTA_CONFIRMADA'),respostaId:Id,versao:z.number().int().positive()}).strict();
