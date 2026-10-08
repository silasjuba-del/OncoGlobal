import { cnsValido } from "../cns.js";
export { cnsValido };
// AG-01 · Identificador por valor (lições I1–I2)
// Regras puras: sem I/O, sem Date.now, sem Math.random. Rótulo não prova o tipo do identificador.

export type TipoIdentificadorPorValor = "CPF" | "CNS" | "DESCONHECIDO";

export interface EntradaClassificarIdentificador {
  rotulo?: string | null;
  valor: string;
}

export interface SaidaClassificarIdentificador {
  tipoPorValor: TipoIdentificadorPorValor;
  valido: boolean;
  conflitoRotulo: boolean;
}

// CNS uses the shared D-W9-13 implementation.


/**
 * Normaliza o rótulo impresso para detectar a expectativa indicada no documento.
 */
function inferirTipoEsperadoPeloRotulo(rotulo?: string | null): "CPF" | "CNS" | "OUTRO" | null {
  if (!rotulo) return null;
  const r = rotulo.trim().toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  if (r.length === 0) return null;

  if (/\b(CPF|CIC)\b/.test(r)) return "CPF";
  if (/\b(CNS|CARTAO\s+SUS|SUS)\b/.test(r)) return "CNS";
  if (/\b(CI|RG|IDENTIDADE|REGISTRO\s+GERAL|MATRICULA|PRONTUARIO)\b/.test(r)) return "OUTRO";

  return null;
}

/**
 * Classifica um identificador pelo seu formato e valor numérico, nunca pelo rótulo.
 * Se o rótulo sugerir um tipo divergente do tipo apurado pelo valor, sinaliza conflitoRotulo.
 */
export function classificarIdentificador(
  entrada: EntradaClassificarIdentificador,
): SaidaClassificarIdentificador {
  const d = (entrada.valor ?? "").replace(/\D/g, "");

  let tipoPorValor: TipoIdentificadorPorValor = "DESCONHECIDO";
  let valido = false;

  if (d.length === 11) {
    tipoPorValor = "CPF";
    valido = cpfValido(entrada.valor);
  } else if (d.length === 15) {
    tipoPorValor = "CNS";
    valido = cnsValido(entrada.valor);
  }

  const esperado = inferirTipoEsperadoPeloRotulo(entrada.rotulo);
  let conflitoRotulo = false;

  if (esperado !== null) {
    if (esperado === "CPF" && tipoPorValor !== "CPF") {
      conflitoRotulo = true;
    } else if (esperado === "CNS" && tipoPorValor !== "CNS") {
      conflitoRotulo = true;
    } else if (esperado === "OUTRO" && (tipoPorValor === "CPF" || tipoPorValor === "CNS")) {
      conflitoRotulo = true;
    }
  }

  return {
    tipoPorValor,
    valido,
    conflitoRotulo,
  };
}

export function cpfValido(raw: string): boolean {
  const d = (raw ?? "").replace(/\D/g, "");
  if (d.length !== 11 || /^(\d)\1{10}$/.test(d)) return false;
  const dv = (n: number) => {
    let s = 0;
    for (let i = 0; i < n; i++) s += Number(d[i]) * (n + 1 - i);
    const r = (s * 10) % 11;
    return r === 10 ? 0 : r;
  };
  return dv(9) === Number(d[9]) && dv(10) === Number(d[10]);
}
