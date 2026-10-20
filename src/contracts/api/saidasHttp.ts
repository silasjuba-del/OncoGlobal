import { PropostasDoseReceitaResposta } from './propostaDoseReceita.js';
import { ListarEstudosRespostaSchema, EstudoServicoSchema, AvaliacaoEstudoRespostaSchema, SchemaFatosTrialsResposta } from "./trialsServico.js";
import { BasePrescricaoExecutavelResposta, PrescricaoExecutavelPreparada, PrescricaoExecutavelConfirmada } from "./operacaoPrescricaoExecutavel.js";
import { AcaoCompostaPreparada, BaseAcaoCompostaResposta } from "./execucaoAcaoComposta.js";
import { TimelineMulticamadasResposta } from "./timelineMulticamadas.js";
import {RespostaCanalPreparada,RespostaCanalConfirmada} from './respostaCanal.js';
import { z } from "zod";
import {DitadoResposta} from '../fase2/ditado.js';
import { RevisaoClinicaResposta } from '../fase2/revisaoClinica.js';
import { LotesPacienteResposta } from './lotes.js';
import { EstadoDoencaPreparado } from '../fase2/estadoDoenca.js';
import { Id, Instante } from "../base.js";
import { ClinicalFact, ReviewException } from "../w10/extracao.js";
import { ResultadoInstrumentoSchema } from "../f0c/resultadoInstrumento.js";
import { InvestigacaoConsultaVisao } from "./investigacao.js";
import { EstadoOncoassist, FontesOncoassist, HistoricoOncoassist, RespostaOncoassist } from "./oncoassist.js";
import { ReconciliacaoProposta, RevisaoPreparada } from "./revisaoExtracao.js";
import { SintesePropostaResposta } from "./sinteseProposta.js";
import { AcaoResposta, AgendaResposta, ApacResposta, BundleResposta, CanalResposta, ChatResposta,
  ConfirmacaoResposta, ConsultaResposta, FlashPreparadaResposta, FlashRascunhoResposta, SalaoResposta } from "./respostas.js";

const Count = z.number().int().nonnegative();
import { ContingenciaSalaoResposta, HistoricoContingenciaSalaoResposta } from "./salaoContingencia.js";
const JsonObjeto = z.record(z.string(), z.json());
const RefBiblioteca = z.object({ id: Id, versao: Id, hash: z.string().regex(/^[a-f0-9]{64}$/) }).nullable();
const Gravacao = z.object({ codigo: z.enum(["GRAVADA", "REPLAY"]), eventId: Id });
const ConfigGravada = z.object({ estado: z.enum(["GRAVADA", "REPLAY"]), revision: Count,
  alteracoes: z.array(JsonObjeto), proveniencia: z.literal("DECISAO_MEDICA").nullable() });
const ItemImportado = z.object({ schema: z.literal("ItemBiblioteca@1"), id: Id, versao: Id,
  pilar: z.number().int().min(1).max(8), tipo: z.enum(["REFERENCIA", "REGRA", "TRIAL"]), titulo: Id, texto: Id });
const PropostaLlm = z.object({ codigo: Id, draftId: Id, criaEventoClinico: z.literal(false) });
const Extracao = z.object({ draftId: Id, revision: Count, linkedPatientId: Id.nullable(),
  requiresMedicalReview: z.literal(true), facts: z.array(ClinicalFact), exceptions: z.array(ReviewException) });

/** Mesmos contratos no servidor e no cliente. Valida sem descartar campos adicionais da resposta legada. */
export const SaidasHttp: Readonly<Record<string, z.ZodType>> = {
  listarEstudosTrials: ListarEstudosRespostaSchema,
  importarEstudoTrial: EstudoServicoSchema,
  revisarEstudoTrial: EstudoServicoSchema,
  avaliarEstudoTrial: AvaliacaoEstudoRespostaSchema,
  fatosTrials: SchemaFatosTrialsResposta,
  basePrescricaoExecutavel: BasePrescricaoExecutavelResposta,
  prepararPrescricaoExecutavel: PrescricaoExecutavelPreparada,
  confirmarPrescricaoExecutavel: PrescricaoExecutavelConfirmada,
  baseAcaoComposta: BaseAcaoCompostaResposta,
  prepararAcaoComposta: AcaoCompostaPreparada,
  timelineMulticamadas: TimelineMulticamadasResposta,
  gerarContingenciaSalao: ContingenciaSalaoResposta, historicoContingenciaSalao: HistoricoContingenciaSalaoResposta,
  prepararRespostaCanal:RespostaCanalPreparada,confirmarRespostaCanal:RespostaCanalConfirmada,
  ditado:DitadoResposta,
  lotesPaciente:LotesPacienteResposta,
  login: z.object({ token: z.string().min(1), expiraEm: Instante }),
  carregarConsulta: ConsultaResposta, agenda: AgendaResposta, apac: ApacResposta, canal: CanalResposta,
  salao: SalaoResposta, salvarTriagemSalao: SalaoResposta, liberarSalao: SalaoResposta,
  vincularCanal: CanalResposta, chat: ChatResposta, bundle: BundleResposta, confirmar: ConfirmacaoResposta,
  acao: AcaoResposta, investigacao: InvestigacaoConsultaVisao,
  revisaoClinica: RevisaoClinicaResposta,
  prepararEstadoDoenca: EstadoDoencaPreparado,confirmarEstadoDoenca:Gravacao,
  avaliarInstrumento: z.object({ resultado: ResultadoInstrumentoSchema, gravado: z.literal(false), assinado: z.literal(false) }),
  oncoassistStatus: EstadoOncoassist, oncoassistFontes: FontesOncoassist, oncoassistClassificar: RespostaOncoassist,
  oncoassistHistorico: HistoricoOncoassist,
  sinteseRetratoLlm: SintesePropostaResposta, reconciliarRascunhos: ReconciliacaoProposta, prepararRevisao: RevisaoPreparada,
  proporDoseReceita: PropostasDoseReceitaResposta,
  rascunhoFlash: FlashRascunhoResposta, prepararFlash: FlashPreparadaResposta,
  selecionarContexto: z.object({ codigo: z.literal("CONTEXTO_SELECIONADO") }),
  reconciliarMedicamentos: Gravacao,
  proporPrescricao: z.object({ draftId: Id, revision: Count, revisao: Id, assina: z.literal(false), exporta: z.literal(false) }),
  rascunhoPrescricao: z.object({ draftId: Id, seguranca: z.object({ resultado: z.literal("NOT_EVALUABLE"),
    motivos: z.array(z.object({ codigo: Id, texto: Id, fonte: Id })) }), assina: z.literal(false), exporta: z.literal(false) }),
  extracaoLlm: PropostaLlm, documentoOriginalLlm: PropostaLlm,
  extrair: z.union([Extracao, z.object({codigo:z.literal("REPLAY"),draftId:Id,revision:Count,
    linkedPatientId:z.null(),requiresMedicalReview:z.literal(true)})]),
  upload: z.union([Extracao.extend({ codigo: z.literal("RASCUNHO_SALVO"), conversionStatus: z.enum(["PRONTO", "PENDENTE"]) }),
    z.object({ codigo: z.literal("REPLAY"), draftId: Id, revision: Count, linkedPatientId: Id.nullable(), requiresMedicalReview: z.literal(true) })]),
  rascunho: z.object({ draft: z.object({ draftId: Id, patientId: Id.nullable(), sourceId: Id, rawRef: Id,
    revision: Count, payload: z.json(), diagnostics: z.array(z.string()), criadoEm: Instante }) }),
  revisarRascunho: z.union([
    z.object({ codigo: z.literal("VINCULO_REVISTO"), draftId: Id, revision: Count, linkedPatientId: Id.nullable(), fatosConfirmados: z.literal(0), criaEventoClinico: z.literal(false) }),
    z.object({ codigo: z.enum(["GRAVADA", "REPLAY"]), draftId: Id, revision: Count, linkedPatientId: Id,
      encounterId: Id, factIds: z.array(Id), resultRef: Id, evolucaoRascunho: z.string(), revisaoMedica: z.object({ medicoId: Id, em: Instante }) }),
  ]),
  lerPerfil: z.object({ revision: Count, perfil: z.object({ medico: JsonObjeto, instituicao: JsonObjeto, preferencias: JsonObjeto, conexoes: JsonObjeto }) }),
  salvarPerfil: ConfigGravada, alterarCaixa: ConfigGravada,
  lerCaixa: z.object({ revision: Count, value: z.json() }),
  historicoConfig: z.object({ itens: z.array(z.object({ operationId: Id, revision: Count,
    tipo: z.literal("PROVISORIO-W10"), alteracoes: z.array(JsonObjeto), proveniencia: z.literal("DECISAO_MEDICA").nullable() })) }),
  recist: z.object({ estado: z.literal("PARCIAL"), series: z.array(z.object({ estado: Id, resultado: z.json().nullable() })) }),
  estatistica: z.object({ versao: Id, escopo: z.enum(["LEDGER_COMPLETO", "PERIODO_CLINICO"]), periodoClinico: JsonObjeto.nullable(),
    denominadorPacientes: Count, totalPacientes: Count, eventosPorCategoria: z.record(z.string(), Count), pacientesPorCategoria: z.record(z.string(), Count),
    documentosAssinados: Count, administracoesPorStatus: z.record(z.string(), Count), exclusoes: z.record(z.string(), Count) }),
  consultarConhecimento: z.object({ status: z.literal("OK"), modo: z.literal("LEXICAL"), algoritmo: z.literal("TOKEN_EXATO_NORMALIZADO"),
    corpus: z.object({ versao: Id, arquivos: z.array(JsonObjeto) }), vetorial: z.object({ status: z.literal("NOT_IMPLEMENTED") }),
    resultados: z.array(z.object({ referencia: JsonObjeto, scoreLexical: z.number().finite() })), topKAplicado: z.number().int().positive(), aviso: Id }),
  "/salao/revisar-relato-canal": Gravacao,
  "/farmacia/enviar": Gravacao, "/farmacia/conferir": Gravacao, "/salao/registrar-administracao": Gravacao,
  "/apac/validar-emissao": Gravacao, "/chat/aceitar-decisao": Gravacao, "/tarefas/receber": Gravacao, "/tarefas/concluir": Gravacao,
  "/biblioteca/importar": z.object({ codigo: z.literal("PACOTE_IMPORTADO_RASCUNHO"), pacoteId: Id, hash: z.string().regex(/^[a-f0-9]{64}$/) }),
  "/biblioteca/curar": z.object({ codigo: z.literal("ITEM_CURADO"), estado: z.enum(["CONSULTAVEL", "OBSOLETO"]), referencia: RefBiblioteca }),
  "/biblioteca/ativar": z.object({ codigo: z.literal("BIBLIOTECA_ATIVADA"), referencia: RefBiblioteca }),
  "/biblioteca/rollback": z.object({ codigo: z.literal("BIBLIOTECA_RESTAURADA"), referencia: RefBiblioteca }),
  "/biblioteca/consultar": z.object({ itens: z.array(ItemImportado), referencia: RefBiblioteca }),
  "/biblioteca/estado": z.object({ ativa: Id.nullable(), referencia: RefBiblioteca, pacoteId: Id.nullable(), hash: Id.nullable(),
    ativacao: z.object({ pacote: Id, anterior: Id.nullable(), motivo: z.enum(["ATIVACAO", "ROLLBACK"]), ator: Id.nullable(), registradoEm: Instante.nullable() }).nullable(),
    pacotes: z.array(z.object({ pacoteId: Id, versao: Id, hash: z.string().regex(/^[a-f0-9]{64}$/), ativo: z.boolean(),
      itens: z.array(z.object({ id: Id, estado: z.enum(["RASCUNHO", "CONSULTAVEL", "ALERTA", "OBSOLETO"]) })) })),
    itens: z.array(ItemImportado.extend({ titulo: z.string().min(1).max(300), texto: z.string().min(1).max(200000),
      aplicabilidade: z.object({ tumor: z.array(Id), histologia: z.array(Id), estadio: z.array(Id), biomarcador: z.array(Id), linha: z.array(Id) }),
      proveniencia: z.object({ fonte: z.string().url(), trecho: z.string().min(1).max(200000), publicadoEm: z.string().date(),
        recuperadoEm: Instante, licenca: z.string().min(1).max(300) }), dependencias: z.array(z.object({ id: Id, versao: Id })),
      estado: z.enum(["RASCUNHO", "CONSULTAVEL", "ALERTA", "OBSOLETO"]),
      curadoria: z.object({ ator: Id, registradoEm: Instante.nullable() }).nullable() })) }),
};

export function respostaHttpValida(rota: string, status: number, resultado: unknown): boolean {
  // Respostas negativas têm formatos de erro específicos; não são confundidas com saídas de sucesso.
  if (status < 200 || status >= 300) return true;
  const schema = SaidasHttp[rota];
  return schema !== undefined && schema.safeParse(resultado).success;
}
