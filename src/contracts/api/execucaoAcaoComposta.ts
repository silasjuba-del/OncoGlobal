import { z } from "zod";
import { Id } from "../base.js";
import { BaseAcaoComposta, ContextoAcaoComposta, PedidoAcaoComposta, ResultadoAcaoComposta } from "./acoesCompostas.js";

export const BaseAcaoCompostaResposta = z.object({
  base: BaseAcaoComposta.nullable(),
  pendencias: z.array(Id),
}).strict();
export type BaseAcaoCompostaResposta = z.infer<typeof BaseAcaoCompostaResposta>;

export const PrepararAcaoCompostaPedido = z.object({
  contexto: ContextoAcaoComposta,
  expectedBaseHash: z.string().regex(/^[a-f0-9]{64}$/),
  idempotencyKey: Id,
  pedido: PedidoAcaoComposta,
}).strict();
export type PrepararAcaoCompostaPedido = z.infer<typeof PrepararAcaoCompostaPedido>;

export const AcaoCompostaPreparada = z.object({
  draftId: Id,
  revision: z.number().int().nonnegative(),
  conteudoHash: z.string().regex(/^[a-f0-9]{64}$/),
  resultado: ResultadoAcaoComposta,
  documentoPlano: z.object({ titulo: Id, texto: Id }).strict(),
  criaEventoClinico: z.literal(false),
  liberaTratamento: z.literal(false),
}).strict();
export type AcaoCompostaPreparada = z.infer<typeof AcaoCompostaPreparada>;
