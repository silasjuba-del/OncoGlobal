import type { ClinicalEvent } from "../../contracts/operacao.js";
import { administrations } from "./series.js";

export interface CumulativeDose { droga: string; quantidadeEfetivaMg: number; adminIds: string[] }

/** Prescribed quantities never enter; OMITIDA contributes zero, PARCIAL the actual amount. */
export function cumulativos(eventos: readonly ClinicalEvent[]): CumulativeDose[] {
  const doses = new Map<string, CumulativeDose>();
  for (const a of administrations(eventos)) {
    if (a.status === "OMITIDA" || a.quantidadeEfetivaMg === 0) continue;
    const total = doses.get(a.droga) ?? { droga: a.droga, quantidadeEfetivaMg: 0, adminIds: [] };
    total.quantidadeEfetivaMg += a.quantidadeEfetivaMg;
    total.adminIds.push(a.adminId);
    doses.set(a.droga, total);
  }
  return [...doses.values()].sort((a, b) => a.droga.localeCompare(b.droga));
}
