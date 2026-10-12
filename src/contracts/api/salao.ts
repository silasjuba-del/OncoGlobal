import type { EntradaFila } from '../regras.js';
import type { Destino } from '../estados.js';

export interface CartaoSalaoVisao {
  entrada: EntradaFila;
  destino: Destino;
  emergencia: boolean;
  temCorte: boolean;
  nome: string;
}
