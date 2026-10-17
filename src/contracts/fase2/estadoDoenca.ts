import { z } from "zod";
import { DataCivil,Id } from "../base.js";
import { ContextoDutosVisao } from "../api/dutos.js";
export const PedidoEstadoDoenca=ContextoDutosVisao.extend({estado:z.enum(["REMISSAO","RECIDIVA"]),data:DataCivil,
  fundamento:z.string().trim().min(1).max(4000)}).strict();
export type PedidoEstadoDoenca=z.infer<typeof PedidoEstadoDoenca>;
export const EstadoDoencaPreparado=z.object({codigo:z.literal("ESTADO_DOENCA_PREPARADO"),contexto:ContextoDutosVisao,
  draftId:Id,conteudoHash:z.string().regex(/^[a-f0-9]{64}$/),texto:Id,criaEventoClinico:z.literal(false)}).strict();
export type EstadoDoencaPreparado=z.infer<typeof EstadoDoencaPreparado>;
export const ConfirmacaoEstadoDoenca=ContextoDutosVisao.extend({draftId:Id,conteudoHash:z.string().regex(/^[a-f0-9]{64}$/)}).strict();
export type ConfirmacaoEstadoDoenca=z.infer<typeof ConfirmacaoEstadoDoenca>;
export const RegistroEstadoDoenca=z.object({estado:z.enum(["REMISSAO","RECIDIVA"]),data:DataCivil,fundamento:z.string().trim().min(1).max(4000)}).strict();
