import { z } from "zod";
import { DataCivil, Fonte, Id, Instante } from "../base.js";

export const TipoPassoRoteiroAnamnese = z.enum([
  "PERGUNTA_SINTOMA",
  "SOLICITACAO_DOCUMENTO_EXAME",
  "SOLICITACAO_FOTO_LESAO_OU_RECEITA",
  "LEMBRETE_RETORNO_PREPARO",
]);
export type TipoPassoRoteiroAnamnese = z.infer<typeofPassoRoteiroAnamnese>;
type typeofPassoRoteiroAnamnese = typeof TipoPassoRoteiroAnamnese;

export const PassoRoteiroAnamnese = z.object({
  passoId: Id,
  ordem: z.number().int().positive(),
  tipo: TipoPassoRoteiroAnamnese,
  dominioClinico: z.string().min(1).max(120),
  perguntaCanonica: z.string().min(1).max(1000),
  obrigatorioParaResumo: z.boolean(),
}).strict();
export type PassoRoteiroAnamnese = z.infer<typeof PassoRoteiroAnamnese>;

export const LembreteOrientacaoAprovado = z.object({
  orientacaoId: Id,
  titulo: z.string().min(1).max(250),
  textoAprovado: z.string().min(1).max(2000),
  statusCuradoria: z.enum(["CONFERIDA_MEDICO", "RASCUNHO"]),
  fonte: z.string().min(1).max(250),
}).strict();
export type LembreteOrientacaoAprovado = z.infer<typeof LembreteOrientacaoAprovado>;

/** Roteiro aprovado por tumor/contexto (AG-19). Roteiros em RASCUNHO não podem ser executados no canal. */
export const RoteiroAnamneseTumor = z.object({
  roteiroId: Id,
  versao: Id,
  tumorPackId: Id,
  contextoClinico: z.enum(["PRIMEIRA_CONSULTA", "PRE_CICLO_QT", "SEGUIMENTO_POS_TRATAMENTO"]),
  statusCuradoria: z.enum(["CONFERIDA_MEDICO", "RASCUNHO"]),
  aprovadoPor: Id.nullable(),
  aprovadoEm: DataCivil.nullable(),
  fonte: z.string().min(1).max(250),
  passos: z.array(PassoRoteiroAnamnese).min(1).max(30),
  lembretesOrientacoes: z.array(LembreteOrientacaoAprovado).max(20),
}).strict().superRefine((r, ctx) => {
  if (r.statusCuradoria === "CONFERIDA_MEDICO" && (!r.aprovadoPor || !r.aprovadoEm)) {
    ctx.addIssue({ code: "custom", message: "roteiro CONFERIDA_MEDICO exige aprovadoPor e aprovadoEm" });
  }
});
export type RoteiroAnamneseTumor = z.infer<typeof RoteiroAnamneseTumor>;

export const RespostaPassoAnamnese = z.object({
  passoId: Id,
  mensagemIdOrigem: Id,
  respostaLiteral: z.string().min(1).max(5000),
  polaridade: z.enum(["AFIRMADO", "NEGADO", "INCERTO_DUVIDA", "NAO_RESPONDIDO"]),
  documentoOuFotoRef: Id.nullable(),
  fonte: Fonte,
  respondidoEm: Instante,
}).strict();
export type RespostaPassoAnamnese = z.infer<typeof RespostaPassoAnamnese>;

/**
 * Resumo estruturado da anamnese guiada (F5):
 * - Preserva fontes, lacunas, incertezas e negações;
 * - Nunca equivale a avaliação médica concluída, diagnóstico, dose ou prescrição.
 */
export const ResumoEstruturadoAnamnese = z.object({
  schema: z.literal("ResumoEstruturadoAnamnese@1"),
  respostasOriginais: z.array(RespostaPassoAnamnese).default([]),
  sessaoAnamneseId: Id,
  patientId: Id,
  contatoId: Id,
  roteiroId: Id,
  roteiroVersao: Id,
  tumorPackId: Id,
  itensColetados: z.array(z.object({
    passoId: Id,
    dominioClinico: z.string().min(1).max(120),
    resumoItem: z.string().min(1).max(1000),
    polaridade: z.enum(["AFIRMADO", "NEGADO", "INCERTO_DUVIDA"]),
    fonte: Fonte,
  }).strict()),
  documentosSolicitadosPendentes: z.array(Id),
  lacunasExplicitas: z.array(z.string().min(1).max(500)),
  incertezasExplicitas: z.array(z.string().min(1).max(500)),
  negacoesPreservadas: z.array(z.string().min(1).max(500)),
  alertasEscalonamentoMedico: z.array(z.string().min(1).max(500)),
  alertasInformadosNaoVerificados:z.array(z.string().min(1).max(500)).optional(),
  orientacoesFixasEntreguesIds: z.array(Id),
  avaliacaoMedicaConcluida: z.literal(false),
  defineDiagnostico: z.literal(false),
  defineDoseOuPrescricao: z.literal(false),
  revisao: z.literal("REVISAR"),
  geradoEm: Instante,
}).strict();
export type ResumoEstruturadoAnamnese = z.infer<typeof ResumoEstruturadoAnamnese>;

/** Registro de voz no canal (F5): exige consentimento e apaga o áudio bruto após transcrição validada (Q16 / A5). */
export const RegistroVozAnamneseCanal = z.object({
  vozId: Id,
  sessaoAnamneseId: Id,
  patientId: Id,
  contatoId: Id,
  consentimentoVigenteRef: Id,
  tecnologia: z.enum(["TRANSCRICAO_LOCAL", "DEEPGRAM_COMANDO_CURTO"]),
  duracaoSegundos: z.number().positive().max(600),
  audioSha256Original: z.string().regex(/^[a-f0-9]{64}$/),
  transcricaoValidada: z.string().min(1).max(50_000),
  audioBrutoApagado: z.literal(true),
  apagadoEm: Instante,
}).strict();
export type RegistroVozAnamneseCanal = z.infer<typeof RegistroVozAnamneseCanal>;

/**
 * OncoChief (F5 / ORK-2) · Modo de revisão cruzada sob demanda sobre o OncoBoard existente + Harness.
 * Não possui serviço nem memória paralela; juiz LLM nunca aprova o que o código reprovou (assimetria A9).
 */
export const ResultadoRevisaoCruzadaOncoChief = z.object({
  schema: z.literal("ResultadoRevisaoCruzadaOncoChief@1"),
  revisaoId: Id,
  patientRef: Id,
  personasConsultadas: z.array(z.enum(["oncologista_clinico", "cirurgiao_oncologico", "radioterapeuta"])).min(1).max(3),
  pareceresPorPersona: z.array(z.object({
    persona: z.enum(["oncologista_clinico", "cirurgiao_oncologico", "radioterapeuta"]),
    resposta: z.string(),
    perguntas: z.array(z.string()),
    lacunas: z.array(z.string()),
    divergencias: z.array(z.string()),
    citacoes: z.array(z.object({ fonteId: Id, versao: Id, trecho: z.string() }).strict()),
  }).strict()),
  reprovacoesDeterministicasCodigo: z.array(z.string().min(1)),
  vereditoFinalCodigoPrevalece: z.enum(["APROVADO_PARA_REVISAO_MEDICA", "BLOQUEADO_POR_CODIGO"]),
  memoriaParalelaCriada: z.literal(false),
  servicoParaleloCriado: z.literal(false),
  tipo: z.literal("RASCUNHO_REVISAO_CRUZADA"),
  geradoEm: Instante,
}).strict().superRefine((r, ctx) => {
  if (r.reprovacoesDeterministicasCodigo.length > 0 && r.vereditoFinalCodigoPrevalece !== "BLOQUEADO_POR_CODIGO") {
    ctx.addIssue({
      code: "custom",
      path: ["vereditoFinalCodigoPrevalece"],
      message: "Assimetria A9: juiz/revisão LLM nunca aprova o que o código reprovou",
    });
  }
});
export type ResultadoRevisaoCruzadaOncoChief = z.infer<typeof ResultadoRevisaoCruzadaOncoChief>;
