import { z } from "zod";
import { Id, Instante } from "../base.js";

export const PapelProfissionalSetor = z.enum([
  "MEDICO",
  "ENFERMAGEM_SALAO",
  "FARMACIA",
  "SECRETARIA_FATURAMENTO",
]);
export type PapelProfissionalSetor = z.infer<typeof PapelProfissionalSetor>;

export const SetorOperacionalF6 = z.enum([
  "MEDICO",
  "TRIAGEM",
  "FARMACIA",
  "SECRETARIA",
  "FATURAMENTO",
]);
export type SetorOperacionalF6 = z.infer<typeof SetorOperacionalF6>;

export const OperacaoSetorialF6 = z.enum([
  "LER_PRONTUARIO_COMPLETO",
  "CONFIRMAR_FATO_CLINICO",
  "ASSINAR_DOCUMENTO_OU_PRESCRICAO",
  "LIBERAR_CORTE_SALAO",
  "ACEITAR_OU_RECUSAR_CORRECAO_FARMACIA",
  "LER_FILA_E_POLTRONAS_SALAO",
  "LANCAR_TRIAGEM_SALAO",
  "REGISTRAR_ADMINISTRACAO_EFETIVA",
  "REGISTRAR_INTERRUPCAO_SALAO",
  "LER_PRESCRICAO_ASSINADA_FARMACIA",
  "CONFERIR_OU_PEDIR_CORRECAO_FARMACIA",
  "EDITAR_PRESCRICAO_NA_FARMACIA",
  "LER_AGENDA_E_CADASTRO_SECRETARIA",
  "GERENCIAR_LOTE_APAC_FATURAMENTO",
  "LER_CHAT_SETOR",
  "ESCREVER_CHAT_SETOR",
  "PROMOVER_CHAT_AO_PRONTUARIO_SEM_MEDICO",
  "LER_ESTATISTICA_SERVICO",
  "EXPORTAR_WORK_PARA_STUDY",
]);
export type OperacaoSetorialF6 = z.infer<typeof OperacaoSetorialF6>;

/** Sessão autenticada por profissional e setor (F6 / Q40). */
export const SessaoProfissionalSetorF6 = z.object({
  sessaoId: Id,
  profissionalId: Id,
  papel: PapelProfissionalSetor,
  setor: SetorOperacionalF6,
  registroConselho: z.string().min(1).max(80).nullable(),
  territorio: z.literal("WORK"),
  emitidaEm: Instante,
  expiraEm: Instante,
}).strict().superRefine((s, ctx) => {
  if (s.papel === "MEDICO" && (!s.registroConselho || !s.registroConselho.trim())) {
    ctx.addIssue({ code: "custom", path: ["registroConselho"], message: "papel MEDICO exige CRM no registroConselho" });
  }
  if (s.papel === "ENFERMAGEM_SALAO" && s.setor !== "TRIAGEM") {
    ctx.addIssue({ code: "custom", path: ["setor"], message: "ENFERMAGEM_SALAO atua no setor TRIAGEM" });
  }
  if (s.papel === "FARMACIA" && s.setor !== "FARMACIA") {
    ctx.addIssue({ code: "custom", path: ["setor"], message: "FARMACIA atua no setor FARMACIA" });
  }
  if (s.papel === "SECRETARIA_FATURAMENTO" && s.setor !== "SECRETARIA" && s.setor !== "FATURAMENTO") {
    ctx.addIssue({ code: "custom", path: ["setor"], message: "SECRETARIA_FATURAMENTO atua em SECRETARIA ou FATURAMENTO" });
  }
});
export type SessaoProfissionalSetorF6 = z.infer<typeof SessaoProfissionalSetorF6>;

export const CodigoEventoAvisoMedicoOpaco = z.enum([
  "TRIAGEM_CORTE_AGUARDANDO_AVALIACAO",
  "EMERGENCIA_E1_NO_SALAO",
  "INTERRUPCAO_INFUSAO_NO_SALAO",
  "FARMACIA_SOLICITOU_CORRECAO_PRESCRICAO",
  "CANAL_MENSAGEM_PRIORITARIA_RECEBIDA",
  "APAC_PRAZO_D85_OU_PENDENCIA",
]);
export type CodigoEventoAvisoMedicoOpaco = z.infer<typeof CodigoEventoAvisoMedicoOpaco>;

/**
 * Aviso ao médico (inclusive para painel/celular — Q55/Q59):
 * Estritamente livre de PHI (sem nome, CPF, CNS, telefone, e-mail ou texto clínico livre).
 */
export const AvisoMedicoSemPhiF6 = z.object({
  avisoId: Id,
  setorOrigem: SetorOperacionalF6,
  urgencia: z.enum(["ROTINA", "PRIORITARIO", "EMERGENCIA_E1"]),
  codigoEventoOpaco: CodigoEventoAvisoMedicoOpaco,
  referenciaOpacaHash: z.string().regex(/^[a-f0-9]{64}$/),
  contemPhi: z.literal(false),
  criadoEm: Instante,
}).strict();
export type AvisoMedicoSemPhiF6 = z.infer<typeof AvisoMedicoSemPhiF6>;

export const MensagemOperacionalSetorF6 = z.object({
  mensagemId: Id,
  patientId: Id,
  encounterId: Id,
  setor: z.enum(["TRIAGEM", "FARMACIA", "SECRETARIA", "MEDICO"]),
  autorProfissionalId: Id,
  autorPapel: PapelProfissionalSetor,
  textoOperacional: z.string().min(1).max(4000),
  promovidaAoProntuarioAutomaticamente: z.literal(false),
  criadoEm: Instante,
}).strict();
export type MensagemOperacionalSetorF6 = z.infer<typeof MensagemOperacionalSetorF6>;

export const VereditoIsolamentoWorkStudyF6 = z.object({
  permitido: z.boolean(),
  territorioOrigem: z.enum(["WORK", "STUDY"]),
  territorioDestino: z.enum(["WORK", "STUDY"]),
  motivoCodigo: z.string().min(1),
  prontuarioOuPhiTransferido: z.literal(false),
}).strict();
export type VereditoIsolamentoWorkStudyF6 = z.infer<typeof VereditoIsolamentoWorkStudyF6>;
