import { z } from "zod";
import { Id, Instante } from "./base.js";

export const ContextoSkill = z.object({ patientId: Id, encounterId: Id, tumorLotId: Id.nullable() }).strict();
export const TipoDocumentoSkill = z.enum(["RESUMO_CASO", "EVOLUCAO", "RECEITA", "PEDIDO_EXAMES", "ENCAMINHAMENTO", "ORIENTACOES"]);
const Texto = z.string().trim().min(1).max(2000);
export const ConfiguracaoPrimeiraConsulta = z.object({
  documentos: z.array(TipoDocumentoSkill).min(1).max(6).default(["RESUMO_CASO", "EVOLUCAO", "RECEITA", "PEDIDO_EXAMES"])
    .refine(v => new Set(v).size === v.length && v.includes("RESUMO_CASO"), "Resumo obrigatório e documentos sem duplicação"),
  estiloResumo: z.enum(["POR_DOMINIO", "CRONOLOGICO"]).default("POR_DOMINIO"),
  priorizarPendencias: z.boolean().default(true),
  receitas: z.array(z.object({ medicamento: Texto, dose: Texto.nullable(), via: Texto.nullable(),
    frequencia: Texto.nullable(), duracao: Texto.nullable(), quantidade: Texto.nullable() }).strict()).max(30).default([]),
  exames: z.array(z.object({ exame: Texto, indicacao: Texto.nullable() }).strict()).max(30).default([]),
}).strict().superRefine((c, ctx) => {
  if (c.receitas.length && !c.documentos.includes("RECEITA")) ctx.addIssue({ code: "custom", message: "Receitas fora dos documentos selecionados" });
  if (c.exames.length && !c.documentos.includes("PEDIDO_EXAMES")) ctx.addIssue({ code: "custom", message: "Exames fora dos documentos selecionados" });
});
export const PedidoSkillClinica = z.discriminatedUnion("acao", [
  z.object({ acao: z.literal("CATALOGO") }).strict(),
  z.object({ acao: z.literal("EXECUTAR"), contexto: ContextoSkill, skillId: z.literal("primeira-consulta"),
    versao: z.literal("1.0.0"), operationId: z.string().trim().min(8).max(160),
    fontes: z.array(z.object({ draftId: Id, expectedRevision: z.number().int().nonnegative() }).strict()).min(1).max(20)
      .refine(v => new Set(v.map(f => f.draftId)).size === v.length, "Fonte duplicada"),
    configuracao: ConfiguracaoPrimeiraConsulta,
  }).strict(),
  z.object({ acao: z.literal("LER"), contexto: ContextoSkill, execucaoId: Id }).strict(),
  z.object({ acao: z.literal("HISTORICO"), contexto: ContextoSkill }).strict(),
]);
export const ReferenciaFonteSkill = z.object({ draftId: Id, revision: z.number().int().nonnegative(), sourceId: Id,
  segmentId: Id, hash: z.string().regex(/^[a-f0-9]{64}$/), reviewDecisionId: Id }).strict();
export const EvidenciaSkill = z.object({ factId: Id, sourceId: Id, segmentId: Id, dominio: Id,
  data: z.string().nullable(), valor: z.string(), trecho: z.string().max(4000), trechoAbreviado: z.boolean(),
  exigeConfirmacao: z.boolean(), qualificadores: z.string(),
}).strict();
export const DocumentoSkill = z.object({
  kind: z.literal("SKILL_DOCUMENTO_RASCUNHO"), documentId: Id, execucaoId: Id, contexto: ContextoSkill,
  tipo: TipoDocumentoSkill, titulo: Id, texto: z.string().min(1), estado: z.literal("RASCUNHO"),
  assinatura: z.null(), pendencias: z.array(z.string()), fontes: z.array(ReferenciaFonteSkill),
}).strict();
export const ExecucaoSkill = z.object({
  kind: z.literal("SKILL_EXECUCAO_RASCUNHO"), execucaoId: Id, contexto: ContextoSkill,
  skillId: z.literal("primeira-consulta"), versao: z.literal("1.0.0"), mecanismo: z.literal("COMPOSICAO_LOCAL_DETERMINISTICA"),
  operationId: Id, inputHash: z.string().regex(/^[a-f0-9]{64}$/), cadastroHash: z.string().regex(/^[a-f0-9]{64}$/), criadoEm: Instante, medicoId: Id,
  configuracao: ConfiguracaoPrimeiraConsulta, fontes: z.array(ReferenciaFonteSkill), evidencias: z.array(EvidenciaSkill),
  documentos: z.array(z.object({ documentId: Id, hash: z.string().regex(/^[a-f0-9]{64}$/) }).strict()),
  pendencias: z.array(z.string()), estado: z.literal("RASCUNHOS_PREPARADOS"),
  criaEventoClinico: z.literal(false), assinaDocumentos: z.literal(false),
}).strict();
export const ResultadoSkillClinica = z.discriminatedUnion("codigo", [
  z.object({ codigo: z.literal("SKILLS_DISPONIVEIS"), skills: z.array(z.object({ id: Id, versao: Id, titulo: Id,
    origem: z.literal("NATIVA_DO_APP"), documentos: z.array(TipoDocumentoSkill) }).strict()),
    pacotesExternos: z.literal("ADAPTADOR_DE_ADMISSAO_NAO_CONFIGURADO") }).strict(),
  z.object({ codigo: z.enum(["SKILL_PREPARADA", "SKILL_REPLAY", "SKILL_CARREGADA"]), execucao: ExecucaoSkill,
    documentos: z.array(DocumentoSkill), validade: z.enum(["ATUAL", "ENTRADA_ALTERADA"]), criaEventoClinico: z.literal(false) }).strict(),
  z.object({ codigo: z.literal("SKILLS_HISTORICO"), execucoes: z.array(z.object({ execucaoId: Id, skillId: Id,
    versao: Id, criadoEm: Instante, documentos: z.number().int().nonnegative() }).strict()), temMais: z.boolean() }).strict(),
]);
export type ExecucaoSkill = z.infer<typeof ExecucaoSkill>;
export type DocumentoSkill = z.infer<typeof DocumentoSkill>;
export type ConfiguracaoPrimeiraConsulta = z.infer<typeof ConfiguracaoPrimeiraConsulta>;
export type PedidoSkillClinica = z.infer<typeof PedidoSkillClinica>;
export type ResultadoSkillClinica = z.infer<typeof ResultadoSkillClinica>;
