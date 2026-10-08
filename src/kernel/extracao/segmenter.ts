import type { EncounterSegment, FactSourceType } from "./tipos.js";
import { normalizarLateralidade, normalizarSitioAnatomico } from "./normalizacao.js";

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
  readonly greetedName: string | null;
  readonly greeting: boolean;
  readonly age: string | null;
  readonly sex: string | null;
  readonly tumor: string | null;
  readonly tumorSide: string | null;
  readonly companion: string | null;
  readonly newExamSet: boolean;
}

function sinais(text: string): Signals {
  // "Chamo"/"próximo" é uma chamada explícita, não uma menção incidental de nome.
  const match = text.match(
    /(?:\bchamo\b|\bpróxim[oa](?:\s+paciente)?\b|\bnova consulta com\b)\s*:?\s*([\p{L}]+(?:\s+[\p{L}0-9]+){0,3})/iu,
  );
  // A greeting vocative is only a candidate, weaker than an explicit patient call.
  // Anchor to the turn opening and require punctuation to avoid incidental names.
  const greetedName = match ? null : text.match(
    /^\s*(?:bom dia|boa tarde|boa noite|olá)\s*[,:]\s*([\p{L}][\p{L}'’-]*(?:\s+[\p{L}][\p{L}'’-]*){0,7})\s*(?=[.,;:!?]|$)/iu,
  )?.[1]?.trim() ?? null;
  const age = text.match(/\b(\d{1,3})\s+anos\b/iu)?.[1] ?? null;
  const sex = text.match(/\b(?:sexo\s*:?\s*)?(feminino|masculino)\b/iu)?.[1]?.toLowerCase() ?? null;
  const tumor = sitioTumoral(text);
  const companion = text.match(/\bacompanhante\s*:\s*([\p{L}]+)/iu)?.[1]?.toLowerCase() ?? null;
  return {
    calledName: match?.[1]?.trim() ?? null,
    greetedName,
    greeting: /\b(?:bom dia|boa tarde|boa noite|olá|nova consulta)\b/iu.test(text),
    age, sex, tumor, tumorSide: lateralidadeTumoral(text, tumor), companion,
    newExamSet: /\b(?:novo conjunto de exames|nova pasta de exames)\b/iu.test(text),
  };
}

/** Only laterality next to a recognized tumor site is a segmentation signal. */
function lateralidadeTumoral(text: string, tumor: string | null): string | null {
  if (!tumor) return null;
  const lados = new Set<string>();
  for (const match of text.matchAll(/\b(?:tumor|neoplasia)\s+(?:de\s+)?([\p{L}]+(?:\s+[\p{L}]+){0,4})/giu)) {
    if (sitioTumoral(match[0]) !== tumor) continue;
    for (const side of (match[1] ?? "").matchAll(/\b(direit[ao]|esquerd[ao]|bilateral)\b/giu)) {
      const canonico = normalizarLateralidade(side[1], tumor);
      if (canonico) lados.add(canonico);
    }
  }
  return lados.size === 1 ? [...lados][0]! : null;
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
    const uncertainHomonym = !!current.greetedName && !!name
      && current.greetedName.toLocaleLowerCase("pt-BR") === name.toLocaleLowerCase("pt-BR")
      && !!current.tumor && current.tumor === previous?.tumor
      && !!current.tumorSide && !!previous?.tumorSide && current.tumorSide !== previous.tumorSide;
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
    const opensBoundary: boolean = group.length > 0 && (differentName || newCall || demographicShift || uncertainHomonym ||
      (companionShift && current.greeting) || newExamContext ||
      (longPause && (current.greeting || !!current.calledName)));
    if (opensBoundary) {
      if (uncertainHomonym) boundaryReviewRequired = true;
      flush();
      boundaryConfidence = current.calledName && current.greeting ? 0.95 : 0.5;
      boundaryReviewRequired = boundaryConfidence < 0.9;
      name = null;
      prior = null;
    }
    group.push(turn);
    if (current.calledName) name = current.calledName;
    else if (!name && current.greetedName) name = current.greetedName;
    const previousWithinSegment: Signals | null = opensBoundary ? null : previous;
    prior = {
      calledName: name,
      greetedName: current.greetedName,
      greeting: current.greeting,
      // Signals remain known until contradicted or the segment is flushed.
      // A turn without demographics must not erase the last observed values.
      age: current.age ?? previousWithinSegment?.age ?? null,
      sex: current.sex ?? previousWithinSegment?.sex ?? null,
      tumor: current.tumor ?? previousWithinSegment?.tumor ?? null,
      tumorSide: current.tumorSide ?? previousWithinSegment?.tumorSide ?? null,
      companion: current.companion ?? previousWithinSegment?.companion ?? null,
      newExamSet: current.newExamSet,
    };
  }
  flush();
  return output;
}
