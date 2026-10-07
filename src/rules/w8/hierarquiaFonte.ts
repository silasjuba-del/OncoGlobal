// AG-05 · Hierarquia de fonte (lições E1–E3)
// Regras puras: sem I/O, sem Date.now, sem Math.random.
// Primária prevalece; secundária só corrobora ou conflita.
// Valor só em secundária → { origem: "MENCIONADO_SEM_LAUDO", estado: "PENDENTE" }.
// Categoria sem número (ex.: "PIRADS" sem valor) → PENDENTE.

import type { Fonte } from "../../contracts/base.js";
import type { Semaforo } from "../../contracts/estados.js";

export type NaturezaFonte = "PRIMARIA" | "SECUNDARIA" | "ADMINISTRATIVA";

export interface AchadoFonte {
  natureza: NaturezaFonte;
  valor?: unknown | null;
  categoria?: string | null;
  escore?: number | string | null;
  fonte?: Fonte | null;
  descricao?: string | null;
}

export type OrigemResultado =
  | "PRIMARIA_CONFIRMADA"
  | "MENCIONADO_SEM_LAUDO"
  | "CONFLITO_ENTRE_FONTES"
  | "CATEGORIA_SEM_VALOR"
  | "ADMINISTRATIVO_IGNORADO";

export interface SaidaHierarquiaFonte {
  valorEleito: unknown | null;
  origem: OrigemResultado;
  estado: Semaforo;
  motivo: string;
  corrobora: boolean;
  conflito: boolean;
}

function eCategoriaSemNumero(item?: AchadoFonte | null): boolean {
  if (!item) return false;
  // Categoria explícita (ex: "PIRADS", "BI-RADS") sem escore numérico preenchido
  if (item.categoria && (item.escore === null || item.escore === undefined || item.escore === "")) {
    return true;
  }
  // Se valor for string e for apenas o nome da categoria sem dígitos
  if (typeof item.valor === "string") {
    const limpo = item.valor.trim().toUpperCase();
    if (/^(PIRADS|PI-RADS|BIRADS|BI-RADS|LIRADS|LI-RADS)$/.test(limpo)) {
      return true;
    }
  }
  return false;
}

function valoresConcordam(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a === "number" && typeof b === "number") return a === b;
  const strA = String(a ?? "").trim().toLowerCase();
  const strB = String(b ?? "").trim().toLowerCase();
  return strA.length > 0 && strA === strB;
}

/**
 * Avalia a precedência entre fontes primária, secundária e administrativa.
 * - E1: Primária prevalece; secundária corrobora ou conflita.
 * - E2: Valor presente apenas na secundária vira MENCIONADO_SEM_LAUDO com PENDENTE.
 * - E3: Categoria sem escore (ex.: "PIRADS" sem número) vira CATEGORIA_SEM_VALOR com PENDENTE.
 */
export function avaliarHierarquiaFonte(
  primaria?: AchadoFonte | null,
  secundaria?: AchadoFonte | null,
  administrativa?: AchadoFonte | null,
): SaidaHierarquiaFonte {
  // E3: Categoria sem número em qualquer das fontes clínicas
  if (eCategoriaSemNumero(primaria) || eCategoriaSemNumero(secundaria)) {
    return {
      valorEleito: null,
      origem: "CATEGORIA_SEM_VALOR",
      estado: "PENDENTE",
      motivo: "categoria informada sem escore ou número associado (E3: proibido inferir classificação)",
      corrobora: false,
      conflito: false,
    };
  }

  // E1: Presença de fonte primária
  if (primaria && primaria.valor !== null && primaria.valor !== undefined) {
    if (secundaria && secundaria.valor !== null && secundaria.valor !== undefined) {
      const concorda = valoresConcordam(primaria.valor, secundaria.valor);
      if (concorda) {
        return {
          valorEleito: primaria.valor,
          origem: "PRIMARIA_CONFIRMADA",
          estado: "VERDE",
          motivo: "laudo primário comprobatório prevalece e fonte secundária corrobora (E1)",
          corrobora: true,
          conflito: false,
        };
      }
      return {
        valorEleito: primaria.valor,
        origem: "CONFLITO_ENTRE_FONTES",
        estado: "VERMELHO",
        motivo: "fonte secundária diverge do laudo primário (E1: conflito registrado)",
        corrobora: false,
        conflito: true,
      };
    }

    return {
      valorEleito: primaria.valor,
      origem: "PRIMARIA_CONFIRMADA",
      estado: "VERDE",
      motivo: "laudo primário comprobatório prevalece (E1)",
      corrobora: false,
      conflito: false,
    };
  }

  // E2: Apenas fonte secundária presente
  if (secundaria && secundaria.valor !== null && secundaria.valor !== undefined) {
    return {
      valorEleito: secundaria.valor,
      origem: "MENCIONADO_SEM_LAUDO",
      estado: "PENDENTE",
      motivo: "mencionado em documento secundário de outro médico, sem laudo comprobatório (E2)",
      corrobora: false,
      conflito: false,
    };
  }

  // Apenas administrativa presente
  if (administrativa && administrativa.valor !== null && administrativa.valor !== undefined) {
    return {
      valorEleito: null,
      origem: "ADMINISTRATIVO_IGNORADO",
      estado: "PENDENTE",
      motivo: "documento administrativo não estabelece fato clínico comprobatório",
      corrobora: false,
      conflito: false,
    };
  }

  return {
    valorEleito: null,
    origem: "MENCIONADO_SEM_LAUDO",
    estado: "PENDENTE",
    motivo: "dado ausente em todas as fontes",
    corrobora: false,
    conflito: false,
  };
}
