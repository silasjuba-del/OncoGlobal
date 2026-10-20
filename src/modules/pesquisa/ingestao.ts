import type { EvidenceRef, ExtractiveSummaryDraft, StudyCandidateDraft, StudySource } from "./tipos.js";

export interface DocumentInput {
  sourceId: string;
  sourceRef: string;
  originalName: string;
  mimeType: string;
  content?: string | Uint8Array;
  /** Referência local ao anexo original. Conteúdo binário não é interpretado/OCR. */
  attachmentRef?: string;
  /** SHA-256 calculado pela camada de armazenamento quando os bytes não são fornecidos aqui. */
  attachmentContentHash?: string;
  locator?: string;
}
export type Sha256 = (bytes: Uint8Array) => Promise<string>;

/** Usa Web Crypto no navegador. Em ambientes sem crypto.subtle, injete o digest da borda local. */
export async function ingestDocument(input: DocumentInput, digest: Sha256 = webSha256): Promise<StudySource> {
  if (!input.sourceId.trim() || !input.sourceRef.trim() || !input.originalName.trim()) throw new Error("SOURCE_IDENTITY_REQUIRED");
  const extension = input.originalName.toLowerCase().split(".").pop() ?? "";
  const kind = extension === "txt" || input.mimeType === "text/plain" ? "TXT"
    : extension === "md" || extension === "markdown" || input.mimeType === "text/markdown" ? "MD"
      : extension === "json" || input.mimeType === "application/json" ? "JSON" : "BINARY_REFERENCE";
  if (kind === "BINARY_REFERENCE") {
    if (typeof input.content === "string" || !input.attachmentRef?.trim()) throw new Error("BINARY_MUST_REMAIN_REFERENCE");
    const hash = input.content instanceof Uint8Array ? await digest(input.content) : input.attachmentContentHash;
    if (!hash || !/^[a-f\d]{64}$/i.test(hash)) throw new Error("BINARY_SHA256_REQUIRED");
    return { sourceId: input.sourceId, sourceRef: input.sourceRef, originalName: input.originalName, mimeType: input.mimeType,
      kind, contentHash: hash.toLowerCase(), originalContent: null, attachmentRef: input.attachmentRef, locator: input.locator ?? null };
  }
  if (input.content === undefined) throw new Error("TEXT_CONTENT_REQUIRED");
  const decoded = typeof input.content === "string" ? input.content : new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(input.content);
  const bytes = new TextEncoder().encode(decoded);
  const text = decoded;
  if (kind === "JSON") JSON.parse(text);
  const hash = await digest(bytes);
  if (!/^[a-f\d]{64}$/i.test(hash)) throw new Error("SHA256_REQUIRED");
  return { sourceId: input.sourceId, sourceRef: input.sourceRef, originalName: input.originalName, mimeType: input.mimeType,
    kind, contentHash: hash.toLowerCase(), originalContent: text, attachmentRef: null, locator: input.locator ?? null };
}

export async function draftStudyCandidate(source: StudySource, candidateId: string, digest: Sha256 = webSha256): Promise<StudyCandidateDraft> {
  if (!candidateId.trim()) throw new Error("CANDIDATE_ID_REQUIRED");
  await assertSourceIntact(source, digest);
  const base: StudyCandidateDraft = { candidateId, sourceId: source.sourceId, sourceHash: source.contentHash,
    reviewStatus: "PENDENTE_REVISAO_MEDICA", studyId: null, title: null, description: null, arms: [],
    inclusionCriteria: [], exclusionCriteria: [], outcomes: [], warnings: [] };
  if (source.kind === "BINARY_REFERENCE") return { ...base, warnings: ["ANEXO_BINARIO_REFERENCIADO_SEM_OCR"] };
  if (source.kind !== "JSON") return draftFromText(source, base);
  const originalContent = source.originalContent;
  if (originalContent === null) throw new Error("TEXT_SOURCE_CONTENT_REQUIRED");
  const data: unknown = JSON.parse(originalContent);
  if (!isRecord(data)) return { ...base, warnings: ["JSON_ROOT_NOT_OBJECT"] };
  const title = evidenceForString(data.title, source, "title");
  const description = evidenceForString(data.description, source, "description");
  const outcomes = stringArray(data.outcomes).map((value, index) => evidenced(source, `outcomes[${index}]`, value));
  const arms = Array.isArray(data.arms) ? data.arms.flatMap((arm, index) => {
    if (!isRecord(arm) || typeof arm.name !== "string") return [];
    return [{ armId: typeof arm.id === "string" ? arm.id : `${candidateId}-arm-${index + 1}`,
      name: evidenced(source, `arms[${index}].name`, arm.name),
      description: typeof arm.description === "string" ? evidenced(source, `arms[${index}].description`, arm.description) : null }];
  }) : [];
  return { ...base, title, description, outcomes, arms,
    inclusionCriteria: criteria(data.inclusionCriteria, "INCLUSAO", source, candidateId),
    exclusionCriteria: criteria(data.exclusionCriteria, "EXCLUSAO", source, candidateId),
    warnings: ["CANDIDATO_EXTRAIDO_DE_ESTRUTURA_DOCUMENTAL; REVISAR_TEXTO_E_MAPEAMENTOS"] };
}

function draftFromText(source: StudySource, base: StudyCandidateDraft): StudyCandidateDraft {
  const content = source.originalContent ?? "";
  const headings: Record<string, "title" | "description" | "arms" | "inclusion" | "exclusion" | "outcomes"> = {
    "title": "title", "study title": "title", "título": "title", "titulo": "title",
    "description": "description", "study description": "description", "descrição": "description", "descricao": "description",
    "arms": "arms", "study arms": "arms", "braços": "arms", "bracos": "arms",
    "inclusion criteria": "inclusion", "inclusion": "inclusion", "critérios de inclusão": "inclusion", "criterios de inclusao": "inclusion",
    "exclusion criteria": "exclusion", "exclusion": "exclusion", "critérios de exclusão": "exclusion", "criterios de exclusao": "exclusion",
    "outcomes": "outcomes", "endpoints": "outcomes", "desfechos": "outcomes"
  };
  const sections = new Map<string, Array<{ text: string; locator: string }>>();
  let current: string | null = null;
  for (const [index, line] of content.split(/\r?\n/).entries()) {
    const inline = /^\s{0,3}#{0,3}\s*([^:#]+?)\s*:\s*(\S.*)?$/.exec(line);
    const inlineName = inline?.[1]?.trim().toLowerCase();
    const inlineSection = inlineName ? headings[inlineName] : undefined;
    if (inlineSection) {
      current = inlineSection; sections.set(current, sections.get(current) ?? []);
      const value = inline?.[2]?.trim();
      if (value) sections.get(current)?.push({ text: value, locator: `line:${index + 1}` });
      continue;
    }
    const heading = /^\s{0,3}#{1,3}\s+(.+?)\s*$/.exec(line);
    const normalized = heading?.[1]?.trim().replace(/\*\*/g, "").toLowerCase();
    const next = normalized ? headings[normalized] : undefined;
    if (next === "title" && normalized !== "title" && heading) {
      sections.set("title", [{ text: heading[1]!.trim(), locator: `line:${index + 1}` }]); current = null; continue;
    }
    if (next) { current = next; sections.set(current, sections.get(current) ?? []); continue; }
    if (heading && index === 0 && !sections.has("title")) {
      sections.set("title", [{ text: heading[1]!.trim(), locator: `line:${index + 1}` }]); current = null; continue;
    }
    if (current && line.trim()) sections.get(current)?.push({ text: line.trim(), locator: `line:${index + 1}` });
  }
  const one = (key: string) => sections.get(key)?.map((p) => p.text).join("\n") ?? "";
  const textEvidence = (entry: { text: string; locator: string }) => ({ text: entry.text, evidence: [evidenceRef(source, entry.locator, entry.text)] });
  const titleEntry = sections.get("title")?.[0];
  const descriptionEntries = sections.get("description") ?? [];
  const description = one("description");
  const criterionDrafts = (polarity: "INCLUSAO" | "EXCLUSAO", key: string) => (sections.get(key) ?? []).map((item, index) => ({
    criterionId: `${base.candidateId}-${polarity}-${index + 1}`, polarity, groupId: null, groupOperator: null, expression: null,
    rawText: item.text, status: "PENDENTE" as const, evidence: [evidenceRef(source, item.locator, item.text)]
  }));
  const arms = (sections.get("arms") ?? []).map((item, index) => ({ armId: `${base.candidateId}-arm-${index + 1}`,
    name: textEvidence(item), description: null }));
  const outcomes = (sections.get("outcomes") ?? []).map(textEvidence);
  const recognized = titleEntry || description || arms.length || sections.has("inclusion") || sections.has("exclusion") || outcomes.length;
  return { ...base, title: titleEntry ? textEvidence(titleEntry) : null,
    description: description ? { text: description, evidence: descriptionEntries.map((entry) => evidenceRef(source, entry.locator, entry.text)) }
      : recognized ? null : evidenced(source, "document", content),
    arms, inclusionCriteria: criterionDrafts("INCLUSAO", "inclusion"), exclusionCriteria: criterionDrafts("EXCLUSAO", "exclusion"), outcomes,
    warnings: recognized ? ["TEXTO_EM_SECOES_RECONHECIDAS; CRITERIOS_SEM_BINDING_MEDICO"] : ["ESTRUTURA_NAO_RECONHECIDA; DOCUMENTO_INTEGRAL_MANTIDO_COMO_RASCUNHO"] };
}

export async function summarizeExtractive(source: StudySource, maxParagraphs = 3, digest: Sha256 = webSha256): Promise<ExtractiveSummaryDraft> {
  if (!Number.isInteger(maxParagraphs) || maxParagraphs < 1) throw new Error("INVALID_PARAGRAPH_LIMIT");
  await assertSourceIntact(source, digest);
  if (!source.originalContent || source.kind === "BINARY_REFERENCE") return { text: "", method: "DETERMINISTIC_EXTRACTIVE", isAiGenerated: false,
    reviewStatus: "PENDENTE_REVISAO_MEDICA", evidence: [] };
  const paragraphs = source.originalContent.split(/\r?\n\s*\r?\n/).map((p) => p.trim()).filter(Boolean).slice(0, maxParagraphs);
  const evidence = paragraphs.map((p, i) => evidenceRef(source, `paragraph:${i + 1}`, p));
  return { text: paragraphs.join("\n\n"), method: "DETERMINISTIC_EXTRACTIVE", isAiGenerated: false,
    reviewStatus: "PENDENTE_REVISAO_MEDICA", evidence };
}

function criteria(value: unknown, polarity: "INCLUSAO" | "EXCLUSAO", source: StudySource, id: string) {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item, index) => {
    if (typeof item === "string") return [{ criterionId: `${id}-${polarity}-${index + 1}`, polarity, groupId: null,
      groupOperator: null, expression: null, rawText: item, status: "PENDENTE" as const,
      evidence: [evidenceRef(source, `${polarity.toLowerCase()}[${index}]`, item)] }];
    if (!isRecord(item) || typeof item.text !== "string") return [];
    // Estrutura importada continua apenas um rascunho; clínico precisa confirmar bindings.
    const expression = null;
    const groupOperator = null;
    return [{ criterionId: typeof item.id === "string" ? item.id : `${id}-${polarity}-${index + 1}`, polarity,
      groupId: null, groupOperator, expression, rawText: item.text,
      status: "PENDENTE" as const, evidence: [evidenceRef(source, `${polarity.toLowerCase()}[${index}].text`, item.text)] }];
  });
}
function evidenceForString(value: unknown, source: StudySource, locator: string) { return typeof value === "string" ? evidenced(source, locator, value) : null; }
function evidenced(source: StudySource, locator: string, text: string) { return { text, evidence: [evidenceRef(source, locator, text)] }; }
function evidenceRef(source: StudySource, locator: string, exactText: string): EvidenceRef {
  return { sourceId: source.sourceId, sourceRef: source.sourceRef, locator, exactText, contentHash: source.contentHash };
}
function isRecord(value: unknown): value is Record<string, unknown> { return typeof value === "object" && value !== null && !Array.isArray(value); }
function stringArray(value: unknown): string[] { return Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : []; }
async function assertSourceIntact(source: StudySource, digest: Sha256): Promise<void> {
  if (source.kind === "BINARY_REFERENCE") {
    if (!source.attachmentRef || !/^[a-f\d]{64}$/i.test(source.contentHash)) throw new Error("BINARY_SOURCE_REFERENCE_INVALID");
    return;
  }
  if (source.originalContent === null || await digest(new TextEncoder().encode(source.originalContent)) !== source.contentHash) throw new Error("SOURCE_CONTENT_HASH_MISMATCH");
}
async function webSha256(bytes: Uint8Array): Promise<string> {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) throw new Error("SHA256_PROVIDER_REQUIRED");
  const copy = new Uint8Array(bytes.byteLength); copy.set(bytes);
  const digest = await subtle.digest("SHA-256", copy);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
