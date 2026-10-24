import type { ClasseErroAvaliacao } from "../../contracts/harnessAvaliacao.js";

export const CLASSES_ERRO_ORDEM: readonly ClasseErroAvaliacao[] = [
  "CONTROLE_POSITIVO_SILENCIOSO",
  "VAZAMENTO_ENTRE_PACIENTES",
  "VALOR_NUMERICO_CRITICO_PRE_VALIDADO",
  "QUALIFICADOR_INVERTIDO",
  "CITACAO_NAO_SUSTENTADA",
  "CONFLITO_OCULTADO",
  "OMISSAO_CRITICA",
];

/** Intervalo de confiança de Wilson (95%, z = 1.959964) para proporções com denominador finito. */
export function intervaloWilson95(erros: number, total: number): {
  inferior: number | null;
  superior: number | null;
  semiamplitude: number | null;
} {
  if (!Number.isInteger(total) || total <= 0 || !Number.isInteger(erros) || erros < 0 || erros > total) {
    return { inferior: null, superior: null, semiamplitude: null };
  }
  const z = 1.959964;
  const z2 = z * z;
  const p = erros / total;
  const denom = 1 + z2 / total;
  const centro = (p + z2 / (2 * total)) / denom;
  const margem = (z * Math.sqrt((p * (1 - p)) / total + z2 / (4 * total * total))) / denom;
  const inferior = Math.max(0, Number((centro - margem).toFixed(6)));
  const superior = Math.min(1, Number((centro + margem).toFixed(6)));
  const semiamplitude = Number(((superior - inferior) / 2).toFixed(6));
  return { inferior, superior, semiamplitude };
}
