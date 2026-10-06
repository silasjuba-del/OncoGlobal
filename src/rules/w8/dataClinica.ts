// AG-03 · Data clínica e idade derivada (lições T1–T2)
// Regras puras: sem I/O, sem Date.now, sem Math.random, offset injetado.
// Só a data clínica entra na linha do tempo; idade é sempre derivada, nunca copiada.

import type { Semaforo } from "../../contracts/estados.js";

export interface EntradaDataClinica {
  dataClinica?: string | null;
  dataEmissao?: string | null;
  dataAssinaturaDigital?: string | null;
  dataExtracaoSistema?: string | null;
}

export interface SaidaDataClinica {
  data: string | null;
  estado: Semaforo;
  motivo: string;
}

export interface SaidaIdadeNaData {
  idadeAnos: number | null;
  estado: Semaforo;
  motivo: string;
}

const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const MS_POR_DIA = 86_400_000;

/**
 * T1: Seleciona a data clínica autêntica (coleta, realização, entrada de biópsia).
 * Se ausente, retorna PENDENTE. Jamais usa data de emissão, assinatura digital
 * ou extração de sistema/SISREG como substituta da data clínica.
 */
export function escolherDataClinica(entrada: EntradaDataClinica): SaidaDataClinica {
  const clinica = entrada.dataClinica ? entrada.dataClinica.trim() : null;

  if (!clinica) {
    const temOutras = Boolean(
      entrada.dataEmissao ||
      entrada.dataAssinaturaDigital ||
      entrada.dataExtracaoSistema,
    );
    return {
      data: null,
      estado: "PENDENTE",
      motivo: temOutras
        ? "data clínica ausente: emissão, assinatura digital ou extração não substituem data clínica (T1)"
        : "data clínica ausente",
    };
  }

  if (!ISO_DATE_REGEX.test(clinica)) {
    return {
      data: null,
      estado: "PENDENTE",
      motivo: `data clínica '${clinica}' inválida (formato esperado YYYY-MM-DD)`,
    };
  }

  return {
    data: clinica,
    estado: "VERDE",
    motivo: "data clínica de coleta/realização identificada",
  };
}

/**
 * T2: Idade é calculada derivando nascimento na data de referência + offset injetado.
 * Nunca deve ser copiada do cabeçalho de laudos (que registram idade defasada).
 */
export function idadeNaData(
  nascimento: string | null | undefined,
  dataRef: string | null | undefined,
  offsetDias: number = 0,
): SaidaIdadeNaData {
  if (!nascimento || !dataRef) {
    return {
      idadeAnos: null,
      estado: "PENDENTE",
      motivo: "data de nascimento ou data de referência ausente",
    };
  }

  const nascLimpo = nascimento.trim();
  const refLimpa = dataRef.trim();

  if (!ISO_DATE_REGEX.test(nascLimpo) || !ISO_DATE_REGEX.test(refLimpa)) {
    return {
      idadeAnos: null,
      estado: "PENDENTE",
      motivo: "formato de data inválido para cálculo de idade (exige YYYY-MM-DD)",
    };
  }

  const nascY = Number(nascLimpo.slice(0, 4));
  const nascM = Number(nascLimpo.slice(5, 7));
  const nascD = Number(nascLimpo.slice(8, 10));

  const refY = Number(refLimpa.slice(0, 4));
  const refM = Number(refLimpa.slice(5, 7));
  const refD = Number(refLimpa.slice(8, 10));

  const refUtcMs = Date.UTC(refY, refM - 1, refD) + offsetDias * MS_POR_DIA;
  const dRefEfetiva = new Date(refUtcMs);

  const effY = dRefEfetiva.getUTCFullYear();
  const effM = dRefEfetiva.getUTCMonth() + 1;
  const effD = dRefEfetiva.getUTCDate();

  let anos = effY - nascY;
  if (effM < nascM || (effM === nascM && effD < nascD)) {
    anos -= 1;
  }

  if (anos < 0) {
    return {
      idadeAnos: null,
      estado: "PENDENTE",
      motivo: "data de referência é anterior à data de nascimento",
    };
  }

  return {
    idadeAnos: anos,
    estado: "VERDE",
    motivo: "idade calculada estritamente por derivação cronológica na data de referência (T2)",
  };
}
