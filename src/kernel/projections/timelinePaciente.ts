// FUGU-10 · Timeline longitudinal do paciente (Anexo A; D-W9-07; D-W9-12; Q45).
// Projeção pura a partir dos fatos confirmados por regra/clique. `stageHistory` é imutável
// e `historicalMetastaticDisease` nunca volta a false. Nada aqui vira ordem clínica.
import { PatientTimeline } from "../../contracts/w10/clinico-w10.js";
import type { ClinicalFact, ReviewException } from "../extracao/tipos.js";
import { historicalMetastaticDisease } from "../extracao/safety.js";
import { normalizarDataCivil } from "../extracao/normalizacao.js";
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
    const tipo = v.tipo === "PATOLOGICO" ? "PATOLOGICO" as const
      : v.tipo === "POS_TRATAMENTO" ? "POS_TRATAMENTO" as const : "CLINICO" as const;
    return {
      tipo,
      valor: literalDoEstagio(f),
      sistema: typeof v.sistema === "string" && v.sistema.trim() ? v.sistema : "AJCC 8",
      data: normalizarDataCivil(f.date ?? null),
      sourceId: f.sourceId,
    };
  }).filter((e) => e.valor.trim() !== "")
    .sort((a, b) => (a.data ?? "9999").localeCompare(b.data ?? "9999")
      || a.sourceId.localeCompare(b.sourceId) || a.valor.localeCompare(b.valor));
}

function dataMinima(fatos: readonly ClinicalFact[]): string | null {
  const datas = fatos.map((f) => normalizarDataCivil(f.date ?? null)).filter((d): d is string => d !== null);
  return datas.length ? datas.sort()[0]! : null;
}

/** Tratamento em cinco estados de entidade (não é semáforo): proposto→prescrito→administrado→suspenso→concluído. */
export function tratamentoLongitudinal(fatos: readonly ClinicalFact[]) {
  const t = reconciliarTratamento(fatos);
  const ciclo = (() => {
    const numeros = fatos.filter((f) => f.domain === "cycle")
      .map((f) => Number(valor(f).numero ?? f.value)).filter((n) => Number.isInteger(n) && n > 0);
    return numeros.length ? Math.max(...numeros) : null;
  })();
  const entrada = (regimen: string, status: "PROPOSTO" | "PRESCRITO" | "ADMINISTRADO" | "SUSPENSO_ADIADO" | "CONCLUIDO") => {
    const relacionados = fatos.filter((f) => f.domain === "drug" || f.domain === "regimen" || f.domain === "cycle");
    return {
      regimen,
      templateId: null,
      // intenção clínica ≠ finalidade APAC (D-W9-12): nunca deduzida aqui
      intent: null,
      line: null,
      cycle: status === "PRESCRITO" || status === "ADMINISTRADO" ? ciclo : null,
      status,
      em: dataMinima(relacionados),
      sourceIds: [...new Set(relacionados.map((f) => f.sourceId))].sort(),
    };
  };
  const entradas = [
    ...t.proposto.map((r) => entrada(r, "PROPOSTO")),
    ...t.prescrito.map((r) => entrada(r, "PRESCRITO")),
    ...t.administrado.map((r) => entrada(r, "ADMINISTRADO")),
    ...t.suspensoAdiado.map((r) => entrada(r, "SUSPENSO_ADIADO")),
    ...t.concluido.map((r) => entrada(r, "CONCLUIDO")),
  ];
  const vistos = new Set<string>();
  return entradas.filter((e) => {
    const chave = `${e.regimen}\u0000${e.status}`;
    if (vistos.has(chave)) return false;
    vistos.add(chave);
    return true;
  }).sort((a, b) => a.regimen.localeCompare(b.regimen) || a.status.localeCompare(b.status));
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
