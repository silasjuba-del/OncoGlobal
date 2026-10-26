import { Instante } from "../base.js";
import { z } from "zod";

const Id = z.string().trim().min(1).max(240);
const Hash = z.string().regex(/^[a-f0-9]{64}$/);
export const ContextoConversa = z.object({ patientId: Id, encounterId: Id, tumorLotId: Id.nullable() }).strict();
export type ContextoConversa = z.infer<typeof ContextoConversa>;
export const PreferenciasConversa = z.object({ formato: z.enum(["TOPICOS", "PROSA"]), extensao: z.enum(["BREVE", "DETALHADA"]), incluirBiblioteca: z.boolean() }).strict();
export type PreferenciasConversa = z.infer<typeof PreferenciasConversa>;
export const ModeloConversa = z.object({ endpoint: z.string().max(300), modelo: z.string().trim().min(1).max(120) }).strict();
export type ModeloConversa = z.infer<typeof ModeloConversa>;
export const ConfiguracaoConversa = z.object({ revision: z.number().int().nonnegative(), preferencias: PreferenciasConversa, modelo: ModeloConversa.nullable() }).strict();
export const FonteConversa = z.object({ id: Id, tipo: z.enum(["PRONTUARIO", "DOCUMENTO", "BIBLIOTECA"]), titulo: z.string().max(400),
  texto: z.string().max(12000), hash: Hash, revisao: z.string().max(200), draftId: Id.nullable(), eventId: Id.nullable(),
  sourceId: Id.nullable(), pagina: z.number().int().positive().nullable(), data: z.string().nullable(), url: z.string().nullable() }).strict();
export type FonteConversa = z.infer<typeof FonteConversa>;
export const CitacaoConversa = z.object({ fonteId: Id, trecho: z.string().min(1).max(12000) }).strict();
export const TurnoConversa = z.object({ id: Id, operationId: Id, pergunta: z.string().min(1).max(6000),
  modo: z.enum(["BRIEFING", "MODELO_LOCAL"]), modelo: z.string().nullable(), estado: z.enum(["EM_CURSO", "CONCLUIDA", "CANCELADA", "FALHOU"]),
  texto: z.string().max(60000), citacoes: z.array(CitacaoConversa).max(100), fontes: z.array(FonteConversa).max(100),
  criadoEm: Instante, concluidoEm: Instante.nullable(), atorId: Id,
  codigo: z.string().nullable(), validadeFontes: z.enum(["ATUAIS", "ALTERADAS"]), revisaoObrigatoria: z.literal(true), assinado: z.literal(false), criaEventoClinico: z.literal(false) }).strict();
export type TurnoConversa = z.infer<typeof TurnoConversa>;
export const PedidoConversa = ContextoConversa.extend({ operationId: Id, pergunta: z.string().trim().min(1).max(6000),
  fontesIds: z.array(Id).max(40), modo: z.enum(["BRIEFING", "MODELO_LOCAL"]) }).strict();
export type PedidoConversa = z.infer<typeof PedidoConversa>;
export const CancelarConversa = ContextoConversa.extend({ turnoId: Id }).strict();
export const SalvarConfiguracaoConversa = ContextoConversa.extend({ expectedRevision: z.number().int().nonnegative(), preferencias: PreferenciasConversa, modelo: ModeloConversa.nullable() }).strict();
export const HistoricoConversa = z.object({ codigo: z.literal("CONVERSA_HISTORICO"), contexto: ContextoConversa,
  configuracao: ConfiguracaoConversa, fontes: z.array(FonteConversa), turnos: z.array(TurnoConversa), limiteHistorico: z.literal(100) }).strict();
export type HistoricoConversa = z.infer<typeof HistoricoConversa>;
export const RespostaConversa = z.object({ codigo: z.enum(["CONVERSA_CONCLUIDA", "CONVERSA_REPLAY", "CONVERSA_EM_CURSO"]), contexto: ContextoConversa, turno: TurnoConversa }).strict();
export type RespostaConversa = z.infer<typeof RespostaConversa>;
export const ConfiguracaoConversaResposta = z.object({ codigo: z.literal("CONVERSA_CONFIGURADA"), configuracao: ConfiguracaoConversa }).strict();
export const EventoConversa = z.discriminatedUnion("tipo", [
  z.object({ tipo: z.literal("inicio"), turnoId: Id }).strict(),
  z.object({ tipo: z.literal("delta"), texto: z.string().max(60000), parcialNaoValidado: z.literal(true) }).strict(),
  z.object({ tipo: z.literal("final"), resposta: RespostaConversa }).strict(),
  z.object({ tipo: z.literal("erro"), codigo: Id }).strict(),
]);
export type EventoConversa = z.infer<typeof EventoConversa>;
export const SaidasConversaOncoassist = {
  "/consulta/assistente/historico": HistoricoConversa,
  "/consulta/assistente/configurar": ConfiguracaoConversaResposta,
  "/consulta/assistente/responder": RespostaConversa,
  "/consulta/assistente/responder-stream": RespostaConversa,
  "/consulta/assistente/cancelar": RespostaConversa,
} as const;
export interface ApiConversaOncoassist {
  historico(contexto: ContextoConversa, signal?: AbortSignal): Promise<HistoricoConversa>;
  responder(pedido: PedidoConversa, signal?: AbortSignal, aoEvento?: (evento: EventoConversa) => void): Promise<RespostaConversa>;
  configurar(pedido: z.infer<typeof SalvarConfiguracaoConversa>, signal?: AbortSignal): Promise<z.infer<typeof ConfiguracaoConversaResposta>>;
  cancelar(pedido: z.infer<typeof CancelarConversa>, signal?: AbortSignal): Promise<RespostaConversa>;
}
