// KIMI-14 · K-26 + N17 · biblioteca de fichas aprovadas (PLANO Parte 0 K-26; N17 §0.6; MATRIZ).
// Regra (K-26): busca semântica só DESCOBRE candidatos; a receita carrega UMA ficha aprovada
// INTEIRA (templateId+version+hash), nunca dose remontada de trechos. N17: duas versões de
// ficha ⇒ carrega uma inteira, sem mistura.
// ESTADO: SEM_IMPLEMENTACAO — não existe biblioteca de fichas aprovadas em src/; render.ts
// renderiza qualquer TemplateDocumento genérico (receita.v1.json é esqueleto sem conteúdo
// clínico). MATRIZ: "templates/renders genéricos não provam ficha receita inteira sem mistura".
// Dono provável: modules/documentos (DOMINIO) + corpus/templates (GLM cura conteúdo; a W5
// proíbe inventar conteúdo — a biblioteca depende da curadoria do Dr. Silas, pendência 0.8-5).
import { describe, expect, it } from "vitest";

interface FichaLike { templateId?: string; versao?: string; hash?: string }

async function biblioteca(): Promise<Record<string, unknown> | null> {
  // Candidatos plausíveis: um módulo de biblioteca de fichas aprovadas.
  for (const caminho of ["../../src/modules/documentos/render.js", "../../src/modules/documentos/biblioteca.js"]) {
    try {
      const mod = (await import(caminho)) as Record<string, unknown>;
      const fn = mod["carregarFichaAprovada"] ?? mod["bibliotecaFichas"] ?? mod["resolverFicha"];
      if (typeof fn === "function") return mod;
    } catch { /* módulo ausente */ }
  }
  return null;
}

describe("K-26 / N17 · biblioteca de fichas de prescrição aprovadas", () => {
  it("K-26 · SEM_IMPLEMENTACAO: biblioteca de fichas aprovadas (templateId+version+hash) existe", async () => {
    expect(await biblioteca(),
      "K-26 não implementado: não há biblioteca de ficha aprovada inteira nem função que " +
      "carregue ficha por (templateId, version, hash); render.ts aceita qualquer template genérico").not.toBeNull();
  });

  it("K-26 · positivo: duas versões da ficha ⇒ carrega UMA inteira, identificada por templateId+version+hash", async () => {
    const bib = await biblioteca();
    if (!bib) return;
    const carregar = bib["carregarFichaAprovada"] as (ref: unknown) => FichaLike;
    const ficha = carregar({ templateId: "ficha-teste", version: "2.0.0",
      hash: "sha256:esperado" });
    expect(ficha.templateId).toBe("ficha-teste");
    expect(ficha.versao).toBe("2.0.0");
    expect(ficha.hash).toBe("sha256:esperado");
  });

  it("K-26 · negativo: dose remontada de trechos (fora de ficha inteira) é recusada", async () => {
    const bib = await biblioteca();
    if (!bib) return;
    const montar = bib["carregarFichaAprovada"] as (ref: unknown) => unknown;
    expect(() => montar({ trechos: ["dose 500mg", "d1-d8"], semFicha: true })).toThrow();
  });

  it("N17 · negativo: versão pedida inexistente ⇒ erro tipado, nunca mistura versões", async () => {
    const bib = await biblioteca();
    if (!bib) return;
    const carregar = bib["carregarFichaAprovada"] as (ref: unknown) => unknown;
    expect(() => carregar({ templateId: "ficha-teste", version: "9.9.9", hash: "x" })).toThrow();
  });
});
