import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";

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
it("K-13 menção documental não é dose calculada; K-09 preserva correção e falante", () => {
  expect(readFileSync(join(root, "CHEMO@1.0.0.md"), "utf8")).toContain("Menção de dose ≠ dose calculada");
  expect(readFileSync(join(root, "INTENT@1.0.0.md"), "utf8")).toContain("substituiDraftId");
  expect(readFileSync(join(root, "CAIXA@1.0.0.md"), "utf8")).toContain("conteúdo inerte");
});
