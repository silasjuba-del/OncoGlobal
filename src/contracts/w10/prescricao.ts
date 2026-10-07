// W10 · Prescrição em 4 camadas (D-W9-24/26/45/47; docs/specs/PATCH-PRESCRICAO-UI-LONGITUDINAL.md).
// A prescrição nasce do protocolo versionado; cálculo de dose é código (FN-04), nunca LLM.
import { z } from "zod";
import { Id, Instante } from "../base.js";

/** D-W9-47 · quatro classes. QT = oncológicas. */
export const ClasseMedicacao = z.enum(["PRE_QT", "QT", "POS_QT", "NAO_ONCOLOGICA"]);
export type ClasseMedicacao = z.infer<typeof ClasseMedicacao>;

export const DoseBasis = z.enum(["FIXED", "MG_KG", "MG_M2", "AUC", "OTHER"]);
export type DoseBasis = z.infer<typeof DoseBasis>;

/** D-W9-26 · ajuste só pelos botões −20/−30/−40 sobre a dose anterior. */
export const AjustePercentual = z.union([z.literal(-20), z.literal(-30), z.literal(-40)]);
export type AjustePercentual = z.infer<typeof AjustePercentual>;

export const OrigemItem = z.enum(["PROTOCOL", "MANUAL"]);

/** Limiares de bula declarados na ficha (D-W9-22a): porta de ciclo; inteiros nas bordas (K-10). */
export const LimiaresBula = z.object({
  neutrofilosMin: z.number().int().min(0).nullable(), // /µL
  plaquetasMin: z.number().int().min(0).nullable(), // /µL
  clcrMinMlMin: z.number().int().min(0).nullable(),
  fevePctMin: z.number().int().min(0).max(100).nullable(),
  fonte: z.string().min(1), // bula/diretriz citada
}).strict();
export type LimiaresBula = z.infer<typeof LimiaresBula>;

export const PrescriptionItem = z.object({
  drug: z.string().min(1),
  classe: ClasseMedicacao,
  sequence: z.number().int().min(1),
  standardDose: z.number().positive().nullable(),
  doseBasis: DoseBasis,
  calculatedDose: z.number().positive().nullable(), // saída de FN-04
  prescribedDose: z.number().positive().nullable(),
  unit: z.string().min(1),
  adjustmentPercent: AjustePercentual.nullable(),
  adjustmentReason: z.string().min(1).nullable(),
  route: z.string().min(1),
  diluent: z.string().nullable(),
  finalVolumeMl: z.number().positive().nullable(),
  infusionTime: z.string().nullable(), // ex.: "46 h", "60 min"
  days: z.array(z.string().min(1)), // ["d1","d8"]
  observacao: z.string().nullable(),
  source: OrigemItem,
  /** Override de padrão do protocolo exige motivo (ALTERAR PADRÃO). */
  overrideMotivo: z.string().min(1).nullable(),
}).strict().superRefine((i, ctx) => {
  if (i.adjustmentPercent !== null && !i.adjustmentReason)
    ctx.addIssue({ code: "custom", message: "ajuste de dose exige motivo" });
  if (i.source === "MANUAL" && i.classe === "QT" && !i.overrideMotivo)
    ctx.addIssue({ code: "custom", message: "antineoplásico fora do protocolo exige motivo" });
});
export type PrescriptionItem = z.infer<typeof PrescriptionItem>;

/** Ficha = identidade tumor + nome + cenário + versão (D-W9-22b); hash fixa o conteúdo inteiro (K-26). */
export const ProtocolTemplate = z.object({
  templateId: Id,
  tumor: z.string().min(1),
  nome: z.string().min(1),
  cenario: z.string().min(1),
  versao: z.string().min(1),
  hash: z.string().min(1),
  codigoInstitucional: z.string().nullable(), // ex.: "P1456"
  intervaloDias: z.number().int().positive().nullable(),
  ciclos: z.number().int().positive().nullable(),
  itens: z.array(PrescriptionItem).min(1),
  limiaresBula: LimiaresBula.nullable(),
  fonte: z.string().min(1),
  status: z.enum(["RASCUNHO", "CONFERIDA_MEDICO", "INATIVA"]), // só CONFERIDA_MEDICO é usável
}).strict();
export type ProtocolTemplate = z.infer<typeof ProtocolTemplate>;

export const OrderType = z.enum(["OUTPATIENT_ORAL", "SUPPORTIVE", "ANTINEOPLASTIC", "INFUSION", "HYDRATION", "CONTROLLED"]);
export const EstadoOrdem = z.enum(["DRAFT", "SIGNED", "CANCELLED"]);

/** Camada 1: o ato médico. Assinada é imutável; correção = nova versão (supersedes). */
export const ClinicalOrder = z.object({
  orderId: Id,
  patientId: Id,
  encounterId: Id,
  cancerEpisodeId: Id.nullable(),
  orderType: OrderType,
  indication: z.string().nullable(),
  templateId: Id.nullable(),
  templateVersao: z.string().nullable(),
  cycle: z.number().int().positive().nullable(),
  day: z.string().nullable(),
  itens: z.array(PrescriptionItem).min(1),
  authoredBy: Id,
  authoredAt: Instante,
  status: EstadoOrdem,
  supersedesOrderId: Id.nullable(),
}).strict();
export type ClinicalOrder = z.infer<typeof ClinicalOrder>;

/** Receita de uma linha (modo rápido): a expressão do médico é preservada; o parser só estrutura. */
export const QuickLine = z.object({
  expression: z.string().min(1), // "ONDANSETRONA 8 MG VO 8/8H SE NÁUSEA"
  parsed: z.object({
    drug: z.string().nullable(),
    doseValue: z.number().positive().nullable(),
    doseUnit: z.string().nullable(),
    route: z.string().nullable(),
    frequency: z.string().nullable(),
    prn: z.boolean(),
    prnIndication: z.string().nullable(),
    maxDaily: z.string().nullable(),
    duration: z.string().nullable(),
  }).strict(),
  pendencias: z.array(z.string()), // campos que o parser não conseguiu: nunca inventa
}).strict();
export type QuickLine = z.infer<typeof QuickLine>;

/** Tabela regulatória versionada decide o documento; nunca o componente React. */
export const PrescriptionDocumentType = z.enum([
  "SIMPLE", "ANTIMICROBIAL", "SPECIAL_CONTROL", "NOTIFICATION_A", "NOTIFICATION_B",
  "NOTIFICATION_B2", "RETINOID", "THALIDOMIDE", "INSTITUTIONAL",
]);
export type PrescriptionDocumentType = z.infer<typeof PrescriptionDocumentType>;

/** Resultado do SafetyEngine. BLOCK bloqueia o ARTEFATO, nunca o médico; NOT_EVALUABLE = PENDENTE. */
export const SafetyVerdict = z.object({
  resultado: z.enum(["PASS", "WARNING", "BLOCK_ARTEFATO", "NOT_EVALUABLE"]),
  motivos: z.array(z.object({ codigo: z.string().min(1), texto: z.string().min(1), fonte: z.string().min(1) }).strict()),
}).strict();
export type SafetyVerdict = z.infer<typeof SafetyVerdict>;
