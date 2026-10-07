// FUGU-07 · ReconciliationEngine (D-W9-33 §4/§7; D-W9-22c; D-W9-43).
// Cada campo vira `ReconciledField` com candidatos por fonte. Conflito nunca é escolhido
// em silêncio: ou a hierarquia do domínio decide com o conflito visível, ou o campo fica
// sem resolução (resolvedFactId null) até o médico decidir.
import type { ClinicalFact, FactDomain, FactSourceType, ReconciledField, ReviewException } from "./tipos.js";
import { g07Lateralidade } from "../harness/gates.js";
import {
  componenteM, DICIONARIO_FARMACO, normalizarDataCivil, normalizarLateralidade, normalizarSitioAnatomico,
} from "./normalizacao.js";

/** Ordem de precedência por domínio (spec §4). O primeiro é o mais forte. */
const HIERARQUIA: Readonly<Record<FactDomain, readonly FactSourceType[]>> = {
  diagnosis: ["pathology", "imaging_report", "medical_note", "nursing", "plaud"],
  histology: ["pathology", "medical_note", "nursing", "plaud"],
  stage: ["pathology", "imaging_report", "medical_note", "nursing", "plaud"],
  biomarker: ["pathology", "medical_note", "nursing", "plaud"],
  metastasis: ["pathology", "imaging_report", "medical_note", "nursing", "plaud"],
  drug: ["prescription", "administration", "medical_note", "nursing", "plaud"],
  regimen: ["prescription", "administration", "medical_note", "nursing", "plaud"],
  cycle: ["prescription", "administration", "medical_note", "nursing", "plaud"],
  symptom: ["plaud", "nursing", "medical_note", "imaging_report", "pathology"],
  toxicity: ["plaud", "nursing", "medical_note", "pathology"],
  lab: ["medical_note", "nursing", "administration", "plaud", "pathology"],
  imaging: ["imaging_report", "medical_note", "nursing", "plaud", "pathology"],
  procedure: ["pathology", "administration", "medical_note", "nursing", "plaud"],
  plan: ["medical_note", "prescription", "nursing", "plaud", "administration"],
};

/** Texto da hierarquia do domínio, exatamente como a spec §4 descreve. */
export const HIERARQUIA_TEXTO: Readonly<Record<FactDomain, string>> = {
  diagnosis: "diagnóstico: AP/imagem > evolução > enfermagem > Plaud",
  histology: "histologia: AP > IHQ > evolução > Plaud > enfermagem",
  stage: "estadiamento: AP + imagem > evolução estruturada > CID",
  biomarker: "biomarcador: AP/IHQ > evolução > Plaud",
  metastasis: "metástase: AP + imagem > evolução > Plaud",
  drug: "dose/protocolo/ciclo: prescrição > administração > evolução > Plaud",
  regimen: "dose/protocolo/ciclo: prescrição > administração > evolução > Plaud",
  cycle: "dose/protocolo/ciclo: prescrição > administração > evolução > Plaud",
  symptom: "sintoma: fala/Plaud ≈ enfermagem específica > evolução genérica",
  toxicity: "toxicidade: fala/Plaud ≈ enfermagem específica > evolução genérica",
  lab: "laboratório: resultado > evolução > Plaud (número falado pede confirmação)",
  imaging: "imagem: laudo > evolução > Plaud",
  procedure: "procedimento: AP/administração > evolução > Plaud",
  plan: "plano: evolução > prescrição > enfermagem > Plaud",
};

function rankDe(domain: FactDomain, sourceType: FactSourceType): number {
  const idx = HIERARQUIA[domain].indexOf(sourceType);
  return idx < 0 ? HIERARQUIA[domain].length : idx;
}

function valorComparavel(fact: ClinicalFact): string {
  return JSON.stringify(fact.value ?? null);
}

/** Literal TNM de um fato de estágio, seja string crua ou valor normalizado. */
export function literalDoEstagio(fact: ClinicalFact): string {
  if (typeof fact.value === "string") return fact.value;
  const v = typeof fact.value === "object" && fact.value !== null
    ? fact.value as Record<string, unknown> : {};
  return typeof v.literal === "string" ? v.literal : "";
}

/** Chave do campo reconciliado: agrupa fatos que disputam o mesmo valor. */
export function chaveDoFato(fact: ClinicalFact): string {
  const v = typeof fact.value === "object" && fact.value !== null
    ? fact.value as Record<string, unknown> : {};
  const sufixo = (valor: unknown): string =>
    typeof valor === "string" && valor.trim() ? `:${valor.trim().toLocaleUpperCase("pt-BR")}` : "";
  switch (fact.domain) {
    case "biomarker": return `biomarker${sufixo(v.marker)}`;
    case "lab": return `lab${sufixo(v.marker)}`;
    case "drug": return `drug${sufixo(v.normalizado ?? v.raw ?? fact.value)}`;
    case "imaging": return `imaging${sufixo(v.sitioCanonico ?? v.siteRaw)}`;
    default: return fact.domain;
  }
}

/**
 * Fato sem valor utilizável não pode "resolver" um campo: ausência fica PENDENTE.
 * Vale para valor nulo e para laboratório que não normalizou (número falado, unidade estranha).
 */
export function valorNaoResolvivel(fact: ClinicalFact): boolean {
  if (fact.value === null || fact.value === undefined) return true;
  if (fact.domain === "lab") {
    const v = fact.value as Record<string, unknown>;
    return v.normalizado !== true || v.value === null || v.value === undefined;
  }
  if (typeof fact.value === "string") return fact.value.trim() === "";
  if (fact.domain === "stage") return literalDoEstagio(fact).trim() === "";
  return false;
}

/** Reconcilia um campo: candidatos ordenados por hierarquia + conflito explícito. */
export function reconciliarCampo(domain: FactDomain, candidatos: readonly ClinicalFact[]): ReconciledField {
  const ordenados = [...candidatos].sort((a, b) =>
    rankDe(domain, a.sourceType) - rankDe(domain, b.sourceType) || a.id.localeCompare(b.id));
  const melhorRank = ordenados.length ? rankDe(domain, ordenados[0]!.sourceType) : -1;
  const noTopo = ordenados.filter((f) => rankDe(domain, f.sourceType) === melhorRank);
  const valoresTopo = new Set(noTopo.map(valorComparavel));
  const valoresAbaixo = new Set(ordenados.slice(noTopo.length).map(valorComparavel));
  const divergenciaInterna = valoresTopo.size > 1;
  const divergenciaHierarquica = !divergenciaInterna
    && [...valoresAbaixo].some((valor) => !valoresTopo.has(valor));
  const conflict = divergenciaInterna || divergenciaHierarquica;
  const eleito = noTopo[0] ?? null;
  return {
    domain,
    candidates: ordenados,
    // conflito entre fontes do mesmo nível não é decidido por id: fica para o médico
    // e fato sem valor utilizável não resolve o campo (ausência ≠ valor)
    resolvedFactId: divergenciaInterna || eleito === null || valorNaoResolvivel(eleito)
      ? null : eleito.id,
    conflict,
    hierarquia: HIERARQUIA_TEXTO[domain],
  };
}

/** Etapa 5 do pipeline: agrupa os fatos por campo e reconcilia cada grupo. */
export function reconciliarCampos(fatos: readonly ClinicalFact[]): Readonly<Record<string, ReconciledField>> {
  const grupos = new Map<string, ClinicalFact[]>();
  for (const fact of fatos) {
    const chave = chaveDoFato(fact);
    const atual = grupos.get(chave);
    if (atual) atual.push(fact); else grupos.set(chave, [fact]);
  }
  const campos: Record<string, ReconciledField> = {};
  for (const chave of [...grupos.keys()].sort()) {
    const candidatos = grupos.get(chave)!;
    campos[chave] = reconciliarCampo(candidatos[0]!.domain, candidatos);
  }
  return campos;
}

// ── Separação do tratamento em estados (spec §7) ──────────────────────────────
export interface TratamentoReconciliado {
  readonly proposto: readonly string[];
  readonly prescrito: readonly string[];
  readonly administrado: readonly string[];
  readonly suspensoAdiado: readonly string[];
  readonly concluido: readonly string[];
  /** "retiro carbo" × prescrição com carboplatina ⇒ true (nunca escolha silenciosa). */
  readonly conflitoPlanejadoOrdenado: boolean;
}

function nomesDeFarmaco(fatos: readonly ClinicalFact[], fonte: FactSourceType): string[] {
  return fatos.filter((f) => f.domain === "drug" && f.sourceType === fonte)
    .map((f) => {
      const v = typeof f.value === "object" && f.value !== null ? f.value as Record<string, unknown> : {};
      const nome = v.normalizado ?? v.raw ?? f.value;
      return typeof nome === "string" ? nome.trim().toLocaleUpperCase("pt-BR") : "";
    }).filter(Boolean);
}

/** Fármacos citados em texto livre, por casamento no dicionário local (sem adivinhar). */
export function farmacosMencionados(texto: string): string[] {
  const chave = texto.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLocaleLowerCase("pt-BR");
  const achados = new Set<string>();
  for (const [nome, canonico] of Object.entries(DICIONARIO_FARMACO)) {
    if (new RegExp(`\\b${nome.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`).test(chave)) achados.add(canonico);
  }
  return [...achados].sort();
}

const RETIRADA = /\b(?:retir\w*|suspend\w*|nao usar|sem)\b/iu;

/** Separa o tratamento realizado em proposto → prescrito → administrado → suspenso → concluído. */
export function reconciliarTratamento(fatos: readonly ClinicalFact[]): TratamentoReconciliado {
  const plano = fatos.filter((f) => f.domain === "plan")
    .map((f) => (typeof f.value === "string" ? f.value : "")).filter(Boolean);
  const prescrito = nomesDeFarmaco(fatos, "prescription");
  const administrado = nomesDeFarmaco(fatos, "administration");
  const retirados = plano.filter((t) => RETIRADA.test(t)).flatMap(farmacosMencionados);
  const suspenso = new Set(retirados);
  const conflito = retirados.some((nome) => prescrito.includes(nome));
  const concluido = fatos.some((f) => f.domain === "plan" && /\bconclu\w*|termin\w*/iu.test(String(f.value)))
    ? ["TRATAMENTO"] : [];
  return {
    proposto: plano.flatMap(farmacosMencionados).filter((n) => !suspenso.has(n)),
    prescrito,
    administrado,
    suspensoAdiado: [...suspenso].sort(),
    concluido,
    conflitoPlanejadoOrdenado: conflito,
  };
}

// ── Conflitos clínicos detectados (viram exceções na caixa de revisão) ────────
function novoId(kind: string, segmentId: string | null, indice: number): string {
  return `exc:${kind}:${segmentId ?? "sem-segmento"}:${indice}`;
}

/** M0 declarado × metástase documentada: nunca escolher em silêncio. */
export function conflitoM0(fatos: readonly ClinicalFact[]): ReviewException | null {
  const m0 = fatos.filter((f) => f.domain === "stage" && componenteM(literalDoEstagio(f)) === "0");
  const mets = fatos.filter((f) => f.domain === "metastasis");
  if (!m0.length || !mets.length) return null;
  return {
    id: novoId("CONFLICT", m0[0]!.segmentId, 1),
    kind: "CONFLICT",
    segmentId: m0[0]!.segmentId,
    factIds: [...m0, ...mets].map((f) => f.id),
    reason: "M0 documentado × metástase registrada: revisão humana obrigatória",
    sourceIds: [...new Set([...m0, ...mets].map((f) => f.sourceId))],
  };
}

/** Lateralidade divergente entre fontes: chama o gate G-07 do harness (não reimplementa a tabela). */
export function conflitoLateralidade(fatos: readonly ClinicalFact[]): ReviewException | null {
  const porFonte = new Map<string, string>();
  let orgao: string | null = null;
  for (const fact of fatos) {
    if (fact.domain !== "imaging" && fact.domain !== "diagnosis") continue;
    const v = typeof fact.value === "object" && fact.value !== null
      ? fact.value as Record<string, unknown> : {};
    const lateralidade = typeof v.lateralidade === "string" ? v.lateralidade
      : normalizarLateralidade(typeof v.lateralityRaw === "string" ? v.lateralityRaw : null);
    if (!orgao && typeof v.sitioCanonico === "string" && v.sitioCanonico.trim()) orgao = v.sitioCanonico;
    if (lateralidade) porFonte.set(fact.sourceId, lateralidade);
  }
  const valores = [...porFonte.values()];
  if (valores.length < 2 || new Set(valores).size < 2) return null;
  const veredito = g07Lateralidade({
    orgao,
    path: valores[0],
    rads: valores[1],
    procedimento: valores[2],
    diagnostico: valores[3],
  });
  if (veredito.decisao !== "ALERTA") return null;
  const fonte = fatos[0]!;
  return {
    id: novoId("CONFLICT", fonte.segmentId, 2),
    kind: "CONFLICT",
    segmentId: fonte.segmentId,
    factIds: fatos.filter((f) => porFonte.has(f.sourceId)).map((f) => f.id),
    reason: `lateralidade divergente entre fontes (${veredito.motivo})`,
    sourceIds: [...porFonte.keys()],
  };
}

/** TNM incompatível entre avaliações do mesmo tipo (ex.: cT2 e cT4 coexistentes). */
export function conflitoTnm(fatos: readonly ClinicalFact[]): ReviewException | null {
  const stages = fatos.filter((f) => f.domain === "stage");
  const literais = new Set(stages.map((f) => JSON.stringify(f.value ?? "")));
  if (literais.size < 2) return null;
  const tipos = new Set(stages.map((f) => {
    const v = typeof f.value === "object" && f.value !== null ? f.value as Record<string, unknown> : {};
    return typeof v.tipo === "string" ? v.tipo : "CLINICO";
  }));
  if (tipos.size > 1) return null; // avaliações coexistem (A3): não é conflito
  const primeiro = stages[0]!;
  return {
    id: novoId("CONFLICT", primeiro.segmentId, 3),
    kind: "CONFLICT",
    segmentId: primeiro.segmentId,
    factIds: stages.map((f) => f.id),
    reason: "TNM incompatível entre fontes do mesmo tipo de avaliação",
    sourceIds: [...new Set(stages.map((f) => f.sourceId))],
  };
}

/** CID × primário: CID de sítio diferente do tumor primário identificado. */
export function conflitoCid(fatos: readonly ClinicalFact[]): ReviewException | null {
  const cid = fatos.filter((f) => {
    const v = typeof f.value === "object" && f.value !== null ? f.value as Record<string, unknown> : {};
    return typeof v.cid === "string" && v.cid.trim() !== "";
  });
  const primario = fatos.filter((f) => f.domain === "diagnosis").map((f) => {
    const v = typeof f.value === "object" && f.value !== null ? f.value as Record<string, unknown> : {};
    return typeof v.sitioCanonico === "string" ? v.sitioCanonico : "";
  }).filter(Boolean);
  if (!cid.length || !primario.length) return null;
  const primeiro = cid[0]!;
  return {
    id: novoId("CONFLICT", primeiro.segmentId, 4),
    kind: "CONFLICT",
    segmentId: primeiro.segmentId,
    factIds: [...cid, ...fatos.filter((f) => f.domain === "diagnosis")].map((f) => f.id),
    reason: `CID × tumor primário (${primario[0]}) exigem conferência humana`,
    sourceIds: [...new Set([...cid, ...fatos].map((f) => f.sourceId))],
  };
}

/** Dose/data incoerente: ciclos com a mesma data e números diferentes. */
export function conflitoDoseData(fatos: readonly ClinicalFact[]): ReviewException | null {
  const ciclos = fatos.filter((f) => f.domain === "cycle" && f.date);
  if (ciclos.length < 2) return null;
  const porData = new Map<string, Set<string>>();
  for (const ciclo of ciclos) {
    const data = normalizarDataCivil(ciclo.date ?? null);
    if (!data) continue;
    const v = typeof ciclo.value === "object" && ciclo.value !== null ? ciclo.value as Record<string, unknown> : {};
    const conjunto = porData.get(data) ?? new Set<string>();
    conjunto.add(String(v.numero ?? ciclo.value));
    porData.set(data, conjunto);
  }
  const divergente = [...porData.entries()].find(([, numeros]) => numeros.size > 1);
  if (!divergente) return null;
  const afetados = ciclos.filter((f) => normalizarDataCivil(f.date ?? null) === divergente[0]);
  return {
    id: novoId("CONFLICT", afetados[0]!.segmentId, 5),
    kind: "CONFLICT",
    segmentId: afetados[0]!.segmentId,
    factIds: afetados.map((f) => f.id),
    reason: `dose/data incoerente: ciclos distintos na mesma data (${divergente[0]})`,
    sourceIds: [...new Set(afetados.map((f) => f.sourceId))],
  };
}

/**
 * Cronologia impossível: evento documentado antes da data do diagnóstico.
 * Ex.: PET 02/2025 × diagnóstico 11/2025 ⇒ TEMPORAL_CONFLICT.
 */
export function conflitoCronologia(fatos: readonly ClinicalFact[]): ReviewException | null {
  const diagnosticos = fatos.filter((f) => f.domain === "diagnosis" && f.date)
    .map((f) => ({ fact: f, data: normalizarDataCivil(f.date ?? null) }))
    .filter((x): x is { fact: ClinicalFact; data: string } => x.data !== null);
  if (!diagnosticos.length) return null;
  const dataDiagnostico = diagnosticos.map((d) => d.data).sort()[0]!;
  const anteriores = fatos.filter((f) => {
    if (!f.date || f.domain === "diagnosis") return false;
    const data = normalizarDataCivil(f.date);
    return data !== null && data < dataDiagnostico;
  });
  if (!anteriores.length) return null;
  return {
    id: novoId("TEMPORAL_CONFLICT", anteriores[0]!.segmentId, 6),
    kind: "TEMPORAL_CONFLICT",
    segmentId: anteriores[0]!.segmentId,
    factIds: [...anteriores.map((f) => f.id), ...diagnosticos.map((d) => d.fact.id)],
    reason: `evento anterior à data do diagnóstico (${dataDiagnostico}): cronologia impossível`,
    sourceIds: [...new Set([...anteriores, ...diagnosticos.map((d) => d.fact)].map((f) => f.sourceId))],
  };
}

/** Sítio anatômico divergente entre fontes do mesmo domínio de imagem. */
export function conflitoSitio(fatos: readonly ClinicalFact[]): ReviewException | null {
  const sitios = new Map<string, Set<string>>();
  for (const fact of fatos) {
    if (fact.domain !== "imaging") continue;
    const v = typeof fact.value === "object" && fact.value !== null ? fact.value as Record<string, unknown> : {};
    const sitio = typeof v.sitioCanonico === "string" ? v.sitioCanonico
      : normalizarSitioAnatomico(typeof v.siteRaw === "string" ? v.siteRaw : null);
    if (!sitio) continue;
    const conjunto = sitios.get(fact.sourceId) ?? new Set<string>();
    conjunto.add(sitio);
    sitios.set(fact.sourceId, conjunto);
  }
  const conjuntos = [...sitios.values()].filter((s) => s.size > 0);
  if (conjuntos.length < 2) return null;
  const primeiro = [...conjuntos[0]!][0]!;
  const divergente = conjuntos.some((s) => !s.has(primeiro));
  if (!divergente) return null;
  const afetados = fatos.filter((f) => sitios.has(f.sourceId));
  return {
    id: novoId("CONFLICT", afetados[0]!.segmentId, 7),
    kind: "CONFLICT",
    segmentId: afetados[0]!.segmentId,
    factIds: afetados.map((f) => f.id),
    reason: "sítio anatômico divergente entre fontes: revisão humana obrigatória",
    sourceIds: [...sitios.keys()],
  };
}

/** Conflito planejado × ordenado (ex.: "retiro carbo" com carboplatina prescrita). */
export function conflitoPlanejadoOrdenado(fatos: readonly ClinicalFact[]): ReviewException | null {
  const tratamento = reconciliarTratamento(fatos);
  if (!tratamento.conflitoPlanejadoOrdenado) return null;
  const plano = fatos.find((f) => f.domain === "plan")!;
  const prescricao = fatos.filter((f) => f.domain === "drug" && f.sourceType === "prescription");
  return {
    id: novoId("CONFLICT", plano.segmentId, 8),
    kind: "CONFLICT",
    segmentId: plano.segmentId,
    factIds: [plano, ...prescricao].map((f) => f.id),
    reason: "planned_regimen != ordered_regimen: retirada verbalizada × fármaco prescrito",
    sourceIds: [...new Set([plano, ...prescricao].map((f) => f.sourceId))],
  };
}

/** Todos os conflitos clínicos detectáveis a partir dos fatos. */
export function detectarConflitos(fatos: readonly ClinicalFact[]): readonly ReviewException[] {
  return [
    conflitoM0(fatos),
    conflitoLateralidade(fatos),
    conflitoTnm(fatos),
    conflitoCid(fatos),
    conflitoDoseData(fatos),
    conflitoCronologia(fatos),
    conflitoSitio(fatos),
    conflitoPlanejadoOrdenado(fatos),
  ].filter((e): e is ReviewException => e !== null);
}
