import { describe, expect, it, vi } from "vitest";
import { draftStudyCandidate, extractStudyDraft, ingestDocument, studyExtractionPrompt, summarizeExtractive } from "../../../src/app/pesquisa/index.js";

const hash = "a".repeat(64);
const sha = async () => hash;

describe("study source ingestion", () => {
  it("retains the full Markdown and extracts only explicitly headed text with exact line evidence", async () => {
    const text = "# Trial Alpha\n\n## Description\nFor adults with disease X.\n\n## Arms\n- Experimental arm\n\n## Inclusion Criteria\n- No prior treatment\n\n## Outcomes\n- Overall survival";
    const source = await ingestDocument({ sourceId: "src-1", sourceRef: "local://protocol-1", originalName: "protocol.md", mimeType: "text/markdown", content: text }, sha);
    const candidate = await draftStudyCandidate(source, "cand-1", sha);
    expect(source.originalContent).toBe(text);
    expect(source.contentHash).toBe(hash);
    expect(candidate.title?.text).toBe("Trial Alpha");
    expect(candidate.arms[0]?.name.text).toBe("- Experimental arm");
    expect(candidate.inclusionCriteria[0]?.rawText).toBe("- No prior treatment");
    expect(candidate.inclusionCriteria[0]?.expression).toBeNull();
    expect(candidate.inclusionCriteria[0]?.status).toBe("PENDENTE");
    expect(candidate.inclusionCriteria[0]?.evidence[0]?.exactText).toBe("- No prior treatment");
    expect(candidate.reviewStatus).toBe("PENDENTE_REVISAO_MEDICA");
  });

  it("keeps JSON criterion text unbound and produces an explicitly extractive summary", async () => {
    const source = await ingestDocument({ sourceId: "src-2", sourceRef: "local://protocol-2", originalName: "protocol.json", mimeType: "application/json",
      content: JSON.stringify({ title: "Study Beta", inclusionCriteria: ["age >= 18"], arms: [{ name: "Control" }], outcomes: ["response"] }) }, sha);
    const candidate = await draftStudyCandidate(source, "cand-2", sha);
    expect(candidate.inclusionCriteria[0]?.expression).toBeNull();
    expect(candidate.inclusionCriteria[0]?.evidence[0]?.locator).toBe("inclusao[0]");
    const summary = await summarizeExtractive(source, 3, sha);
    expect(summary.method).toBe("DETERMINISTIC_EXTRACTIVE");
    expect(summary.isAiGenerated).toBe(false);
    expect(summary.reviewStatus).toBe("PENDENTE_REVISAO_MEDICA");
  });

  it("requires a local reference and hash for binary attachments and never claims OCR", async () => {
    const binary = await ingestDocument({ sourceId: "src-pdf", sourceRef: "local://pdf", originalName: "protocol.pdf", mimeType: "application/pdf",
      content: new Uint8Array([1, 2, 3]), attachmentRef: "attachments/protocol.pdf" }, sha);
    const candidate = await draftStudyCandidate(binary, "cand-pdf", sha);
    expect(binary.originalContent).toBeNull();
    expect(binary.contentHash).toBe(hash);
    expect(binary.attachmentRef).toBe("attachments/protocol.pdf");
    expect(candidate.warnings).toContain("ANEXO_BINARIO_REFERENCIADO_SEM_OCR");
    await expect(ingestDocument({ sourceId: "x", sourceRef: "x", originalName: "x.pdf", mimeType: "application/pdf", attachmentRef: "x" }, sha))
      .rejects.toThrow("BINARY_SHA256_REQUIRED");
  });

  it("detects text mutation even if the caller keeps the old source hash", async () => {
    const source = await ingestDocument({ sourceId: "src-m", sourceRef: "local://m", originalName: "m.txt", mimeType: "text/plain", content: "original" }, sha);
    await expect(draftStudyCandidate({ ...source, originalContent: "mutated" }, "c", async () => "d".repeat(64))).rejects.toThrow("SOURCE_CONTENT_HASH_MISMATCH");
  });

  it("leaves the injectable AI adapter off by default and never treats its output as facts", async () => {
    const source = await ingestDocument({ sourceId: "src-3", sourceRef: "local://p", originalName: "p.txt", mimeType: "text/plain", content: "Study text" }, sha);
    const adapter = { extract: vi.fn().mockResolvedValue({ eligible: true, criteria: ["invented"] }) };
    expect(await extractStudyDraft(source, "c", undefined)).toEqual({ status: "DISABLED", reason: "NO_ADAPTER" });
    expect(adapter.extract).not.toHaveBeenCalled();
    const result = await extractStudyDraft(source, "c", adapter);
    expect(result).toEqual({ status: "DISABLED", reason: "LOCAL_DEIDENTIFICATION_GATE_UNAVAILABLE" });
    expect(adapter.extract).not.toHaveBeenCalled();
    expect(studyExtractionPrompt).toContain("Nunca use dados identificáveis de pacientes");
  });
});
