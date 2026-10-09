// Pipeline de extração multimodal — 9 etapas puras encadeadas (D-W9-33; spec §1).
// Sem I/O, sem relógio, sem rede: cada etapa recebe e devolve dados.
// "IA EXTRAI TUDO. CÓDIGO RECONCILIA. MÉDICO SÓ RESOLVE EXCEÇÕES."
import type {
  ClinicalFact, EncounterSegment, PatientCandidate, ReconciledField,
  ReviewAction, ReviewException,
} from "../kernel/extracao/tipos.js";
import {
  ClinicalFact as ClinicalFactContract, ReviewAction as ReviewActionContract,
} from "../contracts/w10/extracao.js";
import { createHash } from "node:crypto";
import type { PatientTimeline } from "../contracts/w10/clinico-w10.js";
import { segmentarTranscricao } from "../kernel/extracao/segmenter.js";
import { rankearPacientes, type IdentityHints, type RegistryPatient } from "../kernel/extracao/patient-resolver.js";
import { extratorDeterministico } from "../kernel/extracao/extrator.js";
import { normalizarDataCivil, normalizarFatos as normalizar } from "../kernel/extracao/normalizacao.js";
import {
  conflitoPlanejadoOrdenado, detectarConflitos, reconciliarCampos,
} from "../kernel/extracao/reconciliacao.js";
import {
  deduplicarFatos as deduplicarFontes, type FonteParaDedupe, type ResultadoDeduplicacao,
} from "../kernel/extracao/deduplicacao.js";
// A mesma função pura usada na etapa 5 está disponível para confrontos offline.
export { detectarConflitos } from "../kernel/extracao/reconciliacao.js";
export { aplicarAcaoRevisao, type ResultadoAcaoRevisao } from "../kernel/extracao/eventoRevisao.js";
import { validarSegurancaAntiAlucinacao, type ViolacaoInvariante } from "../kernel/extracao/safety.js";
import {
  excecaoDeFarmacoIncerto, excecaoDeNumeroFalado, excecoesDeVinculo, montarCaixaRevisao,
  type CaixaRevisao,
} from "../kernel/extracao/caixaRevisao.js";
import { faltantesObrigatorios, requiredBiomarkers } from "../kernel/extracao/biomarcadores.js";
import { excecoesProgressao, seriesDeImagem, type SerieImagem } from "../kernel/projections/radiologia.js";
import { projetarTimelinePaciente } from "../kernel/projections/timelinePaciente.js";

export interface ExtractionSource extends FonteParaDedupe {
  /** Contexto é enviado pelo chamador local, não derivado do texto ou do score. */
}

export interface ExtractionInput extends ExtractionSource {
  /** Entradas adicionais explícitas: não há acesso oculto a store/documentos. */
  readonly additionalSources?: readonly ExtractionSource[];
  /** Cadastro e pistas vêm do chamador local; texto livre sozinho não prova identidade. */
  readonly registeredPatients?: readonly RegistryPatient[];
  readonly identityHintsBySegment?: Readonly<Record<string, IdentityHints>>;
  readonly openedPatientId?: string;
  /** Contexto local do tumor (cadastro/consulta aberta) para o Biomarker Requirement Engine. */
  readonly tumorContexto?: Readonly<{ tumor?: string; histologia?: string | null; estadio?: string | null }>;
  /** Ações médicas JÁ persistidas no ledger; entram por parâmetro, nunca nascem aqui (D-W9-34a). */
  readonly confirmacoes?: readonly ReviewAction[];
}

export interface ExtractionState {
  readonly input: ExtractionInput;
  readonly segments: readonly EncounterSegment[];
  readonly patientCandidates: readonly PatientCandidate[];
  readonly facts: readonly ClinicalFact[];
  readonly deduplicacao: ResultadoDeduplicacao;
  readonly fields: Readonly<Record<string, ReconciledField>>;
  readonly conflitos: readonly ReviewException[];
  readonly exceptions: readonly ReviewException[];
  readonly rejeitados: readonly ClinicalFact[];
  /** Raw facts that failed the strict runtime contract; retained for draft/review diagnostics. */
  readonly factContractRejections: readonly FactContractRejection[];
  readonly violacoes: readonly ViolacaoInvariante[];
  readonly caixaRevisao: CaixaRevisao;
  readonly series: readonly SerieImagem[];
  /** Projeção do primeiro paciente ligado; null enquanto não houver decisão persistida. */
  readonly timeline: PatientTimeline | null;
  readonly timelines: readonly PatientTimeline[];
  readonly confirmationRequired: readonly ReviewException[];
}

export interface FactContractRejection {
  readonly rawFact: unknown;
  readonly diagnostics: readonly string[];
}

export interface FactContractValidation {
  readonly facts: readonly ClinicalFact[];
  readonly rejected: readonly FactContractRejection[];
}

/** Validate runtime extractor output before normalization or reconciliation. */
export function validarFatosContraContrato(fatos: readonly unknown[]): FactContractValidation {
  const facts: ClinicalFact[] = [];
  const rejected: FactContractRejection[] = [];
  for (const rawFact of fatos) {
    try {
      const parsed = ClinicalFactContract.safeParse(rawFact);
      if (parsed.success) facts.push(parsed.data);
      else rejected.push({
        rawFact,
        diagnostics: parsed.error.issues.map((issue) => {
          const path = issue.path.map(String).join(".") || "<root>";
          return `${path}: ${issue.message}`;
        }),
      });
    } catch {
      // Malformed runtime values are expected input failures; retain the raw candidate and do not abort the draft.
      rejected.push({ rawFact, diagnostics: ["<root>: contrato não pôde inspecionar o fato"] });
    }
  }
  return { facts, rejected };
}

function base(input: ExtractionInput): ExtractionState {
  return {
    input, segments: [], patientCandidates: [], facts: [],
    deduplicacao: { repeticoes: [], versoesDiscordantes: [], fatoRepetidoIds: [] },
    fields: {}, conflitos: [],
    exceptions: [], rejeitados: [], factContractRejections: [], violacoes: [],
    caixaRevisao: { itens: [], resumo: { reconciliadosAutomaticamente: 0, precisamConfirmacao: 0, texto: "", lista: [] } },
    series: [], timeline: null, timelines: [], confirmationRequired: [],
  };
}

function fontes(input: ExtractionInput): readonly ExtractionSource[] {
  return [input, ...(input.additionalSources ?? [])];
}

/** 1 — Segmenter preliminar: uma entrada não é tomada como um paciente. */
export function segmentar(state: ExtractionState): ExtractionState {
  const { input } = state;
  return {
    ...state,
    segments: fontes(input).flatMap((fonte) => fonte.rawTranscript.trim()
      ? segmentarTranscricao({
        recordingId: fonte.recordingId,
        sourceId: fonte.sourceId,
        sourceType: fonte.sourceType,
        ...(fonte.page === undefined ? {} : { page: fonte.page }),
        turns: fonte.rawTranscript.split(/\r?\n/).map((text) => ({ text, startMs: null, endMs: null })),
      }) : []),
  };
}

/** 2 — PatientResolver: sem evidência de cadastro, zero candidato/vínculo. */
export function identificarPaciente(state: ExtractionState): ExtractionState {
  const { input } = state;
  return {
    ...state,
    patientCandidates: state.segments.flatMap((segment) =>
      rankearPacientes(
        segment.id,
        input.identityHintsBySegment?.[segment.id] ?? {},
        input.registeredPatients ?? [],
        { desidentified: segment.sourceType === "plaud", ...(input.openedPatientId
          ? { openedPatientId: input.openedPatientId } : {}) },
      )),
  };
}

/** 3 — porta do extrator (dublê determinístico dos sintéticos; LLM desligada). */
export function extrairFatos(state: ExtractionState): ExtractionState {
  const valida = validarFatosContraContrato(state.segments.flatMap((segment) =>
    extratorDeterministico.extrair(segment)));
  return { ...state, facts: valida.facts, factContractRejections: valida.rejected };
}

/** Chave de conteúdo: mesmo segmento, mesma fonte, mesmo domínio, valor, frase original e data. */
function chaveDeConteudo(fact: ClinicalFact): string {
  return createHash("sha256").update(JSON.stringify([
    fact.segmentId, fact.sourceId, fact.domain, fact.value ?? null, fact.rawEvidence, fact.date ?? null,
  ])).digest("hex");
}

/**
 * Colapsa fatos com conteúdo idêntico na mesma fonte e segmento (laudo reimpresso ou repetido),
 * mantendo a primeira ocorrência. Conteúdo divergente nunca é descartado: segue para reconciliação.
 */
export function deduplicarFatos(fatos: readonly ClinicalFact[]): readonly ClinicalFact[];
export function deduplicarFatos(fatos: readonly ClinicalFact[], fontes: readonly FonteParaDedupe[]): ResultadoDeduplicacao;
export function deduplicarFatos(fatos: readonly ClinicalFact[], fontes?: readonly FonteParaDedupe[]): readonly ClinicalFact[] | ResultadoDeduplicacao {
  if (fontes !== undefined) return deduplicarFontes(fatos, fontes);
  const vistos = new Set<string>();
  return fatos.filter((fact) => {
    const chave = chaveDeConteudo(fact);
    if (vistos.has(chave)) return false;
    vistos.add(chave);
    return true;
  });
}

/** 4 — normalização: unidades, data civil −03:00, lateralidade, sítio, fármaco, TNM; depois deduplicação. */
export function normalizarFatos(state: ExtractionState): ExtractionState {
  return { ...state, facts: deduplicarFatos(normalizar(state.facts)) };
}

/** 5 — reconciliação multifonte: cada campo vira `ReconciledField` + conflitos explícitos. */
function vinculosPersistidos(state: ExtractionState): ReadonlyMap<string, string> {
  // Pré-condição do ExtractionInput: `confirmacoes` foi lido do ledger canônico
  // pelo chamador autenticado. Aqui apenas se confere formato/escopo; este
  // módulo puro não atesta persistência e não aceita ações diretamente de HTTP.
  const confirmados = new Map<string, string>();
  for (const segment of state.segments) {
    const exceptionId = `exc:UNLINKED_PATIENT:${segment.id}`;
    const pacientes = new Set((state.input.confirmacoes ?? []).flatMap((acao) => {
      const validada = ReviewActionContract.safeParse(acao);
      if (!validada.success || validada.data.acao !== "LIGAR_PACIENTE"
        || validada.data.exceptionId !== exceptionId || !validada.data.medicoId.trim()) return [];
      const patientId = validada.data.patientId;
      return typeof patientId === "string" && patientId.trim() ? [patientId] : [];
    }));
    // Decisões conflitantes não autorizam reconciliação entre pacientes.
    if (pacientes.size === 1) confirmados.set(segment.id, [...pacientes][0]!);
  }
  return confirmados;
}

function conflitosDeTratamentoEntreFontes(
  state: ExtractionState, deduplicacao: ResultadoDeduplicacao,
): readonly ReviewException[] {
  const ligados = vinculosPersistidos(state);
  const porGravacao = new Map(fontes(state.input).map((fonte) => [fonte.recordingId, fonte]));
  const porEncontro = new Map<string, ClinicalFact[]>();
  const escopoPorFactId = new Map<string, string>();
  const dataClinicaPorSegmento: Record<string, string> = {};
  for (const segment of state.segments) {
    const patientId = ligados.get(segment.id);
    const contexto = porGravacao.get(segment.recordingId)?.contexto;
    const data = contexto ? normalizarDataCivil(contexto.dataClinica) : null;
    if (!patientId || !contexto?.encounterId.trim() || !data) continue;
    dataClinicaPorSegmento[segment.id] = data;
    const escopo = JSON.stringify([patientId, contexto.encounterId.trim(), data]);
    const grupo = porEncontro.get(escopo) ?? [];
    for (const fact of state.facts) {
      if (fact.segmentId !== segment.id || (fact.domain !== "plan" && fact.domain !== "drug")) continue;
      grupo.push(fact);
      escopoPorFactId.set(fact.id, escopo);
    }
    porEncontro.set(escopo, grupo);
  }
  const repetidosNesteEncontro = new Set<string>();
  for (const repeticao of deduplicacao.repeticoes) {
    const escoposPrincipais = new Set(repeticao.fatoPrincipalIds.map((id) => escopoPorFactId.get(id)));
    for (const id of repeticao.fatoRepetidoIds) {
      const escopo = escopoPorFactId.get(id);
      if (escopo && escoposPrincipais.has(escopo)) repetidosNesteEncontro.add(id);
    }
  }
  return [...porEncontro.values()].flatMap((grupo) => {
    const unicos = grupo.filter((f) => !repetidosNesteEncontro.has(f.id));
    if (new Set(unicos.map((f) => f.segmentId)).size < 2) return [];
    const conflito = conflitoPlanejadoOrdenado(unicos, {
      mesmoPacienteEEncontroConfirmados: true, dataClinicaPorSegmento,
    });
    return conflito ? [conflito] : [];
  });
}

export function reconciliarFontes(state: ExtractionState): ExtractionState {
  const deduplicacao = deduplicarFontes(state.facts, fontes(state.input));
  const grupos = [...new Set(state.facts.map((fact) => fact.segmentId))]
    .map((segmentId) => ({ segmentId, facts: state.facts.filter((fact) => fact.segmentId === segmentId) }));
  // Campos permanecem por segmento; só plano × prescrição podem ser confrontados
  // entre fontes, e somente com decisão de vínculo já persistida + mesmo encontro/data.
  const locais = grupos.flatMap(({ facts }) => detectarConflitos(facts));
  const entreFontes = conflitosDeTratamentoEntreFontes(state, deduplicacao);
  const idsEntreFontes = new Set(entreFontes.map((c) => c.id));
  return {
    ...state,
    deduplicacao,
    fields: Object.fromEntries(grupos.flatMap(({ segmentId, facts }) =>
      Object.entries(reconciliarCampos(facts)).map(([key, value]) =>
        [grupos.length > 1 ? `${segmentId}::${key}` : key, value]))),
    conflitos: [
      ...locais.filter((c) => !idsEntreFontes.has(c.id)),
      ...entreFontes,
      ...deduplicacao.versoesDiscordantes.map((grupo, indice) => ({
        id: `exc:CONFLICT:versao-documental:${indice}`,
        kind: "CONFLICT" as const,
        segmentId: null, factIds: [...grupo.factIds],
        reason: `mesma identidade de exame com conteúdo ou versão discordante (${grupo.chaveExame}): conferir fontes`,
        sourceIds: [...new Set(grupo.fontes.map((f) => f.sourceId))],
      })),
    ],
  };
}

/** 6 — SafetyValidator: os 7 invariantes anti-alucinação (FUGU-08). */
export function validarSeguranca(state: ExtractionState): ExtractionState {
  const resultados = [...new Set(state.facts.map((fact) => fact.segmentId))].map((segmentId) =>
    validarSegurancaAntiAlucinacao(state.facts.filter((fact) => fact.segmentId === segmentId), {
      conflitoTemporalDetectado: state.conflitos.some((c) => c.kind === "TEMPORAL_CONFLICT" && c.segmentId === segmentId),
    }));
  return { ...state, facts: resultados.flatMap((r) => r.facts),
    rejeitados: resultados.flatMap((r) => r.rejeitados), violacoes: resultados.flatMap((r) => r.violacoes) };
}

/** 7 — conflitos/pendências viram a caixa de revisão (o que vai ao médico). */
export function classificarExcecoes(state: ExtractionState): ExtractionState {
  const vinculos = state.segments.flatMap((segment) => excecoesDeVinculo({
    id: segment.id, sourceId: segment.sourceId,
    boundaryReviewRequired: segment.boundaryReviewRequired,
  }));
  const numerosFalados = state.facts
    .filter((f) => f.sourceType === "plaud" && f.requiresConfirmation
      && (f.domain === "lab" || f.domain === "cycle" || f.domain === "imaging"))
    .map(excecaoDeNumeroFalado);
  const farmacosIncertos = state.facts.filter((f) => f.domain === "drug" && f.requiresConfirmation
    && (f.evidence === "INFERRED" || f.evidence === "UNCERTAIN"))
    .map(excecaoDeFarmacoIncerto);
  const grupos = state.segments.length
    ? state.segments.map(({ id }) => ({ segmentId: id, facts: state.facts.filter((fact) => fact.segmentId === id) }))
    : [{ segmentId: null, facts: state.facts }];
  const series = grupos.flatMap(({ facts }) => seriesDeImagem(facts));
  const progressoes = excecoesProgressao(series);
  const faltantes = grupos.flatMap(({ segmentId, facts }) => {
    // Contexto único da entrada não pode ser herdado por vários pacientes.
    const contexto = state.segments.length <= 1 ? state.input.tumorContexto : undefined;
    const requisitos = requiredBiomarkers({
      tumor: contexto?.tumor ?? tumorDosFatos(facts),
      histologia: contexto?.histologia ?? histologiaDosFatos(facts),
      estadio: contexto?.estadio ?? null,
    });
    return faltantesObrigatorios(facts, requisitos, segmentId);
  });
  const caixaRevisao = montarCaixaRevisao({
    fatos: state.facts,
    conflitos: state.conflitos, vinculos,
    faltantes: [...faltantes], progressoes: [...progressoes],
  });
  return {
    ...state,
    series,
    exceptions: [
      ...caixaRevisao.itens,
      ...numerosFalados.filter((e) => !caixaRevisao.itens.some((i) => i.factIds.some((f) => e.factIds.includes(f)))),
      ...farmacosIncertos.filter((e) => !caixaRevisao.itens.some((i) => i.kind === "UNCERTAIN_DRUG" && i.factIds.some((f) => e.factIds.includes(f)))),
    ],
    caixaRevisao,
  };
}

function tumorDosFatos(fatos: readonly ClinicalFact[]): string | null {
  for (const fact of fatos) {
    if (fact.domain !== "diagnosis") continue;
    const v = typeof fact.value === "object" && fact.value !== null
      ? fact.value as Record<string, unknown> : {};
    if (typeof v.sitioCanonico === "string" && v.sitioCanonico.trim()) return v.sitioCanonico;
  }
  return null;
}

function histologiaDosFatos(fatos: readonly ClinicalFact[]): string | null {
  for (const fact of fatos) {
    if (fact.domain !== "histology") continue;
    if (typeof fact.value === "string" && fact.value.trim()) return fact.value.trim();
    const v = typeof fact.value === "object" && fact.value !== null
      ? fact.value as Record<string, unknown> : {};
    if (typeof v.texto === "string" && v.texto.trim()) return v.texto.trim();
  }
  return null;
}

/** 8 — timeline longitudinal só para paciente ligado por decisão persistida. */
export function projetarTimeline(state: ExtractionState): ExtractionState {
  const porId = new Map(state.exceptions.map((e) => [e.id, e]));
  const conflitantes = new Set(["CONFLICT", "TEMPORAL_CONFLICT", "INTERVAL_PROGRESSION"]);
  const ligados = vinculosPersistidos(state);
  const timelines: PatientTimeline[] = [];
  for (const segment of state.segments) {
    const patientId = ligados.get(segment.id);
    const excecao = porId.get(`exc:UNLINKED_PATIENT:${segment.id}`);
    if (!patientId || excecao?.kind !== "UNLINKED_PATIENT") continue;
    const fatos = state.facts.filter((f) => f.segmentId === segment.id);
    if (!fatos.length) continue;
    // Ligar a fonte ao paciente NÃO confirma uma intenção falada ou um fármaco
    // ainda incerto. O contrato longitudinal de tratamentos não carrega
    // incerteza: até decisão clínica específica, eles ficam só em facts/caixa.
    const fatosParaTimeline = fatos.filter((f) =>
      (f.domain !== "plan" && f.domain !== "drug" && f.domain !== "regimen" && f.domain !== "cycle")
      || (f.evidence === "EXPLICIT" && !f.requiresConfirmation));
    const conflitos = state.exceptions
      .filter((e) => conflitantes.has(e.kind) && e.segmentId === segment.id);
    const faltantes = state.exceptions
      .filter((e) => e.kind === "MISSING_REQUIRED" && e.segmentId === segment.id)
      .map((e) => e.reason.replace(/^campo obrigatório ausente para [^:]+: /, "").replace(/ \(NÃO SEI.*$/, ""));
    timelines.push(projetarTimelinePaciente({
      patientId, fatos: fatosParaTimeline, conflitos, missingRequiredData: faltantes,
    }));
  }
  const ordenadas = timelines.sort((a, b) => a.patientId.localeCompare(b.patientId));
  return { ...state, timelines: ordenadas, timeline: ordenadas[0] ?? null };
}

/** 9 — apenas prepara exceções; nunca confirma, grava ou assina. */
export function prepararConfirmacaoMedica(state: ExtractionState): ExtractionState {
  return { ...state, confirmationRequired: [...state.exceptions] };
}

/** Nove transformações síncronas e puras, em ordem normativa; nenhuma faz I/O. */
export function executarPipelineExtracao(input: ExtractionInput): ExtractionState {
  const entradas = fontes(input);
  if (entradas.some((fonte) => !fonte.recordingId.trim() || !fonte.sourceId.trim())) {
    throw new Error("Cada entrada exige recordingId e sourceId");
  }
  if (new Set(entradas.map((fonte) => fonte.recordingId)).size !== entradas.length) {
    // O segmentador deriva IDs do recordingId; colisão confundiria pacientes/fatos.
    throw new Error("Entradas multifonte exigem recordingId distintos");
  }
  return prepararConfirmacaoMedica(
    projetarTimeline(
      classificarExcecoes(
        validarSeguranca(
          reconciliarFontes(
            normalizarFatos(
              extrairFatos(
                identificarPaciente(segmentar(base(input))),
              ),
            ),
          ),
        ),
      ),
    ),
  );
}
