// W10-INT-PRESC-03 · ajuste de dose pelos botões −20/−30/−40 (D-W9-26, Q29). Função pura.
// Base = dose de entrada do ciclo anterior (K-06). A conta é mgAposReducao (D-F1-52), uma vez.
// Qualquer outro percentual é RECUSADO. Não recalcula mg/m², mg/kg nem AUC.
import type { PrescriptionItem } from "../../contracts/w10/prescricao.js";
import { mgAposReducao } from "../../contracts/doseReducao.js";

export type RecusaAjuste = {
  codigo: "PERCENTUAL_INVALIDO" | "MOTIVO_AUSENTE" | "DOSE_ANTERIOR_AUSENTE" | "AJUSTE_JA_APLICADO" | "DOSE_RESULTANTE_INVALIDA";
  texto: string;
};
export type ResultadoAjuste = { ok: true; item: PrescriptionItem } | { ok: false; recusa: RecusaAjuste };

const PERMITIDOS: readonly number[] = [-20, -30, -40];

/**
 * @param item  item do ciclo (se `doseBase` não for dado, a base é `item.prescribedDose` = dose do ciclo anterior)
 * @param percentual  só −20, −30 ou −40 (valor desconhecido de propósito: entrada de UI não é confiável)
 * @param motivo  obrigatório (não vazio)
 * @param opcoes.doseBase  dose prescrita do ciclo anterior, quando `item` é o item do ciclo atual (ver instanciarProtocolo.doseAnteriorPrescrita)
 */
export function aplicarAjuste(
  item: PrescriptionItem,
  percentual: unknown,
  motivo: string,
  opcoes?: { doseBase?: number | null },
): ResultadoAjuste {
  if (typeof percentual !== "number" || !PERMITIDOS.includes(percentual))
    return { ok: false, recusa: { codigo: "PERCENTUAL_INVALIDO", texto: "ajuste só pode ser −20, −30 ou −40 (D-W9-26)" } };
  if (typeof motivo !== "string" || motivo.trim() === "")
    return { ok: false, recusa: { codigo: "MOTIVO_AUSENTE", texto: "ajuste de dose exige motivo" } };
  const temBaseExplicita = opcoes?.doseBase !== undefined;
  if (!temBaseExplicita && item.adjustmentPercent !== null)
    return { ok: false, recusa: { codigo: "AJUSTE_JA_APLICADO", texto: "item já ajustado; informe a dose do ciclo anterior (doseBase) para reajustar" } };
  const base = temBaseExplicita ? (opcoes?.doseBase ?? null) : item.prescribedDose;
  if (base === null || !Number.isFinite(base) || base <= 0)
    return { ok: false, recusa: { codigo: "DOSE_ANTERIOR_AUSENTE", texto: "sem dose do ciclo anterior para ajustar (PENDENTE)" } };
  if (item.unit !== "mg") return { ok: false, recusa: { codigo: "DOSE_RESULTANTE_INVALIDA", texto: "redução em mg exige dose absoluta em mg; conferir unidade" } };
  const r = -percentual; // 20 | 30 | 40
  const dose = mgAposReducao(base, r);
  if (!(dose > 0))
    return { ok: false, recusa: { codigo: "DOSE_RESULTANTE_INVALIDA", texto: "dose após o ajuste não é positiva" } };
  return {
    ok: true,
    item: { ...item, prescribedDose: dose, adjustmentPercent: percentual as -20 | -30 | -40, adjustmentReason: motivo.trim() },
  };
}
