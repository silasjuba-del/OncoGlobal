import type { ClasseMedicacao } from "../w10/prescricao.js";

export interface TrechoFonte { inicio: number; fim: number; texto: string }
export interface CriterioUsado {
  tipo: string; grau: number; criterioLiteral: string; fonteTrecho: string; trecho: TrechoFonte;
}
export interface LeituraQuantidade {
  leitura: "POR_DIA" | "NO_TOTAL"; quantidade: number; periodoDias: number | null;
  grau: number | null; criterioLiteral: string | null; trecho: TrechoFonte;
}
export interface ResultadoCtcaeClinico {
  termo: string | null; grauSugerido: number | null; criteriosUsados: CriterioUsado[];
  criteriosFaltantes: { pergunta: string }[]; ambiguidades: LeituraQuantidade[];
  status: "SUGESTAO" | "PENDENTE"; sugestao: true; confirmadoPeloMedico: false;
  bloqueiaSalvar: false; destino: "FILA_MEDICO" | null; e1: boolean; rulesetVersao: string;
}

export interface MedicamentoRetorno { nome: string; classe: ClasseMedicacao | null }
export interface EntradaRetornoToxicidade {
  pacienteId: string; grau: number | null; plaquetas: number | null; dataPlaquetas: string | null;
  horasDiarreia: number | null; vomito: boolean | null;
  medicamentos: readonly (string | MedicamentoRetorno)[] | null; dm2: boolean | null; tempDecimos: number | null;
}
export interface ResultadoRetornoToxicidade {
  pacienteId: string; destino: "FILA_MEDICO" | "SEM_FILA";
  motivos: { codigo: string; texto: string }[];
  alertas: { codigo: string; texto: string; bloqueiaSalvar: false; alteraFila: false; defineDose: false; defineCausalidade: false }[];
  pendencias: { codigo: string; texto: string }[];
  bloqueiaSalvar: false; confirmadoPeloMedico: false; sugestao: true;
}

export interface ResultadoIntervaloPosQt {
  estado: "PASSA" | "AVISO" | "PENDENTE" | "NAO_APLICA"; dias: number | null; motivo: string;
  bloqueiaSalvar: false; trava: false; rulesetVersao: string; fuso: string;
}
export interface RespostaCanal {
  id: string; termo: string; texto: string; status: string; alertaMedico: true;
  bloqueiaSalvar: false; defineDose: false; defineCausalidade: false;
}
export interface ResultadoCanal {
  estado: "ALERTA" | "SEM_ALERTA"; respostas: RespostaCanal[]; alertaMedico: boolean;
  bloqueiaSalvar: false; rulesetVersao: string;
}
export interface LeituraValorAtual { valor: number; data: string; hora: string | null }
export interface ResultadoValorAtual {
  estado: "ATUAL" | "PENDENTE" | "CONFLITO"; valorAtual: number | null;
  serie: LeituraValorAtual[]; candidatos: LeituraValorAtual[]; dadoAntigo: LeituraValorAtual | null;
  bloqueiaSalvar: false;
}
export interface EntradaVertigem { tontura: boolean | null; historicoAnterior: boolean | null; inicioNovo: boolean | null }
