// FN-22 · Reconciliação multi-fonte (INV-07): nunca last-write-wins; conflito preserva candidatos.
import type { Fonte } from "../contracts/index.js";

export type ClasseReconciliacao = "CONCORDANTE" | "COMPLEMENTAR" | "CONFLITO" | "FONTE_UNICA" | "AUSENTE";

export interface Observacao<T> { valor: T | null; fonte: Fonte }

export interface ResultadoReconciliacao<T> {
  classe: ClasseReconciliacao;
  valor: T | null; // só quando CONCORDANTE ou FONTE_UNICA
  candidatos: { valor: T; fontes: Fonte[] }[];
}

/**
 * Compara observações do MESMO campo e do MESMO tempo clínico.
 * igual: comparador do domínio (default: igualdade estrita / JSON).
 * COMPLEMENTAR = uma fonte tem valor e outras explicitamente não informam.
 */
export function reconciliar<T>(
  obs: readonly Observacao<T>[],
  igual: (a: T, b: T) => boolean = (a, b) => JSON.stringify(a) === JSON.stringify(b),
): ResultadoReconciliacao<T> {
  const comValor = obs.filter((o): o is { valor: T; fonte: Fonte } => o.valor !== null);
  if (comValor.length === 0) return { classe: "AUSENTE", valor: null, candidatos: [] };

  const grupos: { valor: T; fontes: Fonte[] }[] = [];
  for (const o of comValor) {
    const g = grupos.find((x) => igual(x.valor, o.valor));
    if (g) g.fontes.push(o.fonte);
    else grupos.push({ valor: o.valor, fontes: [o.fonte] });
  }
  if (grupos.length > 1) return { classe: "CONFLITO", valor: null, candidatos: grupos };

  const unico = grupos[0]!;
  if (comValor.length === 1) {
    return { classe: obs.length > 1 ? "COMPLEMENTAR" : "FONTE_UNICA", valor: unico.valor, candidatos: grupos };
  }
  return { classe: comValor.length < obs.length ? "COMPLEMENTAR" : "CONCORDANTE", valor: unico.valor, candidatos: grupos };
}
