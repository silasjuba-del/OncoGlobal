import { describe, expect, it } from "vitest";
import { classificarDocumento, type TabelaRegulatoria } from "../../src/rules/prescricao/classificarDocumento.js";

// Tabela SINTÉTICA: nomes fictícios, só para testar a mecânica (a tabela real vive no corpus).
const tabela = (extra: Partial<TabelaRegulatoria> = {}): TabelaRegulatoria => ({
  versao: "sintetica-1", fonte: "tabela de teste",
  entradas: [
    { nomes: ["Alfazol"], tipo: "NOTIFICATION_A", fonte: "lista sintética A" },
    { nomes: ["Betazol", "Betazolina"], tipo: "NOTIFICATION_B", fonte: "lista sintética B" },
    { nomes: ["Gamacilina"], tipo: "ANTIMICROBIAL", fonte: "lista sintética ATM" },
    { nomes: ["Deltoína"], tipo: "THALIDOMIDE", fonte: "lista sintética T" },
    { nomes: ["Confuzol"], tipo: "SPECIAL_CONTROL", fonte: "x" },
    { nomes: ["Confuzol"], tipo: "NOTIFICATION_B2", fonte: "y" },
  ],
  ...extra,
});

describe("W10-INT-PRESC-05 · classificarDocumento", () => {
  it("classifica pela tabela injetada, sem acento/caixa e com dose junto", () => {
    expect(classificarDocumento("alfazol", tabela())).toMatchObject({ estado: "CLASSIFICADO", tipo: "NOTIFICATION_A", fonte: "lista sintética A", tabelaVersao: "sintetica-1", origem: "ENTRADA" });
    expect(classificarDocumento("BETAZOLINA 10 MG", tabela())).toMatchObject({ tipo: "NOTIFICATION_B" });
    expect(classificarDocumento("deltoina", tabela())).toMatchObject({ tipo: "THALIDOMIDE" });
    expect(classificarDocumento("Gamacilina 500 mg VO", tabela())).toMatchObject({ tipo: "ANTIMICROBIAL" });
  });
  it("prefixo parcial não casa (Alfa ≠ Alfazol; Betazolinax ≠ Betazolina)", () => {
    expect(classificarDocumento("Alfa", tabela())).toMatchObject({ estado: "PENDENTE" });
    expect(classificarDocumento("Betazolinax", tabela())).toMatchObject({ estado: "PENDENTE" });
  });
  it("fora da tabela e sem padrão ⇒ PENDENTE, nunca SIMPLE", () => {
    const r = classificarDocumento("Zetaxol", tabela());
    expect(r).toMatchObject({ estado: "PENDENTE", tipo: null, tabelaVersao: "sintetica-1" });
  });
  it("padrão só se a TABELA o declarar", () => {
    const r = classificarDocumento("Zetaxol", tabela({ padrao: "SIMPLE" }));
    expect(r).toMatchObject({ estado: "CLASSIFICADO", tipo: "SIMPLE", origem: "PADRAO_DA_TABELA" });
  });
  it("tabelas diferentes dão resultados diferentes (nada embutido no código)", () => {
    const outra: TabelaRegulatoria = { versao: "sintetica-2", fonte: "f", entradas: [{ nomes: ["Alfazol"], tipo: "RETINOID", fonte: "z" }] };
    expect(classificarDocumento("Alfazol", outra)).toMatchObject({ tipo: "RETINOID", tabelaVersao: "sintetica-2" });
    expect(classificarDocumento("Alfazol", { versao: "vazia", fonte: "f", entradas: [] })).toMatchObject({ estado: "PENDENTE" });
  });
  it("conflito entre entradas nunca some", () => {
    const r = classificarDocumento("Confuzol", tabela());
    expect(r).toMatchObject({ estado: "CONFLITO", tipo: null });
    expect(r.estado === "CONFLITO" && r.candidatos.sort()).toEqual(["NOTIFICATION_B2", "SPECIAL_CONTROL"]);
  });
  it("sem tabela, medicamento vazio ou tipo inválido ⇒ PENDENTE", () => {
    expect(classificarDocumento("Alfazol", null)).toMatchObject({ estado: "PENDENTE", tabelaVersao: null });
    expect(classificarDocumento("  ", tabela())).toMatchObject({ estado: "PENDENTE" });
    const ruim = { versao: "r", fonte: "f", entradas: [{ nomes: ["Alfazol"], tipo: "INVENTADO" as never, fonte: "x" }] };
    expect(classificarDocumento("Alfazol", ruim)).toMatchObject({ estado: "PENDENTE" });
  });
});
