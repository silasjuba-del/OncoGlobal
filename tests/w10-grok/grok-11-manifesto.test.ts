// GROK-11 · N19. O adv n19 procura outros nomes de arquivo; este teste roda o script da faixa.
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";

const raiz = new URL("../..", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");

function rodar(args: string[]) {
  return spawnSync(process.execPath, ["scripts/verificar-manifesto.mjs", ...args], {
    cwd: raiz,
    encoding: "utf8",
  });
}

function sha(rel: string): string {
  return createHash("sha256").update(readFileSync(`${raiz}/${rel}`)).digest("hex");
}

describe("GROK-11 verificar-manifesto", () => {
  it("arquivo da faixa passa e o pin traz o hash do contrato e do ruleset", () => {
    const r = rodar(["--executor", "GROK", "--arquivos", "src/kernel/harness/ownership.ts"]);
    expect(r.status).toBe(0);
    expect(r.stdout).toContain("trilha ok");
    expect(r.stdout).toContain(`PIN src/contracts/agentes.ts ${sha("src/contracts/agentes.ts")}`);
    expect(r.stdout).toContain(`PIN corpus/rulesets/salao-triagem.v1.json ${sha("corpus/rulesets/salao-triagem.v1.json")}`);
    expect(r.stdout).toContain("BASE ausente");
  });

  it("diff fora da trilha nomeia o arquivo e sai 1", () => {
    const r = rodar(["--executor", "GROK", "--arquivos", "src/ui/App.tsx", "src/rules/suporteNaoOncologico.ts"]);
    expect(r.status).toBe(1);
    expect(r.stdout).toContain("FORA_DA_TRILHA src/ui/App.tsx");
    expect(r.stdout).not.toContain("FORA_DA_TRILHA src/rules/suporteNaoOncologico.ts");
    expect(r.stdout).not.toContain("trilha ok");
  });

  it("prescrição, recist, gates e w8 existente ficam fora", () => {
    const r = rodar([
      "--executor", "GROK",
      "--arquivos",
      "src/rules/prescricao/index.ts",
      "src/rules/morfometria/index.ts",
      "src/rules/recist/porta.ts",
      "src/kernel/harness/gates.ts",
      "src/rules/w8/interacoes.ts",
    ]);
    expect(r.status).toBe(1);
    for (const arquivo of [
      "src/rules/prescricao/index.ts",
      "src/rules/morfometria/index.ts",
      "src/rules/recist/porta.ts",
      "src/kernel/harness/gates.ts",
      "src/rules/w8/interacoes.ts",
    ]) expect(r.stdout).toContain(`FORA_DA_TRILHA ${arquivo}`);
  });

  it("arquivo novo ao lado de w8 entra só quando a base não o tem", () => {
    const semBase = rodar(["--executor", "GROK", "--arquivos", "src/rules/w8/novo-ao-lado.ts"]);
    expect(semBase.status).toBe(1);
    const comBase = rodar([
      "--executor", "GROK",
      "--base", "f0/w1-integrado",
      "--arquivos", "src/rules/w8/novo-ao-lado.ts",
    ]);
    expect(comBase.status).toBe(0);
    expect(comBase.stdout).toMatch(/^BASE f0\/w1-integrado [0-9a-f]{40}$/m);
  });

  it("o diff desta branch contra a integração cabe na trilha GROK", () => {
    const r = rodar(["--executor", "GROK", "--base", "f0/w1-integrado", "--head", "HEAD"]);
    expect(r.status, r.stdout).toBe(0);
    expect(r.stdout).toContain("trilha ok");
  });
});
