import { Alerta } from "./operacao.js";
import { z } from "zod";
import { DataCivil, Fonte, Id, Instante } from "./base.js";
import { Paciente, TumorLot, Triagem, Contato, TreatmentEpisode, Ciclo, TreatmentAdministration } from "./clinico.js";
import { Apac, SignatureReference } from "./operacao.js";
import { Conversation } from "./agentes.js";
import { Tarefa } from "./f1/tarefa.js";
import { AnotacaoEvolucao } from "./f1/anotacaoEvolucao.js";

const Campo = z.object({ campo: Id, valor: z.unknown() }).passthrough()
  .refine(d => Object.hasOwn(d, "valor"), "valor ausente");
const Documento = z.object({ data: z.object({ documentId: Id, documentVersion: z.number().int().positive(),
  texto: z.string() }).passthrough(), signature: SignatureReference.passthrough() }).passthrough();
const Revisao = z.object({}).passthrough().refine(d =>
  typeof d.campo === "string" || typeof d.exceptionId === "string" || typeof d.kind === "string", "decisão sem identidade");
const AgendaEntry = z.object({ patientId: Id, encounterId: Id, horario: z.string().regex(/^\d{2}:\d{2}$/), data: DataCivil }).strict();
const LabResult = z.object({ campo: Id, valor: z.number().finite(), unidade: Id, data: z.union([DataCivil, Instante]), sourceId: Id }).passthrough();
const TextoDominio = z.string().trim().min(1);
// Formato literal consumido pela Flash: dado ausente não constitui um laudo.
const LaudoDatado = z.object({ dataClinica: DataCivil, fraseLaudo: TextoDominio,
  nome: TextoDominio.optional(), situacao: z.enum(["DENTRO_DO_LIMITE", "FORA_DO_LIMITE", "SEM_REFERENCIA"]).optional() }).passthrough();
// Material legado consumido pelo Retrato. Qualificadores são preservados, não inferidos.
const AchadosImagem = z.object({ incerto: z.boolean().optional(), suspeita: z.boolean().optional(),
  negado: z.boolean().optional() }).strict().refine(d => Object.keys(d).length > 0);
const MaterialImagem = z.object({ textoLaudo: TextoDominio.optional(), resumo: TextoDominio.optional(),
  achados: z.union([TextoDominio, z.array(TextoDominio).min(1), AchadosImagem]).optional(),
  dataClinica: DataCivil.optional() }).passthrough().refine(d =>
  d.textoLaudo !== undefined || d.resumo !== undefined || d.achados !== undefined, "material de imagem ausente");
const ImagingReport = z.union([LaudoDatado, MaterialImagem]);
// Formatos do histórico clínico: null explicita lacuna, sem gerar valor ou regra.
const Cirurgia = z.object({ tipo: z.literal("CIRURGIA"), id: TextoDominio, data: DataCivil,
  procedimento: TextoDominio.nullable(), observacao: z.string().nullable() }).strict();
const Radioterapia = z.object({ tipo: z.literal("RT"), id: TextoDominio, inicio: DataCivil,
  fim: DataCivil.nullable(), fracoes: z.number().int().nonnegative().nullable(),
  doseTotalGy: z.number().nonnegative().nullable(), boost: z.string().nullable(),
  topografia: TextoDominio.nullable(), medicoResponsavel: TextoDominio.nullable(),
  local: TextoDominio.nullable(), observacao: z.string().nullable() }).strict()
  .refine(d => d.fim === null || d.fim >= d.inicio, "fim anterior ao início");
/** Mesmo contrato estrutural da leitura RECIST; aptidão técnica e proveniência permanecem nas regras. */
export const RecistSeriePayload = z.object({
  patientId: z.string().min(1), tumorLotId: z.string().nullable(), episodioId: z.string().min(1),
  baselineEventId: z.string().min(1),
  alvos: z.array(z.object({ codigo: z.string(), tipo: z.enum(["NAO_NODAL", "LINFONODO"]),
    eixo: z.enum(["MAIOR", "CURTO"]), orgaoId: z.string().nullable(),
    elegibilidadeBasal: z.enum(["ELEGIVEL", "NAO_ELEGIVEL"]).nullable(),
    fonteElegibilidadeIds: z.array(z.string()) }).strict()),
  pontos: z.array(z.object({ eventId: z.string(), patientId: z.string(), tumorLotId: z.string().nullable(),
    episodioId: z.string(), data: z.string(), metodo: z.enum(["TC", "CXR", "CALIPER", "RM", "US", "OUTRO"]),
    tecnicaId: z.string().nullable(), espessuraCorteMm: z.number().nullable(),
    qualidadeMedicao: z.enum(["ADEQUADA", "INADEQUADA", "NAO_AVALIADA"]),
    lesoes: z.array(z.object({ codigo: z.string(), diametroMm: z.number(), fonteIds: z.array(z.string()),
      unidadeOriginal: z.enum(["mm", "cm"]).nullable().optional(), valorOriginal: z.number().nullable().optional() }).strict()),
    novasLesoes: z.boolean().nullable(),
    naoAlvos: z.enum(["AUSENTE_DOCUMENTADO", "PERSISTENTE_SEM_PROGRESSAO", "PROGRESSAO_INEQUIVOCA", "NAO_AVALIADO"]),
    fonteIds: z.array(z.string()) }).strict()),
}).strict();
const schemas: Readonly<Record<string, z.ZodType>> = Object.freeze({
  Alerta, Paciente, TumorLot, Triagem, Contato, TreatmentEpisode, Ciclo, TreatmentAdministration, APAC: Apac,
  Conversation, AgendaEntry, FATO: Campo, DOCUMENTO: Documento, ReviewDecision: Revisao, LabResult,
  Tarefa, AnotacaoEvolucao,
  ConsultaConfirmada: z.object({ dataClinica:DataCivil,documentoIds:z.array(z.object({documentId:Id,documentVersion:z.number().int().positive()}).strict()).min(1) }).strict(),
  Weight: z.object({ kg: z.number().finite().positive(), origem: z.enum(["MEDIDO", "INFORMADO_PACIENTE", "ANTERIOR"]), data: DataCivil, sourceId: Id }).passthrough(),
  ApacAviso: z.object({ apacId: Id, competencia: z.string().regex(/^\d{4}-\d{2}$/) }).passthrough(),
  Biopsy: z.object({ dataClinica: DataCivil }).passthrough(),
  Staging: z.object({ dataClinica: DataCivil, tipo: z.enum(["STAGING", "RESTAGING"]) }).passthrough(),
  TreatmentCycle: z.object({ dataClinica: DataCivil, linha: z.number().int().positive(), ciclo: z.number().int().positive() }).passthrough(),
  ImagingReport,
  ExameLaudo: LaudoDatado,
  RecistSerie: RecistSeriePayload,
  Surgery: Cirurgia,
  FatoCirurgia: Cirurgia,
  Radiotherapy: Radioterapia,
  FatoRadioterapia: Radioterapia,
  FatoRT: Radioterapia,
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
