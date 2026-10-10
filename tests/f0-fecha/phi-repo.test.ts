import { deflateRawSync } from "node:zlib";
import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { describe, expect, it } from "vitest";
import {
  extractXlsxRows,
  findTextCandidates,
  scanRepository,
  scanText,
  sha256,
  type PhiDispositionItem,
  type PhiManifest,
} from "../../scripts/phi-repo.mjs";

function syntheticCpf(): string {
  const digits = "529982247";
  const digit = (slice: string, start: number) => {
    const sum = [...slice].reduce((total, value, index) => total + Number(value) * (start - index), 0);
    const remainder = (sum * 10) % 11;
    return String(remainder === 10 ? 0 : remainder);
  };
  return `${digits}${digit(digits, 10)}${digit(digits + digit(digits, 10), 11)}`;
}

function manifestFor(path: string, text: string, items: PhiDispositionItem[], hashMode?: "raw" | "utf8-lf"): PhiManifest {
  return {
    schemaVersion: 1 as const,
    files: [{ path, sha256: sha256(Buffer.from(text, "utf8"), hashMode), ...(hashMode ? { hashMode } : {}), items }],
  };
}

function initGitRepo(): string {
  const root = mkdtempSync(join(tmpdir(), "phi-repo-"));
  execFileSync("git", ["init", "-q"], { cwd: root, shell: false });
  execFileSync("git", ["-C", root, "config", "user.email", "test@example.invalid"], { shell: false });
  execFileSync("git", ["-C", root, "config", "user.name", "Test"], { shell: false });
  return root;
}

function minimalBlankPdf(): Buffer {
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 144] /Resources << >> /Contents 4 0 R >>",
    "<< /Length 0 >>\nstream\n\nendstream",
  ];
  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  for (let index = 0; index < objects.length; index += 1) {
    offsets.push(Buffer.byteLength(pdf, "binary"));
    pdf += `${index + 1} 0 obj\n${objects[index]}\nendobj\n`;
  }
  const xrefOffset = Buffer.byteLength(pdf, "binary");
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  pdf += offsets.slice(1).map((offset) => `${String(offset).padStart(10, "0")} 00000 n \n`).join("");
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;
  return Buffer.from(pdf, "binary");
}

function minimalTextAndImagePdf(): Buffer {
  const content = "BT /F1 12 Tf 10 20 Td (SAFE) Tj ET\nq 10 0 0 10 0 0 cm /Im0 Do Q";
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 144] /Resources << /Font << /F1 6 0 R >> /XObject << /Im0 5 0 R >> >> /Contents 4 0 R >>",
    `<< /Length ${content.length} >>\nstream\n${content}\nendstream`,
    `<< /Type /XObject /Subtype /Image /Width 1 /Height 1 /ColorSpace /DeviceRGB /BitsPerComponent 8 /Length 3 >>\nstream\n\0\0\0\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];
  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  for (let index = 0; index < objects.length; index += 1) {
    offsets.push(Buffer.byteLength(pdf, "binary"));
    pdf += `${index + 1} 0 obj\n${objects[index]}\nendobj\n`;
  }
  const xrefOffset = Buffer.byteLength(pdf, "binary");
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  pdf += offsets.slice(1).map((offset) => `${String(offset).padStart(10, "0")} 00000 n \n`).join("");
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;
  return Buffer.from(pdf, "binary");
}

function zip(entries: Array<[string, string]>): Buffer {
  const local: Buffer[] = [];
  const central: Buffer[] = [];
  let offset = 0;
  for (const [name, content] of entries) {
    const nameBytes = Buffer.from(name, "utf8");
    const plain = Buffer.from(content, "utf8");
    const compressed = deflateRawSync(plain);
    const header = Buffer.alloc(30);
    header.writeUInt32LE(0x04034b50, 0);
    header.writeUInt16LE(20, 4);
    header.writeUInt16LE(8, 8);
    header.writeUInt32LE(compressed.length, 18);
    header.writeUInt32LE(plain.length, 22);
    header.writeUInt16LE(nameBytes.length, 26);
    local.push(header, nameBytes, compressed);

    const directory = Buffer.alloc(46);
    directory.writeUInt32LE(0x02014b50, 0);
    directory.writeUInt16LE(20, 4);
    directory.writeUInt16LE(20, 6);
    directory.writeUInt16LE(8, 10);
    directory.writeUInt32LE(compressed.length, 20);
    directory.writeUInt32LE(plain.length, 24);
    directory.writeUInt16LE(nameBytes.length, 28);
    directory.writeUInt32LE(offset, 42);
    central.push(directory, nameBytes);
    offset += header.length + nameBytes.length + compressed.length;
  }
  const centralBytes = Buffer.concat(central);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(centralBytes.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...local, centralBytes, end]);
}

describe("scanner PHI do repositório", () => {
  it("detecta identificadores positivos e rejeita padrões inválidos", () => {
    const cpf = syntheticCpf();
    const positives = [
      ["cpf", `CPF: ${cpf}`],
      ["cns", `CNS: ${"1" + "23456789012345"}`],
      ["telefone", `Contato: ${"11" + "98765" + "4321"}`],
      ["email", `Contato: ${"teste" + "@example.com"}`],
      ["credencial_portal", ["Portal do paciente", `log${"in"}: ${"usuario" + "-teste"}`, `se${"nha"}: ${"segredo" + "-teste"}`].join(String.fromCharCode(10))],
      ["nome_cabecalho_laudo", "Paciente: Nome Sobrenome"],
    ] as const;
    for (const [type, sample] of positives) {
      const textHits = scanText(sample, "laudo-sintetico.txt").findings.map((candidate) => candidate.type);
      const candidates = findTextCandidates(sample, "laudo-sintetico.txt").map((candidate) => candidate.type);
      expect([...textHits, ...candidates]).toContain(type);
    }

    const negatives = [
      "CPF: 111.111.111-11",
      "CNS: 12345",
      "Telefone: 123",
      "Email: apenas-texto",
      "Portal do paciente\nstatus: indisponível",
    ];
    for (const sample of negatives) expect(scanText(sample, "fixture-neutro.txt").findings).toEqual([]);
    expect(scanText("Paciente: Paciente Teste 08", "laudo-sintetico.txt").findings).toEqual([]);
  });

  it("permite somente microprompt e hash token com hash e contexto exatos", () => {
    const prompt = `arquivo: ${"resumo" + "@1.0.0.md"}`;
    const promptCandidate = findTextCandidates(prompt, "docs/prompts/lista.md").find((candidate) => candidate.type === "email");
    expect(promptCandidate?.contextTag).toBe("microprompt_version_filename");
    const promptScan = scanText(prompt, "docs/prompts/lista.md", {
      manifest: manifestFor("docs/prompts/lista.md", prompt, [{
        type: "email", line: 1, ordinal: 0, contextTag: "microprompt_version_filename",
        status: "technical_token_false_positive", evidenceRef: "docs/prompts/lista.md:1",
        reason: "Identificador de microprompt no formato nome-versão-arquivo.",
      }]),
    });
    expect(promptScan.findings).toEqual([]);
    expect(promptScan.dispositionsApplied.map(({ status }) => status)).toEqual(["technical_token_false_positive"]);

    const hashLine = `commit a${"11" + "98765" + "4321"}${"b".repeat(28)}`;
    const hashCandidate = findTextCandidates(hashLine, "docs/commits.md").find((candidate) => candidate.type === "telefone");
    expect(hashCandidate?.contextTag).toBe("commit_hash_40_or_64_hex");
    const hashScan = scanText(hashLine, "docs/commits.md", {
      manifest: manifestFor("docs/commits.md", hashLine, [{
        type: "telefone", line: 1, ordinal: 0, contextTag: "commit_hash_40_or_64_hex",
        status: "technical_token_false_positive", evidenceRef: "docs/commits.md:1",
        reason: "O match telefônico está contido em token hexadecimal de commit.",
      }]),
    });
    expect(hashScan.findings).toEqual([]);

    const changed = hashLine.replace(/b$/, "c");
    const stale = scanText(changed, "docs/commits.md", {
      manifest: manifestFor("docs/commits.md", hashLine, [{
        type: "telefone", line: 1, ordinal: 0, contextTag: "commit_hash_40_or_64_hex",
        status: "technical_token_false_positive", evidenceRef: "docs/commits.md:1",
        reason: "O match telefônico está contido em token hexadecimal de commit.",
      }]),
    });
    expect(stale.findings.map(({ type, path, line }) => ({ type, path, line }))).toEqual([
      { type: "telefone", path: "docs/commits.md", line: 1 },
    ]);
    expect(stale.pending.map(({ type, status }) => ({ type, status }))).toContainEqual({ type: "manifest_hash_mismatch", status: "PENDENTE" });

    const manifestHash = `"sha256": "a${"11" + "98765" + "4321"}${"b".repeat(52)}"`;
    expect(findTextCandidates(manifestHash, "docs/f0-fecha/PHI-TRIAGEM.json")).toEqual([]);

    const sha256Line = `"hash": "a${"11" + "98765" + "4321"}${"b".repeat(52)}"`;
    const sha256Candidate = findTextCandidates(sha256Line, "corpus/fichas/example.json").find((candidate) => candidate.type === "telefone");
    expect(sha256Candidate?.contextTag).toBe("json_sha256_field_64hex");
  });

  it("mantém um segundo ID real-like sem disposição e só libera o token declarado", () => {
    const cpf = syntheticCpf();
    const text = `registro A: ${cpf}; registro B: ${cpf}`;
    const scan = scanText(text, "tests/fixtures/escopo-controlado.txt", {
      manifest: manifestFor("tests/fixtures/escopo-controlado.txt", text, [{
        type: "cpf", line: 1, ordinal: 0, status: "synthetic_declared",
        evidenceRef: "tests/fixtures/escopo-controlado.txt:1",
        reason: "Um único campo foi declarado sintético neste fixture.",
      }]),
    });
    expect(scan.dispositionsApplied.map(({ type, line }) => ({ type, line }))).toEqual([{ type: "cpf", line: 1 }]);
    expect(scan.findings.map(({ type, path, line, ordinal }) => ({ type, path, line, ordinal }))).toEqual([
      { type: "cpf", path: "tests/fixtures/escopo-controlado.txt", line: 1, ordinal: 1 },
    ]);
    expect(findTextCandidates(`CPF: ${cpf}`, "entrada-sem-declaracao.txt").map(({ type, line }) => ({ type, line })))
      .toEqual([{ type: "cpf", line: 1 }]);
  });

  it("usa utf8-lf apenas quando declarado e mantém raw byte-sensitive", async () => {
    const crlf = Buffer.from("linha 1\r\nlinha 2\r\n", "utf8");
    const lf = Buffer.from("linha 1\nlinha 2\n", "utf8");
    expect(sha256(crlf, "utf8-lf", "notes.txt")).toBe(sha256(lf, "utf8-lf", "notes.txt"));
    expect(sha256(crlf)).not.toBe(sha256(lf));
    const bomCrlf = Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), crlf]);
    const bomLf = Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), lf]);
    expect(sha256(bomCrlf, "utf8-lf", "notes.txt")).toBe(sha256(bomLf, "utf8-lf", "notes.txt"));
    expect(sha256(bomLf, "utf8-lf", "notes.txt")).not.toBe(sha256(lf, "utf8-lf", "notes.txt"));
    expect(() => sha256(crlf, "utf8-lf", "document.pdf")).toThrow("utf8_lf_not_supported_for_binary_format");

    const root = initGitRepo();
    try {
      const candidate = `CPF: ${syntheticCpf()}\r\n`;
      writeFileSync(join(root, "public.txt"), candidate);
      const manifest = manifestFor("public.txt", candidate.replace(/\r\n/g, "\n"), [{
        type: "cpf", line: 1, ordinal: 0, status: "synthetic_declared",
        evidenceRef: "fixture declaration", reason: "Synthetic scanner fixture.",
      }], "utf8-lf");
      const matched = await scanRepository(root, manifest);
      expect(matched.findings).toEqual([]);
      writeFileSync(join(root, "public.txt"), `${candidate}CPF: ${syntheticCpf()}\r\n`);
      const changed = await scanRepository(root, manifest);
      expect(changed.findings.map(({ type }) => type)).toContain("cpf");
      expect(changed.pending.some(({ type }) => type === "manifest_hash_mismatch")).toBe(true);

      const rawManifest = manifestFor("public.txt", candidate.replace(/\r\n/g, "\n"), [{
        type: "cpf", line: 1, ordinal: 0, status: "synthetic_declared",
        evidenceRef: "fixture declaration", reason: "Synthetic scanner fixture.",
      }]);
      const rawMismatch = await scanRepository(root, rawManifest);
      expect(rawMismatch.findings.map(({ type }) => type)).toContain("cpf");
    } finally { rmSync(root, { recursive: true, force: true }); }
  });

  it("scaneia a superfície Git publicável: ignora build não rastreado, inclui rastreado ignorado e untracked público", async () => {
    const root = initGitRepo();
    try {
      writeFileSync(join(root, ".gitignore"), "dist/\n");
      mkdirSync(join(root, "dist"));
      const id = syntheticCpf();
      writeFileSync(join(root, "dist", "ignored.txt"), `CPF: ${id}`);
      writeFileSync(join(root, "dist", "tracked.txt"), `CPF: ${id}`);
      writeFileSync(join(root, "public.txt"), `CPF: ${id}`);
      execFileSync("git", ["-C", root, "add", ".gitignore"], { shell: false });
      execFileSync("git", ["-C", root, "add", "-f", "dist/tracked.txt"], { shell: false });
      const scanned = await scanRepository(root, { schemaVersion: 1, files: [], protectedPaths: [] });
      expect(scanned.findings.map(({ path }) => path).sort()).toEqual(["dist/tracked.txt", "public.txt"]);
      expect(scanned.findings.some(({ path }) => path === "dist/ignored.txt")).toBe(false);
      const failed = await scanRepository(join(root, "missing"), { schemaVersion: 1, files: [], protectedPaths: [] });
      expect(failed.pending.map(({ type }) => type)).toContain("git_inventory_failed");
    } finally { rmSync(root, { recursive: true, force: true }); }
  });

  it("falha fechado em gitlink e arquivo rastreado ausente", async () => {
    const root = initGitRepo();
    const nested = mkdtempSync(join(tmpdir(), "phi-subrepo-"));
    try {
      mkdirSync(join(root, "module"));
      writeFileSync(join(nested, "module.txt"), "fixture");
      execFileSync("git", ["init", "-q"], { cwd: nested, shell: false });
      execFileSync("git", ["-C", nested, "config", "user.email", "test@example.invalid"], { shell: false });
      execFileSync("git", ["-C", nested, "config", "user.name", "Test"], { shell: false });
      execFileSync("git", ["-C", nested, "add", "module.txt"], { shell: false });
      execFileSync("git", ["-C", nested, "commit", "-qm", "fixture"], { shell: false });
      const oid = execFileSync("git", ["-C", nested, "rev-parse", "HEAD"], { encoding: "utf8", shell: false }).trim();
      execFileSync("git", ["-C", root, "update-index", "--add", "--cacheinfo", `160000,${oid},module`], { shell: false });
      writeFileSync(join(root, "removed.txt"), "fixture");
      execFileSync("git", ["-C", root, "add", "removed.txt"], { shell: false });
      rmSync(join(root, "removed.txt"));

      const result = await scanRepository(root, { schemaVersion: 1, files: [], protectedPaths: [] });
      expect(result.unscanned).toContainEqual({ type: "gitlink_or_directory", path: "module", status: "UNVERIFIED" });
      expect(result.pending.map(({ type, path }) => ({ type, path }))).toContainEqual({ type: "gitlink_or_directory", path: "module" });
      expect(result.pending.map(({ type, path }) => ({ type, path }))).toContainEqual({ type: "inventory_file_unavailable", path: "removed.txt" });
    } finally {
      rmSync(nested, { recursive: true, force: true });
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("compara blob do índice ao worktree e só tolera CRLF/LF equivalente em texto", async () => {
    const root = initGitRepo();
    try {
      const stagedId = join(root, "staged-id.txt");
      const eol = join(root, "eol.txt");
      writeFileSync(stagedId, `CPF: ${syntheticCpf()}\n`);
      writeFileSync(eol, "sem identificadores\n");
      execFileSync("git", ["-C", root, "add", "staged-id.txt", "eol.txt"], { shell: false });
      writeFileSync(stagedId, "texto neutro no worktree\n");
      writeFileSync(eol, "sem identificadores\r\n");

      const result = await scanRepository(root, { schemaVersion: 1, files: [], protectedPaths: [] });
      expect(result.pending.map(({ type, path }) => ({ type, path }))).toContainEqual({
        type: "git_index_worktree_mismatch", path: "staged-id.txt",
      });
      expect(result.pending.some(({ type, path }) => type === "git_index_worktree_mismatch" && path === "eol.txt")).toBe(false);
    } finally { rmSync(root, { recursive: true, force: true }); }
  });

  it("recusa diretório pai junction que resolve para fora do repositório", async () => {
    const root = initGitRepo();
    const outside = mkdtempSync(join(tmpdir(), "phi-outside-"));
    const docsPath = join(root, "docs");
    let junctionCreated = false;
    try {
      mkdirSync(docsPath);
      writeFileSync(join(docsPath, "arquivo.txt"), `CPF: ${syntheticCpf()}`);
      execFileSync("git", ["-C", root, "add", "docs/arquivo.txt"], { shell: false });
      rmSync(docsPath, { recursive: true, force: true });
      writeFileSync(join(outside, "arquivo.txt"), `CPF: ${syntheticCpf()}`);
      symlinkSync(outside, docsPath, "junction");
      junctionCreated = true;

      const result = await scanRepository(root, { schemaVersion: 1, files: [], protectedPaths: [] });
      expect(result.findings).toEqual([]);
      expect(result.unscanned).toContainEqual({ type: "path_outside_repository", path: "docs/arquivo.txt", status: "UNVERIFIED" });
      expect(result.pending).toContainEqual(expect.objectContaining({
        type: "path_outside_repository", path: "docs/arquivo.txt", status: "PENDENTE",
        reason: "physical_path_outside_repository",
      }));
    } finally {
      if (junctionCreated && existsSync(docsPath)) rmSync(docsPath, { recursive: false, force: true });
      rmSync(outside, { recursive: true, force: true });
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("extrai apenas strings e valores armazenados de XLSX, sem executar fórmula ou macro", () => {
    const email = `${"fixture"}${"@example.com"}`;
    const workbook = zip([
      ["xl/sharedStrings.xml", `<sst><si><t>Contato</t></si><si><t>${email}</t></si></sst>`],
      ["xl/worksheets/sheet1.xml", '<worksheet><sheetData><row r="4"><c t="s"><v>0</v></c><c t="s"><v>1</v></c></row></sheetData></worksheet>'],
    ]);
    const rows = extractXlsxRows(workbook);
    expect(rows.map(({ line }) => line)).toEqual([4]);
    expect(findTextCandidates(rows[0]!.text, "protocolos.xlsx").map(({ type }) => type)).toContain("email");
  });

  it("exige revisão PDF vinculada ao SHA para página sem texto", async () => {
    const root = initGitRepo();
    try {
      const bytes = minimalBlankPdf();
      writeFileSync(join(root, "scan.pdf"), bytes);
      const sha = sha256(bytes);
      const base = { schemaVersion: 1 as const, files: [{ path: "scan.pdf", sha256: sha }], protectedPaths: [] };
      const withoutReview = await scanRepository(root, base);
      expect(withoutReview.unscanned).toContainEqual({ type: "pdf_visual_content", path: "scan.pdf", status: "UNVERIFIED" });
      expect(withoutReview.pending.map(({ type }) => type)).toContain("pdf_visual_review_required");

      const reviewed: PhiManifest = {
        ...base,
        files: [{ ...base.files[0]!, coverageReviews: [{
          kind: "pdf_visual_review", sha256: sha, status: "manual_review_complete",
          pages: [1], evidenceRef: "review fixture", reason: "Visual page reviewed in synthetic test.",
        }] }],
      };
      const staleReview: PhiManifest = {
        ...reviewed,
        files: [{ ...reviewed.files[0]!, coverageReviews: [{ ...reviewed.files[0]!.coverageReviews![0]!, sha256: "0".repeat(64) }] }],
      };
      const stale = await scanRepository(root, staleReview);
      expect(stale.pending.map(({ type }) => type)).toContain("pdf_visual_review_required");
      const withReview = await scanRepository(root, reviewed);
      expect(withReview.pending.some(({ type }) => type === "pdf_visual_review_required")).toBe(false);
      expect(withReview.dispositionsApplied).toContainEqual({ type: "pdf_visual_review", path: "scan.pdf", status: "manual_review_complete" });
    } finally { rmSync(root, { recursive: true, force: true }); }
  });

  it("exige revisão PDF vinculada ao SHA para imagem embutida em página com texto", async () => {
    const root = initGitRepo();
    try {
      const bytes = minimalTextAndImagePdf();
      writeFileSync(join(root, "mixed.pdf"), bytes);
      const result = await scanRepository(root, {
        schemaVersion: 1,
        files: [{ path: "mixed.pdf", sha256: sha256(bytes) }],
        protectedPaths: [],
      });
      expect(result.pending.map(({ type }) => type)).toContain("pdf_visual_review_required");
      expect(result.unscanned).toContainEqual({ type: "pdf_visual_content", path: "mixed.pdf", status: "UNVERIFIED" });
    } finally { rmSync(root, { recursive: true, force: true }); }
  });

  it("exige revisão hash-bound das partes XLSX ainda não extraídas", async () => {
    const root = initGitRepo();
    try {
      const bytes = zip([
        ["xl/sharedStrings.xml", "<sst><si><t>Dados de fixture</t></si></sst>"],
        ["xl/worksheets/sheet1.xml", "<worksheet><sheetData><row r=\"1\"><c t=\"s\"><v>0</v></c></row></sheetData></worksheet>"],
      ]);
      writeFileSync(join(root, "workbook.xlsx"), bytes);
      const sha = sha256(bytes);
      const base = { schemaVersion: 1 as const, files: [{ path: "workbook.xlsx", sha256: sha }], protectedPaths: [] };
      const withoutReview = await scanRepository(root, base);
      expect(withoutReview.unscanned).toContainEqual({ type: "xlsx_unread_parts", path: "workbook.xlsx", status: "UNVERIFIED" });
      expect(withoutReview.pending.map(({ type }) => type)).toContain("xlsx_unread_parts_review_required");

      const reviewed: PhiManifest = {
        ...base,
        files: [{ ...base.files[0]!, coverageReviews: [{
          kind: "xlsx_unread_parts_review", sha256: sha, status: "manual_review_complete",
          parts: ["comments", "headers_footers", "docProps", "embedded_images"],
          evidenceRef: "review fixture", reason: "Unextracted workbook parts reviewed in synthetic test.",
        }] }],
      };
      const staleReview: PhiManifest = {
        ...reviewed,
        files: [{ ...reviewed.files[0]!, coverageReviews: [{ ...reviewed.files[0]!.coverageReviews![0]!, sha256: "0".repeat(64) }] }],
      };
      const stale = await scanRepository(root, staleReview);
      expect(stale.pending.map(({ type }) => type)).toContain("xlsx_unread_parts_review_required");
      const withReview = await scanRepository(root, reviewed);
      expect(withReview.pending.some(({ type }) => type === "xlsx_unread_parts_review_required")).toBe(false);
      expect(withReview.dispositionsApplied).toContainEqual({ type: "xlsx_unread_parts_review", path: "workbook.xlsx", status: "manual_review_complete" });
    } finally { rmSync(root, { recursive: true, force: true }); }
  });

  it("mantém findings e arquivos não escaneados explícitos no repositório", async () => {
    const manifest = JSON.parse(readFileSync("docs/f0-fecha/PHI-TRIAGEM.json", "utf8"));
    const result = await scanRepository(process.cwd(), manifest);
    console.info("PHI_SCAN_SAFE=" + JSON.stringify({
      findings: result.findings.map(({ type, path, line, ordinal, contextTag, page }) => ({ type, path, line, ordinal, contextTag, page })),
      unscanned: result.unscanned,
      dispositionsApplied: result.dispositionsApplied.map(({ type, path, line, ordinal, contextTag, page, status }) => ({ type, path, line, ordinal, contextTag, page, status })),
      pending: result.pending.map(({ type, path, line, status, reason }) => ({ type, path, line, status, reason })),
    }));
    expect({
      findings: result.findings.map(({ type, path, line, page }) => ({ type, path, line, page })),
      unscanned: result.unscanned.map(({ type, path, status }) => ({ type, path, status })),
      pending: result.pending.map(({ type, path, line, status, reason }) => ({ type, path, line, status, reason })),
    }).toEqual({ findings: [], unscanned: [], pending: [] });
  });
});
