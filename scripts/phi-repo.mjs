import { readFileSync, lstatSync, realpathSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { inflateRawSync } from "node:zlib";
import { join, relative, sep, resolve, isAbsolute } from "node:path";
import { getDocument, OPS } from "pdfjs-dist/legacy/build/pdf.mjs";

const EMAIL = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
const CNS = /(?<!\d)(?:[12789]\d{14}|[12789]\d{2}(?:[ .-]\d{3}){4}|[12789]\d{2}[ .-]\d{4}[ .-]\d{4}[ .-]\d{4})(?!\d)/g;
const CPF = /(?:^|\D)(\d{3})[.\s-]?(\d{3})[.\s-]?(\d{3})[.\s-]?(\d{2})(?!\d)/g;
const PHONE = /(?<!\d)(?:\+?55[ .-]*)?(?:\(([1-9]\d)\)|([1-9]\d))[ .-]*(9\d{4}|\d{4})[ .-]?(\d{4})(?!\d)/g;
const HASH_TOKEN = /(?<![0-9a-f])(?:[0-9a-f]{40}|[0-9a-f]{64})(?![0-9a-f])/gi;
const PROMPT_VERSION = /^[A-Z0-9._-]+@\d+\.\d+\.\d+\.md$/i;
const TEXT_DECODER = new TextDecoder("utf-8", { fatal: true });
const MAX_ZIP_ENTRIES = 10_000;
const MAX_ZIP_ENTRY_BYTES = 16 * 1024 * 1024;
const MAX_ZIP_TOTAL_BYTES = 64 * 1024 * 1024;
const XLSX_UNREAD_PARTS = ["comments", "headers_footers", "docProps", "embedded_images"];
const OPERATIONAL_STORE_EXTENSIONS = new Set(["db", "sqlite", "sqlite3", "db-wal", "db-shm", "sqlite-wal", "sqlite-shm"]);

const BRAZILIAN_DDDS = new Set([
  "11", "12", "13", "14", "15", "16", "17", "18", "19", "21", "22", "24", "27", "28",
  "31", "32", "33", "34", "35", "37", "38", "41", "42", "43", "44", "45", "46", "47",
  "48", "49", "51", "53", "54", "55", "61", "62", "63", "64", "65", "66", "67", "68",
  "69", "71", "73", "74", "75", "77", "79", "81", "82", "83", "84", "85", "86", "87",
  "88", "89", "91", "93", "94", "95", "96", "97", "98", "99",
]);

const SUPPRESSIBLE = new Set([
  "technical_token_false_positive",
  "synthetic_declared",
  "public_author_metadata",
  "public_contact_metadata",
  "technical_font_asset",
  "synthetic_visual_review",
]);

const NON_TEXT_EXTENSIONS = new Set(["pdf", "xlsx", "png", "jpg", "jpeg", "webp", "gif", "bmp", "tif", "tiff", "woff2"]);

export function sha256(bytes, hashMode = "raw", path = "") {
  let input = bytes;
  if (hashMode === "utf8-lf") {
    const extension = path.toLowerCase().split(".").pop() ?? "";
    if (NON_TEXT_EXTENSIONS.has(extension)) throw new Error("utf8_lf_not_supported_for_binary_format");
    const buffer = Buffer.isBuffer(bytes) ? bytes : Buffer.from(bytes);
    if (buffer.includes(0)) throw new Error("utf8_lf_not_supported_for_binary_content");
    const text = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(buffer);
    input = Buffer.from(text.replace(/\r\n/g, "\n"), "utf8");
  } else if (hashMode !== "raw") {
    throw new Error("unsupported_hash_mode");
  }
  return createHash("sha256").update(input).digest("hex");
}

function currentFileHash(bytes, path, manifest) {
  const record = manifestFile(manifest, path);
  try {
    return sha256(bytes, record?.hashMode ?? "raw", path);
  } catch {
    return null;
  }
}

function cpfValido(digits) {
  if (digits.length !== 11 || /^(\d)\1{10}$/.test(digits)) return false;
  const calculate = (slice, start) => {
    const sum = [...slice].reduce((total, digit, index) => total + Number(digit) * (start - index), 0);
    const remainder = (sum * 10) % 11;
    return remainder === 10 ? 0 : remainder;
  };
  return calculate(digits.slice(0, 9), 10) === Number(digits[9])
    && calculate(digits.slice(0, 10), 11) === Number(digits[10]);
}

function phoneValid(match) {
  return BRAZILIAN_DDDS.has(match[1] ?? match[2] ?? "");
}

function phoneContext(line, start, end, path) {
  // The manifest binds every other file by SHA-256; its own exact sha256 field is schema-typed metadata and cannot self-reference.
  if (path === "docs/f0-fecha/PHI-TRIAGEM.json") {
    for (const field of line.matchAll(/"sha256"\s*:\s*"([0-9a-f]{64})"/gi)) {
      const valueStart = field.index + field[0].indexOf(field[1]);
      if (start >= valueStart && end <= valueStart + field[1].length) return "triage_manifest_sha256_field";
    }
  }
  for (const hash of line.matchAll(HASH_TOKEN)) {
    if (start >= hash.index && end <= hash.index + hash[0].length) {
      const prefix = line.slice(0, hash.index);
      const suffix = line.slice(hash.index + hash[0].length);
      if (/(?:"(?:sha256|hash)"\s*:\s*"|\b(?:sha256|hash)\s*[:=]\s*)[^"\s]*$/i.test(prefix) && /^"?\s*[,}\]]?/.test(suffix)) {
        return "json_sha256_field_64hex";
      }
      return "commit_hash_40_or_64_hex";
    }
  }
  return null;
}

function emailContext(line, start, end) {
  const token = line.slice(start, end);
  return PROMPT_VERSION.test(token) ? "microprompt_version_filename" : null;
}

function addCandidate(out, counts, type, line, lineNumber, start, end, contextTag = null) {
  const key = `${type}:${lineNumber}`;
  const ordinal = counts.get(key) ?? 0;
  counts.set(key, ordinal + 1);
  out.push({ type, line: lineNumber, ordinal, start, end, contextTag });
}

export function findTextCandidates(text, path = "<memory>", page = undefined) {
  const candidates = [];
  const lines = text.split(/\r?\n/);
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] ?? "";
    const lineNumber = index + 1;
    const counts = new Map();
    for (const match of line.matchAll(CPF)) {
      const digits = match.slice(1).join("");
      if (cpfValido(digits)) {
        const digitsStart = match.index + match[0].indexOf(match[1]);
        addCandidate(candidates, counts, "cpf", line, lineNumber, digitsStart, digitsStart + 11);
      }
    }
    for (const match of line.matchAll(CNS)) {
      addCandidate(candidates, counts, "cns", line, lineNumber, match.index, match.index + match[0].length);
    }
    for (const match of line.matchAll(PHONE)) {
      if (!phoneValid(match)) continue;
      const start = match.index;
      const end = start + match[0].length;
      const contextTag = phoneContext(line, start, end, path);
      if (contextTag === "triage_manifest_sha256_field") continue;
      addCandidate(candidates, counts, "telefone", line, lineNumber, start, end, contextTag);
    }
    for (const match of line.matchAll(EMAIL)) {
      addCandidate(candidates, counts, "email", line, lineNumber, match.index, match.index + match[0].length,
        emailContext(line, match.index, match.index + match[0].length));
    }
    const headerField = line.match(/^\s*(?:paciente|nome(?:\s+do\s+paciente)?|identifica[cç][aã]o)\s*[:=]\s*(.*?)\s*$/i);
    const candidateName = headerField?.[1]?.trim() ?? "";
    const nameTokens = candidateName.match(/[A-Za-zÀ-ÿ]+/g) ?? [];
    if (/\.(?:pdf|txt|md|csv|html?|json|log|ya?ml)$/i.test(path)
      && headerField && nameTokens.length >= 2 && !/[{}<>]/.test(candidateName)
      && !/^Paciente Teste \d{2}\b.*$/i.test(candidateName)) {
      const start = line.indexOf(candidateName);
      addCandidate(candidates, counts, "nome_cabecalho_laudo", line, lineNumber, start, start + candidateName.length);
    }
  }
  return candidates.map(({ type, line, ordinal, contextTag }) => ({
    type, path, line, ordinal, contextTag, ...(page === undefined ? {} : { page }),
  }));
}

function findPortalCredentials(lines, path, page = undefined) {
  const findings = [];
  for (let index = 0; index < lines.length; index += 1) {
    const from = Math.max(0, index - 2);
    const to = Math.min(lines.length, index + 3);
    const context = lines.slice(from, to).join(" ");
    const hasPortalContext = /portal.{0,80}(?:login|usu[aá]rio|user|senha|password|pass)|(?:login|usu[aá]rio|user|senha|password|pass).{0,80}portal/i.test(context)
      || /portal/i.test(path);
    const hasCredentialValue = /(?:portal[_\s-]*(?:login|usu[aá]rio|user|senha|password|pass)|(?:login|usu[aá]rio|user(?:name)?|senha|password|pass)(?:[_\s-]*(?:do[_\s-]*)?portal)?)\s*[:=]\s*\S/i.test(lines[index] ?? "");
    if (hasPortalContext && hasCredentialValue) findings.push({
      type: "credencial_portal", path, line: index + 1, ordinal: 0, contextTag: null,
      ...(page === undefined ? {} : { page }),
    });
  }
  return findings;
}

function manifestFile(manifest, path) {
  return manifest?.files?.find((file) => file.path === path) ?? null;
}

function evidenceValid(entry) {
  return SUPPRESSIBLE.has(entry.status)
    && typeof entry.evidenceRef === "string" && entry.evidenceRef.length > 0
    && typeof entry.reason === "string" && entry.reason.length > 0;
}

function resolveCandidates(candidates, path, fileHash, manifest, additional = []) {
  const result = { findings: [], dispositionsApplied: [], pending: [] };
  const record = manifestFile(manifest, path);
  const hashMatches = record?.sha256 === fileHash;
  if (record && !hashMatches) {
    result.pending.push({ type: "manifest_hash_mismatch", path, status: "PENDENTE" });
  }
  const allCandidates = [...candidates, ...additional];
  const seenEntries = new Set();
  for (const candidate of allCandidates) {
      const entry = hashMatches
      ? record.items?.find((item) => item.type === candidate.type
        && item.line === candidate.line && item.ordinal === candidate.ordinal
        && item.page === candidate.page)
      : null;
    if (entry && evidenceValid(entry)
      && (!entry.contextTag || entry.contextTag === candidate.contextTag)) {
      seenEntries.add(entry);
      result.dispositionsApplied.push({ type: candidate.type, path, line: candidate.line,
      ordinal: candidate.ordinal, contextTag: candidate.contextTag,
      ...(candidate.page === undefined ? {} : { page: candidate.page }), status: entry.status });
      continue;
    }
    if (entry) {
      seenEntries.add(entry);
      const reason = entry.status === "PENDENTE"
        ? entry.reason ?? "disposition_pending_review"
        : entry.contextTag && entry.contextTag !== candidate.contextTag
          ? "disposition_context_mismatch"
          : "disposition_evidence_invalid";
      result.pending.push({ type: candidate.type, path, line: candidate.line,
        ...(candidate.page === undefined ? {} : { page: candidate.page }), status: "PENDENTE", reason });
    }
    result.findings.push({ type: candidate.type, path, line: candidate.line, ordinal: candidate.ordinal,
      contextTag: candidate.contextTag,
      ...(candidate.page === undefined ? {} : { page: candidate.page }) });
  }
  if (hashMatches) {
    for (const entry of record.items ?? []) {
      if (!seenEntries.has(entry)) {
        result.pending.push({ type: entry.type, path, line: entry.line,
          ...(entry.page === undefined ? {} : { page: entry.page }), status: "PENDENTE", reason: "disposition_target_missing" });
      }
    }
  }
  return result;
}

export function scanText(text, path, options = {}) {
  const bytes = Buffer.from(text, "utf8");
  const fileHash = options.sha256 ?? sha256(bytes);
  const candidates = findTextCandidates(text, path);
  const portal = findPortalCredentials(text.split(/\r?\n/), path);
  return resolveCandidates(candidates, path, fileHash, options.manifest, portal);
}

function unescapeXml(value) {
  return value.replace(/&(#x[0-9a-f]+|#[0-9]+|amp|lt|gt|quot|apos);/gi, (_, entity) => {
    const named = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };
    if (!entity.startsWith("#")) return named[entity.toLowerCase()] ?? "";
    const codepoint = entity[1]?.toLowerCase() === "x"
      ? Number.parseInt(entity.slice(2), 16) : Number.parseInt(entity.slice(1), 10);
    return codepoint > 0 && codepoint <= 0x10ffff ? String.fromCodePoint(codepoint) : "";
  });
}

function extractTags(xml, tagName) {
  return [...xml.matchAll(new RegExp(`<${tagName}\\b[^>]*>([\\s\\S]*?)<\\/${tagName}>`, "g"))]
    .map((match) => unescapeXml(match[1] ?? ""));
}

function xmlTextRuns(xml) {
  return [...xml.matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/g)].map((match) => unescapeXml(match[1] ?? ""));
}

function unzipSelectedXml(bytes) {
  const eocd = bytes.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  if (eocd < 0 || eocd + 22 > bytes.length) throw new Error("xlsx_zip_directory_missing");
  const entriesCount = bytes.readUInt16LE(eocd + 10);
  let centralOffset = bytes.readUInt32LE(eocd + 16);
  if (entriesCount > MAX_ZIP_ENTRIES || centralOffset >= eocd) throw new Error("xlsx_zip_limits");
  const selected = new Map();
  let totalBytes = 0;
  for (let index = 0; index < entriesCount; index += 1) {
    if (centralOffset + 46 > eocd || bytes.readUInt32LE(centralOffset) !== 0x02014b50) throw new Error("xlsx_zip_central_entry_invalid");
    const method = bytes.readUInt16LE(centralOffset + 10);
    const compressedSize = bytes.readUInt32LE(centralOffset + 20);
    const expandedSize = bytes.readUInt32LE(centralOffset + 24);
    const nameLength = bytes.readUInt16LE(centralOffset + 28);
    const extraLength = bytes.readUInt16LE(centralOffset + 30);
    const commentLength = bytes.readUInt16LE(centralOffset + 32);
    const localOffset = bytes.readUInt32LE(centralOffset + 42);
    const name = bytes.toString("utf8", centralOffset + 46, centralOffset + 46 + nameLength);
    const next = centralOffset + 46 + nameLength + extraLength + commentLength;
    if (next > eocd) throw new Error("xlsx_zip_central_entry_truncated");
    centralOffset = next;
    const wanted = name === "xl/sharedStrings.xml" || /^xl\/worksheets\/sheet\d+\.xml$/i.test(name);
    if (name === "xl/vbaProject.bin") throw new Error("xlsx_macro_part_present");
    if (!wanted) continue;
    if (expandedSize > MAX_ZIP_ENTRY_BYTES || totalBytes + expandedSize > MAX_ZIP_TOTAL_BYTES) throw new Error("xlsx_xml_limits");
    if (localOffset + 30 > bytes.length || bytes.readUInt32LE(localOffset) !== 0x04034b50) throw new Error("xlsx_local_header_invalid");
    const localNameLength = bytes.readUInt16LE(localOffset + 26);
    const localExtraLength = bytes.readUInt16LE(localOffset + 28);
    const start = localOffset + 30 + localNameLength + localExtraLength;
    const end = start + compressedSize;
    if (end > bytes.length) throw new Error("xlsx_data_truncated");
    const compressed = bytes.subarray(start, end);
    const expanded = method === 0 ? compressed : method === 8
      ? inflateRawSync(compressed, { maxOutputLength: MAX_ZIP_ENTRY_BYTES })
      : null;
    if (!expanded || expanded.length !== expandedSize) throw new Error("xlsx_compression_unsupported");
    totalBytes += expanded.length;
    selected.set(name, expanded.toString("utf8"));
  }
  return selected;
}

export function extractXlsxRows(bytes) {
  const entries = unzipSelectedXml(Buffer.from(bytes));
  const sharedXml = entries.get("xl/sharedStrings.xml") ?? "";
  const sharedStrings = extractTags(sharedXml, "si").map((item) => xmlTextRuns(item).join(""));
  const rows = [];
  for (const [name, xml] of entries) {
    if (!/^xl\/worksheets\/sheet\d+\.xml$/i.test(name)) continue;
    for (const rowMatch of xml.matchAll(/<row\b([^>]*)>([\s\S]*?)<\/row>/g)) {
      const attrs = rowMatch[1] ?? "";
      const rowText = rowMatch[2] ?? "";
      const rowNumber = Number(attrs.match(/\br="(\d+)"/)?.[1] ?? rows.length + 1);
      const cells = [];
      for (const cellMatch of rowText.matchAll(/<c\b([^>]*)>([\s\S]*?)<\/c>/g)) {
        const cellAttrs = cellMatch[1] ?? "";
        const cellXml = cellMatch[2] ?? "";
        const type = cellAttrs.match(/\bt="([^"]+)"/)?.[1] ?? "";
        if (type === "s") {
          const sharedIndex = Number(extractTags(cellXml, "v")[0] ?? -1);
          if (Number.isInteger(sharedIndex) && sharedStrings[sharedIndex] !== undefined) cells.push(sharedStrings[sharedIndex]);
        } else if (type === "inlineStr") {
          cells.push(xmlTextRuns(extractTags(cellXml, "is")[0] ?? "").join(""));
        } else {
          const value = extractTags(cellXml, "v")[0];
          if (value !== undefined) cells.push(value);
          const formula = extractTags(cellXml, "f")[0];
          if (formula !== undefined) cells.push(unescapeXml(formula));
        }
      }
      rows.push({ line: rowNumber, text: cells.join(" ") });
    }
  }
  return rows.sort((a, b) => a.line - b.line);
}

function scanMappedLines(lines, path, fileHash, manifest) {
  const combined = { findings: [], dispositionsApplied: [], pending: [] };
  const record = manifestFile(manifest, path);
  const hashMatches = record?.sha256 === fileHash;
  if (record && !hashMatches) combined.pending.push({ type: "manifest_hash_mismatch", path, status: "PENDENTE" });
  const all = [];
  const portalCandidates = [];
  for (const item of lines) {
    const textResult = findTextCandidates(item.text, path);
    for (const candidate of findTextCandidates(item.text, path, item.page)) all.push({ ...candidate, line: item.line });
    for (const candidate of findPortalCredentials(item.text.split(/\r?\n/), path, item.page)) portalCandidates.push({ ...candidate, line: item.line });
  }
  const resolved = resolveCandidates(all, path, fileHash, manifest, portalCandidates);
  combined.findings.push(...resolved.findings);
  combined.dispositionsApplied.push(...resolved.dispositionsApplied);
  combined.pending.push(...resolved.pending.filter((entry) => entry.type !== "manifest_hash_mismatch"));
  return combined;
}

function mergeResult(target, source) {
  target.findings.push(...source.findings);
  target.dispositionsApplied.push(...source.dispositionsApplied);
  target.pending.push(...source.pending);
}

function manifestAssetDisposition(manifest, path, fileHash, category, context) {
  const file = manifestFile(manifest, path);
  if (!file) return { status: "PENDENTE", applied: false, reason: "missing_manifest_entry" };
  if (file.sha256 !== fileHash) return { status: "PENDENTE", applied: false, reason: "manifest_hash_mismatch" };
  if (file.category !== category || !file.evidenceRef || !file.reason) return { status: "PENDENTE", applied: false, reason: "asset_evidence_missing" };
  if (context && !context(file)) return { status: "PENDENTE", applied: false, reason: "asset_magic_mismatch" };
  return { status: "DISPOSED", applied: true, reason: file.reason };
}

function coverageReviewValid(manifest, path, fileHash, kind, required) {
  const record = manifestFile(manifest, path);
  if (!record || record.sha256 !== fileHash) return false;
  const review = record.coverageReviews?.find((entry) => entry.kind === kind);
  if (!review || review.sha256 !== fileHash || review.status !== "manual_review_complete"
    || !review.evidenceRef || !review.reason) return false;
  const declared = new Set(kind === "pdf_visual_review" ? review.pages ?? [] : review.parts ?? []);
  return required.every((item) => declared.has(item));
}

function indexWorktreeEquivalent(indexBytes, worktreeBytes, path) {
  if (indexBytes.equals(worktreeBytes)) return true;
  const extension = path.toLowerCase().split(".").pop() ?? "";
  if (NON_TEXT_EXTENSIONS.has(extension) || indexBytes.includes(0) || worktreeBytes.includes(0)) return false;
  try {
    const decoder = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true });
    const indexText = decoder.decode(indexBytes).replace(/\r\n/g, "\n");
    const worktreeText = decoder.decode(worktreeBytes).replace(/\r\n/g, "\n");
    return indexText === worktreeText;
  } catch {
    return false;
  }
}

function readIndexEntries(root) {
  const listing = execFileSync("git", ["ls-files", "--stage", "-z"], {
    cwd: root, encoding: "buffer", shell: false, stdio: ["ignore", "pipe", "ignore"],
  });
  const entries = new Map();
  for (const record of listing.toString("utf8").split("\0").filter(Boolean)) {
    const tab = record.indexOf("\t");
    if (tab < 0) continue;
    const [mode, oid, stage] = record.slice(0, tab).split(" ");
    const path = record.slice(tab + 1);
    const existing = entries.get(path) ?? [];
    existing.push({ mode, oid, stage, path });
    entries.set(path, existing);
  }
  return entries;
}

function readIndexBlobs(root, entries) {
  const objectIds = [...new Set([...entries.values()].flat()
    .filter((entry) => entry.stage === "0" && entry.mode !== "120000" && entry.mode !== "160000")
    .filter((entry) => !OPERATIONAL_STORE_EXTENSIONS.has((entry.path ?? "").toLowerCase().split(".").pop()))
    .map((entry) => entry.oid))];
  if (objectIds.length === 0) return new Map();
  const output = execFileSync("git", ["cat-file", "--batch"], {
    cwd: root,
    input: Buffer.from(`${objectIds.join("\n")}\n`, "utf8"),
    encoding: "buffer", shell: false, stdio: ["pipe", "pipe", "ignore"], maxBuffer: 512 * 1024 * 1024,
  });
  const blobs = new Map();
  let offset = 0;
  while (offset < output.length) {
    const newline = output.indexOf(0x0a, offset);
    if (newline < 0) throw new Error("git_batch_header_invalid");
    const [oid, type, sizeText] = output.toString("ascii", offset, newline).split(" ");
    const size = Number(sizeText);
    if (type !== "blob" || !Number.isSafeInteger(size) || size < 0) throw new Error("git_batch_blob_invalid");
    const start = newline + 1;
    const end = start + size;
    if (end >= output.length || output[end] !== 0x0a) throw new Error("git_batch_blob_truncated");
    blobs.set(oid, output.subarray(start, end));
    offset = end + 1;
  }
  return blobs;
}

function imageMagic(path, bytes) {
  if (/\.png$/i.test(path) && bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return "png_signature";
  if (/\.jpe?g$/i.test(path) && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "jpeg_signature";
  if (/\.webp$/i.test(path) && bytes.toString("ascii", 0, 4) === "RIFF" && bytes.toString("ascii", 8, 12) === "WEBP") return "webp_signature";
  if (/\.gif$/i.test(path) && /^GIF8[79]a$/.test(bytes.toString("ascii", 0, 6))) return "gif_signature";
  if (/\.bmp$/i.test(path) && bytes.toString("ascii", 0, 2) === "BM") return "bmp_signature";
  if (/\.tiff?$/i.test(path) && (bytes.toString("ascii", 0, 4) === "II*\0" || bytes.toString("ascii", 0, 4) === "MM\0*")) return "tiff_signature";
  return null;
}

function emptyResult() {
  return { findings: [], unscanned: [], dispositionsApplied: [], pending: [] };
}

async function readPdfTextPages(bytes) {
  const data = new Uint8Array(bytes.byteLength);
  data.set(bytes);
  const task = getDocument({
    data,
    disableFontFace: true,
    useSystemFonts: false,
    useWorkerFetch: false,
    useWasm: false,
    isEvalSupported: false,
    verbosity: 0,
  });
  const document = await task.promise;
  try {
    const pages = [];
    for (let number = 1; number <= document.numPages; number += 1) {
      const page = await document.getPage(number);
      const content = await page.getTextContent();
      const text = content.items.map((item) => ("str" in item ? item.str : ""))
        .join(" ").replace(/\s+/g, " ").trim();
      const operatorList = await page.getOperatorList();
      const imageOps = new Set([
        OPS.paintImageMaskXObject, OPS.paintImageMaskXObjectGroup, OPS.paintImageXObject,
        OPS.paintInlineImageXObject, OPS.paintInlineImageXObjectGroup, OPS.paintImageXObjectRepeat,
        OPS.paintImageMaskXObjectRepeat,
      ]);
      const hasImages = operatorList.fnArray.some((operator) => imageOps.has(operator));
      pages.push({ number, text, hasImages });
    }
    return pages;
  } finally {
    await task.destroy();
  }
}

export async function scanRepository(root, manifest = { files: [], protectedPaths: [] }) {
  const result = emptyResult();
  const seen = new Set();
  const protectedPaths = new Map((manifest.protectedPaths ?? []).map((entry) => [entry.path, entry]));
  let paths;
  let indexEntries;
  let indexBlobs;
  try {
    const listing = execFileSync("git", ["ls-files", "-z", "--cached", "--others", "--exclude-standard"], {
      cwd: root, encoding: "buffer", shell: false, stdio: ["ignore", "pipe", "ignore"],
    });
    paths = [...new Set(listing.toString("utf8").split("\0").filter(Boolean))];
    indexEntries = readIndexEntries(root);
    indexBlobs = readIndexBlobs(root, indexEntries);
  } catch {
    result.pending.push({ type: "git_inventory_failed", path: ".", status: "PENDENTE", reason: "publishable_inventory_unavailable" });
    result.unscanned.push({ type: "git_inventory", path: ".", status: "UNVERIFIED" });
    return result;
  }
  const rootAbsolute = resolve(root);
  let rootRealpath;
  try { rootRealpath = realpathSync(rootAbsolute); } catch {
    result.pending.push({ type: "repository_root_unavailable", path: ".", status: "PENDENTE", reason: "repository_realpath_unavailable" });
    result.unscanned.push({ type: "repository_root_unavailable", path: ".", status: "UNVERIFIED" });
    return result;
  }
  for (const path of paths) {
    const absolute = resolve(rootAbsolute, path);
    const relativeToRoot = relative(rootAbsolute, absolute);
    if (relativeToRoot.startsWith(`..${sep}`) || relativeToRoot === "..") {
      result.unscanned.push({ type: "path_outside_repository", path, status: "UNVERIFIED" });
      result.pending.push({ type: "path_outside_repository", path, status: "PENDENTE", reason: "inventory_path_not_contained" });
      continue;
    }
    let stat;
    try { stat = lstatSync(absolute); } catch {
      result.pending.push({ type: "inventory_file_unavailable", path, status: "PENDENTE", reason: "current_worktree_content_unavailable" });
      result.unscanned.push({ type: "inventory_file_unavailable", path, status: "UNVERIFIED" });
      continue;
    }
    if (stat.isSymbolicLink()) {
      seen.add(path);
      result.unscanned.push({ type: "symlink_not_followed", path, status: "UNVERIFIED" });
      result.pending.push({ type: "symlink_not_followed", path, status: "PENDENTE", reason: "symlink_target_not_read" });
      continue;
    }
    let fileRealpath;
    try { fileRealpath = realpathSync(absolute); } catch {
      result.unscanned.push({ type: "path_realpath_unavailable", path, status: "UNVERIFIED" });
      result.pending.push({ type: "path_realpath_unavailable", path, status: "PENDENTE", reason: "file_realpath_unavailable" });
      continue;
    }
    const physicalRelative = relative(rootRealpath, fileRealpath);
    if (physicalRelative === ".." || physicalRelative.startsWith(`..${sep}`) || isAbsolute(physicalRelative)) {
      result.unscanned.push({ type: "path_outside_repository", path, status: "UNVERIFIED" });
      result.pending.push({ type: "path_outside_repository", path, status: "PENDENTE", reason: "physical_path_outside_repository" });
      continue;
    }
    if (!stat.isFile()) {
      result.unscanned.push({ type: stat.isDirectory() ? "gitlink_or_directory" : "non_regular_file", path, status: "UNVERIFIED" });
      result.pending.push({ type: stat.isDirectory() ? "gitlink_or_directory" : "non_regular_file", path, status: "PENDENTE", reason: "inventory_entry_not_regular_file" });
      seen.add(path);
      continue;
    }
    seen.add(path);
    const protectedEntry = protectedPaths.get(path);
    if (protectedEntry?.doNotRead === true) {
      result.unscanned.push({ type: protectedEntry.type ?? "manual_review", path, status: "PENDENTE" });
      result.pending.push({ type: "protected_path_not_read", path, status: "PENDENTE", evidenceRef: protectedEntry.evidenceRef ?? null });
      continue;
    }
    const extension = path.toLowerCase().split(".").pop() ?? "";
    if (OPERATIONAL_STORE_EXTENSIONS.has(extension)) {
      result.unscanned.push({ type: "operational_store_not_read", path, status: "UNVERIFIED" });
      result.pending.push({ type: "operational_store_not_read", path, status: "PENDENTE", reason: "operational_database_excluded_from_scanner_content_reads" });
      continue;
    }
    const bytes = readFileSync(absolute);
    const staged = indexEntries.get(path) ?? [];
    if (staged.length > 1 || staged.some((entry) => entry.stage !== "0")) {
      result.unscanned.push({ type: "index_conflict", path, status: "UNVERIFIED" });
      result.pending.push({ type: "index_conflict", path, status: "PENDENTE", reason: "multiple_index_stages" });
    } else if (staged.length === 1) {
      try {
        const indexBytes = indexBlobs.get(staged[0].oid);
        if (!indexBytes) throw new Error("git_index_blob_missing");
        if (!indexWorktreeEquivalent(indexBytes, bytes, path)) {
          result.pending.push({ type: "git_index_worktree_mismatch", path, status: "PENDENTE", reason: "published_index_bytes_differ_from_scanned_worktree" });
        }
      } catch {
        result.unscanned.push({ type: "index_blob_unavailable", path, status: "UNVERIFIED" });
        result.pending.push({ type: "index_blob_unavailable", path, status: "PENDENTE", reason: "published_index_blob_not_read" });
      }
    }
    const fileHash = currentFileHash(bytes, path, manifest);
    if (fileHash === null) {
      result.unscanned.push({ type: "hash_mode_content_unsupported", path, status: "UNVERIFIED" });
      result.pending.push({ type: "manifest_hash_mode_invalid", path, status: "PENDENTE", reason: "utf8_lf_requires_text_content" });
      continue;
    }

      if (["png", "jpg", "jpeg", "webp", "gif", "bmp", "tif", "tiff"].includes(extension)) {
        const magic = imageMagic(path, bytes);
        const disposition = manifestAssetDisposition(manifest, path, fileHash, "synthetic_visual_review", (file) => magic !== null && file.magic === magic);
        if (disposition.applied) result.dispositionsApplied.push({ type: "raster_asset", path, status: "synthetic_visual_review" });
        else {
          result.unscanned.push({ type: "imagem_raster", path, status: "UNVERIFIED" });
          result.pending.push({ type: "raster_asset", path, status: disposition.status, reason: disposition.reason });
        }
        continue;
      }

      if (extension === "woff2") {
        const magic = bytes.toString("ascii", 0, 4) === "wOF2";
        const disposition = manifestAssetDisposition(manifest, path, fileHash, "technical_font_asset", (file) => magic && file.magic === "wOF2");
        if (disposition.applied) result.dispositionsApplied.push({ type: "technical_font_asset", path, status: "DISPOSED" });
        else {
          result.unscanned.push({ type: "binario_opaco", path, status: "UNVERIFIED" });
          result.pending.push({ type: "technical_font_asset", path, status: disposition.status, reason: disposition.reason });
        }
        continue;
      }

      if (extension === "xlsx") {
        try {
          const rows = extractXlsxRows(bytes);
          mergeResult(result, scanMappedLines(rows, path, fileHash, manifest));
          if (coverageReviewValid(manifest, path, fileHash, "xlsx_unread_parts_review", XLSX_UNREAD_PARTS)) {
            result.dispositionsApplied.push({ type: "xlsx_unread_parts_review", path, status: "manual_review_complete" });
          } else {
            result.unscanned.push({ type: "xlsx_unread_parts", path, status: "UNVERIFIED" });
            result.pending.push({ type: "xlsx_unread_parts_review_required", path, status: "PENDENTE", reason: "comments_headers_footers_docprops_and_embedded_images_not_extracted" });
          }
        } catch {
          result.unscanned.push({ type: "xlsx_unreadable", path, status: "UNVERIFIED" });
          result.pending.push({ type: "xlsx_unreadable", path, status: "PENDENTE", reason: "xlsx_text_extraction_failed" });
        }
        continue;
      }

      if (extension === "pdf") {
        try {
          const pages = await readPdfTextPages(bytes);
          if (pages.length === 0) {
            result.unscanned.push({ type: "pdf_sem_paginas", path, status: "UNVERIFIED" });
            result.pending.push({ type: "pdf_sem_paginas", path, status: "PENDENTE", reason: "pdf_page_count_unavailable" });
            continue;
          }
          const visualPages = pages.filter((page) => !page.text || page.hasImages).map((page) => page.number);
          if (visualPages.length > 0 && coverageReviewValid(manifest, path, fileHash, "pdf_visual_review", visualPages)) {
            result.dispositionsApplied.push({ type: "pdf_visual_review", path, status: "manual_review_complete" });
          } else if (visualPages.length > 0) {
            result.unscanned.push({ type: "pdf_visual_content", path, status: "UNVERIFIED" });
            result.pending.push({ type: "pdf_visual_review_required", path, status: "PENDENTE", reason: "image_or_textless_pages_need_hash_bound_manual_review" });
          }
          const lines = pages.flatMap((page) => page.text.split(/\r?\n/).map((text, index) => ({ page: page.number, line: index + 1, text })));
          mergeResult(result, scanMappedLines(lines, path, fileHash, manifest));
        } catch {
          result.unscanned.push({ type: "pdf_ilegivel", path, status: "UNVERIFIED" });
          result.pending.push({ type: "pdf_ilegivel", path, status: "PENDENTE", reason: "pdf_text_extraction_failed" });
        }
        continue;
      }

      try {
        if (bytes.includes(0)) throw new Error("binary_content");
        const text = TEXT_DECODER.decode(bytes);
        mergeResult(result, scanText(text, path, { sha256: fileHash, manifest }));
      } catch {
        result.unscanned.push({ type: "binario_opaco", path, status: "UNVERIFIED" });
      }
  }
  for (const entry of manifest.files ?? []) {
    if (!seen.has(entry.path)) result.pending.push({ type: "manifest_path_missing", path: entry.path, status: "PENDENTE" });
  }
  for (const entry of manifest.protectedPaths ?? []) {
    if (!seen.has(entry.path)) result.pending.push({ type: "protected_path_missing", path: entry.path, status: "PENDENTE" });
  }
  return result;
}
