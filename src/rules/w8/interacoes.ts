// AG-09 · Interações medicamentosas sem fonte = PENDENTE (norma G-09)
// Regras puras: sem I/O, sem Date.now, sem Math.random.
// Lê o ruleset interacoes.v1.json injetado.
// Par sem regra ativa com fonte → PENDENTE ("não verificado"), NUNCA "sem interação" ou "VERDE".
// Regra ativa com fonte → alerta com severidade da fonte.
// F0-COMPLEMENTO: somente pares curados podem ser ativados.

import { casaTermoFarmaco, referenciaComTrecho, type CatalogoInteracoes } from "../../contracts/f0c/interacoes.js";
import type { Semaforo } from "../../contracts/estados.js";

export interface RegraInteracaoItem {
  drogaA: string;
  drogaBouClasse: string;
  mecanismo?: string | null;
  severidade?: "LEVE" | "MODERADA" | "GRAVE" | "CONTRAINDICADA" | string | null;
  monitorizacao?: string | null;
  notaManejo?: string | null;
  fonte?: {
    tipo?: string | null;
    referencia?: string | null;
    trecho?: string | null;
    edicao?: string | null;
  } | null;
  ativo: boolean;
}

export interface RulesetInteracoes {
  header?: {
    id: string;
    versao: string;
  };
  interacoes: readonly RegraInteracaoItem[];
}

export interface SaidaAvaliacaoInteracao {
  drogaA: string;
  drogaB: string;
  estado: Semaforo;
  severidade: string | null;
  motivo: string;
  regraAtiva: boolean;
  fonteReferencia: string | null;
}

/**
 * G-09: Avalia se existe regra ativa e referenciada de interação medicamentosa entre duas drogas.
 * Invariante clínica: se não houver regra ativa curada com literatura, retorna SEMPRE PENDENTE
 * ("não verificado"). Proibido declarar silenciosamente "sem interação" ou "seguro".
 */
export function avaliarInteracaoMedicamentosa(
  droga1: string,
  droga2: string,
  ruleset: RulesetInteracoes,
  catalogo?: CatalogoInteracoes,
): SaidaAvaliacaoInteracao {
  const d1 = droga1?.trim() || "droga_1";
  const d2 = droga2?.trim() || "droga_2";

  const regras = ruleset?.interacoes ?? [];

  // Procura por regras cadastradas (em qualquer ordem)
  const casadas = regras.filter((item) => {
    const direta =
      casaTermoFarmaco(item.drogaA, d1, catalogo) && casaTermoFarmaco(item.drogaBouClasse, d2, catalogo);
    const inversa =
      casaTermoFarmaco(item.drogaA, d2, catalogo) && casaTermoFarmaco(item.drogaBouClasse, d1, catalogo);
    return direta || inversa;
  });

  // Uma semente inativa anterior não esconde outra regra curada aplicável.
  const regraEncontrada = casadas.find((item) => item.ativo === true && referenciaComTrecho(item.fonte));
  if (regraEncontrada) {
    const sev = regraEncontrada.severidade || null;
    return {
      drogaA: d1,
      drogaB: d2,
      estado: "VERMELHO",
      severidade: sev,
      motivo: `interação ativa detectada: ${regraEncontrada.drogaA} + ${regraEncontrada.drogaBouClasse} (severidade ${sev ?? "não classificada"})`,
      regraAtiva: true,
      fonteReferencia: regraEncontrada.fonte!.referencia!,
    };
  }

  // G-09: Sem regra ativa com fonte -> PENDENTE ("não verificado"), NUNCA "sem interação"
  return {
    drogaA: d1,
    drogaB: d2,
    estado: "PENDENTE",
    severidade: null,
    motivo: "não verificado: ausência de regra ativa com fonte clínica comprovada",
    regraAtiva: false,
    fonteReferencia: null,
  };
}
