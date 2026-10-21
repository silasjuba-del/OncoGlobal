import { detectarEmergencias, type RulesetRads } from "../rules/radsEmergencias.js";

/** Sem corpus/texto nao ha avaliacao. Uma lista vazia so descreve avaliacao executada ou fonte nao radiologica. */
export function avaliarRadsRascunho(sourceType: unknown, texto: string, sourceId: string,
  ruleset: RulesetRads | null | undefined) {
  if (sourceType !== "imaging_report") return { alertasRads: [], diagnostics: [] };
  if (!ruleset || !texto.trim()) return { alertasRads: null, diagnostics: ["RADS_NAO_AVALIADO"] };
  return { alertasRads: detectarEmergencias(texto, ruleset).alertas.map(a => ({ ...a, sourceId })), diagnostics: [] };
}
