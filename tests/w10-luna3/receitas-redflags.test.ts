import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { CaixaNumerada } from "../../src/contracts/w10/clinico-w10.js";
import { classificarDocumento } from "../../src/rules/prescricao/classificarDocumento.js";

const json = (path: string) => JSON.parse(readFileSync(new URL(`../../${path}`, import.meta.url), "utf8"));

describe("W10-LUNA3 receitas e red flags", () => {
  it("preserves common recipe source data and never promotes it to reviewed", () => {
    const recipes = json("corpus/receitas/comuns.v1.json");
    expect(recipes.fichas).toHaveLength(47);
    expect(recipes.totalFichas).toBe(47);
    expect(recipes.totalReceitas).toBe(56);
    expect(recipes.consumivel).toBe(false);
    for (const ficha of recipes.fichas) {
      expect(ficha.estado).toBe("RASCUNHO");
      expect(ficha.aprovadoMedico).toBe(false);
      expect(ficha.consumivel).toBe(false);
      expect(ficha.receitasModelos.every((recipe: { estado: string; aprovadoMedico: boolean; consumivel: boolean }) => recipe.estado === "RASCUNHO" && !recipe.aprovadoMedico && !recipe.consumivel)).toBe(true);
      expect(ficha.ausenciasConformeFonte).toContain("Não enumeradas");
      expect(ficha.versaoFonte).toBe("NAO_INFORMADA");
      expect(ficha.id).toBe(ficha.fichaOriginal.id);
      expect(ficha.confiancaFonte).toBe(ficha.fichaOriginal.confianca);
    }
    expect(recipes.fichas.reduce((count: number, ficha: { receitasModelos: unknown[] }) => count + ficha.receitasModelos.length, 0)).toBe(56);
    const toxic = json("corpus/receitas/toxicidade.v1.json");
    const copied = readFileSync(new URL("../../corpus/receitas/toxicidade-fonte-original.v1.md", import.meta.url));
    const original = readFileSync(new URL("../../docs/referencias/externos/PRESCRICAO-POR-TOXICIDADE.md", import.meta.url));
    const digest = (value: Buffer) => createHash("sha256").update(value.toString("utf8").replaceAll("\r", "")).digest("hex");
    expect(digest(copied)).toBe(digest(original));
    expect(toxic.status).toBe("RASCUNHO");
    expect(toxic.consumivel).toBe(false);
    expect(toxic.aprovadoMedico).toBe(false);
    expect(toxic.ctcae.status).toBe("RASCUNHO_VERIFICAR");
    expect(toxic.ctcae.versaoExigida).toBe("6");
    expect(toxic.preservarMarcadores).toContain("[VERIFICAR]");
    expect(toxic.divergenciaAntiEmese.status).toBe("DIVERGENCIA_PRESERVADA");
    expect(toxic.divergenciaAntiEmese.alteraTextoFonte).toBe(false);
    expect(toxic.divergenciaAntiEmese.decisaoPosterior).toContain("prometazina VO");
  });

  it("covers exactly the 25 source red flags and leaves wording and actions inactive", () => {
    const library = json("corpus/redflags/sinais-alarme.v1.json");
    expect(library.sinais).toHaveLength(25);
    expect(new Set(library.sinais.map((item: { id: string }) => item.id)).size).toBe(25);
    expect(library.consumivel).toBe(false);
    expect(library.textoFinalAprovado).toBe(false);
    expect(library.iniciaComunicacao).toBe(false);
    expect(library.executaConduta).toBe(false);
    expect(library.orientacaoPadrao).toBe("PROCURAR_PS");
    for (const item of library.sinais) {
      expect(item.status).toBe("RASCUNHO_TEXTO_FINAL");
      expect(item.trechoFonte).toContain(item.sintoma);
      expect(item.localizador).toMatch(/§2/);
    }
    const fever = library.sinais[0];
    expect(fever.limite.operador).toBe(">");
    expect(fever.limite.valor).toBe(37.8);
    expect(fever.decisao).toContain("exatamente 37,8 °C não dispara");
    const diarrhea = library.sinais.find((item: { id: string }) => item.id === "redflag-10-diarreia");
    expect(diarrhea.decisaoLocal).toContain("decisão médica");
    expect(diarrhea.decisaoLocal).toContain("procurar PS");
  });
});
