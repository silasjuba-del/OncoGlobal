import type { EncounterSegment, FactSourceType } from "./tipos.js";

// PROVISORIO-W10: ajustar sinais/limiares ao contrato w10, sem implicar vínculo de paciente.
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
  const tumor = text.match(/\b(?:tumor|neoplasia)\s+(?:de\s+)?([\p{L}]+)/iu)?.[1]?.toLowerCase() ?? null;
  const companion = text.match(/\bacompanhante\s*:\s*([\p{L}]+)/iu)?.[1]?.toLowerCase() ?? null;
  return {
    calledName: match?.[1]?.trim() ?? null,
    greeting: /\b(?:bom dia|boa tarde|boa noite|olá|nova consulta)\b/iu.test(text),
    age, sex, tumor, companion,
    newExamSet: /\b(?:novo conjunto de exames|nova pasta de exames)\b/iu.test(text),
  };
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
    const differentName = !!current.calledName && !!name &&
      current.calledName.toLocaleLowerCase("pt-BR") !== name.toLocaleLowerCase("pt-BR");
    const newCall = !!current.calledName && !name && group.length > 0;
    const demographicShift = !!prior &&
      ((!!current.age && !!prior.age && current.age !== prior.age) ||
       (!!current.sex && !!prior.sex && current.sex !== prior.sex) ||
       (!!current.tumor && !!prior.tumor && current.tumor !== prior.tumor));
    const companionShift = !!current.companion && !!prior?.companion &&
      current.companion !== prior.companion;
    const newExamContext = current.newExamSet && current.greeting;
    const longPause = group.length > 0 && turn.startMs !== null && group.at(-1)?.endMs != null
      && turn.startMs - group.at(-1)!.endMs! >= 60_000;
    // Chamada explícita + saudação dá fronteira mais forte; qualquer sinal isolado fica em revisão.
    if (group.length > 0 && (differentName || newCall || demographicShift ||
        (companionShift && current.greeting) || newExamContext ||
        (longPause && (current.greeting || !!current.calledName)))) {
      flush();
      boundaryConfidence = current.calledName && current.greeting ? 0.95 : 0.5;
      boundaryReviewRequired = boundaryConfidence < 0.9;
      name = null;
      prior = null;
    }
    group.push(turn);
    if (current.calledName) name = current.calledName;
    prior = {
      calledName: name,
      greeting: current.greeting,
      age: current.age,
      sex: current.sex,
      tumor: current.tumor,
      companion: current.companion,
      newExamSet: current.newExamSet,
    };
  }
  flush();
  return output;
}
