import type { ClinicalEvent } from "../../contracts/operacao.js";
import { administrations } from "./series.js";

export interface CumulativeDose {
  droga: string; quantidadeEfetivaMg: number; adminIds: string[];
  /** mesma administração registrada com quantidades diferentes: fica FORA do total até revisão (INV-07) */
  conflitoAdminIds: string[];
}

/** Prescribed quantities never enter; OMITIDA contributes zero, PARCIAL the actual amount. */
export function cumulativos(eventos: readonly ClinicalEvent[]): CumulativeDose[] {
  const doses = new Map<string, CumulativeDose>();
  const porAdmin = new Map<string, { droga: string; quantidades: Set<number> }>();
  for (const a of administrations(eventos)) {
    if (a.status === "OMITIDA" || a.quantidadeEfetivaMg === 0) continue;
    const reg = porAdmin.get(a.adminId) ?? { droga: a.droga, quantidades: new Set<number>() };
    reg.quantidades.add(a.quantidadeEfetivaMg);
    porAdmin.set(a.adminId, reg);
  }
  for (const [adminId, { droga, quantidades }] of porAdmin) {
    const total = doses.get(droga) ?? { droga, quantidadeEfetivaMg: 0, adminIds: [], conflitoAdminIds: [] };
    if (quantidades.size > 1) total.conflitoAdminIds.push(adminId);
    else { total.quantidadeEfetivaMg += [...quantidades][0]!; total.adminIds.push(adminId); }
    doses.set(droga, total);
  }
  return [...doses.values()].sort((a, b) => a.droga.localeCompare(b.droga));
}
