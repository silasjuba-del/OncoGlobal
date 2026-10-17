import { z } from "zod";

const Hex = z.string().regex(/^[a-f0-9]{64}$/);
const Versao = z.string().regex(/^\d+\.\d+\.\d+$/);
export const ItemBibliotecaConteudo = z.object({
  schema: z.literal("ItemBiblioteca@1"), id: z.string(), versao: Versao, pilar: z.number().int(),
  tipo: z.enum(["REFERENCIA", "REGRA", "TRIAL"]), titulo: z.string(), texto: z.string(),
  aplicabilidade: z.object({ tumor: z.array(z.string()), histologia: z.array(z.string()), estadio: z.array(z.string()), biomarcador: z.array(z.string()), linha: z.array(z.string()) }),
  proveniencia: z.object({ fonte: z.string(), trecho: z.string(), publicadoEm: z.string(), recuperadoEm: z.string(), licenca: z.string() }),
  dependencias: z.array(z.object({ id: z.string(), versao: Versao })),
});
export const ItemBibliotecaResposta = ItemBibliotecaConteudo.extend({
  estado: z.enum(["RASCUNHO", "CONSULTAVEL", "ALERTA", "OBSOLETO"]),
  curadoria: z.object({ ator: z.string(), registradoEm: z.string().nullable() }).nullable(),
});
export type ItemBibliotecaConteudo = z.infer<typeof ItemBibliotecaConteudo>;
export type ItemBibliotecaResposta = z.infer<typeof ItemBibliotecaResposta>;

export const BibliotecaEstado = z.object({
  ativa: z.string().nullable(), referencia: z.object({ id: z.string(), versao: Versao, hash: Hex }).nullable(),
  pacoteId: z.string().nullable(), hash: Hex.nullable(),
  curadoriaHash: Hex.nullable().optional(),
  anteriorRollback: z.object({pacoteId:z.string(),hash:Hex,curadoriaHash:Hex}).nullable().optional(),
  ativacao: z.object({ pacote: z.string(), anterior: z.string().nullable(), motivo: z.enum(["ATIVACAO", "ROLLBACK"]), ator: z.string().nullable(), registradoEm: z.string().nullable() }).nullable(),
  pacotes: z.array(z.object({ pacoteId: z.string(), versao: Versao, hash: Hex, ativo: z.boolean(), itens: z.array(z.object({ id: z.string(), estado: z.enum(["RASCUNHO", "CONSULTAVEL", "ALERTA", "OBSOLETO"]) })) })),
  itens: z.array(ItemBibliotecaResposta),
});
export type BibliotecaEstado = z.infer<typeof BibliotecaEstado>;

export const BibliotecaConsulta = z.object({ itens: z.array(ItemBibliotecaConteudo), referencia: z.object({ id: z.string(), versao: Versao, hash: Hex }).nullable() });
export type BibliotecaConsulta = z.infer<typeof BibliotecaConsulta>;

export interface PacoteBibliotecaHttp { manifesto: unknown; arquivos: Record<string, { texto: string } | { base64: string }> }
export interface ApiBiblioteca {
  estado(pacoteId?: string): Promise<BibliotecaEstado>;
  importar(pacote: PacoteBibliotecaHttp): Promise<{ codigo: string; pacoteId: string; hash: string }>;
  curar(pedido: { pacoteId: string; itemId: string; expectedHash: string; expectedCuradoriaHash: string; estado: "CONSULTAVEL" | "OBSOLETO" }): Promise<{ codigo: string }>;
  ativar(pedido: { pacoteId: string; expectedHash: string; expectedCuradoriaHash: string }): Promise<{ codigo: string }>;
  rollback(pedido: { expectedAtiva: string; expectedHash: string; expectedAnterior: string; expectedAnteriorHash: string; expectedAnteriorCuradoriaHash: string }): Promise<{ codigo: string }>;
  consultar(pedido: { filtros: Partial<Record<"tumor" | "histologia" | "estadio" | "biomarcador" | "linha", string>>; modo?: "CONSULTA" | "ALERTA" }): Promise<BibliotecaConsulta>;
}
