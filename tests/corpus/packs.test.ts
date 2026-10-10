// GLM-06 · packs lote 1: estrutura TumorPack (R-22) sem dose numérica e sem SIGTAP real.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { validarRuleset } from "../../src/kernel/corpus/loader.js";

const packs = ["pulmao", "mama", "colorretal", "prostata"];
const vazios = ["pulmao", "mama", "colorretal"];
const carregar = (id: string): unknown =>
  JSON.parse(readFileSync(fileURLToPath(new URL(`../../corpus/packs/${id}.v1.json`, import.meta.url)), "utf8"));

/** Varredura recursiva: retorna pares [chave, valor] de todo o objeto aninhado. */
function* entradas(valor: unknown, pai = ""): Generator<[string, unknown]> {
  if (Array.isArray(valor)) { for (const v of valor) yield* entradas(v, pai); return; }
  if (typeof valor === "object" && valor !== null) {
    for (const [k, v] of Object.entries(valor as Record<string, unknown>)) {
      yield [k, v];
      yield* entradas(v, k);
    }
  }
}

describe("packs lote 1 (pulmao, mama, colorretal, prostata)", () => {
  it("os 4 packs têm header válido (G-17) e id correto", () => {
    for (const id of packs) {
      const json = carregar(id) as { header: { id: string } };
      expect(json.header.id).toBe(id);
      expect(validarRuleset(json).ok).toBe(true);
    }
  });

  it("estrutura TumorPack: pulmão/mama/colorretal vazios; próstata com kit D-W9-67", () => {
    for (const id of vazios) {
      const p = carregar(id) as Record<string, unknown>;
      for (const campo of ["cid", "labsBaseline", "labsFollowup", "biomarcadores", "roteiroAnamnese"])
        expect(p[campo], `${id}.${campo}`).toEqual([]);
      expect(p.imagem).toEqual({ baseline: [], resposta: [], seguimento: [] });
      expect(p.intervalos).toEqual({});
      expect(p.estadiamento).toEqual({ sistema: "[VERIFICAR]", edicao: "[VERIFICAR]" });
      expect((p.protocolos as { ativo: boolean }[]).every((x) => x.ativo === false)).toBe(true);
    }
    const pr = carregar("prostata") as {
      cid: unknown[];
      labsBaseline: { id: string; ativo: boolean }[];
      labsFollowup: unknown[];
      biomarcadores: unknown[];
      roteiroAnamnese: unknown[];
      imagem: { baseline: { id: string; ativo: boolean }[]; resposta: unknown[]; seguimento: unknown[] };
      intervalos: Record<string, unknown>;
      estadiamento: { sistema: string; edicao: string };
      protocolos: { ativo: boolean }[];
    };
    expect(pr.cid).toEqual([]);
    expect(pr.labsFollowup).toEqual([]);
    expect(pr.biomarcadores).toEqual([]);
    expect(pr.roteiroAnamnese).toEqual([]);
    expect(pr.intervalos).toEqual({});
    expect(pr.estadiamento).toEqual({ sistema: "[VERIFICAR]", edicao: "[VERIFICAR]" });
    expect(pr.protocolos.every((x) => x.ativo === false)).toBe(true);
    expect(pr.labsBaseline.map((l) => l.id)).toEqual(["psat", "fosfatase-alcalina", "calcio", "testosterona"]);
    expect(pr.labsBaseline.every((l) => l.ativo === true)).toBe(true);
    expect(pr.imagem.baseline.map((i) => i.id)).toEqual(["cintilografia-ossea", "rmn-pelve"]);
    expect(pr.imagem.baseline.every((i) => i.ativo === true)).toBe(true);
    expect(pr.imagem.resposta).toEqual([]);
    expect(pr.imagem.seguimento).toEqual([]);
  });

  it("nenhum campo dose numérico em nenhum pack (LLM/FN-04 calcula; corpus não carrega dose)", () => {
    for (const id of packs)
      for (const [chave, valor] of entradas(carregar(id)))
        if (/^dose/i.test(chave)) expect(typeof valor, `${id}.${chave}`).not.toBe("number");
  });

  it("nenhum código SIGTAP além de [VERIFICAR]", () => {
    for (const id of packs)
      for (const [chave, valor] of entradas(carregar(id)))
        if (chave === "sigtap") expect(valor, `${id}.${chave}`).toBe("[VERIFICAR]");
  });
});
