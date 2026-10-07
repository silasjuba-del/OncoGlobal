// AG-09 · Interações medicamentosas sem fonte = PENDENTE (norma G-09)
// Regras puras: sem I/O, sem Date.now, sem Math.random.
// Lê o ruleset interacoes.v1.json injetado.
// Par sem regra ativa com fonte → PENDENTE ("não verificado"), NUNCA "sem interação" ou "VERDE".
// Regra ativa com fonte → alerta com severidade da fonte.
// Nenhuma regra ativa hoje: teste prova que tudo sai PENDENTE.

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

function normalizarDroga(s?: string | null): string {
  if (!s) return "";
  return s
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function casaDrogaOuClasse(termoRegra: string, drogaConsulta: string): boolean {
  const r = normalizarDroga(termoRegra);
  const c = normalizarDroga(drogaConsulta);
  if (!r || !c) return false;
  return r === c || c.includes(r) || r.includes(c);
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
): SaidaAvaliacaoInteracao {
  const d1 = droga1?.trim() || "droga_1";
  const d2 = droga2?.trim() || "droga_2";

  const regras = ruleset?.interacoes ?? [];

  // Procura por regras cadastradas (em qualquer ordem)
  const regraEncontrada = regras.find((item) => {
    const direta =
      casaDrogaOuClasse(item.drogaA, d1) && casaDrogaOuClasse(item.drogaBouClasse, d2);
    const inversa =
      casaDrogaOuClasse(item.drogaA, d2) && casaDrogaOuClasse(item.drogaBouClasse, d1);
    return direta || inversa;
  });

  // Só vira alerta se a regra estiver formalmente ativa e tiver fonte bibliográfica comprovada
  const temFonteValida =
    regraEncontrada?.fonte?.referencia &&
    regraEncontrada.fonte.referencia.trim() !== "" &&
    regraEncontrada.fonte.referencia !== "[VERIFICAR]";

  if (regraEncontrada && regraEncontrada.ativo === true && temFonteValida) {
    const sev = regraEncontrada.severidade || "MODERADA";
    return {
      drogaA: d1,
      drogaB: d2,
      estado: "VERMELHO",
      severidade: sev,
      motivo: `interação ativa detectada: ${regraEncontrada.drogaA} + ${regraEncontrada.drogaBouClasse} (severidade ${sev})`,
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
