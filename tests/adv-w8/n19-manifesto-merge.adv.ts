// KIMI-14 · N19 · manifesto com diff real antes do merge (PLANO §0.6 N19; K-25 linha 62; MATRIZ).
// Regra: executor altera arquivo fora do manifesto ⇒ reprovado ANTES do merge (harness, não
// procedimento manual). K-25: manifesto W0 por onda com base, dono por arquivo, hashes,
// proibições; diff real comparado antes do merge.
// ESTADO: SEM_IMPLEMENTACAO — docs/MANIFESTO-W1-F0.md é declarativo (não tem hashes por
// arquivo) e docs/w5/ferramentas/claim.ps1 é semáforo de reserva da W5 com caminho fixo do
// worktree do orquestrador (não um gate de merge reprovável em CI deste repo).
// Dono provável: tech lead (CI/scripts) — fora da faixa de qualquer executor W8.
// GIVEN/WHEN/THEN de referência (N19): dado um diff que toca arquivo fora do manifesto da
// onda, quando o harness de merge avalia, então a reprovação acontece antes do merge com o
// arquivo identificado.
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const RAIZ = new URL("../..", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");

/** Harness candidato: script de verificação de manifesto ligado ao merge/CI. */
function harnessManifesto(): string | null {
  for (const candidato of ["scripts/check-manifesto.mjs", "scripts/verificar-manifesto.mjs", "scripts/check-claims.mjs",
    "tests/w3/manifesto-merge.test.ts", "tests/manifesto.test.ts"]) {
    if (existsSync(join(RAIZ, candidato))) return candidato;
  }
  return null;
}

describe("N19 · gating de merge: diff fora do manifesto reprova antes do merge", () => {
  it("N19 · SEM_IMPLEMENTACAO: existe harness executável que reprova diff fora do manifesto", () => {
    expect(harnessManifesto(),
      "N19 não implementado: nenhum script/teste neste repo reprova, antes do merge, um diff " +
      "que toque arquivo fora do manifesto da onda; claim.ps1 é semáforo W5 (caminho fixo de " +
      "outro worktree), não gate de merge (MATRIZ: 'claim não é harness de rejeição de diff adulterado')").not.toBeNull();
  });

  it("N19 · base real: o manifesto W1 existe e declara dono por arquivo + contratos congelados", () => {
    const manifesto = readFileSync(join(RAIZ, "docs/MANIFESTO-W1-F0.md"), "utf8");
    expect(manifesto).toContain("um dono por ARQUIVO");
    expect(manifesto).toContain("src/contracts/");
    expect(manifesto).toMatch(/hash/i); // K-25 exige hashes no manifesto
  });

  it("N19 · positivo (quando implementado): diff adulterado fora da trilha ⇒ reprovado com arquivo nomeado", () => {
    const harness = harnessManifesto();
    if (!harness) return;
    // O harness existente será acionado aqui com um diff sintético fora do manifesto;
    // a expectativa concreta depende da interface escolhida pelo implementador.
    expect(harness).toBeTruthy();
  });
});
