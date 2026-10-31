import { z } from "zod";
import { ContextoDutosVisao } from "./dutos.js";
import { Tarefa, ReferenciaPedido, FonteResultadoPedido } from "../f1/tarefa.js";
import { DataCivil, Id } from "../base.js";
const contexto = ContextoDutosVisao;
const base = { contexto, tarefaId: Id, pedido: ReferenciaPedido, expectedEventId: Id, operationId: Id };
export const PedidoResultadoExame = z.discriminatedUnion("acao", [
  z.object({ acao: z.literal("LISTAR"), contexto }).strict(),
  z.object({ ...base, acao: z.literal("REALIZADO"), realizadoEm: DataCivil }).strict(),
  z.object({ ...base, acao: z.literal("RESULTADO_DISPONIVEL"), fonte: FonteResultadoPedido }).strict(),
  z.object({ ...base, acao: z.literal("REVISADO"), expectedFonteHash: z.string().regex(/^[a-f0-9]{64}$/) }).strict(),
]);
export type PedidoResultadoExame = z.infer<typeof PedidoResultadoExame>;
export const ResultadosPedidosResposta = z.object({ codigo: z.literal("RESULTADOS_PEDIDOS"), contexto,
  tarefas: z.array(z.object({ eventId: Id, tarefa: Tarefa, pedidos: z.array(ReferenciaPedido.extend({ titulo: Id, texto: z.string(), assinadoEm: Id })) }).strict()),
  fontes: z.array(FonteResultadoPedido.extend({ texto: z.string(), registradoEm: Id }).strict()),
}).strict();
export type ResultadosPedidosResposta = z.infer<typeof ResultadosPedidosResposta>;
