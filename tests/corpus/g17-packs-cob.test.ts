import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { carregarDiretorio } from "../../src/kernel/corpus/loader.js";

// Corpus real como base estrutural; mutações existem apenas em memória, não são fontes clínicas.
const caminho = fileURLToPath(new URL("../../corpus/packs/mama.v1.json", import.meta.url));
const pack = JSON.parse(readFileSync(caminho, "utf8")) as { header: Record<string, unknown> };

describe("G-17 · header dos packs (escopo: validação no loader)", () => {
  it("positivo: pack com header e fonte declarada passa pelo carregador", () => {
    const r = carregarDiretorio(
      () => JSON.stringify(pack),
      () => ["mama.v1.json"],
      "corpus/packs",
    );
    expect(r.rejeitados).toEqual([]);
    expect(r.validos).toEqual([
      { arquivo: "corpus/packs/mama.v1.json", id: "mama", versao: "1.0.0" },
    ]);
  });

  it("negativo: pack sem fonte e pack sem versão são rejeitados individualmente", () => {
    const { fonte: _fonte, ...semFonte } = pack.header;
    const { versao: _versao, ...semVersao } = pack.header;
    const arquivos: Record<string, unknown> = {
      "sem-fonte.v1.json": { ...pack, header: semFonte },
      "sem-versao.v1.json": { ...pack, header: semVersao },
    };
    const resultado = carregarDiretorio(
      (arquivo) => JSON.stringify(arquivos[arquivo.split("/").at(-1) ?? ""]),
      () => Object.keys(arquivos),
      "corpus/packs",
    );
    expect(resultado.validos).toEqual([]);
    expect(resultado.rejeitados.map((r) => r.arquivo)).toEqual([
      "corpus/packs/sem-fonte.v1.json",
      "corpus/packs/sem-versao.v1.json",
    ]);
    expect(resultado.rejeitados[0]?.erros.join(" ")).toContain("fonte");
    expect(resultado.rejeitados[1]?.erros.join(" ")).toContain("versao");
  });

});
