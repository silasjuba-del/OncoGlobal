import { z } from "zod";
import { DataCivil, Id } from "../base.js";
import { Apac } from "../operacao.js";
import { EstadoApac } from "../estados.js";
import { ContextoAcaoComposta } from "./acoesCompostas.js";

const HashSha256 = z.string().regex(/^[a-f0-9]{64}$/);
const RevisaoInteira = z.number().int().nonnegative().refine(Number.isSafeInteger);
const VersaoInteira = z.number().int().positive().refine(Number.isSafeInteger);
const Competencia = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/);
const TextoAdministrativo = z.string().trim().max(4000).nullable();
const CampoTextual = z.string().trim().nullable();

/** Only fields the physician may edit for the local administrative draft. */
export const EdicaoApacRascunhoSchema = z.object({
  competencia: Competencia,
  campos: z.object({
    procedimentoPrincipal: CampoTextual,
    pacienteCns: CampoTextual,
    nomeMae: CampoTextual,
    nomeEstabelecimento: CampoTextual,
    cnesSolicitante: CampoTextual,
    solicitanteNome: CampoTextual,
    solicitanteCns: CampoTextual,
    justificativa: TextoAdministrativo,
    descricaoDiagnostico: TextoAdministrativo,
    quantidadePrincipal: z.number().int().positive().refine(Number.isSafeInteger).nullable(),
    pacienteNascimento: DataCivil.nullable(),
    pacienteSexo: z.enum(["M", "F"]).nullable(),
  }).strict(),
}).strict();
export type EdicaoApacRascunho = z.infer<typeof EdicaoApacRascunhoSchema>;

export const BaseApacRascunhoRespostaSchema = z.object({
  contexto: ContextoAcaoComposta,
  revisao: HashSha256,
  prescricao: z.object({
    documentId: Id,
    documentVersion: VersaoInteira,
    protocoloId: Id,
    dataPrevista: DataCivil,
  }).strict().nullable(),
  sugestao: EdicaoApacRascunhoSchema,
  camposClinicos: z.array(z.object({ chave: Id, rotulo: z.string().trim().min(1), valor: z.string().nullable() }).strict()),
  existentes: z.array(z.object({
    apacId: Id,
    versao: VersaoInteira,
    competencia: Competencia,
    estado: EstadoApac,
  }).strict()),
  pendencias: z.array(z.string().min(1)),
}).strict();
export type BaseApacRascunhoResposta = z.infer<typeof BaseApacRascunhoRespostaSchema>;

export const PrepararApacRascunhoPedidoSchema = z.object({
  contexto: ContextoAcaoComposta,
  expectedBaseHash: HashSha256,
  idempotencyKey: Id,
  edicao: EdicaoApacRascunhoSchema,
}).strict();
export type PrepararApacRascunhoPedido = z.infer<typeof PrepararApacRascunhoPedidoSchema>;

const ApacEmRascunhoSchema = Apac.safeExtend({
  estado: z.literal("RASCUNHO"),
  resultadoExterno: z.null(),
}).strict();

export const ApacRascunhoPreparadoSchema = z.object({
  contexto: ContextoAcaoComposta,
  draftId: Id,
  revision: RevisaoInteira,
  conteudoHash: HashSha256,
  baseHash: HashSha256,
  apac: ApacEmRascunhoSchema,
  texto: z.string(),
  pendencias: z.array(z.string().min(1)),
  avisos: z.array(z.string().min(1)),
  permiteExportar: z.literal(false),
}).strict().superRefine((resposta, ctx) => {
  if (resposta.apac.tumorLotId !== resposta.contexto.tumorLotId)
    ctx.addIssue({ code: "custom", path: ["apac", "tumorLotId"], message: "APAC_LOTE_DIVERGENTE" });
});
export type ApacRascunhoPreparado = z.infer<typeof ApacRascunhoPreparadoSchema>;

export const ConfirmarApacRascunhoPedidoSchema = z.object({
  contexto: ContextoAcaoComposta,
  draftId: Id,
  expectedRevision: RevisaoInteira,
  conteudoHash: HashSha256,
  idempotencyKey: Id,
}).strict();
export type ConfirmarApacRascunhoPedido = z.infer<typeof ConfirmarApacRascunhoPedidoSchema>;

export const ApacRascunhoConfirmadoSchema = z.object({
  codigo: z.enum(["GRAVADA", "REPLAY"]),
  apacId: Id,
  versao: VersaoInteira,
  eventId: Id,
  estado: z.literal("RASCUNHO"),
  permiteExportar: z.literal(false),
}).strict();
export type ApacRascunhoConfirmado = z.infer<typeof ApacRascunhoConfirmadoSchema>;
