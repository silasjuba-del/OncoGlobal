// C-14 Conversa · C-15 VoiceIntent · C-18 AgentSpec · C-21 SanitizationReport · C-22 VisualSuggestion · Ruleset (G-17)
import { z } from "zod";
import { Id, Instante } from "./base.js";
import { CapabilityStatus, EstadoConversa, EvidenceLayer, Semaforo } from "./estados.js";

// ── C-14 Conversa com o paciente (Q41–44; dono único: AG-14 — K-21) ─────────
export const MsgPaciente = z.object({
  msgId: Id,
  idFornecedor: z.string().min(1), // dedupe (K-29)
  direcao: z.enum(["IN", "OUT"]),
  textoRawRef: z.string().min(1), // local
  midia: z.array(z.object({ ref: z.string(), tipo: z.string(), processada: z.boolean() }).strict()),
  enviadoPor: z.enum(["PACIENTE", "CONTATO", "MEDICO", "ONCOASSIST_ROTEIRO", "ONCOASSIST_FIXA"]),
  em: Instante,
}).strict();

export const Conversation = z.object({
  convId: Id,
  contatoId: Id,
  patientId: Id.nullable(), // null = fila de vínculo
  estado: EstadoConversa,
  cor: Semaforo,
  mensagens: z.array(MsgPaciente),
  consentimentoEm: Instante.nullable(), // A10
}).strict();

// ── C-15 Comando de voz (Deepgram Nova-3, comando curto — A6/A9/G-23) ───────
export const VoiceIntent = z.object({
  intent: z.enum([
    "CREATE_IMAGING_REQUEST_DRAFT", "CREATE_LAB_REQUEST_DRAFT", "CREATE_PRESCRIPTION_DRAFT",
    "SET_RETURN", "NOTE", "UNKNOWN",
  ]),
  params: z.record(z.string(), z.unknown()),
  falante: z.enum(["MEDICO", "PACIENTE", "FAMILIAR", "DESCONHECIDO"]), // K-09
  substituiDraftId: Id.nullable(), // "não, melhor RM"
  transcricaoRef: z.string().min(1),
  confianca: z.number().min(0).max(1),
}).strict(); // o paciente vem da sessão, nunca do nome falado

// ── C-18 AgentSpec (agente "burro") ─────────────────────────────────────────
export const AgentSpec = z.object({
  id: z.string().regex(/^AG-\d{2}$/),
  version: z.string().min(1),
  ownerOf: z.array(z.string().min(1)).min(1), // INV-15
  trigger: z.string().min(1), // chave da tabela do Maestro
  extractor: z.object({
    microprompt: z.string().regex(/^[A-Z_]+@\d+\.\d+\.\d+$/), // corpus/prompts/<ID>@semver
    tokenBudget: z.number().int().positive(),
    timeoutMs: z.number().int().positive(),
    phiAllowed: z.literal(false), // INV-12
  }).strict().nullable(),
  rulesetRef: z.string().nullable(),
  capabilityStatus: CapabilityStatus,
}).strict();
export type AgentSpec = z.infer<typeof AgentSpec>;

// ── Ruleset/corpus: sem fonte não carrega (G-17, K-27) ──────────────────────
export const RulesetHeader = z.object({
  id: z.string().min(1),
  versao: z.string().regex(/^\d+\.\d+\.\d+$/),
  vigenteDesde: z.iso.date(),
  fonte: z.object({
    tipo: z.enum(["DECISAO_MEDICA", "DIRETRIZ", "NORMA", "LITERATURA"]),
    referencia: z.string().min(1),
    trecho: z.string().nullable(), // obrigatório para DIRETRIZ/NORMA/LITERATURA
    edicao: z.string().nullable(),
  }).strict(),
  curador: z.string().min(1),
  aprovadoEm: z.iso.date(),
}).strict().superRefine((h, ctx) => {
  if (h.fonte.tipo !== "DECISAO_MEDICA" && !h.fonte.trecho)
    ctx.addIssue({ code: "custom", message: "fonte externa exige trecho que sustente a regra (K-27)" });
});

// ── C-21 SanitizationReport (R-31; G-27) ─────────────────────────────────────
export const SanitizationReport = z.object({
  artefatoId: Id,
  tipo: z.enum(["TEXTO", "PDF", "IMAGEM", "DICOM"]),
  removidos: z.array(z.string()),
  mantidos: z.array(z.string()),
  transformacoes: z.array(z.string()),
  riscoResidual: z.enum(["BAIXO", "ALTO"]),
  versaoSanitizador: z.string().min(1),
  em: Instante,
}).strict();

// ── C-22 VisualSuggestion (AG-20; desligada até validação + Anvisa — R-32/G-26) ──
export const VisualSuggestion = z.object({
  imagemRef: z.string().min(1),
  serie: z.string().nullable(),
  corte: z.number().int().nullable(),
  regiao: z.object({ x: z.number(), y: z.number(), w: z.number(), h: z.number() }).strict(),
  descricao: z.string().min(1),
  interpretacaoSugerida: z.string().min(1),
  limitacoes: z.array(z.string()).min(1),
  cobertura: z.string().min(1),
  modelo: z.string().min(1),
  versao: z.string().min(1),
  evidenceLayer: EvidenceLayer.exclude(["DOCUMENT_TEXT"]),
  rotulo: z.literal("Sugestão da IA — sem laudo"),
  decisaoMedica: z.enum(["REGISTRADA", "CORRIGIDA", "DESCARTADA"]).nullable(),
}).strict();
