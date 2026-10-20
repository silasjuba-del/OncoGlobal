import type { PropostaDoseReceita } from './propostaDoseReceita.js';
import type {PrepararRespostaCanal,ConfirmarRespostaCanal} from './respostaCanal.js';
import type {RascunhoRespostaCanal} from '../f2/caixaRespostaCanal.js';
import type { InvestigacaoConsultaVisao } from './investigacao.js';
import type { LotesPacienteResposta } from './lotes.js';
import type { RevisaoClinicaResposta } from '../fase2/revisaoClinica.js';
import type { PedidoEstadoDoenca,EstadoDoencaPreparado,ConfirmacaoEstadoDoenca } from '../fase2/estadoDoenca.js';
import type { DutosClinicaVisao } from './dutos.js';
import type { z } from "zod";
import type { EstadoOncoassist, FontesOncoassist, RespostaOncoassist } from "./oncoassist.js";
import type { Fonte } from "../base.js";
import type { Triagem, TumorLot } from "../clinico.js";
import type { Semaforo } from "../estados.js";
import { ActionIntent, type Alerta, type Apac, type ConfirmarBloco } from "../operacao.js";
import type { ContextoTriagem, SalaoRuleset } from "../regras.js";
import type { ChipEstoque } from "./estoque.js";
import type { EstadoFarmacia } from "./farmacia.js";
import type { DocumentoBundleVisao } from "./bundle.js";
import type { CabecalhoVisao } from "./cabecalho.js";
import type { AlvoImpressao } from "./impressao.js";
import type { PlanoFlash } from "./flash.js";
import type { ItemDeltaVisao } from "./delta.js";
import type { AfirmacaoVisao } from "./evidencia.js";
import type { CartaoSalaoVisao } from "./salao.js";
import type { DatasFixas } from "./datasFixas.js";
import type { LinhaTratamento } from "./historicoTratamento.js";
import type { AlertaPlaquetas } from "./plaquetasAlerta.js";
import type { SaidaElegibilidadeCiclo } from "./elegibilidadeCiclo.js";
import type { ResultadoInstrumento } from "../f0c/instrumentos.js";
import type { ApiBiblioteca } from "./biblioteca.js";

export type CodigoPorta = string;

export class ErroPorta extends Error {
  /** `detalhe`: código devolvido pelo servidor (sem dado clínico), para mostrar ao médico. */
  constructor(readonly codigo: CodigoPorta, readonly detalhe?: string) {
    super(codigo);
  }
}

export interface ResultadoLogin {
  ok: boolean;
  expiraEm: string | null;
}

export interface CaixaConfiguracaoFlash {
  revision: number;
  value: unknown | null;
}

export interface AlteracaoConfiguracaoFlash {
  estado: "GRAVADA" | "REPLAY";
  revision: number;
}

export interface ResultadoConfirmar {
  codigo: string;
  resultRef: string | null;
}

export interface ResultadoAcao {
  codigo: string;
  decisao: string | null;
}

export interface PedidoBundle {
  patientId: string;
  encounterId: string;
  tumorLotId: string | null;
  /** Seleção explícita de documentos para exibição; omitida usa o fechamento atual. */
  draftIds?: readonly string[];
}

export interface BundleExibidoVisao {
  patientId: string;
  encounterId: string;
  documentos: readonly DocumentoBundleVisao[];
}

/** W12-F3 (opcional): dados da Consulta Flash. Ausente = Flash sem exames, retorno PENDENTE e sem modelo padrão. */
export interface FlashVisao {
  exames: readonly { data: string; nome: string; fraseLaudo?: string; situacao: "DENTRO_DO_LIMITE" | "FORA_DO_LIMITE" | "SEM_REFERENCIA" }[];
  retornoDias: number | null;
  modeloPadraoSalvo: boolean;
  laboratorioPreMarcado: boolean;
  imagemPreMarcada: boolean;
  /** W12-F4 (opcional): rascunho da Flash já salvo (revisão corrente, para o próximo salvar). */
  rascunho?: { draftId: string; revision: number; plano?: PlanoFlash };
  protocolo?: string;
  cicloAtual?: number;
  ciclosPrevistos?: number;
  ultimoAdministrado?: string;
  alergia?: string;
  toxicidades?: readonly string[];
  avisos?: readonly string[];
  parciaisCumulativos?: readonly string[];
  sugestoesLaboratorio?: readonly string[];
  /** D-F1-33 · sugestões clínicas que nunca viram pedido nem trava (ex.: triagem nutricional NRS-2002). */
  sugestoesClinicas?: readonly string[];
  modeloSolicitacoes?: {laboratorio:string[];imagem:string[]};
  laboratorios?: readonly { data: string; nome: string; fraseLaudo?: string;
    situacao: "DENTRO_DO_LIMITE" | "FORA_DO_LIMITE" | "SEM_REFERENCIA" }[];
}

/** W12-F4: contexto da consulta + plano exibido. A porta só entrega; o servidor decide o que grava. */
export interface PedidoRascunhoFlash {
  patientId: string;
  encounterId: string;
  tumorLotId: string | null;
  plano: PlanoFlash;
  /** null = ainda não existe rascunho salvo para este contexto. */
  expectedRevision: number | null;
}

export interface ResultadoRascunhoFlash {
  codigo: "RASCUNHO_SALVO";
  draftId: string;
  revision: number;
}

export interface PedidoFinalizarFlash {
  patientId: string;
  encounterId: string;
  tumorLotId: string | null;
  plano: PlanoFlash;
  idempotencyKey: string;
}

/** Documentos em rascunho gerados do plano. Seguem para validar com exibição; nada está assinado ainda. */
export interface FlashPreparada {
  registros: readonly { id: string; expectedRevision: number }[];
  documentos: readonly { documentId: string; documentVersion: number; titulo: string; tipoDocumento: string }[];
  alvoImpressao: AlvoImpressao | null;
}

export interface ConsultaVisao {
  contatosCanal?: CaixaCanalVisao | undefined;
  dutos?: DutosClinicaVisao;
  instrumentosClinicos?: readonly {instrumento:string;avaliacao:ResultadoInstrumento}[];
  resumoEvolucao?: string | null;
  historicoDocumentos?: readonly { eventId: string; documentId: string; documentVersion: number; titulo: string;
    liberacaoPendente?:string|undefined; texto: string; assinadoEm: string; autorId: string; encounterId: string; tumorLotId: string | null }[];
  hoje: string;
  patientId: string;
  encounterId: string;
  tumorLotId: string | null;
  cabecalho: CabecalhoVisao;
  alertas: readonly Alerta[];
  delta: {
    temSnapshotAnterior: boolean;
    itens: readonly ItemDeltaVisao[];
  };
  evidencias: readonly AfirmacaoVisao[];
  fechamento: {
    blocoAtual: Exclude<ConfirmarBloco["bloco"], "TUDO">;
    registros: ConfirmarBloco["registros"];
    documentos: readonly DocumentoBundleVisao[];
    autorExibido: string;
    alvoImpressao: AlvoImpressao | null;
    alertasVermelhos: readonly Alerta[];
  };
  /** W11-H22 (opcionais): calculados no servidor. Ausente = PENDENTE; campo nunca vira verde por omissão. */
  datasFixas?: DatasFixas;
  historicoTratamento?: {
    linhas: readonly LinhaTratamento[];
    estado: "PARCIAL" | "PENDENTE";
    codigo: string | null;
  };
  /** null = limiar de plaquetas não configurado no corpus (PENDENTE na tela). */
  alertaPlaquetas?: AlertaPlaquetas | null;
  elegibilidade?: SaidaElegibilidadeCiclo;
  /** W12-F3 (opcional): dados da Consulta Flash. */
  flash?: FlashVisao;
  /** W12-F3 (opcional): retrato transversal do tumor-índice (contrato RetratoTransversal, validado pelo cartão). Ausente = sem cartão. */
  retratoTransversal?: unknown;
}

export interface PedidoUploadLocal {patientId:string;encounterId:string;tumorLotId:string|null;id:string;sourceId:string;
  sourceType:"pathology"|"imaging_report"|"prescription"|"medical_note"|"nursing"|"lab_feed";
  tipo:"PDF"|"IMAGEM";bytesBase64:string}
export interface ResultadoUploadLocal {codigo:"RASCUNHO_SALVO"|"REPLAY";draftId:string;revision:number;
  linkedPatientId:string|null;requiresMedicalReview:true;conversionStatus?:"PRONTO"|"PENDENTE";motivo?:string|null;
  paginasPendentes?:number[];totalPaginas?:number|null}

export interface PedidoTranscricaoLocal {
  contexto: PedidoBundle; recordingId: string; sourceId: string; sourceType: "medical_note";
  rawTranscript: string; captureMethod: "LOCAL_DICTATION" | "DEEPGRAM_CLOUD" | "PASTED_TEXT"; capturedTranscript: string;
}
export interface ResultadoTranscricaoLocal {
  codigo: "RASCUNHO_SALVO" | "REPLAY"; draftId: string; revision: number; linkedPatientId: null; requiresMedicalReview: true;
}

export interface ItemAgendaVisao {
  horario: string;
  patientId: string;
  encounterId?: string | undefined;
  nome: string;
  prontuario: string;
  semaforo: Semaforo;
  pendentes: number;
  preConsultaPronta: boolean;
  contatosDesdeUltima: number;
  temE1: boolean;
}

export interface AgendaVisao {
  hoje: string;
  itens: readonly ItemAgendaVisao[];
}

export interface PacienteTriagemVisao {
  patientId: string;
  encounterId: string;
  chegadaEm: string;
  nome: string;
  draftId?: string | null | undefined;
  revision?: number | null | undefined;
  estadoRascunho?: "RASCUNHO" | "DECISAO_REGISTRADA" | null | undefined;
}

export interface DecisaoLiberacaoVisao {
  patientId: string;
  motivo: string;
}

export interface SalaoVisao {
  relatosInfusao?: readonly {patientId:string;mensagemId:string;payloadSha256:string;texto:string;em:string;
    contextosRevisao?:readonly {patientId:string;encounterId:string;tumorLotId:null}[]|undefined;
    contextoMensagens:readonly {mensagemId:string;texto:string;em:string;contatoId?:string|undefined;canal?:string|undefined}[]}[] | undefined;
  avisos?: readonly {patientId:string;texto:string}[];
  hoje: string;
  ruleset: SalaoRuleset;
  contexto: ContextoTriagem;
  fonte: Fonte | null;
  cartoes: readonly CartaoSalaoVisao[];
  pacientes: readonly PacienteTriagemVisao[];
  decisoes: readonly DecisaoLiberacaoVisao[];
}

export interface CandidatoVinculoVisao {
  patientId: string;
  nome: string;
  encounterId?: string | undefined;
  tumorLotId?: string | null | undefined;
}

export interface MensagemCanalVisao {
  contextosResposta?:readonly {patientId:string;encounterId:string;tumorLotId:string|null}[]|undefined;
  mensagemId: string;
  texto: string;
  em: string;
  redFlag: boolean;
  contatoId: string;
  patientId: string | null;
  estadoVinculo?: "VINCULADO" | "SEM_VINCULO" | "CONFLITO" | "REVOGADO" | undefined;
  nomePaciente: string | null;
  candidatos: readonly CandidatoVinculoVisao[];
  origemCanal?: "WHATSAPP_SERVICO" | "WHATSAPP_PESSOAL" | "EMAIL" | "TELEFONE" | undefined;
  pendenciaProcessamento?: boolean | undefined;
  reciboTecnico?: "RECEBIDA" | "PROCESSADA" | "ENVIADA" | "ENTREGUE" | "LIDA" | "FALHOU" | undefined;
  estadoConversa?: "NOVA" | "TRIADA" | "AGUARDA_MEDICO" | "RESPONDIDA" | "ENCERRADA" | undefined;
  midia?: {
    providerMediaId: string;
    mimeType: string | null;
    processamento: "NAO_PROCESSADA" | "LIDA_LOCALMENTE";
  } | null | undefined;
  destinatarioExibido?: string | undefined;
  contextoExibido?: {
    patientId: string | null;
    encounterId: string | null;
    versaoContexto?: number | undefined;
  } | undefined;
}

export interface CaixaCanalVisao {
  mensagens: readonly MensagemCanalVisao[];
}

export type CampoOrigemApac = "estadiamentos" | "histologia" | "topografia" | "cid" | null;

export interface ItemApacVisao {
  antiglosa?: import("../../contracts/w10/clinico-w10.js").VereditoAntiglosa | null;
  antiglosaEstado?: string;
  apac: Apac;
  lote: TumorLot;
  nomePaciente: string;
  patientId: string;
  encounterId: string;
  ultimoAvisoEm: string | null;
  campoOrigem: CampoOrigemApac;
  motivoNegativa: string | null;
}

export interface LotesApacVisao {
  hoje: string;
  itens: readonly ItemApacVisao[];
}

export type SetorChat = "TRIAGEM" | "FARMACIA" | "SECRETARIA" | "MEDICO";

export interface MensagemChatVisao {
  mensagemId: string;
  autor: string;
  texto: string;
}

export interface PrescricaoChatVisao {
  conteudoPrescricaoId: string;
  estado: EstadoFarmacia;
  texto: string;
  proposta: string | null;
  chip: ChipEstoque;
}

export interface ChatSetorVisao {
  setor: SetorChat;
  patientId: string;
  encounterId: string;
  mensagens: readonly MensagemChatVisao[];
  prescricao: PrescricaoChatVisao | null;
}

export interface PortaConsulta {
  ditado?(pedido:import('../fase2/ditado.js').DitadoPedido,signal?:AbortSignal):Promise<import('../fase2/ditado.js').DitadoResposta>;
  lotesPaciente?(patientId:string,signal?:AbortSignal):Promise<LotesPacienteResposta>;
  /** Biblioteca pública autenticada com a mesma sessão desta porta, quando suportada pelo servidor. */
  biblioteca?: ApiBiblioteca;
  reconciliarMedicamentos?(pedido: {patientId:string;encounterId:string;tumorLotId:string|null;operationId:string;medicamentos:string[];listaAtualCompleta:true}, signal?:AbortSignal):Promise<{codigo:"GRAVADA"|"REPLAY";eventId:string}>;
  sintetizarRetrato?(contexto: { patientId: string; encounterId: string; tumorLotId: string | null; idempotencyKey: string }, signal?: AbortSignal): Promise<import("./sinteseProposta.js").SintesePropostaResposta>;
  investigacao?(contexto: PedidoBundle, signal?: AbortSignal): Promise<InvestigacaoConsultaVisao>;
  avaliarInstrumento?(contexto:{patientId:string;encounterId:string;tumorLotId:string|null},pedido:unknown):Promise<ResultadoInstrumento>;
  uploadDocumentoLocal?(pedido:PedidoUploadLocal,signal?:AbortSignal):Promise<ResultadoUploadLocal>;
  revisaoClinica?(contexto:PedidoBundle,packId?:string,signal?:AbortSignal):Promise<RevisaoClinicaResposta>;
  prepararEstadoDoenca?(pedido:PedidoEstadoDoenca,signal?:AbortSignal):Promise<EstadoDoencaPreparado>;
  confirmarEstadoDoenca?(pedido:ConfirmacaoEstadoDoenca,signal?:AbortSignal):Promise<{codigo:"GRAVADA"|"REPLAY";eventId:string}>;
  importarTranscricaoLocal?(pedido:PedidoTranscricaoLocal,signal?:AbortSignal):Promise<ResultadoTranscricaoLocal>;
  /** Configuração global autenticada; ausente quando a porta não oferece persistência. */
  lerCaixaConfiguracao?(numero: number): Promise<CaixaConfiguracaoFlash>;
  alterarCaixaConfiguracao?(pedido: { numero: number; valorNovo: unknown; expectedRevision: number; operationId: string }): Promise<AlteracaoConfiguracaoFlash>;
  carregarFonteRevisao?(draftId: string, signal?: AbortSignal): Promise<import("./revisaoExtracao.js").FonteRevisao>;
  vincularFonteRevisao?(pedido: { exceptionId: string; acao: "LIGAR_PACIENTE"; patientId: string;
    sourceId: string; draftId: string; expectedRevision: number; encounterId: string;
    tumorLotId: string | null; idempotencyKey: string }, signal?: AbortSignal): Promise<{ codigo: "VINCULO_REVISTO"; revision: number }>;
  reconciliarFontes?(draftIds: readonly string[], signal?: AbortSignal): Promise<import("./revisaoExtracao.js").ReconciliacaoProposta>;
  prepararRevisaoExtracao?(pedido: import("./revisaoExtracao.js").PedidoRevisaoExtracao, signal?: AbortSignal): Promise<import("./revisaoExtracao.js").RevisaoPreparada>;
  confirmarRevisaoExtracao?(pedido: import("./revisaoExtracao.js").PedidoRevisaoExtracao, signal?: AbortSignal): Promise<{ codigo: "GRAVADA" | "REPLAY" }>;
  /** W12-F4: SALVAR RASCUNHO da Flash. Grava rascunho, nunca assina. */
  salvarRascunhoFlash?(pedido: PedidoRascunhoFlash, signal?: AbortSignal): Promise<ResultadoRascunhoFlash>;
  /** W12-F4: FINALIZAR, passo 1. Gera os documentos em rascunho; a assinatura é validar com exibição. */
  prepararFinalizacaoFlash?(pedido: PedidoFinalizarFlash, signal?: AbortSignal): Promise<FlashPreparada>;
  oncoassistStatus?(signal?: AbortSignal): Promise<EstadoOncoassist>;
  oncoassistFontes?(contexto: PedidoBundle, signal?: AbortSignal): Promise<{
    fontes: FontesOncoassist["fontes"];
    fontesSemVinculo?: FontesOncoassist["fontesSemVinculo"] | undefined;
  }>;
  oncoassistClassificar?(pedido: PedidoBundle & { draftId: string; operationId?: string }, signal?: AbortSignal): Promise<RespostaOncoassist>;
  oncoassistHistorico?(contexto: PedidoBundle, signal?: AbortSignal): Promise<import("./oncoassist.js").HistoricoOncoassist>;
  login(senha: string): Promise<ResultadoLogin>;
  confirmar(bloco: ConfirmarBloco): Promise<ResultadoConfirmar>;
  acao(intent: AcaoIntent): Promise<ResultadoAcao>;
  /** POST /consulta/bundle — registra conteúdo/hash antes de confirmar. */
  exibirBundle(pedido: PedidoBundle): Promise<BundleExibidoVisao>;
  carregarConsulta(patientId: string, tumorLotId?: string | null, encounterId?: string): Promise<ConsultaVisao>;
  // [SERVIDOR_PENDENTE]
  agendaDoDia(): Promise<AgendaVisao>;
  // [SERVIDOR_PENDENTE]
  proporDoseReceita?(contexto:{patientId:string;encounterId:string;tumorLotId:string|null},medicamento:string):Promise<readonly PropostaDoseReceita[]>;
  filaSalao(): Promise<SalaoVisao>;
  gerarContingenciaSalao?(pedido: import("./salaoContingencia.js").GerarContingenciaSalao): Promise<import("../f3/salaoOperacional.js").FolhaContingenciaSalao>;
  historicoContingenciaSalao?(contexto: { patientId: string; encounterId: string }): Promise<import("../f3/salaoOperacional.js").FolhaContingenciaSalao[]>;
  revisarRelatoInfusao?(entrada:{contexto:{patientId:string;encounterId:string;tumorLotId:string|null;operationId:string};mensagemId:string;payloadSha256:string;decisao:string}):Promise<unknown>;
  // [SERVIDOR_PENDENTE]
  salvarTriagem(triagem: Triagem, expectedRevision?: number | null): Promise<SalaoVisao>;
  // [SERVIDOR_PENDENTE]
  liberarComCorte(patientId: string, motivo: string, contexto?: { encounterId: string; expectedRevision: number;
    idempotencyKey: string }): Promise<SalaoVisao>;
  selecionarContexto?(contexto: { patientId: string; encounterId: string; tumorLotId: string | null }): Promise<void>;
  // [SERVIDOR_PENDENTE]
  caixaCanal(): Promise<CaixaCanalVisao>;
  prepararRespostaCanal?(pedido:PrepararRespostaCanal):Promise<RascunhoRespostaCanal>;
  confirmarRespostaCanal?(pedido:ConfirmarRespostaCanal):Promise<{respostaId:string;versao:number}>;
  // [SERVIDOR_PENDENTE] o médico escolhe o candidato; a porta não liga por nome
  pedirVinculo(contatoId: string, patientId: string): Promise<CaixaCanalVisao>;
  // [SERVIDOR_PENDENTE]
  lotesApac(): Promise<LotesApacVisao>;
  // [SERVIDOR_PENDENTE]
  chatSetor(setor: SetorChat): Promise<ChatSetorVisao>;
}

export type AcaoIntent = z.infer<typeof ActionIntent>;
