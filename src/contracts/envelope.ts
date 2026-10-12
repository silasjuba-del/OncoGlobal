import { z } from "zod";
import { DataCivil, Fonte, Id, Instante } from "./base.js";
import { Paciente, TumorLot, Triagem, Contato, TreatmentEpisode, Ciclo, TreatmentAdministration } from "./clinico.js";
import { Apac, SignatureReference } from "./operacao.js";
import { Conversation } from "./agentes.js";
import { Tarefa } from "./f1/tarefa.js";

const Campo = z.object({ campo: Id, valor: z.unknown() }).passthrough()
  .refine(d => Object.hasOwn(d, "valor"), "valor ausente");
const Documento = z.object({ data: z.object({ documentId: Id, documentVersion: z.number().int().positive(),
  texto: z.string() }).passthrough(), signature: SignatureReference.passthrough() }).passthrough();
const Revisao = z.object({}).passthrough().refine(d =>
  typeof d.campo === "string" || typeof d.exceptionId === "string" || typeof d.kind === "string", "decisão sem identidade");
const AgendaEntry = z.object({ patientId: Id, encounterId: Id, horario: z.string().regex(/^\d{2}:\d{2}$/), data: DataCivil }).strict();
const LabResult = z.object({ campo: Id, valor: z.number().finite(), unidade: Id, data: z.union([DataCivil, Instante]), sourceId: Id }).passthrough();
const schemas: Readonly<Record<string, z.ZodType>> = Object.freeze({
  Paciente, TumorLot, Triagem, Contato, TreatmentEpisode, Ciclo, TreatmentAdministration, APAC: Apac,
  Conversation, AgendaEntry, FATO: Campo, DOCUMENTO: Documento, ReviewDecision: Revisao, LabResult,
  Tarefa,
  ConsultaConfirmada: z.object({ dataClinica:DataCivil,documentoIds:z.array(z.object({documentId:Id,documentVersion:z.number().int().positive()}).strict()).min(1) }).strict(),
  Weight: z.object({ kg: z.number().finite().positive(), origem: z.enum(["MEDIDO", "INFORMADO_PACIENTE", "ANTERIOR"]), data: DataCivil, sourceId: Id }).passthrough(),
  ApacAviso: z.object({ apacId: Id, competencia: z.string().regex(/^\d{4}-\d{2}$/) }).passthrough(),
  Biopsy: z.object({ dataClinica: DataCivil }).passthrough(),
  Staging: z.object({ dataClinica: DataCivil, tipo: z.enum(["STAGING", "RESTAGING"]) }).passthrough(),
  TreatmentCycle: z.object({ dataClinica: DataCivil, linha: z.number().int().positive(), ciclo: z.number().int().positive() }).passthrough(),
  ImagingReport: z.object({}).passthrough().refine(d => Object.keys(d).length > 0),
  ExameLaudo: z.object({}).passthrough().refine(d => Object.keys(d).length > 0),
  RecistSerie: z.object({patientId:Id,tumorLotId:Id.nullable(),episodioId:Id,baselineEventId:Id,
    alvos:z.array(z.record(z.string(),z.unknown())),pontos:z.array(z.record(z.string(),z.unknown()))}).strict(),
  Surgery: z.object({dataClinica:DataCivil}).passthrough(),
  FatoCirurgia: z.object({dataClinica:DataCivil}).passthrough(),
  Radiotherapy: z.object({}).passthrough().refine(d=>Object.keys(d).length>0),
  FatoRadioterapia: z.object({}).passthrough().refine(d=>Object.keys(d).length>0),
  FatoRT: z.object({}).passthrough().refine(d=>Object.keys(d).length>0),
  CanalMessage: z.object({ mensagemId: Id, contatoId: Id, patientId: Id.nullable(), texto: z.string(), em: Instante, redFlag: z.boolean() }).strict(),
  ChatMessage: z.object({ mensagemId: Id, patientId: Id, encounterId: Id,
    setor: z.enum(["TRIAGEM", "FARMACIA", "SECRETARIA", "MEDICO"]), autor: Id, texto: z.string() }).strict(),
});

export type DiagnosticoPayload = { ok: true; schema: string } | { ok: false; schema: string;
  motivo: "TIPO_DESCONHECIDO" | "VERSAO_DESCONHECIDA" | "PAYLOAD_FORA_DO_CONTRATO" };

/** Versionamento explícito; tipos anteriores à F1 possuem somente a versão legada 1. */
export function validarPayloadEvento(tipo: string, payload: unknown): DiagnosticoPayload {
  const partes = /^([^@]+)(?:@(\d+))?$/.exec(tipo);
  const nome = partes?.[1] ?? tipo, versao = partes?.[2] ?? "1", schema = `${nome}@${versao}`;
  if (!Object.hasOwn(schemas, nome)) return { ok: false, schema, motivo: "TIPO_DESCONHECIDO" };
  if (!partes || versao !== "1") return { ok: false, schema, motivo: "VERSAO_DESCONHECIDA" };
  return schemas[nome]!.safeParse(payload).success ? { ok: true, schema }
    : { ok: false, schema, motivo: "PAYLOAD_FORA_DO_CONTRATO" };
}

export const Envelope = z.object({ tipo: Id, versao: z.literal(1), dados: z.unknown(), fontes: z.array(Fonte) }).strict()
  .superRefine((e, ctx) => { const r = validarPayloadEvento(`${e.tipo}@${e.versao}`, e.dados);
    if (!r.ok) ctx.addIssue({ code: "custom", message: r.motivo }); });
