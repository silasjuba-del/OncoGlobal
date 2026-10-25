import { z } from "zod";
import { DataCivil, Fonte, Id, Instante } from "../base.js";
import { ReferenciaFato } from "../f1/achadosSetor.js";

export const ContextoAtendimentoV6=z.object({patientId:Id,encounterId:Id,tumorLotId:Id.nullable()}).strict();
export const SaidaAtendimentoV6=z.enum(["RESUMO","EVOLUCAO","EXAMES","RETORNO","PRESCRICAO"]);
export const EntradaAtendimentoV6=z.object({hoje:z.string().trim().max(12000),decisao:z.string().trim().max(12000),
 saidas:z.array(SaidaAtendimentoV6).min(1).max(5).refine(v=>new Set(v).size===v.length)}).strict();
export type EntradaAtendimentoV6=z.infer<typeof EntradaAtendimentoV6>;
const Hash=z.string().regex(/^[a-f0-9]{64}$/);
export const PrepararAtendimentoV6=ContextoAtendimentoV6.extend({entrada:EntradaAtendimentoV6,idempotencyKey:Id,
 expectedBaseHash:Hash,expectedVersion:z.number().int().positive().nullable()}).strict();
export type PrepararAtendimentoV6=z.infer<typeof PrepararAtendimentoV6>;
export const BaseAtendimentoV6=z.object({revisao:Hash,pacienteNome:Id,dataReferencia:DataCivil.nullable(),recuperadoEm:Instante,
 anotacoesChat:z.array(z.object({texto:Id,autor:Id,em:Instante,mensagemId:Id,eventId:Id,mensagemEventId:Id,hashMensagem:Hash}).strict()).optional(),
 pendenciasAnotacoes:z.array(Id).optional(),
 citacoes:z.array(z.object({texto:Id,referencias:z.array(z.object({ref:ReferenciaFato,tempoClinico:z.string().nullable(),
  tempoRegistro:Instante,unidade:z.string().nullable(),fontes:z.array(Fonte)}).strict()).min(1)}).strict()),
 delta:z.object({encounterAnteriorId:Id.nullable(),novos:z.array(ReferenciaFato),substituidos:z.array(ReferenciaFato)}).strict(),
 integridade:z.array(Id)}).strict();
export type BaseAtendimentoV6=z.infer<typeof BaseAtendimentoV6>;
export const DocumentoAtendimentoV6=z.object({tipo:SaidaAtendimentoV6,titulo:Id,texto:Id,
 estado:z.enum(["PRONTO_PARA_REVISAO","PENDENTE","FLUXO_ESPECIFICO_NECESSARIO"]),pendencias:z.array(Id)}).strict();
export type DocumentoAtendimentoV6=z.infer<typeof DocumentoAtendimentoV6>;
export const RascunhoAtendimentoV6=z.object({id:Id,versao:z.number().int().positive(),revisaoBase:Hash,
 referenciasBase:z.object({retratoRevisao:Hash,anotacaoEventIds:z.array(Id)}).strict().optional(),
 entrada:EntradaAtendimentoV6,dataClinica:DataCivil.nullable(),autor:z.object({medicoId:Id,crm:Id}).strict(),salvoEm:Instante,
 documentos:z.array(DocumentoAtendimentoV6).min(1),conteudoHash:Hash}).strict();
export type RascunhoAtendimentoV6=z.infer<typeof RascunhoAtendimentoV6>;
export const AtendimentoV6Resposta=z.object({codigo:z.enum(["ATENDIMENTO_BASE","ATENDIMENTO_PREPARADO","ATENDIMENTO_REPLAY"]),
 formato:z.literal("ONCOLOGIA_V6"),contexto:ContextoAtendimentoV6,base:BaseAtendimentoV6,
 rascunho:RascunhoAtendimentoV6.nullable(),estadoRascunho:z.enum(["AUSENTE","ATUAL","DESATUALIZADO"]),
 criaEventoClinico:z.literal(false),assinado:z.literal(false)}).strict();
export type AtendimentoV6Resposta=z.infer<typeof AtendimentoV6Resposta>;
