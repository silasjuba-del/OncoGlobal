// FUGU-10 · Timeline longitudinal do paciente (Anexo A; D-W9-07; D-W9-12; Q45).
// Projeção pura a partir dos fatos confirmados por regra/clique. `stageHistory` é imutável
// e `historicalMetastaticDisease` nunca volta a false. Nada aqui vira ordem clínica.
import { PatientTimeline } from "../../contracts/w10/clinico-w10.js";
import type { ClinicalFact, ReviewException } from "../extracao/tipos.js";
import { historicalMetastaticDisease } from "../extracao/safety.js";
import { normalizarDataCivil, normalizarTnm } from "../extracao/normalizacao.js";
import { literalDoEstagio, reconciliarTratamento } from "../extracao/reconciliacao.js";

export interface EntradaTimeline {
  readonly patientId: string;
  /** Fatos aceitos pela validação anti-alucinação. */
  readonly fatos: readonly ClinicalFact[];
  readonly conflitos: readonly ReviewException[];
  readonly missingRequiredData: readonly string[];
  /** Valor persistido anterior: garante a monotonicidade do histórico metastático. */
  readonly historicalMetastaticDiseaseAnterior?: boolean;
}

function valor(fact: ClinicalFact): Record<string, unknown> {
  return typeof fact.value === "object" && fact.value !== null
    ? fact.value as Record<string, unknown> : {};
}

/** stageHistory imutável: cada avaliação coexiste (A3) e é ordenada por data + origem. */
export function historicoDeEstagios(fatos: readonly ClinicalFact[]) {
  return fatos.filter((f) => f.domain === "stage").map((f) => {
    const v = valor(f);
    const tnm = normalizarTnm(literalDoEstagio(f), { tipo: typeof v.tipo === "string" ? v.tipo : null,
      sistema: typeof v.sistema === "string" ? v.sistema : null });
    return {
      tipo: v.tipoConflitante === true ? null : tnm.tipo,
      valor: tnm.literal,
      sistema: tnm.sistema,
      data: normalizarDataCivil(f.date ?? null),
      sourceId: f.sourceId,
    };
  }).filter((e) => e.valor.trim() !== "")
    .sort((a, b) => (a.data ?? "9999").localeCompare(b.data ?? "9999")
      || a.sourceId.localeCompare(b.sourceId) || a.valor.localeCompare(b.valor));
}

/** Uma observação conserva sua fonte, data e estado; não elege o maior ciclo do paciente. */
export function tratamentoLongitudinal(fatos: readonly ClinicalFact[]) {
  const estados = [ ["proposto", "PROPOSTO"], ["prescrito", "PRESCRITO"], ["administrado", "ADMINISTRADO"],
    ["suspensoAdiado", "SUSPENSO_ADIADO"], ["concluido", "CONCLUIDO"] ] as const;
  const observacoes = fatos.flatMap(f => {
    if (f.evidence !== "EXPLICIT" || f.requiresConfirmation
      || f.qualificadores && (f.qualificadores.polaridade !== "AFIRMADA" || f.qualificadores.sujeito === "TERCEIRO")) return [];
    if (f.domain === "regimen" && (f.sourceType === "prescription" || f.sourceType === "administration")) {
      const regimen = typeof f.value === "string" ? f.value.trim() : typeof valor(f).normalizado === "string" ? String(valor(f).normalizado).trim() : "";
      return regimen ? [{ f, regimen, status: f.sourceType === "prescription" ? "PRESCRITO" as const : "ADMINISTRADO" as const }] : [];
    }
    const t = reconciliarTratamento([f]);
    return estados.flatMap(([campo, status]) => t[campo].map(regimen => ({ f, regimen, status })));
  });
  const chaveTrecho = (f: ClinicalFact) => JSON.stringify([f.sourceId, f.segmentId, f.sourceType,
    normalizarDataCivil(f.date ?? null), f.rawEvidence, f.page ?? null, f.timestampMs ?? null]);
  const nomesPorTrecho = new Map<string, Set<string>>(), ciclosPorTrecho = new Map<string, ClinicalFact[]>();
  for (const o of observacoes) {
    const chave = chaveTrecho(o.f), nomes = nomesPorTrecho.get(chave) ?? new Set<string>();
    nomes.add(o.regimen); nomesPorTrecho.set(chave, nomes);
  }
  for (const c of fatos) {
    if (c.domain !== "cycle" || !c.rawEvidence.trim() || c.evidence !== "EXPLICIT" || c.requiresConfirmation
      || c.qualificadores && (c.qualificadores.polaridade !== "AFIRMADA" || c.qualificadores.sujeito === "TERCEIRO")) continue;
    const chave = chaveTrecho(c), grupo = ciclosPorTrecho.get(chave) ?? [];
    grupo.push(c); ciclosPorTrecho.set(chave, grupo);
  }
  const entradas = observacoes.map(({ f, regimen, status }) => {
    const chave = chaveTrecho(f), nomesNoTrecho = nomesPorTrecho.get(chave)!;
    const ciclos = ciclosPorTrecho.get(chave) ?? [];
    const numeros = ciclos.map(c => Number(valor(c).numero ?? c.value));
    const unico = new Set(numeros);
    const cycle = (status === "PRESCRITO" || status === "ADMINISTRADO") && nomesNoTrecho.size === 1
      && numeros.length > 0 && numeros.every(n => Number.isInteger(n) && n > 0) && unico.size === 1 ? numeros[0]! : null;
    return { regimen, templateId: null, intent: null, line: null, cycle, status,
      em: normalizarDataCivil(f.date ?? null), sourceIds: [f.sourceId] };
  });
  return entradas
    .sort((a, b) => (a.em ?? "9999").localeCompare(b.em ?? "9999") || a.regimen.localeCompare(b.regimen)
      || a.status.localeCompare(b.status) || a.sourceIds[0]!.localeCompare(b.sourceIds[0]!));
}

/** Projeta a timeline do paciente e valida contra o contrato W10 (falha alto se divergir). */
export function projetarTimelinePaciente(entrada: EntradaTimeline): PatientTimeline {
  if (!entrada.patientId.trim()) throw new Error("Timeline exige patientId");
  const candidato = {
    patientId: entrada.patientId,
    stageHistory: historicoDeEstagios(entrada.fatos),
    historicalMetastaticDisease: entrada.historicalMetastaticDiseaseAnterior === true
      || historicalMetastaticDisease(entrada.fatos),
    treatments: tratamentoLongitudinal(entrada.fatos),
    // RECIST é calculado por código em src/rules/recist (faixa Astra/Grok): aqui não se calcula.
    recist: [],
    missingRequiredData: [...new Set(entrada.missingRequiredData)].sort(),
    unresolvedConflicts: [...new Set(entrada.conflitos.map((c) => c.id))].sort(),
  };
  return PatientTimeline.parse(candidato);
}
