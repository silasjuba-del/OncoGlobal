import { createHash } from "node:crypto";
import { ClinicalFact, FactSourceType, type ClinicalFact as FatoClinico } from "../contracts/w10/extracao.js";
import type { Fonte } from "../contracts/base.js";
import { normalizarDataCivil } from "../kernel/extracao/normalizacao.js";

export interface RevisaoExtracaoPreparada {
  readonly draftId: string;
  readonly sourceId: string;
  readonly payload: {
    readonly kind: "EVOLUCAO_RASCUNHO";
    readonly contexto: { readonly patientId: string; readonly encounterId: string; readonly tumorLotId: string | null };
    readonly status: "RASCUNHO";
    readonly resumo: string;
    readonly selectedFactIds: readonly string[];
    readonly facts: readonly FatoClinico[];
    readonly fontes: readonly Fonte[];
    readonly review: { readonly medicoId: string; readonly em: string; readonly operationId: string };
    readonly origem?: { readonly draftId: string; readonly revision: number; readonly conteudoHash: string };
  };
  readonly registros: readonly {
    readonly eventId: string;
    readonly tipo: "FATO" | "ReviewDecision";
    readonly payload: unknown;
    readonly fontes: readonly Fonte[];
    readonly sourceId: string;
  }[];
}

function hash(text: string): string { return createHash("sha256").update(text, "utf8").digest("hex"); }

function objeto(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown> : null;
}

function dataIso(value: unknown): string | null {
  return typeof value === "string" ? normalizarDataCivil(value) : null;
}

function classeFonte(tipo: string): Fonte["classe"] {
  switch (tipo) {
    case "plaud": return "PLAUD";
    case "medical_note": case "nursing": return "MANUAL";
    default: return "DOCUMENT";
  }
}

function literal(value: unknown): string {
  if (typeof value === "string") return value;
  const record = objeto(value);
  if (record) {
    if (typeof record.marker === "string") {
      const valor = record.value === null || record.value === undefined ? "NÃO CONSTA" : String(record.value);
      return `${record.marker}: ${valor}${typeof record.unit === "string" ? ` ${record.unit}` : ""}`
        + (typeof record.raw === "string" ? ` (${record.raw})` : "");
    }
    if (typeof record.siteRaw === "string" || typeof record.measureRaw === "string") {
      const sitio = typeof record.siteRaw === "string" ? record.siteRaw : "sítio NÃO CONSTA";
      const medida = typeof record.measureRaw === "string" ? `${record.measureRaw} ${String(record.unit ?? "")}`.trim() : "medida NÃO CONSTA";
      return `${sitio}: ${medida}`;
    }
    if (typeof record.raw === "string") return record.raw;
  }
  try { return JSON.stringify(value) ?? String(value); } catch { return "valor não serializável"; }
}

function secao(domain: FatoClinico["domain"]): string {
  switch (domain) {
    case "diagnosis": case "histology": return "Diagnóstico e histologia";
    case "stage": case "metastasis": return "Estadiamento e doença metastática";
    case "biomarker": return "Biomarcadores";
    case "drug": case "regimen": case "cycle": return "Tratamento mencionado";
    case "lab": case "imaging": case "procedure": return "Exames e procedimentos";
    case "symptom": case "toxicity": return "Sintomas e toxicidade";
    case "plan": return "Plano verbalizado";
  }
}

/** Builds a physician-selected review from the server's persisted extraction draft. */
export function prepararRevisaoExtracao(input: {
  readonly draftId: string;
  readonly sourceId: string;
  readonly rawTranscript: string;
  readonly sourceType: string;
  readonly facts: readonly unknown[];
  readonly exceptions: readonly unknown[];
  readonly patientId: string;
  readonly encounterId: string;
  readonly tumorLotId: string | null;
  readonly factIds: readonly string[];
  readonly operationId: string;
  readonly medicoId: string;
  readonly em: string;
  readonly origem?: { readonly draftId: string; readonly revision: number; readonly conteudoHash: string };
}): RevisaoExtracaoPreparada {
  if (!input.factIds.length || new Set(input.factIds).size !== input.factIds.length)
    throw new Error("FACT_IDS_INVALIDOS");
  FactSourceType.parse(input.sourceType);
  const facts = input.facts.map((fact) => ClinicalFact.parse(fact));
  if (facts.some((fact) => fact.sourceId !== input.sourceId || fact.sourceType !== input.sourceType))
    throw new Error("PROVENIENCIA_DIVERGENTE");
  const byId = new Map(facts.map((fact) => [fact.id, fact]));
  const selected = input.factIds.map((id) => byId.get(id));
  if (selected.some((fact) => !fact)) throw new Error("FATO_NAO_ENCONTRADO");
  const escolhidos = selected as FatoClinico[];
  const contentHash = hash(input.rawTranscript);
  const sourceClass = classeFonte(input.sourceType);
  const fonteDoFato = (fact: FatoClinico): Fonte => {
    const dataClinica = dataIso(fact.date);
    const localizador = fact.page ? `pagina:${fact.page}` : null;
    return {
    sourceId: fact.sourceId, classe: sourceClass, localizador: fact.page ? `pagina:${fact.page}` : null,
    dataClinica, dataCaptura: input.em, versao: "extracao-local-v1", contentHash,
  };
  };
  const fontes = [...new Map(escolhidos.map((fact) => {
    const fonte = fonteDoFato(fact);
    return [`${fonte.sourceId}\0${fonte.localizador ?? ""}\0${fonte.dataClinica ?? ""}`, fonte] as const;
  })).values()];

  const linhas = escolhidos.map((fact) => {
    const data = dataIso(fact.date);
    const incerto = fact.requiresConfirmation || fact.evidence === "UNCERTAIN" || fact.evidence === "INFERRED";
    const estado = incerto
      ? "candidato revisado; incerteza original preservada e requer confirmação clínica adicional"
      : "fato revisado explicitamente pelo médico";
    return { secao: secao(fact.domain), texto: `- ${literal(fact.value)}; ${estado}; evidência ${fact.evidence}; fonte ${fact.sourceId}`
      + (data ? `; data clínica ${data}` : "; data clínica não consta no fato")
      + `; trecho original: ${fact.rawEvidence}` };
  });
  const selectedSet = new Set(input.factIds);
  const pendentes = facts.filter((fact) => !selectedSet.has(fact.id)).map((fact) =>
    `- Fato não selecionado (${fact.id}, ${fact.domain}): permanece pendente de revisão; fonte ${fact.sourceId}; trecho: ${fact.rawEvidence}`);
  const excecoes = input.exceptions.map((value) => objeto(value)).filter((value): value is Record<string, unknown> => value !== null)
    .map((item) => typeof item.reason === "string" ? `- Pendência de extração: ${item.reason}` : null)
    .filter((item): item is string => item !== null);
  const blocos = [...new Set(linhas.map((item) => item.secao))].map((titulo) =>
    [titulo, ...linhas.filter((item) => item.secao === titulo).map((item) => item.texto)].join("\n"));
  const resumo = ["Evolução clínica — rascunho de revisão médica", ...blocos,
    ...(pendentes.length || excecoes.length ? ["Pendências", ...pendentes, ...excecoes] : []),
    `Fonte original ${input.sourceId} preservada no rascunho de extração; trechos não extraídos não foram convertidos em fatos.`,
    "Este rascunho não fecha estadiamento TNM, dose ou conduta.",
  ].join("\n");
  const draftId = `evolucao-extracao-${hash(input.operationId).slice(0, 32)}`;
  const payload: RevisaoExtracaoPreparada["payload"] = {
    kind: "EVOLUCAO_RASCUNHO",
    contexto: { patientId: input.patientId, encounterId: input.encounterId, tumorLotId: input.tumorLotId },
    status: "RASCUNHO", resumo, selectedFactIds: [...input.factIds], facts: escolhidos,
    fontes, review: { medicoId: input.medicoId, em: input.em, operationId: input.operationId },
    ...(input.origem ? { origem: { ...input.origem } } : {}),
  };
  const registros = escolhidos.map((fact) => {
    const fatoExplicito = fact.evidence === "EXPLICIT" && !fact.requiresConfirmation;
    const clinicalDate = fatoExplicito ? dataIso(fact.date) : null;
    const campo = fact.domain === "stage" ? "TNM"
      : fact.domain === "lab" ? `extracao.lab:${String(objeto(fact.value)?.marker ?? fact.id).toLocaleUpperCase("pt-BR")}`
        : `extracao.${fact.domain}`;
    const source = fonteDoFato(fact);
    return {
      eventId: `review-fact-${hash(`${input.operationId}\0${fact.id}`).slice(0, 32)}`,
      tipo: fatoExplicito ? "FATO" as const : "ReviewDecision" as const,
      sourceId: fact.sourceId,
      fontes: [source],
      payload: fatoExplicito ? { campo, domain: fact.domain,
        valor: fact.value,
        sourceId: fact.sourceId, factId: fact.id, sourceType: fact.sourceType,
        evidence: fact.evidence, confidence: fact.confidence, requiresConfirmation: fact.requiresConfirmation,
        rawEvidence: fact.rawEvidence, ...(fact.date ? { factDate: fact.date } : {}),
        ...(fact.page === undefined ? {} : { page: fact.page }), ...(fact.regra ? { regra: fact.regra } : {}),
        ...(clinicalDate ? { dataClinica: clinicalDate,
          ...(fact.domain === "lab" ? { observacaoDatada: true } : {}) } : {}) }
        : { exceptionId: fact.id, acao: "CONFIRMAR", factId: fact.id, candidate: fact.value,
          sourceId: fact.sourceId, sourceType: fact.sourceType, evidence: fact.evidence,
          requiresConfirmation: fact.requiresConfirmation, rawEvidence: fact.rawEvidence },
    };
  });
  return { draftId, sourceId: input.sourceId, payload, registros };
}
