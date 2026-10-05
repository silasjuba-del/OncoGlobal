import type { EstadoRun } from "../contracts/estados.js";

export interface Passo {
  id: string;
  dependsOn: readonly string[];
  timeoutMs: number;
}
export interface Plano { evento: string; passos: readonly Passo[] }
export type FalhaAgente = "missing" | "error" | "unattempted";
export type ResultadoPasso =
  | { id: string; resultado: "ok"; saida: unknown; tentativas: number }
  | { id: string; resultado: FalhaAgente; motivo: string; tentativas: number };
export interface RunOrk {
  estado: EstadoRun;
  etapa: string;
  resultados: ResultadoPasso[];
}
export type AgenteFake = (contexto: Readonly<{ evento: string; resultados: readonly ResultadoPasso[] }>)
  => Promise<unknown>;
