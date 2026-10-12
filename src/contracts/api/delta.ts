import type { Semaforo, DeltaKind, DeltaDirecao } from '../estados.js';

export interface ItemDeltaVisao {
  id: string;
  rotulo: string;
  kind: DeltaKind;
  estado: Semaforo;
  direcao?: DeltaDirecao;
  candidatos?: readonly { rotulo: string; valorTexto: string }[];
}
