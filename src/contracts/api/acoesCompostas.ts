import { z } from "zod";
import { DataCivil, Id } from "../base.js";

export const TipoAcaoComposta = z.enum([
  "MANTER_CICLO", "REDUZIR_DOSE", "ADIAR_CICLO", "TROCAR_PROTOCOLO",
]);
export type TipoAcaoComposta = z.infer<typeof TipoAcaoComposta>;

const InteiroSeguroPositivo = z.number().int().positive().refine(Number.isSafeInteger);
const InteiroSeguroNaoNegativo = z.number().int().nonnegative().refine(Number.isSafeInteger);
const MotivoAcaoComposta = z.string().trim().min(1).max(2000);

export const ContextoAcaoComposta = z.object({
  patientId: Id,
  encounterId: Id,
  tumorLotId: Id.nullable(),
}).strict();
export type ContextoAcaoComposta = z.infer<typeof ContextoAcaoComposta>;

export const ItemBaseAcaoComposta = z.object({
  item: InteiroSeguroPositivo,
  droga: z.string().trim().min(1).max(300),
  doseMg: InteiroSeguroNaoNegativo.nullable(),
}).strict();
export type ItemBaseAcaoComposta = z.infer<typeof ItemBaseAcaoComposta>;

export const SnapshotAcaoComposta = z.object({
  contexto: ContextoAcaoComposta,
  cicloId: Id,
  episodioId: Id,
  protocoloId: Id,
  previstoEm: DataCivil,
  itens: z.array(ItemBaseAcaoComposta),
}).strict();
export type SnapshotAcaoComposta = z.infer<typeof SnapshotAcaoComposta>;

export const BaseAcaoComposta = SnapshotAcaoComposta.extend({
  itens: z.array(ItemBaseAcaoComposta).min(1),
  revisao: z.string().trim().min(1).max(240),
  baseHash: z.string().regex(/^[a-f0-9]{64}$/),
}).strict().superRefine((base, ctx) => {
  if (new Set(base.itens.map(item => item.item)).size !== base.itens.length)
    ctx.addIssue({ code: "custom", path: ["itens"], message: "ITEMS_DUPLICADOS" });
});
export type BaseAcaoComposta = z.infer<typeof BaseAcaoComposta>;

const SelecoesItens = z.array(InteiroSeguroPositivo).min(1).superRefine((itens, ctx) => {
  if (new Set(itens).size !== itens.length)
    ctx.addIssue({ code: "custom", message: "SELECAO_DUPLICADA" });
});

export const PedidoAcaoComposta = z.discriminatedUnion("tipo", [
  z.object({ tipo: z.literal("MANTER_CICLO"), motivo: MotivoAcaoComposta }).strict(),
  z.object({ tipo: z.literal("REDUZIR_DOSE"), motivo: MotivoAcaoComposta,
    reducaoPct: InteiroSeguroPositivo.max(99), itensSelecionados: SelecoesItens }).strict(),
  z.object({ tipo: z.literal("ADIAR_CICLO"), motivo: MotivoAcaoComposta,
    dias: InteiroSeguroPositivo.max(365) }).strict(),
  z.object({ tipo: z.literal("TROCAR_PROTOCOLO"), motivo: MotivoAcaoComposta,
    novoProtocoloId: Id }).strict(),
]);
export type PedidoAcaoComposta = z.infer<typeof PedidoAcaoComposta>;

export const CampoDiffAcaoComposta = z.enum(["previstoEm", "protocoloId", "doseMg", "item"]);
export const MudancaAcaoComposta = z.object({
  campo: CampoDiffAcaoComposta,
  item: InteiroSeguroPositivo.nullable(),
  antes: z.union([z.string(), z.number().finite()]).nullable(),
  depois: z.union([z.string(), z.number().finite()]).nullable(),
}).strict();
export type MudancaAcaoComposta = z.infer<typeof MudancaAcaoComposta>;

export const ResultadoAcaoComposta = z.object({
  estado: z.enum(["PREPARADA", "PENDENTE"]),
  baseRevisao: z.string().nullable(),
  baseHash: z.string().regex(/^[a-f0-9]{64}$/).nullable(),
  tipo: TipoAcaoComposta.nullable(),
  motivo: z.string(),
  antes: SnapshotAcaoComposta.nullable(),
  depois: SnapshotAcaoComposta.nullable(),
  diff: z.array(MudancaAcaoComposta),
  pendencias: z.array(z.string().min(1)),
}).strict();
export type ResultadoAcaoComposta = z.infer<typeof ResultadoAcaoComposta>;
