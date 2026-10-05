// GLM-01 · loader de corpus: positivo (rulesets reais) + negativo (G-17/K-27).
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { carregarDiretorio, validarRuleset } from "../../src/kernel/corpus/loader.js";

const dirCorpus = fileURLToPath(new URL("../../corpus/rulesets/", import.meta.url));
const ler = (p: string) => readFileSync(p, "utf8");

describe("validarRuleset (G-17)", () => {
  it("os 4 rulesets atuais do corpus são aceitos", () => {
    const nomes = readdirSync(dirCorpus).filter((n) => n.endsWith(".json"));
    expect(nomes.length).toBeGreaterThanOrEqual(4);
    const ids = nomes.map((n) => {
      const json: unknown = JSON.parse(ler(dirCorpus + n));
      return validarRuleset(json);
    });
    for (const r of ids) expect(r.ok).toBe(true);
    const carregados = carregarDiretorio(ler, () => readdirSync(dirCorpus), dirCorpus);
    expect(carregados.validos.map((v) => v.id).sort()).toEqual(["apac", "dose", "prazos", "salao-triagem"]);
    expect(carregados.rejeitados).toEqual([]);
  });

  it("ruleset sem header é rejeitado", () => {
    expect(validarRuleset({ cortes: {} })).toMatchObject({ ok: false });
    expect(validarRuleset(null)).toMatchObject({ ok: false });
  });

  it("header sem fonte é rejeitado", () => {
    const semFonte = { id: "x", versao: "1.0.0", vigenteDesde: "2026-10-05", curador: "Dr. Silas Negrão", aprovadoEm: "2026-10-05" };
    const r = validarRuleset({ header: semFonte });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.erros.join(" ")).toContain("fonte");
  });

  it("fonte externa (DIRETRIZ) sem trecho é rejeitada; com trecho é aceita (K-27)", () => {
    const base = { id: "x", versao: "1.0.0", vigenteDesde: "2026-10-05", curador: "Dr. Silas Negrão", aprovadoEm: "2026-10-05" };
    const semTrecho = { ...base, fonte: { tipo: "DIRETRIZ", referencia: "NCCN 2026", trecho: null, edicao: null } };
    const comTrecho = { ...base, fonte: { tipo: "DIRETRIZ", referencia: "NCCN 2026", trecho: "trecho que sustenta a regra", edicao: "v2.2026" } };
    expect(validarRuleset({ header: semTrecho }).ok).toBe(false);
    expect(validarRuleset({ header: comTrecho }).ok).toBe(true);
  });

  it("versão fora do semver é rejeitada", () => {
    const base = { vigenteDesde: "2026-10-05", curador: "Dr. Silas Negrão", aprovadoEm: "2026-10-05", fonte: { tipo: "DECISAO_MEDICA", referencia: "Q01", trecho: null, edicao: null } };
    expect(validarRuleset({ header: { ...base, id: "x", versao: "1.0" } }).ok).toBe(false);
    expect(validarRuleset({ header: { ...base, id: "x", versao: "1.0.0" } }).ok).toBe(true);
  });
});

describe("carregarDiretorio (I/O injetado)", () => {
  const headerOk = () => ({
    id: "demo", versao: "1.0.0", vigenteDesde: "2026-10-05",
    fonte: { tipo: "DECISAO_MEDICA", referencia: "teste", trecho: null, edicao: null },
    curador: "Dr. Silas Negrão", aprovadoEm: "2026-10-05",
  });

  it("separa válidos de rejeitados (JSON inválido, sem header, sem fonte) sem tocar o disco", () => {
    const arquivos: Record<string, string> = {
      "a.v1.json": JSON.stringify({ header: headerOk() }),
      "b-quebrado.json": "{ não é json",
      "c-sem-header.json": JSON.stringify({ dados: 1 }),
      "d-sem-fonte.json": JSON.stringify({ header: { id: "d", versao: "1.0.0", vigenteDesde: "2026-10-05", curador: "x", aprovadoEm: "2026-10-05" } }),
      "e.txt": "ignorado",
    };
    const r = carregarDiretorio(
      (p) => {
        const conteudo = arquivos[p.split("/").pop() as string];
        if (conteudo === undefined) throw new Error("arquivo não mockado");
        return conteudo;
      },
      () => Object.keys(arquivos),
      "corpus/fake",
    );
    expect(r.validos).toEqual([{ arquivo: "corpus/fake/a.v1.json", id: "demo", versao: "1.0.0" }]);
    expect(r.rejeitados.map((x) => x.arquivo.split("/").pop()).sort()).toEqual(["b-quebrado.json", "c-sem-header.json", "d-sem-fonte.json"]);
  });

  it("erro de leitura vira rejeição, não exceção", () => {
    const r = carregarDiretorio(
      () => { throw new Error("disk offline"); },
      () => ["x.json"],
      "corpus/fake",
    );
    expect(r.rejeitados.length).toBe(1);
    expect(r.rejeitados[0]?.erros[0]).toContain("disk offline");
  });
});
