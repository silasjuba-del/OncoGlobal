/** D-F1-52 · redução percentual sobre a dose de entrada, uma vez, em mg.
 * Fração abaixo de 0,5 desce; 0,5 sobe; acima de 0,5 sobe. 125 mg com −30% vira 88.
 * Resultado em (0, 1) mg não sobe para 1 e não é dose: devolve 0 para o chamador deixar pendente.
 * Não calcula mg/m², mg/kg nem AUC.
 */
export function mgAposReducao(baseMg: number, reducaoPct: number): number {
  if (!Number.isFinite(baseMg) || !Number.isFinite(reducaoPct)) return Number.NaN;
  const numerador = baseMg * (100 - reducaoPct);
  if (!Number.isFinite(numerador)) return Number.NaN;
  if (numerador > 0 && numerador < 100) return 0;
  return Math.floor((numerador + 50) / 100);
}
