// KIMI-16 · integridade dos fixtures do Paciente Teste 07 (tests/fixtures/caso07/).
// Provam que: (a) os 11 documentos existem e são 100% sintéticos; (b) os números sintéticos
// têm exatamente a estrutura prometida (CNS com checksum válido, CPF com DV inválido de
// propósito); (c) as duplicatas e os trechos riscados são reais no conteúdo; (d) o
// esperado.json bate com o conteúdo dos arquivos. Regressão: CASO-REAL-01-LICOES.md §4.
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const DIR = fileURLToPath(new URL("../fixtures/caso07", import.meta.url));
const ler = (nome: string) => readFileSync(join(DIR, nome), "utf8");
const DOCS = [
  "01-ficha-recepcao.txt", "02-receituario-secundario.txt", "03-documentos-pessoais-comprovante.txt",
  "04-biopsia-lote-a.txt", "05-biopsia-lote-b.txt", "06-rm-prostata.txt",
  "07-cintilografia-ossea-pagina-1.txt", "08-cintilografia-ossea-pagina-2.txt",
  "09-ap-rtu.txt", "10-ihq-original.txt", "11-ihq-sisreg-reimpressao.txt",
] as const;
const PAGINAS_EXAME = DOCS.slice(3); // 04..11 = 8 páginas de exame

const soDigitos = (s: string) => s.replace(/\D/g, "");

// Mesma regra de src/kernel/llm/desidentificar.ts (cnsValido/cpfValido), replicada para os
// fixtures não dependerem de I/O nem de importar src em teste de dados.
function cnsValido(raw: string): boolean {
  const d = soDigitos(raw);
  if (d.length !== 15 || !/^[1-9]/.test(d)) return false;
  let s = 0;
  for (let i = 0; i < 15; i++) s += Number(d[i]) * (15 - i);
  return s % 11 === 0;
}
function cpfValido(raw: string): boolean {
  const d = soDigitos(raw);
  if (d.length !== 11 || /^(\d)\1{10}$/.test(d)) return false;
  const dv = (n: number) => {
    let s = 0;
    for (let i = 0; i < n; i++) s += Number(d[i]) * (n + 1 - i);
    const r = (s * 10) % 11;
    return r === 10 ? 0 : r;
  };
  return dv(9) === Number(d[9]) && dv(10) === Number(d[10]);
}

describe("KIMI-16 · fixtures Paciente Teste 07 — integridade e sinteticidade", () => {
  it("os 11 documentos + esperado.json existem; todos declaram ser sintéticos", () => {
    const noDir = readdirSync(DIR).sort();
    for (const doc of DOCS) {
      expect(noDir, doc).toContain(doc);
      expect(ler(doc), doc).toContain("DOCUMENTO SINTÉTICO");
      expect(ler(doc), doc).toContain("PACIENTE TESTE 07");
    }
    expect(noDir).toContain("esperado.json");
  });

  it("CNS sintético de 15 dígitos tem checksum válido; CPF sintético tem DV propositalmente inválido", () => {
    const doc = ler("03-documentos-pessoais-comprovante.txt");
    const cns = /Matrícula"\):\s*(\d+)/.exec(doc)?.[1];
    const cpf = /"CI"\):\s*([\d.-]+)/.exec(doc)?.[1];
    expect(cns).toBe("704202600001234");
    expect(cnsValido(cns!)).toBe(true);   // classificável como CNS PELO VALOR
    expect(cpf).toBe("123.456.789-01");
    expect(cpfValido(cpf!)).toBe(false);  // inválido de propósito (invariante da onda)
  });

  it("I1/I2: o mesmo valor de 11 dígitos aparece como 'CI' (ficha) e 'Cartão SUS' (laudos)", () => {
    expect(ler("01-ficha-recepcao.txt")).toContain('rótulo impresso "CI"): 123.456.789-01');
    for (const doc of ["04-biopsia-lote-a.txt", "06-rm-prostata.txt", "10-ihq-original.txt"])
      expect(ler(doc), doc).toContain('"Cartão SUS"): 123.456.789-01');
  });

  it("D1: as duas páginas da cintilografia têm corpo idêntico (UM exame MED-5001)", () => {
    const corpo = (nome: string) => ler(nome).split("=====")[2]; // seção entre os 1ºs dois =====
    expect(corpo("07-cintilografia-ossea-pagina-1.txt"))
      .toEqual(corpo("08-cintilografia-ossea-pagina-2.txt"));
  });

  it("D2: IHQ original e reimpressão citam o MESMO protocolo LAB-9004 com extração diferente", () => {
    expect(ler("10-ihq-original.txt")).toContain("Protocolo: LAB-9004");
    const reimpressao = ler("11-ihq-sisreg-reimpressao.txt");
    expect(reimpressao).toContain("LAB-9004");
    expect(reimpressao).toContain("Data da extração: 2026-09-01"); // data de extração ≠ data clínica
  });

  it("R1: a RM contém exatamente 2 trechos [RISCADO]…[/RISCADO]", () => {
    const rm = ler("06-rm-prostata.txt");
    expect(rm.match(/\[RISCADO\][\s\S]*?\[\/RISCADO\]/g)).toHaveLength(2);
  });

  it("P1: biópsia tem 6 sítios com lateralidade/posição; cribriforme em 1 sítio e negado nos demais", () => {
    // corpo do laudo = entre o 2º e o último ===== (fora cabeçalho, banner e rodapé de armadilhas)
    const corpoSemRodape = (nome: string) => ler(nome).split(/={5,}/).slice(2, -1).join("\n");
    const a = corpoSemRodape("04-biopsia-lote-a.txt"), b = corpoSemRodape("05-biopsia-lote-b.txt");
    expect((a + b).match(/^SÍTIO/gm)).toHaveLength(6);
    expect((a + b).match(/COM PADRÃO CRIBRIFORME/g)).toHaveLength(1);
    expect((a + b).match(/Sem padrão cribriforme/g)).toHaveLength(4); // negação por sítio
    expect(a).toContain("inflamação crônica; neoplasia não identificada neste sítio"); // R ápice
    expect(ler("05-biopsia-lote-b.txt")).toContain("Protocolo: LAB-9002"); // lote distinto (não duplicata)
  });

  it("esperado.json: 8 páginas de exame → 6 exames únicos, coerente com o kit", () => {
    const esperado = JSON.parse(ler("esperado.json")) as {
      exames: { paginas: number; unicos: number; listaUnica: { protocolo: string }[] } };
    expect(PAGINAS_EXAME).toHaveLength(8);
    expect(esperado.exames.paginas).toBe(8);
    expect(esperado.exames.unicos).toBe(6);
    expect(esperado.exames.listaUnica.map((e) => e.protocolo)).toEqual(
      ["LAB-9001", "LAB-9002", "RAD-7001", "MED-5001", "LAB-9003", "LAB-9004"]);
  });

  it("E2/E3/S1/S2: âncoras do resultado esperado presentes no receituário e na cintilografia", () => {
    const receituario = ler("02-receituario-secundario.txt");
    expect(receituario).toContain("PSA: 8,4 ng/mL");       // mencionado sem laudo (E2)
    expect(receituario).toContain("PIRADS\" — SEM o número"); // PENDENTE (E3)
    expect(receituario).toContain("DOENÇA LOCALMENTE AVANÇADA"); // ≠ TNM (S1)
    const cint = ler("07-cintilografia-ossea-pagina-1.txt");
    expect(cint).toContain("NEGATIVO para doença óssea secundária"); // (S2)
  });
});
