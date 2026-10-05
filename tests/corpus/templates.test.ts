// GLM-07 · templates de documento: E1/origem ALERTA só na folha operacional do salão (INV-09/K-12).
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

interface Secao { id: string; titulo: string; origem: string; campos: unknown[] }
interface Template {
  id: string; versao: string; secoes: Secao[];
  proibidoConter: string[]; exibeE1: boolean; nota?: string;
}

const nomes = ["evolucao", "receita", "pedido-exame", "resumo-14", "sinais-alarme", "laudo-judicial", "folha-operacional-salao"];
const carregar = (n: string): Template =>
  JSON.parse(readFileSync(fileURLToPath(new URL(`../../corpus/templates/${n}.v1.json`, import.meta.url)), "utf8"));
const templates = nomes.map(carregar);
const folha = carregar("folha-operacional-salao");
const ORIGENS = ["FATO_CONFIRMADO", "DECISAO_MEDICA", "TEXTO_FIXO"];

describe("templates de documento", () => {
  it("os 7 templates existem com shape {id, versao, secoes, proibidoConter}", () => {
    for (const t of templates) {
      expect(t.id).toBe(nomes.find((n) => t.id === n));
      expect(t.versao).toMatch(/^\d+\.\d+\.\d+$/);
      expect(t.secoes.length).toBeGreaterThan(0);
      expect(t.proibidoConter).toContain("CORRECAO_IA");
      for (const s of t.secoes) {
        expect(s.id.length).toBeGreaterThan(0);
        expect(s.titulo.length).toBeGreaterThan(0);
        expect(Array.isArray(s.campos)).toBe(true);
      }
    }
  });

  it("nenhum template, exceto a folha operacional, aceita origem ALERTA (INV-09)", () => {
    for (const t of templates.filter((x) => x.id !== "folha-operacional-salao")) {
      expect(t.secoes.some((s) => s.origem === "ALERTA"), t.id).toBe(false);
      expect(t.proibidoConter, t.id).toContain("ALERTA");
      expect(t.exibeE1, t.id).toBe(false);
      for (const s of t.secoes) expect(ORIGENS, `${t.id}.${s.id}`).toContain(s.origem);
    }
  });

  it("folha operacional do salão é a única que exibe E1 (K-12)", () => {
    expect(folha.exibeE1).toBe(true);
    const e1 = folha.secoes.filter((s) => s.origem === "ALERTA");
    expect(e1.map((s) => s.id)).toEqual(["e1"]);
    expect(folha.proibidoConter).not.toContain("ALERTA");
  });

  it("resumo-14 tem 14 blocos (BASE §42) com títulos pendentes [VERIFICAR]", () => {
    const r = carregar("resumo-14");
    expect(r.secoes.length).toBe(14);
    expect(r.secoes.every((s) => /^bloco-\d{2}$/.test(s.id))).toBe(true);
    expect(r.secoes.every((s) => s.titulo === "[VERIFICAR]")).toBe(true);
  });
});
