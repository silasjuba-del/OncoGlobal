// PROVISORIO-W10: lesões RECIST e graus CTCAE vêm da porta/contratos — só confirmados.

export type ModoChart3D = "recist" | "ctcae";

export interface LesaoRecist {
  id: string;
  rotulo: string;
  /** mm por timepoint (baseline, interina, reaval) — só lesões-alvo confirmadas. */
  mm: readonly [number, number, number];
  cor: string;
}

export interface GrauCtcae {
  toxicidade: string;
  ciclo: string;
  /** 1–4 confirmados; ausente = não incluir (nunca inventar 0). */
  grau: 1 | 2 | 3 | 4;
}

export const TIMEPOINTS_RECIST = ["Baseline", "Interina", "Reaval."] as const;

/** Dados sintéticos alinhados ao desenho OncoChart — limiar RP = −30% da soma baseline. */
export function recistSintetico(): readonly LesaoRecist[] {
  return [
    { id: "t1", rotulo: "T1 · mama", mm: [34, 30, 21], cor: "var(--accent)" },
    { id: "t2", rotulo: "T2 · axila", mm: [18, 16, 11], cor: "var(--info)" },
  ];
}

export function somaRecist(lesoes: readonly LesaoRecist[], i: number): number {
  return lesoes.reduce((a, l) => a + (l.mm[i] ?? 0), 0);
}

export function limiarRpMm(lesoes: readonly LesaoRecist[]): number {
  return somaRecist(lesoes, 0) * 0.7;
}

/** Só graus confirmados (sem G0). */
export function ctcaeSintetico(): readonly GrauCtcae[] {
  return [
    { toxicidade: "Neutropenia", ciclo: "AC3", grau: 3 },
    { toxicidade: "Náusea", ciclo: "AC2", grau: 2 },
    { toxicidade: "Neuropatia", ciclo: "P8", grau: 1 },
    { toxicidade: "Fadiga", ciclo: "P4", grau: 1 },
    { toxicidade: "Mucosite", ciclo: "AC4", grau: 2 },
  ];
}

export function corGrau(grau: 1 | 2 | 3 | 4): string {
  if (grau >= 3) return "var(--danger)";
  if (grau === 2) return "var(--amber)";
  return "var(--ok)";
}
