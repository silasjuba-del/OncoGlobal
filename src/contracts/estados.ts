// C-01 · Dimensões de estado (teto 5 por dimensão — Q9; PLANO v1.1 R-09 + K-17/K-19)
import { z } from "zod";

/** D1 Semáforo do dado (Q10). VERDE = "nenhum alerta com os dados disponíveis", nunca "liberado". */
export const Semaforo = z.enum(["VERDE", "VERMELHO", "PENDENTE"]);
export type Semaforo = z.infer<typeof Semaforo>;

/** D2 Revisão (verdade). Governa persistência como fato. */
export const Revisao = z.enum(["RAW", "INFERIDO", "REVISAR", "CONFIRMADO", "ASSINADO"]);
export type Revisao = z.infer<typeof Revisao>;

/** D3 Status do campo (K-02). */
export const StatusCampo = z.enum(["PRESENTE", "AUSENTE", "NAO_SE_APLICA", "NAO_INFORMADO", "CONFLITO"]);
export type StatusCampo = z.infer<typeof StatusCampo>;

/** D4 Destino no salão (Q26). Nutrição/secretaria são encaminhamentos (tarefas), não destino. */
export const Destino = z.enum(["SALAO", "FILA_MEDICO", "FRENTE"]);
export type Destino = z.infer<typeof Destino>;

/** D5 APAC. AUTORIZADA só entra de fora; NEGADA não apaga. */
export const EstadoApac = z.enum(["RASCUNHO", "EMITIDA", "AUTORIZADA", "NEGADA", "VENCIDA"]);
export type EstadoApac = z.infer<typeof EstadoApac>;

/** D6 Artefato: bloqueia o documento, nunca o médico (INV-18). */
export const EstadoArtefato = z.enum(["PRONTO", "EM_REVISAO", "BLOQUEADO"]);
export type EstadoArtefato = z.infer<typeof EstadoArtefato>;

/** D7 Delta (K-17): direção só existe com regra clínica de direção. */
export const DeltaKind = z.enum(["NOVO", "MUDOU", "PERSISTE", "RESOLVEU"]);
export type DeltaKind = z.infer<typeof DeltaKind>;
export const DeltaDirecao = z.enum(["MELHOR", "PIOR"]);
export type DeltaDirecao = z.infer<typeof DeltaDirecao>;

/** D8 Conversa com o paciente (Q41–44). Urgência = semáforo VERMELHO sobre a conversa. */
export const EstadoConversa = z.enum(["NOVA", "TRIADA", "AGUARDA_MEDICO", "RESPONDIDA", "ENCERRADA"]);
export type EstadoConversa = z.infer<typeof EstadoConversa>;

/** D9 Prescrição → farmácia (Q37). Farmácia nunca edita. */
export const EstadoFarmacia = z.enum(["ENVIADA", "CONFERIDA", "CORRECAO_PEDIDA", "ACEITA"]);
export type EstadoFarmacia = z.infer<typeof EstadoFarmacia>;

/** Run clínico/cognitivo (K-19): etapa é campo, não estado. */
export const EstadoRun = z.enum(["RECEBIDO", "EM_CURSO", "PRONTO", "CONCLUIDO", "FALHOU"]);
export type EstadoRun = z.infer<typeof EstadoRun>;

/** Status de capacidade (INV-24; D10 virou campo do registro — 0.4). */
export const CapabilityStatus = z.enum(["SPECIFIED", "TESTED", "VALIDATED", "OPERATING", "DISABLED"]);
export type CapabilityStatus = z.infer<typeof CapabilityStatus>;

// ── Classificações (≤4; não são estado) ──────────────────────────────────────
export const IntencaoQtRt = z.enum(["DEFINITIVA", "NEOADJUVANTE", "ADJUVANTE", "PALIATIVA"]);
export const IntencaoCx = z.enum(["CURATIVA", "PALIATIVA", "HIGIENICA", "CITORREDUTORA"]);
/** Vocabulário EXTERNO da APAC (Q33) — nomenclatura oficial [VERIFICAR]. Nunca derivado da intenção. */
export const FinalidadeApac = z.enum(["PREVIA", "ADJUVANTE", "CURATIVA", "CONTROLE_TEMPORARIO", "PALIATIVA"]);
export type FinalidadeApac = z.infer<typeof FinalidadeApac>;
export const ClasseRisco = z.enum(["ABSOLUTA", "RELATIVA", "MODIFICADOR", "MONITORAMENTO"]);
export const NaturezaAlerta = z.enum(["AMEACA_IMEDIATA", "REVISAO_URGENTE", "ALERTA_ONCO", "MUDANCA_RESPOSTA"]);
export const EvidenceLayer = z.enum(["DOCUMENT_TEXT", "IMAGE_OBSERVATION", "INFERENCE"]);
