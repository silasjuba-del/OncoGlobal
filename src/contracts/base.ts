// C-02 Fonte · C-03 Dado<T> · C-04 Contexto · DraftEnvelope (K-01)
import { z } from "zod";
import { Revisao, Semaforo, StatusCampo } from "./estados.js";

export const Id = z.string().min(1);
export const Instante = z.iso.datetime({ offset: true });
export const DataCivil = z.iso.date();

export const ClasseFonte = z.enum([
  "PLAUD", "VOICE_COMMAND", "CHAT_TEXT", "DOCUMENT", "MANUAL", "WHATSAPP", "EMAIL", "LAB_FEED",
]);

/** C-02 Proveniência. Data de captura ≠ data clínica. Nome de arquivo nunca entra aqui (K-22: opaco). */
export const Fonte = z.object({
  sourceId: Id,
  classe: ClasseFonte,
  localizador: z.string().nullable(), // página/trecho/corte
  dataClinica: z.string().nullable(), // ISO com precisão variável (ano, mês ou dia)
  dataCaptura: Instante,
  versao: z.string().min(1),
  contentHash: z.string().min(1),
}).strict();
export type Fonte = z.infer<typeof Fonte>;

/** Candidato preservado em CONFLITO (K-02): nenhum valor é eleito. */
const Candidato = <T extends z.ZodTypeAny>(valor: T) =>
  z.object({ valor, fontes: z.array(Fonte).min(1) }).strict();

/**
 * C-03 Dado<T> — o átomo. Refines valem para PROMOÇÃO (fato); rascunho vive em DraftEnvelope.
 * AUSENTE/NAO_INFORMADO ⇒ valor null + PENDENTE
 * CONFLITO ⇒ valor null + VERMELHO + ≥2 candidatos
 * NAO_SE_APLICA ⇒ valor null + motivo + fonte (excluído dos requisitos; não vira VERDE por si)
 * PRESENTE ⇒ valor + ≥1 fonte
 * VERDE ⇒ revisão ≠ RAW (INV-02)
 */
export const dado = <T extends z.ZodTypeAny>(valor: T) =>
  z.object({
    valor: valor.nullable(),
    estado: Semaforo,
    campo: StatusCampo,
    motivo: z.string().min(1),
    fontes: z.array(Fonte),
    revisao: Revisao,
    candidatos: z.array(Candidato(valor)).optional(),
    rulesetVersao: z.string().optional(),
    confianca: z.number().min(0).max(1).optional(),
  }).strict().superRefine((d, ctx) => {
    const erro = (message: string) => ctx.addIssue({ code: "custom", message });
    const valor = (d as unknown as { valor: unknown }).valor; // genérico: T pode ser opcional na inferência
    switch (d.campo) {
      case "AUSENTE":
      case "NAO_INFORMADO":
        if (valor !== null) erro(`${d.campo} exige valor null`);
        if (d.estado !== "PENDENTE") erro(`${d.campo} exige PENDENTE (ausente nunca é VERDE)`);
        break;
      case "CONFLITO":
        if (valor !== null) erro("CONFLITO não elege valor");
        if (d.estado !== "VERMELHO") erro("CONFLITO exige VERMELHO");
        if (!d.candidatos || d.candidatos.length < 2) erro("CONFLITO exige ≥2 candidatos com fontes");
        break;
      case "NAO_SE_APLICA":
        if (valor !== null) erro("NAO_SE_APLICA exige valor null");
        if (d.fontes.length < 1) erro("NAO_SE_APLICA exige fonte que justifique");
        break;
      case "PRESENTE":
        if (valor === null) erro("PRESENTE exige valor");
        if (d.fontes.length < 1) erro("valor presente exige fonte");
        break;
    }
    if (d.estado === "VERDE" && d.revisao === "RAW") erro("VERDE não pode nascer de RAW");
  });

/** C-04 Contexto WORK. A sessão vem do servidor, nunca do payload (INV-04). */
export const Sessao = z.object({
  medicoId: Id,
  crm: z.string().min(1),
  emitidaEm: Instante,
  expiraEm: Instante,
}).strict();
export type Sessao = z.infer<typeof Sessao>;

export const ContextoWork = z.object({
  patientId: Id,
  tumorLotId: Id.nullable(),
  encounterId: Id,
  atendimentoId: Id,
  operationId: Id,
  sessao: Sessao,
}).strict();
export type ContextoWork = z.infer<typeof ContextoWork>;

/** K-01 · Rascunho nunca se perde. Payload é inerte: nunca autoridade, nunca fato. */
export const DraftEnvelope = z.object({
  draftId: Id,
  patientId: Id.nullable(),
  sourceId: Id,
  rawRef: z.string().min(1), // caminho local opaco, nunca URL pública
  payload: z.unknown(),
  diagnostics: z.array(z.string()),
  revision: z.number().int().nonnegative(),
  criadoEm: Instante,
}).strict();
export type DraftEnvelope = z.infer<typeof DraftEnvelope>;
