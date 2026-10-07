import type { PatientCandidate } from "./tipos.js";

// PROVISORIO-W10: cadastro permanece local, sem vínculo automático (D-W9-34a).
export interface IdentityHints {
  readonly name?: string;
  readonly age?: number;
  readonly sex?: string;
  readonly tumor?: string;
  readonly laterality?: string;
  readonly protocol?: string;
  readonly biomarker?: string;
  readonly eventDate?: string;
  readonly mother?: string;
  readonly birthDate?: string;
  readonly cns?: string;
  readonly matricula?: string;
}
export interface RegistryPatient extends IdentityHints {
  readonly patientId: string;
}

const weights = {
  name: 0.35, age: 0.10, sex: 0.05, tumor: 0.15,
  laterality: 0.10, protocol: 0.10, biomarker: 0.05, eventDate: 0.10,
} as const;
type WeightedKey = keyof typeof weights;

function normal(value: string | number | undefined): string | null {
  if (value === undefined || value === "") return null;
  return String(value).normalize("NFD").replace(/\p{Diacritic}/gu, "")
    .trim().replace(/\s+/g, " ").toLocaleLowerCase("pt-BR");
}

export function rankearPacientes(
  segmentId: string,
  hints: IdentityHints,
  patients: readonly RegistryPatient[],
  options: Readonly<{ desidentified: boolean; openedPatientId?: string }>,
): readonly PatientCandidate[] {
  // Nome em transcrição desidentificada pesa zero; nenhum peso restante é renormalizado
  // para forçar falsa certeza. Score ordena candidatos, nunca faz AUTO_MERGE.
  const scores = patients.map((patient) => {
    let score = 0;
    const reasons: Record<string, string> = {};
    for (const key of Object.keys(weights) as WeightedKey[]) {
      if (key === "name" && options.desidentified) {
        reasons.name = "desidentificado: peso zero";
        continue;
      }
      const a = normal(hints[key]);
      const b = normal(patient[key]);
      const match = a !== null && b !== null && a === b;
      score += match ? weights[key] : 0;
      reasons[key] = a === null || b === null ? "ausente: sem pontuar" :
        match ? "coincide" : "diverge";
    }
    // Identificadores fortes não são pontos de nome; preserva razões sem expor valor.
    let strongMatches = 0;
    let strongMismatches = 0;
    for (const key of ["cns", "matricula", "mother", "birthDate"] as const) {
      const a = normal(hints[key]);
      const b = normal(patient[key]);
      reasons[key] = a === null || b === null ? "ausente: conferir cadastro" :
        a === b ? "coincide no cadastro" : "diverge no cadastro";
      if (a !== null && b !== null) {
        if (a === b) strongMatches++;
        else strongMismatches++;
      }
    }
    reasons.openedEncounter = options.openedPatientId === patient.patientId
      ? "consulta aberta: contexto, não identidade" : "outra consulta";
    return {
      candidate: {
        segmentId, patientId: patient.patientId, score: Number(score.toFixed(2)),
        reasons, requiresReview: true as const,
      },
      strongMatches, strongMismatches,
      opened: options.openedPatientId === patient.patientId,
    };
  });
  scores.sort((a, b) =>
    a.strongMismatches - b.strongMismatches ||
    b.strongMatches - a.strongMatches ||
    b.candidate.score - a.candidate.score ||
    Number(b.opened) - Number(a.opened) ||
    a.candidate.patientId.localeCompare(b.candidate.patientId));
  return scores.map(({ candidate }) => candidate);
}
