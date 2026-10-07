import type { EncounterSegment, FactSourceType } from "./tipos.js";
import { normalizarSitioAnatomico } from "./normalizacao.js";

// Sinais/limiares de fronteira não implicam vínculo de paciente (D-W9-34a).
export interface TranscriptTurn {
  readonly text: string;
  readonly startMs: number | null;
  readonly endMs: number | null;
  readonly speaker?: string;
}
export interface SegmentationInput {
  readonly recordingId: string;
  readonly sourceId: string;
  readonly sourceType: FactSourceType;
  readonly page?: number;
  readonly turns: readonly TranscriptTurn[];
}

interface Signals {
  readonly calledName: string | null;
  readonly greeting: boolean;
  readonly age: string | null;
  readonly sex: string | null;
  readonly tumor: string | null;
  readonly companion: string | null;
  readonly newExamSet: boolean;
}

function sinais(text: string): Signals {
  // "Chamo"/"próximo" é uma chamada explícita, não uma menção incidental de nome.
  const match = text.match(
    /(?:\bchamo\b|\bpróxim[oa](?:\s+paciente)?\b|\bnova consulta com\b)\s*:?\s*([\p{L}]+(?:\s+[\p{L}0-9]+){0,3})/iu,
  );
  const age = text.match(/\b(\d{1,3})\s+anos\b/iu)?.[1] ?? null;
  const sex = text.match(/\b(?:sexo\s*:?\s*)?(feminino|masculino)\b/iu)?.[1]?.toLowerCase() ?? null;
  const tumor = sitioTumoral(text);
  const companion = text.match(/\bacompanhante\s*:\s*([\p{L}]+)/iu)?.[1]?.toLowerCase() ?? null;
  return {
    calledName: match?.[1]?.trim() ?? null,
    greeting: /\b(?:bom dia|boa tarde|boa noite|olá|nova consulta)\b/iu.test(text),
    age, sex, tumor, companion,
    newExamSet: /\b(?:novo conjunto de exames|nova pasta de exames)\b/iu.test(text),
  };
}

/** A boundary signal is only a site accepted by the existing anatomical normalizer. */
function sitioTumoral(text: string): string | null {
  const marcadores = /\b(?:tumor|neoplasia)\s+(?:de\s+)?([\p{L}]+(?:\s+[\p{L}]+){0,2})/giu;
  for (const marcador of text.matchAll(marcadores)) {
    const palavras = marcador[1]?.split(/\s+/u) ?? [];
    for (let tamanho = palavras.length; tamanho > 0; tamanho--) {
      for (let inicio = 0; inicio + tamanho <= palavras.length; inicio++) {
        const sitio = normalizarSitioAnatomico(palavras.slice(inicio, inicio + tamanho).join(" "));
        if (sitio) return sitio;
      }
    }
  }
  return null;
}

/** Segmentação por sinais explícitos; caso ambíguo separa e marca revisão, nunca une pacientes. */
export function segmentarTranscricao(input: SegmentationInput): readonly EncounterSegment[] {
  if (!input.recordingId.trim() || !input.sourceId.trim()) {
    throw new Error("Segmentação exige recordingId e sourceId");
  }
  const output: EncounterSegment[] = [];
  let group: TranscriptTurn[] = [];
  let name: string | null = null;
  let prior: Signals | null = null;
  let boundaryConfidence: number | null = null;
  let boundaryReviewRequired = true;

  function flush(): void {
    if (!group.length) return;
    output.push({
      id: `${input.recordingId}:${output.length}`,
      recordingId: input.recordingId,
      sourceId: input.sourceId,
      sourceType: input.sourceType,
      ...(input.page === undefined ? {} : { page: input.page }),
      startMs: group[0]?.startMs ?? null,
      endMs: group.at(-1)?.endMs ?? null,
      speakers: [...new Set(group.map((turn) => turn.speaker).filter((s): s is string => Boolean(s)))],
      candidateNames: name ? [name] : [],
      rawTranscript: group.map((turn) => turn.text).join("\n"),
      boundaryConfidence,
      boundaryReviewRequired,
      patientId: null,
    });
    group = [];
  }

  for (const turn of input.turns) {
    if (!turn.text.trim()) continue;
    const current = sinais(turn.text);
    const previous = prior as Signals | null;
    const differentName = !!current.calledName && !!name &&
      current.calledName.toLocaleLowerCase("pt-BR") !== name.toLocaleLowerCase("pt-BR");
    const newCall = !!current.calledName && !name && group.length > 0;
    const demographicShift: boolean = !!previous &&
      ((!!current.age && !!previous.age && current.age !== previous.age) ||
       (!!current.sex && !!previous.sex && current.sex !== previous.sex) ||
       (!!current.tumor && !!previous.tumor && current.tumor !== previous.tumor));
    const companionShift = !!current.companion && !!previous?.companion &&
      current.companion !== previous.companion;
    const newExamContext = current.newExamSet && current.greeting;
    const longPause = group.length > 0 && turn.startMs !== null && group.at(-1)?.endMs != null
      && turn.startMs - group.at(-1)!.endMs! >= 60_000;
    // Chamada explícita + saudação dá fronteira mais forte; qualquer sinal isolado fica em revisão.
    const opensBoundary: boolean = group.length > 0 && (differentName || newCall || demographicShift ||
      (companionShift && current.greeting) || newExamContext ||
      (longPause && (current.greeting || !!current.calledName)));
    if (opensBoundary) {
      flush();
      boundaryConfidence = current.calledName && current.greeting ? 0.95 : 0.5;
      boundaryReviewRequired = boundaryConfidence < 0.9;
      name = null;
      prior = null;
    }
    group.push(turn);
    if (current.calledName) name = current.calledName;
    const previousWithinSegment: Signals | null = opensBoundary ? null : previous;
    prior = {
      calledName: name,
      greeting: current.greeting,
      // Signals remain known until contradicted or the segment is flushed.
      // A turn without demographics must not erase the last observed values.
      age: current.age ?? previousWithinSegment?.age ?? null,
      sex: current.sex ?? previousWithinSegment?.sex ?? null,
      tumor: current.tumor ?? previousWithinSegment?.tumor ?? null,
      companion: current.companion ?? previousWithinSegment?.companion ?? null,
      newExamSet: current.newExamSet,
    };
  }
  flush();
  return output;
}
