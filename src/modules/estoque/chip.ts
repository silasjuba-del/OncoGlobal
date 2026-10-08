// GRK-07 · Chip de estoque. Informa; não trava; não sugere troca. Leitura velha → DESCONHECIDO.
import { diferencaDiasCivis, fonteInformada } from "../base.js";

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

export function avaliarChip(
  leitura: LeituraEstoque | null,
  hoje: string,
  validade: ValidadeChip | null,
): ChipEstoque {
  if (leitura === null) return desconhecido(null, null, "sem leitura de estoque");
  if (leitura.origem.trim().length === 0) return desconhecido(null, leitura.data, "leitura sem origem");
  if (validade === null || !fonteInformada(validade.fonte) || !Number.isInteger(validade.dias) || validade.dias < 0) {
    return desconhecido(leitura.origem, leitura.data, "[VERIFICAR] validade do chip sem fonte");
  }
  const idade = diferencaDiasCivis(leitura.data, hoje);
  if (idade === null) return desconhecido(leitura.origem, leitura.data, "data da leitura ou hoje inválido");
  if (idade < 0) return desconhecido(leitura.origem, leitura.data, "data da leitura posterior a hoje");
  if (idade > validade.dias) return desconhecido(leitura.origem, leitura.data, "dado velho");
  return {
    estado: leitura.estado,
    origem: leitura.origem,
    data: leitura.data,
    trava: false,
    sugereTroca: false,
    motivo: leitura.estado === "DISPONIVEL" ? "estoque informado como disponível" : "estoque informado como indisponível",
  };
}

function desconhecido(origem: string | null, data: string | null, motivo: string): ChipEstoque {
  return { estado: "DESCONHECIDO", origem, data, trava: false, sugereTroca: false, motivo };
}
