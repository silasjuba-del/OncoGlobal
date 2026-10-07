// Tipos do pipeline de extração multimodal (D-W9-33/34a).
// Os contratos foram publicados pelo tech lead em `src/contracts/w10/extracao.ts` (D-W9-58):
// este módulo não mantém mais nenhum tipo `PROVISORIO-W10`.
export type {
  ClinicalFact,
  EncounterSegment,
  FactDomain,
  FactEvidence,
  FactProvenance,
  FactSourceType,
  PatientCandidate,
  ReconciledField,
  ReviewAction,
  ReviewException,
} from "../../contracts/w10/extracao.js";
export { ExceptionKind } from "../../contracts/w10/extracao.js";

import type { ClinicalFact, FactProvenance, ReviewAction } from "../../contracts/w10/extracao.js";

/**
 * Decisão médica persistida. A autoridade é a `ReviewAction` CONFIRMAR já registrada
 * no ledger; o identificador do evento é a prova documental — nunca o texto livre.
 * O evento em si (tipo/payload) é responsabilidade do ledger (ver `caixaRevisao.ts`).
 */
export interface PhysicianConfirmation {
  readonly acao: ReviewAction;
  readonly decisionEventId: string;
}

/**
 * Mapeamento para o vocabulário de proveniência do projeto (D-W9-33).
 * EXTRACTED = texto reconhecido; DOCUMENT_CONFIRMED só existe com decisão humana persistida.
 */
export function mapearProveniencia(
  fact: ClinicalFact | null,
  confirmacao?: PhysicianConfirmation,
): { provenance: FactProvenance; regra?: string } {
  if (fact === null) return { provenance: "NOT_FOUND" };
  if (confirmacao) {
    if (confirmacao.acao.acao !== "CONFIRMAR") {
      throw new Error("Confirmação médica exige ação CONFIRMAR");
    }
    if (!confirmacao.acao.medicoId.trim() || !confirmacao.decisionEventId.trim()) {
      throw new Error("Confirmação médica exige identificador e evento de decisão");
    }
    return { provenance: "DOCUMENT_CONFIRMED" };
  }
  if (fact.evidence === "EXPLICIT") return { provenance: "EXTRACTED" };
  if (fact.evidence === "UNCERTAIN") return { provenance: "UNCERTAIN" };
  const regra = fact.regra?.trim();
  if (!regra) throw new Error("Inferência exige regra nomeada");
  return { provenance: "INFERRED", regra };
}
