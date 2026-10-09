import { describe, expect, it } from "vitest";
import { validateMatrix } from "../../scripts/matriz-f0.mjs";

describe("R-34 matriz de rastreabilidade da F0", () => {
  it("exige uma linha para cada Q, A, D-W5, D-W8, D-W9, FN, G e T normativos", () => {
    const result = validateMatrix(process.cwd());

    expect(result.errors, result.errors.join("\n")).toEqual([]);
    expect(result.rows).toBe(result.required);
    expect(result.required).toBeGreaterThan(250);
  });

  it("mantém lacunas de F0 vermelhas e só aceita verde com evidência rastreável", () => {
    const result = validateMatrix(process.cwd());

    expect(result.red).toBeGreaterThan(0);
    expect(result.green + result.red + result.na).toBe(result.rows);
    expect(result.errors, result.errors.join("\n")).toEqual([]);
  });

  it("só fecha R-34 quando não restar linha F0 vermelha ou pendente", () => {
    const result = validateMatrix(process.cwd());

    expect(result.red, "linhas F0 vermelhas/pendentes impedem declarar a matriz fechada").toBe(0);
  });
});
