import type { Semaforo, RevisaoConfirmada, DeltaKind, Secao } from '../contracts/dominoBase.js';
export type { Semaforo, RevisaoConfirmada, DeltaKind, Secao } from '../contracts/dominoBase.js';
// Tipos mínimos da linha src/modules. Sem I/O, sem relógio, sem dado clínico embutido.










export function secaoVazia<T>(motivo: string): Secao<T> {
  return { estado: "PENDENTE", motivo, itens: [] };
}

export function secaoDe<T>(estado: Semaforo, motivo: string, itens: readonly T[]): Secao<T> {
  return { estado, motivo, itens: [...itens] };
}

/** Dias civis (ate − de). Data inválida → null. Não lê relógio. */
export { diferencaDiasCivis } from "./datas.js";

export function fonteInformada(fonte: string | null | undefined): boolean {
  return typeof fonte === "string" && fonte.trim().length > 0;
}

