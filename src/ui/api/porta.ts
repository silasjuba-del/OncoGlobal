import type { z } from "zod";
import type { Fonte } from "../../contracts/base.js";
import type { Triagem, TumorLot } from "../../contracts/clinico.js";
import type { Semaforo } from "../../contracts/estados.js";
import { ActionIntent, type Alerta, type Apac, type ConfirmarBloco } from "../../contracts/operacao.js";
import type { ContextoTriagem, SalaoRuleset } from "../../contracts/regras.js";
import type { ChipEstoque } from "../../modules/estoque/chip.js";
import type { EstadoFarmacia } from "../../modules/farmacia/estados.js";
import type { DocumentoBundleVisao } from "../consulta/Bundle.js";
import type { CabecalhoVisao } from "../consulta/viewmodels.js";
import type { AlvoImpressao } from "../consulta/BarraFechamento.js";
import type { ItemDeltaVisao } from "../consulta/PainelDelta.js";
import type { AfirmacaoVisao } from "../evidencia/CardEvidencia.js";
import type { CartaoSalaoVisao } from "../salao/QuadroSalao.js";

export type CodigoPorta =
  | "SESSAO_EXPIRADA"
  | "SERVIDOR_PENDENTE"
  | "PAYLOAD_INVALIDO"
  | "PACIENTE_AUSENTE";

export class ErroPorta extends Error {
  constructor(readonly codigo: CodigoPorta) {
    super(codigo);
  }
}

export interface ResultadoLogin {
  ok: boolean;
  expiraEm: string | null;
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
}

export interface BundleExibidoVisao {
  patientId: string;
  encounterId: string;
  documentos: readonly DocumentoBundleVisao[];
}

export interface ConsultaVisao {
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
}

export interface ItemAgendaVisao {
  horario: string;
  patientId: string;
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
}

export interface DecisaoLiberacaoVisao {
  patientId: string;
  motivo: string;
}

export interface SalaoVisao {
  hoje: string;
  ruleset: SalaoRuleset;
  contexto: ContextoTriagem;
  fonte: Fonte;
  cartoes: readonly CartaoSalaoVisao[];
  pacientes: readonly PacienteTriagemVisao[];
  decisoes: readonly DecisaoLiberacaoVisao[];
}

export interface CandidatoVinculoVisao {
  patientId: string;
  nome: string;
}

export interface MensagemCanalVisao {
  mensagemId: string;
  texto: string;
  em: string;
  redFlag: boolean;
  contatoId: string;
  patientId: string | null;
  nomePaciente: string | null;
  candidatos: readonly CandidatoVinculoVisao[];
}

export interface CaixaCanalVisao {
  mensagens: readonly MensagemCanalVisao[];
}

export type CampoOrigemApac = "estadiamentos" | "histologia" | "topografia" | "cid" | null;

export interface ItemApacVisao {
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
  login(senha: string): Promise<ResultadoLogin>;
  confirmar(bloco: ConfirmarBloco): Promise<ResultadoConfirmar>;
  acao(intent: AcaoIntent): Promise<ResultadoAcao>;
  /** POST /consulta/bundle — registra conteúdo/hash antes de confirmar. */
  exibirBundle(pedido: PedidoBundle): Promise<BundleExibidoVisao>;
  carregarConsulta(patientId: string): Promise<ConsultaVisao>;
  // [SERVIDOR_PENDENTE]
  agendaDoDia(): Promise<AgendaVisao>;
  // [SERVIDOR_PENDENTE]
  filaSalao(): Promise<SalaoVisao>;
  // [SERVIDOR_PENDENTE]
  salvarTriagem(triagem: Triagem): Promise<SalaoVisao>;
  // [SERVIDOR_PENDENTE]
  liberarComCorte(patientId: string, motivo: string): Promise<SalaoVisao>;
  // [SERVIDOR_PENDENTE]
  caixaCanal(): Promise<CaixaCanalVisao>;
  // [SERVIDOR_PENDENTE] o médico escolhe o candidato; a porta não liga por nome
  pedirVinculo(contatoId: string, patientId: string): Promise<CaixaCanalVisao>;
  // [SERVIDOR_PENDENTE]
  lotesApac(): Promise<LotesApacVisao>;
  // [SERVIDOR_PENDENTE]
  chatSetor(setor: SetorChat): Promise<ChatSetorVisao>;
}

export type AcaoIntent = z.infer<typeof ActionIntent>;
