import type { EstadoRun } from "../contracts/estados.js";

export interface Passo {
  id: string;
  dependsOn: readonly string[];
  timeoutMs: number;
}
export type PoliticaConclusao =
  | { tipo: "RECONCILIADOR"; passoId: string }
  | { tipo: "ALGUM_TERMINAL" | "TODOS_TERMINAIS" };
export interface Plano {
  evento: string;
  passos: readonly Passo[];
  /** Ausência preserva o contrato legado; a posição do passo no array não é autoridade. */
  conclusao?: PoliticaConclusao;
}
export type FalhaAgente = "missing" | "error" | "unattempted";
export type ResultadoPasso =
  | { id: string; resultado: "ok"; saida: unknown; tentativas: number }
  | { id: string; resultado: FalhaAgente; motivo: string; tentativas: number };
export interface RunOrk {
  estado: EstadoRun;
  etapa: string;
  resultados: ResultadoPasso[];
  /** Evidência técnica do JOIN, sem conteúdo clínico nem autorização de liberação. */
  diagnosticoConclusao?: DiagnosticoConclusao;
}
export interface DiagnosticoConclusao {
  politica: PoliticaConclusao;
  criterioAtendido: boolean;
  passosEsperados: string[];
  passosComSucesso: string[];
  terminais: string[];
  falhas: { id: string; resultado: FalhaAgente; motivo: string }[];
  reconciliacao: "NAO_APLICAVEL" | "VALIDA" | "AUSENTE_OU_FALHOU" | "SAIDA_INVALIDA" | "COBERTURA_INCOMPLETA";
}
export type AgenteFake = (contexto: Readonly<{ evento: string; resultados: readonly ResultadoPasso[]; signal?: AbortSignal }>)
  => Promise<unknown>;

export interface OpcoesOrk {
  onTimeout?: (id: string) => void;
  aoDescartarTardio?: (id: string) => void;
}
