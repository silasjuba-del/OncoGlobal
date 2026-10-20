import { z } from "zod";
import { DataCivil, Id } from "../base.js";
import { PrescriptionItem } from "../w10/prescricao.js";

/**
 * Item completo de uma ordem QT executável. O identificador é estável entre
 * versões da mesma ordem; `sequence` continua representando a sequência clínica.
 */
export const ItemPrescricaoExecutavel = z.object({
  itemId: Id,
  item: z.object({
    ...PrescriptionItem.shape,
    // Escolha médica explícita para esta ordem; não altera a política legada W10.
    adjustmentPercent: z.number().int().min(-99).max(-1).nullable(),
  }).strict().superRefine((item, ctx) => {
    // Preserve the cross-field rules from the legacy PrescriptionItem schema.
    if (item.adjustmentPercent !== null && !item.adjustmentReason)
      ctx.addIssue({ code: "custom", message: "ajuste de dose exige motivo" });
    if (item.source === "MANUAL" && item.classe === "QT" && !item.overrideMotivo)
      ctx.addIssue({ code: "custom", message: "antineoplásico fora do protocolo exige motivo" });
  }),
}).strict();
export type ItemPrescricaoExecutavel = z.infer<typeof ItemPrescricaoExecutavel>;

export const OrigemPropostaPrescricaoExecutavel = z.object({
  draftId: Id,
  revision: z.number().int().nonnegative().refine(Number.isSafeInteger),
  hash: z.string().regex(/^[a-f0-9]{64}$/),
}).strict();
export type OrigemPropostaPrescricaoExecutavel = z.infer<typeof OrigemPropostaPrescricaoExecutavel>;

/**
 * Conteúdo clínico exibível e hashável. Assinatura, ator e estado do documento
 * pertencem exclusivamente ao evento envelope criado pelo servidor.
 */
export const ConteudoPrescricaoExecutavel = z.object({
  schema: z.literal("PrescricaoExecutavel@1"),
  contexto: z.object({
    patientId: Id,
    encounterId: Id,
    tumorLotId: Id.nullable(),
    episodioId: Id,
    cicloId: Id,
  }).strict(),
  documentId: Id,
  documentVersion: z.number().int().positive().refine(Number.isSafeInteger),
  pacienteNome: z.string().trim().min(1).optional(),
  linha: z.number().int().positive().optional(),
  numeroCiclo: z.number().int().positive().optional(),
  protocoloId: Id,
  dataPrevista: DataCivil,
  motivo: z.string().trim().min(1).max(2000),
  itens: z.array(ItemPrescricaoExecutavel).min(1),
  origemProposta: OrigemPropostaPrescricaoExecutavel.nullable(),
}).strict().superRefine((conteudo, ctx) => {
  const itemIds = new Set<string>();
  const sequencias = new Set<number>();
  conteudo.itens.forEach((item, index) => {
    if (itemIds.has(item.itemId))
      ctx.addIssue({ code: "custom", path: ["itens", index, "itemId"], message: "ITEM_ID_DUPLICADO" });
    if (sequencias.has(item.item.sequence))
      ctx.addIssue({ code: "custom", path: ["itens", index, "item", "sequence"], message: "SEQUENCIA_DUPLICADA" });
    itemIds.add(item.itemId);
    sequencias.add(item.item.sequence);
  });
});
export type ConteudoPrescricaoExecutavel = z.infer<typeof ConteudoPrescricaoExecutavel>;
