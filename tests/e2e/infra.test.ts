import { describe, expect, it } from "vitest";
import { resolve } from "node:path";
import { pedeTestesAdv } from "../../vite.config.js";

const root = process.cwd();

describe("INFRA-01: testes adversariais isolados da suite regular", () => {
  it("aceita os filtros explicitos de pasta e arquivo, inclusive caminhos absolutos", () => {
    for (const path of [
      "tests/adv", "tests/adv/f01.adv.test.ts", "./tests/adv",
      resolve(root, "tests/adv/f01.adv.test.ts"),
    ]) {
      expect(pedeTestesAdv(["run", path, "--no-file-parallelism"], {}, root)).toBe(true);
    }
  });

  it("nao inclui as provas vermelhas por padrao nem por filtro de outra suite", () => {
    expect(pedeTestesAdv(["run", "--no-file-parallelism"], {}, root)).toBe(false);
    expect(pedeTestesAdv(["run", "tests/e2e", "--no-file-parallelism"], {}, root)).toBe(false);
    expect(pedeTestesAdv(["run", "tests/adversarial"], {}, root)).toBe(false);
  });
});
