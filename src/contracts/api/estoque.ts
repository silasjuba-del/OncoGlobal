
export type EstadoChip = "DISPONIVEL" | "INDISPONIVEL" | "DESCONHECIDO";

export interface LeituraEstoque {
  origem: string;
  data: string;
  estado: "DISPONIVEL" | "INDISPONIVEL";
}

export interface ValidadeChip {
  dias: number;
  fonte: string;
}

export interface ChipEstoque {
  estado: EstadoChip;
  origem: string | null;
  data: string | null;
  trava: false;
  sugereTroca: false;
  motivo: string;
}
