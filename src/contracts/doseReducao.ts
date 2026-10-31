/** D-F1-52: mg calculado < meia unidade desce, empate mantém, acima sobe.
 * Resultado positivo abaixo de meia unidade permanece positivo. Dose fixa não passa aqui.
 * A aritmética não recomenda dose, redução ou administração.
 */
export function arredondarDoseMg(valor: number): number | null {
  if (!Number.isFinite(valor) || valor < 0) return null;
  const inteiro = Math.floor(valor), fracao = valor - inteiro;
  const tolerancia = Math.min(1e-9, Number.EPSILON * Math.max(1, valor) * 2);
  if (fracao === 0) return valor;
  if (Math.abs(fracao - 0.5) <= tolerancia) return inteiro + 0.5;
  if (fracao > 0.5) return inteiro + 1;
  return inteiro === 0 ? valor : inteiro;
}

/** Reduz uma vez sobre a base original; percentual zero conserva a dose de entrada. */
export function mgAposReducao(baseMg: number, reducaoPct: number): number {
  if (!Number.isFinite(baseMg) || baseMg < 0 || !Number.isFinite(reducaoPct) || reducaoPct < 0 || reducaoPct > 100) return Number.NaN;
  if (reducaoPct === 0) return baseMg;
  return arredondarDoseMg(baseMg * ((100 - reducaoPct) / 100)) ?? Number.NaN;
}
