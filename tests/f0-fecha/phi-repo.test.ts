import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { describe, expect, it } from "vitest";
import { converterEntradaLocalAsync } from "../../src/leitura/caixa-unica.js";

type FindingType = "cpf" | "cns" | "telefone" | "email" | "credencial_portal" | "nome_cabecalho_laudo";
type Finding = { type: FindingType; path: string; line: number };

const sinteticPatient = /^Paciente Teste \d{2}\b.*$/i;
const emailPattern = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i;
const cnsPattern = /(?<!\d)(?:[12789]\d{14}|[12789]\d{2}(?:[ .-]\d{3}){4}|[12789]\d{2}[ .-]\d{4}[ .-]\d{4}[ .-]\d{4})(?!\d)/;
const cpfPattern = /(?:^|\D)(\d{3})[.\s-]?(\d{3})[.\s-]?(\d{3})[.\s-]?(\d{2})(?!\d)/g;
const phoneCandidatePattern = /(?<!\d)(?:\+?55[ .-]*)?(?:\(([1-9]\d)\)|([1-9]\d))[ .-]*(9\d{4}|\d{4})[ .-]?(\d{4})(?!\d)/g;
const brazilianDdds = new Set([
  "11", "12", "13", "14", "15", "16", "17", "18", "19", "21", "22", "24", "27", "28",
  "31", "32", "33", "34", "35", "37", "38", "41", "42", "43", "44", "45", "46", "47",
  "48", "49", "51", "53", "54", "55", "61", "62", "63", "64", "65", "66", "67", "68",
  "69", "71", "73", "74", "75", "77", "79", "81", "82", "83", "84", "85", "86", "87",
  "88", "89", "91", "93", "94", "95", "96", "97", "98", "99",
]);

function cpfValido(digits: string): boolean {
  if (digits.length !== 11 || /^(\d)\1{10}$/.test(digits)) return false;
  const calculate = (slice: string, start: number) => {
    const sum = [...slice].reduce((total, digit, index) => total + Number(digit) * (start - index), 0);
    const remainder = (sum * 10) % 11;
    return remainder === 10 ? 0 : remainder;
  };
  return calculate(digits.slice(0, 9), 10) === Number(digits[9])
    && calculate(digits.slice(0, 10), 11) === Number(digits[10]);
}

function telefoneValido(match: RegExpMatchArray): boolean {
  return brazilianDdds.has(match[1] ?? match[2] ?? "");
}

function lineFindings(line: string, lineNumber: number, path: string): Finding[] {
  const found: Finding[] = [];
  for (const match of line.matchAll(cpfPattern)) {
    const digits = match.slice(1).join("");
    if (cpfValido(digits)) found.push({ type: "cpf", path, line: lineNumber });
  }
  if (cnsPattern.test(line)) found.push({ type: "cns", path, line: lineNumber });
  if ([...line.matchAll(phoneCandidatePattern)].some(telefoneValido)) {
    found.push({ type: "telefone", path, line: lineNumber });
  }
  if (emailPattern.test(line)) found.push({ type: "email", path, line: lineNumber });

  const headerField = line.match(/^\s*(?:paciente|nome(?:\s+do\s+paciente)?|identifica[cç][aã]o)\s*[:=]\s*(.*?)\s*$/i);
  const candidateName = headerField?.[1]?.trim() ?? "";
  const nameTokens = candidateName.match(/[A-Za-zÀ-ÿ]+/g) ?? [];
  const documentLike = /\.(?:pdf|txt|md|csv|html?|json|log|ya?ml)$/i.test(path);
  if (documentLike && headerField && nameTokens.length >= 2 && !/[{}<>]/.test(candidateName) && !sinteticPatient.test(candidateName)) {
    found.push({ type: "nome_cabecalho_laudo", path, line: lineNumber });
  }
  return found;
}

function findPortalCredentials(lines: string[], path: string): Finding[] {
  const findings: Finding[] = [];
  for (let index = 0; index < lines.length; index += 1) {
    const from = Math.max(0, index - 2);
    const to = Math.min(lines.length, index + 3);
    const context = lines.slice(from, to).join(" ");
    const hasPortalContext = /portal.{0,80}(?:login|usu[aá]rio|user|senha|password|pass)|(?:login|usu[aá]rio|user|senha|password|pass).{0,80}portal/i.test(context)
      || /portal/i.test(path);
    const hasCredentialValue = /(?:portal[_\s-]*(?:login|usu[aá]rio|user|senha|password|pass)|(?:login|usu[aá]rio|user(?:name)?|senha|password|pass)(?:[_\s-]*(?:do[_\s-]*)?portal)?)\s*[:=]\s*\S/i.test(lines[index] ?? "");
    if (hasPortalContext && hasCredentialValue) findings.push({ type: "credencial_portal", path, line: index + 1 });
  }
  return findings;
}

function scanText(text: string, path: string): Finding[] {
  const lines = text.split(/\r?\n/);
  return [
    ...lines.flatMap((line, index) => lineFindings(line, index + 1, path)),
    ...findPortalCredentials(lines, path),
  ];
}

type Unscanned = { type: "pdf_sem_texto" | "imagem_raster" | "binario_opaco"; path: string };
type RepositoryScan = { findings: Finding[]; unscanned: Unscanned[] };

async function scanRepository(root: string): Promise<RepositoryScan> {
  const findings: Finding[] = [];
  const unscanned: Unscanned[] = [];
  const visit = async (directory: string): Promise<void> => {
    for (const name of readdirSync(directory)) {
      if (name === "node_modules" || name === ".git") continue;
      const absolute = join(directory, name);
      const stat = statSync(absolute);
      if (stat.isDirectory()) {
        await visit(absolute);
      } else if (stat.isFile()) {
        const path = relative(root, absolute).split(sep).join("/");
        const bytes = readFileSync(absolute);
        if (/\.(?:png|jpe?g|webp|gif|bmp|tiff?)$/i.test(name)) {
          unscanned.push({ type: "imagem_raster", path });
          continue;
        }
        if (/\.pdf$/i.test(name)) {
          try {
            const result = await converterEntradaLocalAsync({
              id: path,
              tipo: "PDF_DIGITAL",
              conteudo: bytes,
              recebidoEm: "2026-10-09T00:00:00.000Z",
            });
            if (result.status !== "PRONTO" || result.documento.paginas.length === 0) {
              unscanned.push({ type: "pdf_sem_texto", path });
              continue;
            }
            for (const page of result.documento.paginas) {
              findings.push(...scanText(page.texto, path));
            }
          } catch {
            unscanned.push({ type: "pdf_sem_texto", path });
          }
          continue;
        }
        const text = new TextDecoder("utf-8", { fatal: true });
        try {
          if (bytes.includes(0)) {
            unscanned.push({ type: "binario_opaco", path });
          } else {
            findings.push(...scanText(text.decode(bytes), path));
          }
        } catch {
          unscanned.push({ type: "binario_opaco", path });
        }
      }
    }
  };
  await visit(root);
  return { findings, unscanned };
}

function syntheticCpf(): string {
  const digits = "529982247";
  const digit = (slice: string, start: number) => {
    const sum = [...slice].reduce((total, value, index) => total + Number(value) * (start - index), 0);
    const remainder = (sum * 10) % 11;
    return String(remainder === 10 ? 0 : remainder);
  };
  return `${digits}${digit(digits, 10)}${digit(digits + digit(digits, 10), 11)}`;
}

describe("scanner PHI do repositório", () => {
  it("detecta exemplos positivos e rejeita padrões inválidos sem expor valores", () => {
    const cpf = syntheticCpf();
    const positives = [
      ["CPF", `CPF: ${cpf}`],
      ["CNS", `CNS: ${"1" + "23456789012345"}`],
      ["telefone", `Contato: ${"11" + "98765" + "4321"}`],
      ["email", `Contato: ${"teste" + "@example.com"}`],
      ["credencial_portal", ["Portal do paciente", `log${"in"}: ${"usuario" + "-teste"}`, `se${"nha"}: ${"segredo" + "-teste"}`].join(String.fromCharCode(10))],
      ["nome_cabecalho_laudo", "Paciente: Nome Sobrenome"],
    ] as const;
    for (const [type, sample] of positives) {
      expect(scanText(sample, "laudo-sintetico.txt").map((finding) => finding.type)).toContain(type.toLowerCase());
    }

    const negatives = [
      "CPF: 111.111.111-11",
      "CNS: 12345",
      "Telefone: 123",
      "Email: apenas-texto",
      "Portal do paciente\nstatus: indisponível",
    ];
    for (const sample of negatives) expect(scanText(sample, "fixture-neutro.txt")).toEqual([]);
    expect(scanText("Paciente: Paciente Teste 08", "laudo-sintetico.txt")).toEqual([]);
  });

  it("não encontra identificadores ou dados pessoais fora da allowlist sintética declarada", async () => {
    const repositoryRoot = process.cwd();
    const result = await scanRepository(repositoryRoot);
    console.info("PHI_SCAN_SAFE=" + JSON.stringify({
      findings: result.findings.map(({ type, path, line }) => ({ type, path, line })),
      unscanned: result.unscanned,
    }));
    expect({
      findings: result.findings.map(({ type, path, line }) => ({ type, path, line })),
      unscanned: result.unscanned,
    }).toEqual({ findings: [], unscanned: [] });
  });
});
