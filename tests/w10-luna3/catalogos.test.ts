import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { CaixaNumerada } from "../../src/contracts/w10/clinico-w10.js";
import { classificarDocumento } from "../../src/rules/prescricao/classificarDocumento.js";

const json = (path: string) => JSON.parse(readFileSync(new URL(`../../${path}`, import.meta.url), "utf8"));

describe("W10-LUNA3 corpus", () => {
  it("keeps a strict, stable glossary with separate configuration and APAC fields", () => {
    const catalog = json("corpus/glossario/caixas.v1.json");
    const sources = json("corpus/glossario/fontes.v1.json");
    expect(catalog.schemaVersion).toBe("caixas.v1");
    expect(catalog.caixas).toHaveLength(47);
    const numbers = new Set<number>();
    const keys = new Set<string>();
    for (const item of catalog.caixas) {
      expect(CaixaNumerada.safeParse(item).success).toBe(true);
      expect(numbers.has(item.numero)).toBe(false);
      expect(keys.has(item.chave)).toBe(false);
      numbers.add(item.numero);
      keys.add(item.chave);
      expect(sources.fontes.some((source: { numero: number; chave: string; origens: string[] }) => source.numero === item.numero && source.chave === item.chave && source.origens.length > 0)).toBe(true);
      if (item.numero < 100) expect(item.chave).toMatch(/^config\./);
      else expect(item.chave).toMatch(/^apac\./);
    }
    expect(catalog.caixas.filter((item: { chave: string }) => item.chave.startsWith("config."))).toHaveLength(16);
    expect(catalog.caixas.filter((item: { chave: string }) => item.chave.startsWith("apac."))).toHaveLength(31);
    expect(keys.has("config.preferencias.tema")).toBe(true);
    expect(keys.has("config.preferencias.layoutPersonalizado")).toBe(true);
    expect(keys.has("apac.finalidadeApac")).toBe(true);
    expect(keys.has("apac.procedimentosSecundarios")).toBe(true);
    expect(catalog.caixas.find((item: { chave: string }) => item.chave === "apac.procedimentosSecundarios").tipo).toBe("LISTA");
    expect(catalog.caixas.some((item: object) => "valorAtual" in item || "fonteDecisao" in item)).toBe(false);
  });

  it("keeps unverified regulatory names out of the classifier table", () => {
    const active = json("corpus/regulatorio/tabela-ativa.v1.json");
    const pending = json("corpus/regulatorio/pendencias.v1.json");
    expect(active.entradas).toEqual([]);
    expect(active).not.toHaveProperty("padrao");
    expect(classificarDocumento("medicamento desconhecido", active).estado).toBe("PENDENTE");
    expect(pending).not.toHaveProperty("entradas");
    expect(pending.consumivel).toBe(false);
    expect(pending.pendencias).toHaveLength(12);
    for (const item of pending.pendencias) {
      expect(item.status).toBe("PENDENTE_VERIFICACAO");
      expect(item.tipo).toBeNull();
      expect(item.marcador).toBe("[VERIFICAR]");
      expect(item.carregavelNoClassificador).toBe(false);
      expect(item.fontes.every((source: string) => source.startsWith("https://www.gov.br/anvisa/") || source.startsWith("https://bvsms.saude.gov.br/"))).toBe(true);
    }
  });

});
