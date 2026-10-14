import type { Semaforo } from "./estados.js";

export type { Semaforo } from "./estados.js";

export type RevisaoConfirmada = "CONFIRMADO" | "ASSINADO";

export type { DeltaKind } from "./estados.js";

export interface Secao<T> {
  estado: Semaforo;
  motivo: string;
  itens: T[];
}
