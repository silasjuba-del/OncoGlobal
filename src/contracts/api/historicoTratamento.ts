
export interface FatoSistemico {
  readonly tipo: "SISTEMICO";
  readonly id: string;
  /** Data real da administração (YYYY-MM-DD). */
  readonly data: string;
  readonly ciclo: number | null;
  readonly protocolo: string | null;
  /** Dose relativa (%) somente quando confirmada no fato. */
  readonly doseRelativaPct: number | null;
  /** Data prevista do ciclo (YYYY-MM-DD); base do atraso. */
  readonly previstoEm: string | null;
  readonly observacao: string | null;
}

export interface FatoCirurgia {
  readonly tipo: "CIRURGIA";
  readonly id: string;
  readonly data: string;
  readonly procedimento: string | null;
  readonly observacao: string | null;
}

export interface FatoRadioterapia {
  readonly tipo: "RT";
  readonly id: string;
  readonly inicio: string;
  readonly fim: string | null;
  readonly fracoes: number | null;
  readonly doseTotalGy: number | null;
  readonly boost: string | null;
  readonly topografia: string | null;
  readonly medicoResponsavel: string | null;
  readonly local: string | null;
  readonly observacao: string | null;
}

export type FatoTratamento = FatoSistemico | FatoCirurgia | FatoRadioterapia;

export type EstadoLinha = "CONFIRMADO" | "PENDENTE";

export interface LinhaTratamento {
  readonly tipo: "SISTEMICO" | "CIRURGIA" | "RT";
  /** SISTEMICO e CIRURGIA: data do evento. RT: null. */
  readonly data: string | null;
  /** RT: período início–fim. Demais tipos: null. */
  readonly periodo: { readonly inicio: string; readonly fim: string | null } | null;
  /** SISTEMICO: protocolo. CIRURGIA: procedimento. RT: null. Vazio = PENDENTE. */
  readonly protocoloOuTipo: string | null;
  readonly ciclo: number | null;
  readonly doseRelativaPct: number | null;
  /** Real − previsto em dias; null quando algum dos dois falta. */
  readonly atrasoDias: number | null;
  readonly fracoes: number | null;
  readonly doseTotalGy: number | null;
  readonly boost: string | null;
  readonly topografia: string | null;
  readonly medicoResponsavel: string | null;
  readonly local: string | null;
  /** Texto do fato; string vazia quando o fato não traz observação. */
  readonly observacao: string;
  readonly origem: string;
  readonly estado: EstadoLinha;
  readonly pendencias: readonly string[];
}
