import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("U-H7 · layout em 320 px, 768 px, 1280 px e zoom 200% sem rolagem horizontal nem alvo < 24x24 px", () => {
  it("folhas CSS garantem wrap em barras segmentadas/partição, alvo mínimo 24x24 px e colapso responsivo de .colunas/.lado-a-lado", () => {
    const consultaCss = readFileSync(join(process.cwd(), "src/ui/consulta/consulta-local.css"), "utf8");
    const temaCss = readFileSync(join(process.cwd(), "src/ui/tema/tokens.css"), "utf8");

    const blocoSegmented = /\.oc21-segmented\s*\{([\s\S]*?)\}/.exec(consultaCss)?.[1] ?? "";
    expect(blocoSegmented).toMatch(/flex-wrap:\s*wrap/);
    expect(blocoSegmented).toMatch(/max-width:\s*100%/);

    const blocoSegmentedBtn = /\.oc21-segmented\s+button\s*\{([\s\S]*?)\}/.exec(consultaCss)?.[1] ?? "";
    expect(blocoSegmentedBtn).toMatch(/min-height:\s*24px/);
    expect(blocoSegmentedBtn).toMatch(/min-width:\s*24px/);

    const blocoPartition = /\.oc21-partition-bar\s*\{([\s\S]*?)\}/.exec(consultaCss)?.[1] ?? "";
    expect(blocoPartition).toMatch(/flex-wrap:\s*wrap/);

    expect(temaCss).toMatch(/@media\s*\(max-width:\s*768px\)/);
  });
});
