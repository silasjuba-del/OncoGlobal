import { deflateRawSync } from "node:zlib";
import { readFileSync } from "node:fs";
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

function manifestFor(path: string, text: string, items: PhiDispositionItem[]): PhiManifest {
  return {
    schemaVersion: 1 as const,
    files: [{ path, sha256: sha256(Buffer.from(text, "utf8")), items }],
  };
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
