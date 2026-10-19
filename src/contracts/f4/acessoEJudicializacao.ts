import { z } from "zod";
import { DataCivil, Id, Instante } from "../base.js";

/** S-F4-04 · Eixos independentes de acesso (nunca confundir indicação clínica com cobertura ou direito automático). */
export const StatusRegistroRegulatorio = z.enum([
  "REGISTRADO_ANVISA",
  "USO_OFF_LABEL_DOCUMENTADO",
  "NAO_VERIFICADO",
]);
export type StatusRegistroRegulatorio = z.infer<typeof StatusRegistroRegulatorio>;

export const StatusCoberturaPadrao = z.enum([
  "INCORPORADO_SUS",
  "NAO_INCORPORADO_SUS",
  "RENAME_PADRAO",
  "SAUDE_SUPLEMENTAR_ROL",
  "NAO_VERIFICADO",
]);
export type StatusCoberturaPadrao = z.infer<typeof StatusCoberturaPadrao>;

export const StatusDisponibilidadeLocal = z.enum([
  "DISPONIVEL",
  "INDISPONIVEL",
  "DESCONHECIDO",
]);
export type StatusDisponibilidadeLocal = z.infer<typeof StatusDisponibilidadeLocal>;

export const CitacaoEvidenciaLaudo = z.object({
  citacaoId: Id,
  tipoFonte: z.enum(["FATO_CLINICO_CONFIRMADO", "DIRETRIZ_OU_ESTUDO_PUBLICADO", "NORMA_REGULATORIA", "DOCUMENTO_NEGATIVA_OU_FALTA"]),
  referenciaId: Id,
  tituloOuDescricao: z.string().min(1).max(500),
  dataFonte: DataCivil,
  consultadoEm: DataCivil,
  trechoSustentador: z.string().min(1).max(2000),
  desfechosDocumentados: z.object({
    sobrevidaGlobal: z.string().max(250).nullable(),
    sobrevidaLivreProgressao: z.string().max(250).nullable(),
    hazardRatio: z.string().max(250).nullable(),
  }).strict().nullable(),
}).strict();
export type CitacaoEvidenciaLaudo = z.infer<typeof CitacaoEvidenciaLaudo>;

export const AfirmacaoFundamentadaLaudo = z.object({
  afirmacaoId: Id,
  secao: z.enum(["IDENTIFICACAO_DIAGNOSTICO", "HISTORICO_TRATAMENTOS", "JUSTIFICATIVA_CLINICA", "ALTERNATIVAS_SUS", "RISCO_ATRASO"]),
  texto: z.string().min(1).max(3000),
  citacoesIds: z.array(Id).min(1).max(20),
}).strict();
export type AfirmacaoFundamentadaLaudo = z.infer<typeof AfirmacaoFundamentadaLaudo>;

const PADROES_PROIBIDOS_LAUDO_JUDICIAL = [
  /\bdireito\s+adquirido\b/i,
  /\beleg[ií]vel\s+automaticamente\b/i,
  /\bgarantia\s+de\s+cura\b/i,
  /\bprometo\s+resposta\b/i,
  /\bCORRECAO_IA\b/,
  /\bALERTA_E1\b/,
];

/**
 * S-F4-04 (AG-18 / Q48) · Minuta de laudo/relatório de solicitação, acesso ou judicialização:
 * - Toda afirmação cita fato confirmado do paciente ou fonte verificada e datada (grounding estrito);
 * - Separa explicitamente indicação clínica, registro regulatório, cobertura e disponibilidade local;
 * - Proíbe afirmar direito jurídico adquirido, elegibilidade automática ou promessa de resposta;
 * - Nasce sempre em RASCUNHO (revisao: REVISAR, assinado: false); só o médico edita e assina (G-03).
 */
export const MinutaLaudoAcessoJudicial = z.object({
  schema: z.literal("MinutaLaudoAcessoJudicial@1"),
  minutaId: Id,
  versao: z.number().int().positive(),
  patientId: Id,
  encounterId: Id,
  tumorLotId: Id,
  prescricaoAssinadaRef: z.object({
    documentId: Id,
    documentVersion: z.number().int().positive(),
  }).strict(),
  medicamentoSolicitado: z.object({
    nome: z.string().min(1).max(250),
    posologiaPlanejada: z.string().min(1).max(500),
    duracaoPrevista: z.string().min(1).max(250),
  }).strict(),
  separacaoEixosAcesso: z.object({
    indicacaoClinicaMedica: z.string().min(1).max(2000),
    registroRegulatorio: StatusRegistroRegulatorio,
    coberturaPadrao: StatusCoberturaPadrao,
    disponibilidadeLocal: z.object({
      estado: StatusDisponibilidadeLocal,
      origem: z.string().min(1).max(250).nullable(),
      dataLeitura: DataCivil.nullable(),
    }).strict(),
    presumeDireitoIndividualAutomatico: z.literal(false),
    presumeElegibilidadeAutomatica: z.literal(false),
  }).strict(),
  citacoesVerificadas: z.array(CitacaoEvidenciaLaudo).min(1).max(50),
  afirmacoes: z.array(AfirmacaoFundamentadaLaudo).min(1).max(50),
  textoMinutaConsolidado: z.string().min(1).max(30_000),
  contemAlertaOuCorrecaoIa: z.literal(false),
  revisao: z.enum(["REVISAR", "ASSINADO"]),
  assinadoPorMedicoId: Id.nullable(),
  assinadoPorCrm: Id.nullable(),
  assinadoEm: Instante.nullable(),
  criadoEm: Instante,
}).strict().superRefine((m, ctx) => {
  const idsCitacoes = new Set(m.citacoesVerificadas.map((c) => c.citacaoId));
  for (const af of m.afirmacoes) {
    if (af.citacoesIds.some((id) => !idsCitacoes.has(id))) {
      ctx.addIssue({
        code: "custom",
        path: ["afirmacoes"],
        message: `afirmação ${af.afirmacaoId} referencia citação inexistente (violação de grounding)`,
      });
    }
    for (const proibido of PADROES_PROIBIDOS_LAUDO_JUDICIAL) {
      if (proibido.test(af.texto)) {
        ctx.addIssue({
          code: "custom",
          path: ["afirmacoes"],
          message: `afirmação ${af.afirmacaoId} contém expressão proibida (${proibido.source})`,
        });
      }
    }
  }
  for (const proibido of PADROES_PROIBIDOS_LAUDO_JUDICIAL) {
    if (proibido.test(m.textoMinutaConsolidado)) {
      ctx.addIssue({
        code: "custom",
        path: ["textoMinutaConsolidado"],
        message: `texto consolidado contém expressão proibida (${proibido.source})`,
      });
    }
  }
  if (m.revisao === "ASSINADO" && (!m.assinadoPorMedicoId || !m.assinadoPorCrm || !m.assinadoEm)) {
    ctx.addIssue({
      code: "custom",
      path: ["revisao"],
      message: "minuta ASSINADO exige médico com CRM e instante de assinatura",
    });
  }
  if (m.revisao === "REVISAR" && (m.assinadoPorMedicoId !== null || m.assinadoPorCrm !== null || m.assinadoEm !== null)) {
    ctx.addIssue({
      code: "custom",
      path: ["revisao"],
      message: "minuta em REVISAR não pode ter assinatura preenchida",
    });
  }
});
export type MinutaLaudoAcessoJudicial = z.infer<typeof MinutaLaudoAcessoJudicial>;
