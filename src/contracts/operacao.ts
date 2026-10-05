// C-10 APAC · C-11 Evento/Operação · C-12 Alerta · C-16 Comando · C-17 ActionIntent · C-19/C-20 · K-04/K-05
import { z } from "zod";
import { DataCivil, Fonte, Id, Instante } from "./base.js";
import { ClasseRisco, EstadoApac, NaturezaAlerta, Revisao } from "./estados.js";

// ── C-10 APAC (K-03: completude validada só na EMISSÃO, fora do schema) ──────
export const Apac = z.object({
  apacId: Id,
  tumorLotId: Id,
  prescricaoAssinadaRef: z.object({ documentId: Id, documentVersion: z.number().int().min(1) }).strict(),
  dataGeracaoApp: DataCivil, // a data única (Q34): D85 aviso, D90 VENCIDA
  competencia: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),
  campos: z.record(z.string(), z.unknown()),
  estado: EstadoApac,
  resultadoExterno: z.object({
    valor: z.enum(["AUTORIZADA", "NEGADA"]),
    comprovanteRef: z.string().min(1),
    motivo: z.string().nullable(),
    recebidoEm: Instante,
  }).strict().nullable(),
  versao: z.number().int().min(1),
  substituiApacId: Id.nullable(),
}).strict().superRefine((a, ctx) => {
  // AUTORIZADA/NEGADA só existem com evidência externa (não nasce no app)
  if ((a.estado === "AUTORIZADA" || a.estado === "NEGADA") && a.resultadoExterno?.valor !== a.estado)
    ctx.addIssue({ code: "custom", message: `${a.estado} exige resultadoExterno com comprovante` });
});
export type Apac = z.infer<typeof Apac>;

// ── C-11 Operação atômica + evento do ledger (K-04) ──────────────────────────
export const Operation = z.object({
  operationId: Id, // UNIQUE
  payloadHash: z.string().min(1), // mesma chave + hash diferente ⇒ NEGADA + AuditEvent
  resultRef: z.string().nullable(),
  criadoEm: Instante,
}).strict();

export const ClinicalEvent = z.object({
  eventId: Id,
  operationId: Id,
  eventIndex: z.number().int().nonnegative(), // UNIQUE(operationId, eventIndex)
  patientId: Id,
  tumorLotId: Id.nullable(),
  encounterId: Id,
  tipo: z.string().min(1),
  payload: z.unknown(),
  fontes: z.array(Fonte),
  revisao: Revisao,
  criadoEm: Instante,
  criadoPor: z.object({ tipo: z.enum(["SESSAO", "AGENTE", "SISTEMA"]), id: Id }).strict(),
  supersedesEventId: Id.nullable(),
}).strict();
export type ClinicalEvent = z.infer<typeof ClinicalEvent>;

// ── K-05 Snapshot confirmado e referência de assinatura ──────────────────────
export const ConfirmedSnapshotRef = z.object({
  kind: z.literal("CONFIRMED"),
  snapshotId: Id,
  patientId: Id,
  tumorLotId: Id.nullable(),
  encounterId: Id,
  eventIds: z.array(Id).min(1),
  projectionVersion: z.string().min(1),
  rulesetRefs: z.array(z.object({ id: z.string(), version: z.string(), hash: z.string() }).strict()),
  contentHash: z.string().min(1),
}).strict();
export type ConfirmedSnapshotRef = z.infer<typeof ConfirmedSnapshotRef>;

export const SignatureReference = z.object({
  documentId: Id,
  documentVersion: z.number().int().min(1),
  documentHash: z.string().min(1),
  reviewDecisionId: Id,
  serverActorId: Id, // vem da sessão do servidor; humano com CRM (G-03)
}).strict();

// ── C-12 Alerta: vive no chat/apresentação; nunca no texto do prontuário (INV-09/K-12) ──
export const Alerta = z.object({
  alertaId: Id,
  alvo: z.union([
    z.object({ patientId: Id }).strict(),
    z.object({ contatoNaoVinculadoId: Id }).strict(), // K-08
  ]),
  natureza: NaturezaAlerta,
  classeRisco: ClasseRisco.nullable(),
  texto: z.string().min(1),
  origemRegra: z.string().min(1),
  evidencias: z.array(Fonte),
  presentationOverride: z.boolean(), // E1
  authorityOverride: z.literal(false),
  reconhecidoEm: Instante.nullable(),
  destino: z.literal("CHAT"),
}).strict();
export type Alerta = z.infer<typeof Alerta>;

// ── C-16 Comando do médico (payload estrito: rejeita medicoId/assinado/liberado — INV-04) ──
export const ConfirmarBloco = z.object({
  patientId: Id,
  tumorLotId: Id.nullable(),
  encounterId: Id,
  bloco: z.enum(["EVOLUCAO", "PRESCRICAO", "EXAMES", "RETORNO", "APAC", "TUDO"]),
  registros: z.array(z.object({ id: Id, expectedRevision: z.number().int().nonnegative() }).strict()).min(1),
  documentosExibidos: z.array(z.object({ documentId: Id, documentVersion: z.number().int().min(1) }).strict()), // A1/G-25
  reconhecerAlertas: z.array(Id), // K-14: vermelhos exibidos ⇒ "ciente", sem autorização implícita
  idempotencyKey: z.string().min(8),
}).strict();
export type ConfirmarBloco = z.infer<typeof ConfirmarBloco>;

// ── C-17 ActionIntent (AGE; ROE-0: falta verbo/objeto/escopo ⇒ NO_ACTION) ────
export const ActionIntent = z.object({
  verbo: z.enum(["IMPRIMIR", "ENVIAR_WHATSAPP", "ENVIAR_EMAIL", "AGENDAR", "EXPORTAR_APAC", "BACKUP_LOCAL"]),
  objeto: z.object({ tipo: z.string().min(1), id: Id, versao: z.number().int().min(1) }).strict(),
  escopo: z.object({ patientId: Id.nullable(), encounterId: Id.nullable() }).strict(),
  destino: z.string().nullable(),
  idempotencyKey: z.string().min(8),
}).strict(); // a autorização vem do servidor, nunca deste payload

// ── C-19 Correção do médico · C-20 Auditoria ────────────────────────────────
export const CorrectionEvent = z.object({
  autorId: Id,
  alvo: z.object({ tipo: z.string(), id: Id }).strict(),
  antes: z.unknown(),
  depois: z.unknown(),
  alcance: z.enum(["FATO_PACIENTE", "PREFERENCIA", "PROPOSTA_REGRA"]),
  em: Instante,
}).strict();

export const AuditEvent = z.object({
  ator: z.object({ tipo: z.enum(["SESSAO", "AGENTE", "SISTEMA", "EXECUTOR"]), id: Id }).strict(),
  acaoPedida: z.string().min(1),
  decisao: z.enum(["PERMITIDA", "NEGADA"]),
  motivoCodigo: z.string().min(1),
  politicaVersao: z.string().min(1),
  em: Instante,
}).strict(); // lista positiva de campos: sem texto clínico, sem payload (K-22)
