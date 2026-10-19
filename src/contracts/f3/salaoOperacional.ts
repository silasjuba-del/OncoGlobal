import { z } from "zod";
import { DataCivil, Fonte, Id, Instante } from "../base.js";
import { Destino, Semaforo } from "../estados.js";
import { OrigemPeso, ResultadoTriagem, TreatmentAdministration } from "../clinico.js";

export const TipoEventoInterrupcaoSalao = z.enum([
  "ALERGIA_INFUSIONAL",
  "VOMITO_DIFICIL",
  "DOR_OU_EXTRAVASAMENTO_INFUSAO",
]);
export type TipoEventoInterrupcaoSalao = z.infer<typeof TipoEventoInterrupcaoSalao>;

export const AcaoImediataInterrupcaoSalao = z.enum([
  "PARAR_INFUSAO_NA_HORA",
  "PAUSAR_E_AGUARDAR_ESTABILIZACAO",
  "AVISAR_ENFERMAGEM_E_MEDICO_NA_HORA",
]);
export type AcaoImediataInterrupcaoSalao = z.infer<typeof AcaoImediataInterrupcaoSalao>;

/** S-F3-02 · Eventos operacionais do salão (Q28): alergia para na hora; vômito difícil para e espera. */
export const EventoInterrupcaoSalao = z.object({
  eventoSalaoId: Id,
  patientId: Id,
  encounterId: Id,
  cicloId: Id.nullable(),
  tipo: TipoEventoInterrupcaoSalao,
  acaoImediata: AcaoImediataInterrupcaoSalao,
  infusaoSuspensa: z.literal(true),
  exigeAvaliacaoMedica: z.literal(true),
  notificarSetorChat: z.literal("TRIAGEM"),
  descricaoClinica: z.string().min(1).max(1000),
  registradoPor: Id,
  registradoEm: Instante,
}).strict().superRefine((ev, ctx) => {
  if (ev.tipo === "ALERGIA_INFUSIONAL" && ev.acaoImediata !== "PARAR_INFUSAO_NA_HORA") {
    ctx.addIssue({ code: "custom", path: ["acaoImediata"], message: "alergia infusional exige PARAR_INFUSAO_NA_HORA" });
  }
  if (ev.tipo === "VOMITO_DIFICIL" && ev.acaoImediata !== "PAUSAR_E_AGUARDAR_ESTABILIZACAO") {
    ctx.addIssue({ code: "custom", path: ["acaoImediata"], message: "vômito difícil exige PAUSAR_E_AGUARDAR_ESTABILIZACAO" });
  }
});
export type EventoInterrupcaoSalao = z.infer<typeof EventoInterrupcaoSalao>;

/** S-F3-02 · Peso vermelho (Q24–Q25): perda > 5 kg em 60 dias gera tarefa nutrição + QT adiada + consulta médica mantida. */
export const DesfechoPesoSalao = z.object({
  patientId: Id,
  encounterId: Id,
  estadoPeso: Semaforo,
  perdaKg: z.number().nullable(),
  motivo: z.string().min(1),
  tarefaNutricaoCriada: z.boolean(),
  qtAdiada: z.boolean(),
  passaEmConsultaMedica: z.literal(true),
  rulesetVersao: z.string().min(1),
}).strict().superRefine((d, ctx) => {
  if (d.estadoPeso === "VERMELHO" && (!d.tarefaNutricaoCriada || !d.qtAdiada)) {
    ctx.addIssue({ code: "custom", message: "peso VERMELHO exige tarefa de nutrição e QT adiada, mantendo consulta médica" });
  }
});
export type DesfechoPesoSalao = z.infer<typeof DesfechoPesoSalao>;

/** S-F3-02 · Exceção / liberação médica com corte (INV-04 / Q28): exige sessão médica e justificativa explícita. */
export const ExcecaoLiberacaoMedicaSalao = z.object({
  liberacaoId: Id,
  patientId: Id,
  encounterId: Id,
  triagemDraftId: Id,
  triagemRevision: z.number().int().nonnegative(),
  motivoJustificado: z.string().trim().min(1).max(1000),
  autorMedicoId: Id,
  autorCrm: Id,
  registradoEm: Instante,
}).strict();
export type ExcecaoLiberacaoMedicaSalao = z.infer<typeof ExcecaoLiberacaoMedicaSalao>;

/** S-F3-03 · Cálculo de dose, BSA Mosteller, ciclo e separação planejado × prescrito × administrado. */
export const AvaliacaoDoseCicloSalao = z.object({
  patientId: Id,
  encounterId: Id,
  episodioId: Id,
  esquemaId: z.string().min(1),
  numeroCiclo: z.number().int().positive(),
  pesoKg: z.number().positive().nullable(),
  alturaCm: z.number().positive().nullable(),
  origemPeso: OrigemPeso.nullable(),
  bsaMostellerM2: z.number().positive().nullable(),
  dosePlanejadaProtocoloMg: z.number().int().nonnegative().nullable(),
  dosePrescritaAssinadaMg: z.number().int().nonnegative().nullable(),
  doseAdministradaCicloAnteriorMg: z.number().finite().nonnegative().nullable(),
  reducaoPct: z.union([z.literal(0), z.literal(20), z.literal(30), z.literal(40)]),
  doseCalculadaPropostaMg: z.number().int().nonnegative().nullable(),
  estadoDose: Semaforo,
  motivoDose: z.string().min(1),
  ciclosSemPesoConsecutivos: z.number().int().nonnegative(),
  exigeConsultaMedicaNoCiclo: z.boolean(),
  podeSaltarMedicoCiclo3Ac: z.boolean(),
  prescricaoAssinadaInalterada: z.literal(true),
  rulesetVersao: z.string().min(1),
}).strict();
export type AvaliacaoDoseCicloSalao = z.infer<typeof AvaliacaoDoseCicloSalao>;

export const ResumoCumulativoSalao = z.object({
  droga: z.string().min(1),
  quantidadeEfetivaTotalMg: z.number().finite().nonnegative(),
  adminIds: z.array(Id),
  conflitoAdminIds: z.array(Id),
  incluiApenasAdministracaoEfetiva: z.literal(true),
}).strict();
export type ResumoCumulativoSalao = z.infer<typeof ResumoCumulativoSalao>;

/** S-F3-04 · Folha operacional de contingência do salão (K-12 / INV-08 / G-06). */
export const FolhaContingenciaSalao = z.object({
  folhaId: Id,
  patientId: Id,
  encounterId: Id,
  dataImpressao: DataCivil,
  destino: Destino,
  emergenciaAtiva: z.boolean(),
  alertasOperacionaisE1: z.array(z.string().min(1)),
  htmlImprimivel: z.string().min(1),
  hashDocumento: z.string().regex(/^[a-f0-9]{64}$/),
  evolucaoClinicaContemAlerta: z.literal(false),
  geradoEm: Instante,
}).strict();
export type FolhaContingenciaSalao = z.infer<typeof FolhaContingenciaSalao>;

export const RegistroAdministracaoEfetivaSalao = z.object({
  patientId: Id,
  encounterId: Id,
  tumorLotId: Id.nullable(),
  prescricaoAssinadaRef: z.object({
    documentId: Id,
    documentVersion: z.number().int().positive(),
    documentHash: z.string().regex(/^[a-f0-9]{64}$/).optional(),
  }).strict(),
  administracao: TreatmentAdministration,
  fonte: Fonte,
  resultadoTriagem: ResultadoTriagem.optional(),
}).strict();
export type RegistroAdministracaoEfetivaSalao = z.infer<typeof RegistroAdministracaoEfetivaSalao>;
