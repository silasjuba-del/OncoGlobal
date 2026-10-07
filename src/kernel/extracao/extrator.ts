import type { ClinicalFact, EncounterSegment, FactDomain, FactEvidence } from "./tipos.js";

export interface Extrator {
  extrair(segmento: EncounterSegment): readonly ClinicalFact[];
}

/** Dublê determinístico para textos sintéticos, não LLM, não emite ordens clínicas. */
export const extratorDeterministico: Extrator = {
  extrair(segmento) {
    const result: ClinicalFact[] = [];
    const lines = segmento.rawTranscript.split(/\r?\n/);
    for (const [lineIndex, line] of lines.entries()) {
      const raw = line.trim();
      if (!raw || /\[RISCADO\]|\[\/RISCADO\]/iu.test(raw)) continue;
      // Negação de achado não pode ser transformada em achado positivo.
      const negated = /\b(?:não há|sem sinais de|sem evidência de|sem lesões|não observamos|nega)(?:\s|$)/iu.test(raw);
      const add = (domain: FactDomain, value: unknown, evidence: FactEvidence = "EXPLICIT",
        confirmation = false, regra?: string): void => {
        const spokenNumber = segmento.sourceType === "plaud" &&
          /\b\d+(?:[.,]\d+)?\b|\b(?:quatorze|quinze|dez|vinte|trinta)\b/iu.test(raw);
        result.push({
          id: `${segmento.id}:f${lineIndex}:${result.length}`,
          segmentId: segmento.id,
          patientCandidateId: null,
          domain, value, sourceType: segmento.sourceType,
          evidence, sourceId: segmento.sourceId, rawEvidence: raw,
          ...(segmento.page === undefined ? {} : { page: segmento.page }),
          ...(segmento.startMs === null ? {} : { timestampMs: segmento.startMs }),
          ...(raw.match(/\b\d{2}\/\d{2}\/\d{2,4}\b/iu)?.[0]
            ? { date: raw.match(/\b\d{2}\/\d{2}\/\d{2,4}\b/iu)![0] } : {}),
          confidence: spokenNumber ? 0.6 : evidence === "UNCERTAIN" ? 0.5 : 1,
          requiresConfirmation: confirmation || spokenNumber || evidence === "UNCERTAIN",
          ...(regra ? { regra } : {}),
        });
      };

      // Somente rótulos literais ou termos diagnósticos de fonte documental; ausência = nada.
      if (!negated && segmento.sourceType === "pathology") {
        const hist = raw.match(/\b(?:histologia|diagnóstico histológico)\s*:\s*([^.;]+)/iu);
        if (hist) add("histology", hist[1]?.trim());
      }
      const diagnosis = raw.match(/^\s*diagnóstico(?: oncológico)?\s*:\s*([^.;]+)/iu);
      if (diagnosis && !negated && !/\bNÃO SEI\b/iu.test(raw)) {
        add("diagnosis", diagnosis[1]?.trim());
      }
      const tnm = raw.match(
        /\b(?:yp|[cp])T[0-4X](?:[a-d])?\s+(?:yp|[cp])N[0-3X](?:[a-d])?\s+(?:yp|[cp])M[0-1X](?:[a-d])?\b/iu,
      ) ?? raw.match(/\b(?:yp|[cp])T[0-4X](?:[a-d])?N[0-3X](?:[a-d])?M[0-1X](?:[a-d])?\b/iu);
      if (tnm && !negated && !/\bNÃO SEI\b/iu.test(raw)) add("stage", tnm[0]);

      for (const marker of ["HER2", "RE", "RP", "Ki-67", "PD-L1"] as const) {
        const pattern = marker === "HER2"
          ? /\bHER2\s*[:=]?\s*(0|1\+|2\+|3\+)(?=$|[\s,;.)])/iu
          : marker === "PD-L1"
            ? /\bPD-L1\s*(?:TPS|CPS)\s*[:=]?\s*(\d+(?:[.,]\d+)?%?)(?=$|[\s,;.)])/iu
            : new RegExp(`\\b${marker}\\s*[:=]?\\s*(\\d+(?:[.,]\\d+)?\\s*%)(?=$|[\\s,;.)])`, "iu");
        const match = raw.match(pattern);
        if (!match || negated || /\bNÃO SEI\b/iu.test(raw)) continue;
        const method = /\bIHQ\b/iu.test(raw) ? "IHQ" : null;
        const antibody = marker === "PD-L1"
          ? raw.match(/\b(?:22C3|28-8|SP142|SP263)\b/iu)?.[0] ?? null : null;
        const incomplete = marker === "PD-L1" && !antibody;
        add("biomarker", { marker, raw: match[0], method, antibody, value: match[1] },
          incomplete ? "UNCERTAIN" : "EXPLICIT", incomplete);
      }

      // Valores literais com unidade; texto falado ambíguo nunca vira número calculado.
      const lab = raw.match(/\b(Hb|hemoglobina|creatinina|PSA|CEA)\s*[:=]?\s*(\d+(?:[.,]\d+)?)\s*(g\/dL|mg\/dL|ng\/mL|U\/mL)\b/iu);
      if (lab && !negated) add("lab", { marker: lab[1], value: lab[2], unit: lab[3] });
      if (segmento.sourceType === "plaud" &&
          /\b(?:creatinina|hemoglobina|PSA|CEA)\s+(?:quatorze|quinze|vinte)\b/iu.test(raw)) {
        add("lab", { raw, value: null, unit: null }, "UNCERTAIN", true);
      }

      if (!negated && /\b(?:dormência|formigamento|náusea|dor)\b/iu.test(raw)) {
        add("symptom", raw);
      }
      const imaging = raw.match(/\b(?:lesão|nódulo|foco)\s+(?:em|no|na|de)?\s*([\p{L}0-9]+)[^.;]*?\b(\d+(?:[.,]\d+)?)\s*(mm|cm)\b/iu);
      if (imaging && !negated) {
        add("imaging", {
          siteRaw: imaging[1], measureRaw: imaging[2], unit: imaging[3],
          lateralityRaw: raw.match(/\b(?:à esquerda|esquerda|à direita|direita)\b/iu)?.[0] ?? null,
        });
      } else if (segmento.sourceType === "imaging_report" && !negated &&
                 /\b(?:foco|lesão|nódulo)\b/iu.test(raw) && /\bL\d{1,2}\b/iu.test(raw)) {
        // Achado textual (não metástase): preserva trecho e sítio sem inventar medida.
        add("imaging", {
          siteRaw: raw.match(/\bL\d{1,2}\b/iu)?.[0], measureRaw: null, unit: null,
          lateralityRaw: raw.match(/\b(?:à esquerda|esquerda|à direita|direita)\b/iu)?.[0] ?? null,
        });
      }
      if (segmento.sourceType === "prescription" && !negated) {
        const drug = raw.match(/\b(carboplatina|cisplatina|paclitaxel|docetaxel|oxaliplatina)\b/iu);
        if (drug) add("drug", drug[0]);
        const cycle = raw.match(/\bciclo\s*(\d+)\b/iu);
        if (cycle) add("cycle", cycle[1]);
        const regimen = raw.match(/\b(?:protocolo|esquema)\s*:\s*([^.;]+)/iu);
        if (regimen) add("regimen", regimen[1]?.trim());
      }
      const plan = raw.match(/^\s*(?:plano|conduta verbalizada)\s*:\s*(.+)/iu);
      if (plan) add("plan", plan[1]?.trim());
    }
    return result;
  },
};
