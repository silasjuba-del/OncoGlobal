// AG-06 · Trecho riscado e baixa confiança (lições R1, C1)
// Regras puras: sem I/O, sem Date.now, sem Math.random.
// Campo com riscado: true ou confianca abaixo do limiar → PENDENTE com motivo e recorteRef.
// O limiar de confiança NÃO é fixado no código: vem injetado por parâmetro (ruleset [VERIFICAR]).

import type { Semaforo } from "../../contracts/estados.js";

export interface EntradaCampoExtraido {
  valor: unknown;
  riscado?: boolean;
  confianca?: number;
  recorteRef?: string | null;
}

export interface ConfigRasura {
  /** [VERIFICAR ruleset]: Limiar mínimo de confiança injetado por parâmetro, nunca chumbado */
  limiarConfiancaMinima: number;
}

export interface SaidaAvaliacaoRasura {
  valor: unknown | null;
  estado: Semaforo;
  motivo: string;
  recorteRef: string | null;
  pendenteRevisao: boolean;
}

/**
 * R1/C1: Avalia se o campo extraído possui rasura manual ou baixa confiança de captura.
 * Se houver rasura ou confiança inferior ao limiar do ruleset, o valor é anulado
 * e marcado como PENDENTE com referência ao recorte para inspeção médica humana.
 */
export function avaliarRasuraEConfianca(
  campo: EntradaCampoExtraido,
  config: ConfigRasura,
): SaidaAvaliacaoRasura {
  const recorte = campo.recorteRef ?? null;

  // R1: Texto riscado à mão
  if (campo.riscado === true) {
    return {
      valor: null,
      estado: "PENDENTE",
      motivo: "trecho riscado à mão: não usar sem revisão médica (R1)",
      recorteRef: recorte,
      pendenteRevisao: true,
    };
  }

  // C1: Baixa confiança de OCR/visão comparada ao limiar injetado
  if (
    campo.confianca !== undefined &&
    campo.confianca !== null &&
    campo.confianca < config.limiarConfiancaMinima
  ) {
    return {
      valor: null,
      estado: "PENDENTE",
      motivo: `baixa confiança de extração (${campo.confianca} < limiar ${config.limiarConfiancaMinima}): requer conferência médica (C1)`,
      recorteRef: recorte,
      pendenteRevisao: true,
    };
  }

  // Campo sem valor
  if (campo.valor === null || campo.valor === undefined) {
    return {
      valor: null,
      estado: "PENDENTE",
      motivo: "campo ausente ou não informado",
      recorteRef: recorte,
      pendenteRevisao: false,
    };
  }

  // Campo íntegro
  return {
    valor: campo.valor,
    estado: "VERDE",
    motivo: "extração íntegra e confiança satisfatória",
    recorteRef: recorte,
    pendenteRevisao: false,
  };
}
