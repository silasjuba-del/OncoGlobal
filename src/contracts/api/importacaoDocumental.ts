import { z } from "zod";
import { FactSourceType } from "../w10/extracao.js";

export const MAX_DOCUMENTAL_BYTES = 8 * 1024 * 1024;
export const MAX_PACOTE_DOCUMENTAL_BYTES = 13 * 1024 * 1024;
const Id = z.string().min(1).max(200);
const Hash = z.string().regex(/^[a-f0-9]{64}$/);
const Pdf = z.object({
  nome: z.string().min(1).max(240), mediaType: z.literal("application/pdf"),
  bytesBase64: z.string().min(1).max(Math.ceil(MAX_DOCUMENTAL_BYTES / 3) * 4), sha256: Hash,
}).strict();
export const ContextoDocumental = z.object({ patientId: Id, encounterId: Id, tumorLotId: Id.nullable() }).strict();
export type ContextoDocumental = z.infer<typeof ContextoDocumental>;

/** Conteúdo externo é evidência recebida. Não declara paciente, revisão ou autorização clínica. */
export const PacoteDocumental = z.object({
  schema: z.literal("oncoglobal.import.v1"), pacoteId: Id,
  origem: z.object({ aplicativo: z.literal("PDFForge"), versao: z.string().min(1).max(40) }).strict(),
  autor: z.string().min(1).max(160), criadoEm: z.string().datetime({ offset: true }), original: Pdf,
  paginasExtraidas: z.array(z.object({ pagina: z.number().int().min(1).max(10000), texto: z.string().max(200000) }).strict()).max(1000),
  anotacoes: z.array(z.object({ id: Id, pagina: z.number().int().min(1).max(10000), texto: z.string().min(1).max(20000),
    autorTipo: z.enum(["USUARIO", "IA"]), autor: z.string().min(1).max(160), criadoEm: z.string().datetime({ offset: true }),
  }).strict()).max(1000),
  derivado: Pdf.extend({ descricao: z.string().min(1).max(1000), originalSha256: Hash }).strict().optional(),
}).strict().superRefine((p, ctx) => {
  if (p.paginasExtraidas.reduce((n, x) => n + x.texto.length, 0) > 200000)
    ctx.addIssue({ code: "custom", message: "TEXTO_DOCUMENTAL_EXCESSIVO" });
  if (p.anotacoes.reduce((n, x) => n + x.texto.length, 0) > 200000)
    ctx.addIssue({ code: "custom", message: "ANOTACOES_DOCUMENTAIS_EXCESSIVAS" });
  if (new Set(p.paginasExtraidas.map(x => x.pagina)).size !== p.paginasExtraidas.length
    || new Set(p.anotacoes.map(x => x.id)).size !== p.anotacoes.length)
    ctx.addIssue({ code: "custom", message: "IDENTIFICADOR_DOCUMENTAL_DUPLICADO" });
  if (p.derivado && p.derivado.originalSha256 !== p.original.sha256)
    ctx.addIssue({ code: "custom", message: "DERIVADO_ORIGEM_DIVERGENTE" });
});
export type PacoteDocumental = z.infer<typeof PacoteDocumental>;
export const ImportarDocumental = z.object({ contexto: ContextoDocumental, tipoFonte: FactSourceType, pacote: PacoteDocumental }).strict();
export type ImportarDocumental = z.infer<typeof ImportarDocumental>;
export const AbrirDocumental = z.object({ contexto: ContextoDocumental, pacoteId: Id }).strict();

export const ResumoDocumental = z.object({
  pacoteId: Id, draftId: Id.nullable(), sourceId: Id, nome: z.string(), sha256: Hash, recebidoEm: z.string(),
  autorDeclarado: z.string(), importadoPor: Id, origem: z.literal("PDFForge"),
  estado: z.literal("RECEBIDO"), conversao: z.enum(["PRONTO", "PENDENTE"]),
  vinculoPaciente: z.enum(["PENDENTE", "REVISTO"]), requiresMedicalReview: z.literal(true),
  anotacoes: z.number().int().nonnegative(), possuiDerivado: z.boolean(),
}).strict();
export type ResumoDocumental = z.infer<typeof ResumoDocumental>;
export const ImportacaoDocumentalResposta = z.object({ codigo: z.enum(["DOCUMENTO_RECEBIDO", "REPLAY"]),
  contexto: ContextoDocumental, documento: ResumoDocumental, criaEventoClinico: z.literal(false), assinado: z.literal(false),
}).strict();
export const DocumentosDocumentaisResposta = z.object({ contexto: ContextoDocumental, documentos: z.array(ResumoDocumental) }).strict();
export const DocumentoDocumentalResposta = z.object({ contexto: ContextoDocumental, documento: ResumoDocumental,
  pacote: PacoteDocumental, textoLocal: z.array(z.object({ pagina: z.number().int().positive(), texto: z.string() }).strict()),
}).strict();
export type DocumentoDocumentalResposta = z.infer<typeof DocumentoDocumentalResposta>;
export interface ApiDocumental {
  importar(pedido: ImportarDocumental, signal?: AbortSignal): Promise<z.infer<typeof ImportacaoDocumentalResposta>>;
  listar(contexto: ContextoDocumental, signal?: AbortSignal): Promise<z.infer<typeof DocumentosDocumentaisResposta>>;
  abrir(pedido: z.infer<typeof AbrirDocumental>, signal?: AbortSignal): Promise<DocumentoDocumentalResposta>;
}
