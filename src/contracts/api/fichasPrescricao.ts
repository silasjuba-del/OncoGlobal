import { z } from "zod";
import { ContextoAcaoComposta } from "./acoesCompostas.js";
import { ItemPrescricaoExecutavel, OrigemPropostaPrescricaoExecutavel } from "./prescricaoExecutavel.js";
import { ProtocolTemplate } from "../w10/prescricao.js";
import { Instante, Id } from "../base.js";

const Sha256 = z.string().regex(/^[a-f0-9]{64}$/);
const RevisaoSegura = z.number().int().nonnegative().refine(Number.isSafeInteger);
const TextoObrigatorio = z.string().trim().min(1);

/** Contratos da ficha são fronteiras HTTP; rejeita também undefined explícito. */
function rejectOwnUndefined<T extends z.ZodTypeAny>(schema: T): T {
  return schema.superRefine((value, context) => {
    const visit = (current: unknown, path: (string | number)[]): void => {
      if (Array.isArray(current)) {
        current.forEach((item, index) => visit(item, [...path, index]));
        return;
      }
      if (!current || typeof current !== "object") return;
      for (const [key, nested] of Object.entries(current)) {
        if (nested === undefined) {
          context.addIssue({ code: "custom", path: [...path, key], message: "UNDEFINED_PROPERTY_NOT_ALLOWED" });
        } else visit(nested, [...path, key]);
      }
    };
    visit(value, []);
  }) as T;
}

export const RevisaoFichaProtocoloSchema = rejectOwnUndefined(z.object({
  templateId: Id,
  versao: Id,
  revision: z.number().int().positive().refine(Number.isSafeInteger),
  decisao: z.enum(["CONFERIR", "INATIVAR"]),
  medicoId: Id,
  em: Instante,
  motivo: z.string().trim().min(1).max(2000),
  contentHash: Sha256,
  reviewHash: Sha256,
}).strict());
export type RevisaoFichaProtocolo = z.infer<typeof RevisaoFichaProtocoloSchema>;

export const FichaProtocoloCatalogoSchema = rejectOwnUndefined(z.object({
  template: ProtocolTemplate,
  contentHash: Sha256,
  revision: RevisaoSegura,
  revisao: RevisaoFichaProtocoloSchema.nullable(),
  estado: z.enum(["PENDENTE", "CONFERIDA", "INATIVA"]),
  bloqueios: z.array(TextoObrigatorio),
}).strict().superRefine((ficha, context) => {
  const issue = (path: (string | number)[], message: string) =>
    context.addIssue({ code: "custom", path, message });
  if (ficha.revisao && (ficha.revisao.templateId !== ficha.template.templateId
    || ficha.revisao.versao !== ficha.template.versao
    || ficha.revisao.revision !== ficha.revision
    || ficha.revisao.contentHash !== ficha.contentHash))
    issue(["revisao"], "REVIEW_TEMPLATE_IDENTITY_REVISION_OR_CONTENT_MISMATCH");

  if (ficha.estado === "PENDENTE" && ficha.revisao !== null)
    issue(["estado"], "PENDING_STATE_REQUIRES_NO_LOCAL_REVIEW");
  if (ficha.estado === "CONFERIDA" && ficha.revisao?.decisao !== "CONFERIR")
    issue(["estado"], "REVIEWED_STATE_REQUIRES_LOCAL_CONFIRMATION");
  if (ficha.estado === "INATIVA" && ficha.revisao?.decisao !== "INATIVAR")
    issue(["estado"], "INACTIVE_STATE_REQUIRES_LOCAL_DEACTIVATION");
}));
export type FichaProtocoloCatalogo = z.infer<typeof FichaProtocoloCatalogoSchema>;

export const CatalogoFichasRespostaSchema = rejectOwnUndefined(z.object({
  fichas: z.array(FichaProtocoloCatalogoSchema),
}).strict().superRefine((catalogo, context) => {
  const identidades = catalogo.fichas.map(f => `${f.template.templateId}\0${f.template.versao}`);
  if (new Set(identidades).size !== identidades.length)
    context.addIssue({ code: "custom", path: ["fichas"], message: "DUPLICATE_TEMPLATE_VERSION" });
}));
export type CatalogoFichasResposta = z.infer<typeof CatalogoFichasRespostaSchema>;

export const RevisarFichaPedidoSchema = rejectOwnUndefined(z.object({
  templateId: Id,
  versao: Id,
  expectedContentHash: Sha256,
  expectedRevision: RevisaoSegura,
  decisao: z.enum(["CONFERIR", "INATIVAR"]),
  motivo: z.string().trim().min(1).max(2000),
  idempotencyKey: Id,
}).strict());
export type RevisarFichaPedido = z.infer<typeof RevisarFichaPedidoSchema>;

export const InstanciarFichaPedidoSchema = rejectOwnUndefined(z.object({
  contexto: ContextoAcaoComposta,
  templateId: Id,
  versao: Id,
  expectedContentHash: Sha256,
  expectedRevision: RevisaoSegura,
  idempotencyKey: Id,
}).strict());
export type InstanciarFichaPedido = z.infer<typeof InstanciarFichaPedidoSchema>;

const DadosCorporaisSchema = z.object({
  pesoKg: z.number().finite().nullable(),
  alturaCm: z.number().finite().nullable(),
  bsaM2: z.number().finite().nullable(),
  clcr: z.number().finite().nullable(),
  medidoEm: TextoObrigatorio.nullable(),
}).strict();

export const InstanciacaoFichaRespostaSchema = rejectOwnUndefined(z.object({
  contexto: ContextoAcaoComposta,
  origemProposta: OrigemPropostaPrescricaoExecutavel,
  template: ProtocolTemplate,
  contentHash: Sha256,
  revisionFicha: z.number().int().positive().refine(Number.isSafeInteger),
  revisaoFatos: Sha256,
  itens: z.array(ItemPrescricaoExecutavel).min(1),
  pendencias: z.array(TextoObrigatorio),
  avisos: z.array(TextoObrigatorio),
  dadosCorporais: DadosCorporaisSchema,
}).strict().superRefine((resposta, context) => {
  const itemIds = new Set<string>();
  const sequences = new Set<number>();
  resposta.itens.forEach((item, index) => {
    if (itemIds.has(item.itemId))
      context.addIssue({ code: "custom", path: ["itens", index, "itemId"], message: "DUPLICATE_ITEM_ID" });
    if (sequences.has(item.item.sequence))
      context.addIssue({ code: "custom", path: ["itens", index, "item", "sequence"], message: "DUPLICATE_ITEM_SEQUENCE" });
    itemIds.add(item.itemId);
    sequences.add(item.item.sequence);
  });
}));
export type InstanciacaoFichaResposta = z.infer<typeof InstanciacaoFichaRespostaSchema>;
