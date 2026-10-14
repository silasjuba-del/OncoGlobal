import type { MarcacaoTarefasRetorno } from './tarefas.js';

export type SituacaoExame = "DENTRO_DO_LIMITE" | "FORA_DO_LIMITE" | "SEM_REFERENCIA";

export interface ExameRecenteFlash { data: string; nome: string; fraseLaudo?: string; situacao: SituacaoExame }

export interface ItemFlash { id: string; rotulo: string; origem: "MODELO_MEDICO" | "SUGESTAO"; preMarcado: boolean }

export type EstadoApacFlash = "VALIDA" | "PENDENTE" | "INCOMPATIVEL";

export interface ApacFlash { cid: string; sigtap: string; finalidade: string; competencia: string; estado: EstadoApacFlash; pendencias: readonly string[] }

export interface RetornoFlash { dias: number | null; motivo?: string; examesAntesDoRetorno: readonly string[] }

export interface TarefasRetornoFlash { modeloPadraoSalvo: boolean; retorno: ItemFlash; laboratorio: ItemFlash; imagem: ItemFlash }

export interface ConsultaFlashProps {
  cabecalho: { diagnostico?: string; tnm?: string; estadio?: string; biomarcador?: string; antecedentes?: string; medicacoesUso?: string; alergia?: string; ecog?: string; tratamentoAtual?: string; linha?: string; cicloDia?: string; ultimoAdministrado?: string };
  exames: readonly ExameRecenteFlash[];
  laboratorios?: readonly ExameRecenteFlash[];
  toxicidades?: readonly string[];
  avisos?: readonly string[];
  parciaisCumulativos?: readonly string[];
  sugestoesLaboratorio?: readonly string[];
  pacienteNome?: string;
  hoje?: string;
  planoInicial?: PlanoFlash;
  modeloSolicitacoes?: {laboratorio:string[];imagem:string[]};
  acoesHoje: readonly ItemFlash[]; receitas: readonly ItemFlash[]; apac: ApacFlash; iaFala: readonly string[]; retorno: RetornoFlash;
  tarefasRetorno?: TarefasRetornoFlash; linhaPontualizada?: boolean;
  aoSalvarRascunho: (plano: PlanoFlash) => void; aoFinalizar: (plano: PlanoFlash) => void;
  aoAbrirApac?: () => void; ocupado?: boolean; rotuloFinalizar?: string;
}

export interface PlanoFlash {
  acoesMarcadas: readonly string[]; receitasMarcadas: readonly string[];
  receitas?: readonly ReceitaManualFlash[];
  apac: ApacFlash & { emitir: false }; retorno: RetornoFlash; tarefasRetorno?: MarcacaoTarefasRetorno;
  solicitacoes?: { laboratorio: string[]; imagem: string[] };
  decisaoQt?: { solicitarCiclo: boolean; data: string | null };
}
export interface ReceitaManualFlash {id:string;medicamento:string;dose:string|null;orientacao:string|null;duracao:string|null;via:string|null;quantidade:string|null}
