import fs from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { buildMatrix, validateMatrix } from "../../scripts/matriz-f0.mjs";

describe("R-34 matriz de rastreabilidade da F0", () => {
  it("exige uma linha para cada Q, A, D-W5, D-W8, D-W9, FN, G e T normativos", () => {
    const result = validateMatrix(process.cwd());

    expect(result.errors, result.errors.join("\n")).toEqual([]);
    expect(result.rows).toBe(result.required);
    expect(result.required).toBeGreaterThan(250);
  });

  it("mantém lacunas de F0 vermelhas e só aceita verde com evidência rastreável", () => {
    const result = validateMatrix(process.cwd());

    expect(result.green + result.red + result.na).toBe(result.rows);
    expect(result.errors, result.errors.join("\n")).toEqual([]);
  });

  it("só fecha R-34 quando não restar linha F0 vermelha ou pendente", () => {
    const result = validateMatrix(process.cwd());

    expect(result.red, "linhas F0 vermelhas/pendentes impedem declarar a matriz fechada").toBe(0);
  });
});


it("gerador preserva consumidor RADS real em D-W9-68, FN-20 e T-38", () => {
  const gerada = buildMatrix(process.cwd());
  const publicada = fs.readFileSync("docs/MATRIZ-RASTREABILIDADE-F0.md", "utf8");
  for (const id of ["D-W9-68", "FN-20", "T-38"]) {
    for (const matriz of [gerada, publicada]) {
      const linha = matriz.split(/\r?\n/).find(l => l.startsWith(`| ${id} |`));
      expect(linha).toContain("| src/rules/radsEmergencias.ts:detectarEmergencias | src/server/radsRascunho.ts |");
    }
  }
});

it("gate continua recusando RADS se o helper deixar de importar o detector", () => {
  expect(validateMatrix(process.cwd()).errors).toEqual([]);
  const ler = fs.readFileSync;
  let substituiu = false;
  const spy = vi.spyOn(fs, "readFileSync").mockImplementation(((...args: Parameters<typeof fs.readFileSync>) => {
    const lido = ler(...args);
    if (String(args[0]).replaceAll("\\", "/").endsWith("/src/server/radsRascunho.ts") && typeof lido === "string") {
      const semImport = lido.replace(/import\s+\{[^}]+\}\s+from\s+["'][^"']*radsEmergencias\.js["'];?/, "");
      substituiu = semImport !== lido;
      return semImport;
    }
    return lido;
  }) as typeof fs.readFileSync);
  try {
    const result = validateMatrix(process.cwd());
    expect(substituiu).toBe(true);
    expect(result.errors).toHaveLength(3);
    for (const id of ["D-W9-68", "FN-20", "T-38"])
      expect(result.errors).toContainEqual(expect.stringMatching(new RegExp(`^${id}: consumidor`)));
  } finally { spy.mockRestore(); }
});
