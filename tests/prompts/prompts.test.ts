import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const root = fileURLToPath(new URL("../../corpus/prompts/", import.meta.url));
const names = ["LAB", "RADS", "PATH", "CHEMO", "SYMPTOM", "INTENT", "CAIXA"];
it("G-04 cada prompt repete contrato universal sem números de corte clínico", () => {
  for (const name of names) {
    const prompt = readFileSync(join(root, `${name}@1.0.0.md`), "utf8");
    expect(prompt).toContain("não inventar");
    expect(prompt).toContain("null quando ausente");
    expect(prompt).toContain("desidentificada");
    expect(prompt).toContain("Saída só JSON");
    expect(prompt).toContain("não escolher entre fontes");
    expect(prompt).toContain("negações");
    expect(prompt).toContain("lateralidade");
    expect(prompt).not.toMatch(/\b(?:160|1500|37,8|8,0)\b/);
    expect(prompt).not.toMatch(/(?:>=|<=|≥|≤)\s*\d/);
  }
});

// W8/GLM: nenhum microprompt do diretório inteiro (inclusive versões novas) carrega corte clínico (G-04).
it("G-04 nenhum arquivo em corpus/prompts tem número de corte ou comparação com limiar", () => {
  for (const arq of readdirSync(root).filter((f) => f.endsWith(".md")).sort()) {
    const prompt = readFileSync(join(root, arq), "utf8");
    expect(prompt, arq).not.toMatch(/\b(?:160|1500|37,8|8,0)\b/);
    expect(prompt, arq).not.toMatch(/(?:>=|<=|≥|≤)\s*\d/);
  }
});

describe("RADS@1.1.0 (W8/GLM-11 · resumo em dois níveis, caso real 01 §3)", () => {
  const prompt = readFileSync(join(root, "RADS@1.1.0.md"), "utf8");

  it("repete o contrato universal BASE §47 (G-04)", () => {
    for (const frase of ["não inventar", "null quando ausente", "desidentificada", "Saída só JSON", "não escolher entre fontes", "negações", "lateralidade"])
      expect(prompt).toContain(frase);
  });

  it("define resumo1 {sede, tamanho} e resumo2 com os 8 campos, uma palavra cada", () => {
    expect(prompt).toContain("resumo1 { sede, tamanho }");
    expect(prompt).toContain("uma palavra");
    for (const campo of ["lesao", "dimensaoRecist", "linfonodos", "osso", "pleura", "orgaosAdjacentes", "infiltracaoObstrucaoPerfuracao", "naoOncologicos"])
      expect(prompt).toContain(campo);
  });

  it("tabela de valores: texto curto | ausente | nao_descrito | null, com nao_descrito ≠ ausente", () => {
    expect(prompt).toContain('"ausente"');
    expect(prompt).toContain('"nao_descrito"');
    expect(prompt).toContain("nao_descrito ≠ ausente");
    expect(prompt).toContain("`null`");
  });

  it("regras do caso real 01: negação preservada, captação articular ≠ lesão, trecho riscado sem valor", () => {
    expect(prompt).toContain('"sem TEP" ⇒ ausente');
    expect(prompt).toContain("hiperfixação");
    expect(prompt).toContain("captação articular");
    expect(prompt).toContain("lesão óssea oncológica");
    expect(prompt).toContain("riscado: true");
    expect(prompt).toContain("sem valor");
  });
});
it("K-13 menção documental não é dose calculada; K-09 preserva correção e falante", () => {
  expect(readFileSync(join(root, "CHEMO@1.0.0.md"), "utf8")).toContain("Menção de dose ≠ dose calculada");
  expect(readFileSync(join(root, "INTENT@1.0.0.md"), "utf8")).toContain("substituiDraftId");
  expect(readFileSync(join(root, "CAIXA@1.0.0.md"), "utf8")).toContain("conteúdo inerte");
});
