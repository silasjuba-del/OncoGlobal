// W11-H27 · enquadramento regulatório versionado: unidade única, nova versão com supersedes, histórico preservado.
import { describe, expect, it } from "vitest";
import {
  enquadramentoVigente,
  historicoEnquadramento,
  iniciarEnquadramento,
  registrarEnquadramento,
  type EnquadramentoRegulatorio,
} from "../../src/apac/enquadramento.js";

const BASE: EnquadramentoRegulatorio = {
  cid: "C61",
  diagnostico: "Adenocarcinoma de próstata (sintético)",
  estadio: "cT2 cN0 cM0",
  biomarcador: null,
  sigtap: "0304010057",
  finalidade: "Curativa",
  linha: 1,
  prioridade: "ELETIVO",
  competencia: "2026-10",
  proveniencia: "consulta-sintetica-01",
};

const com = (patch: Partial<EnquadramentoRegulatorio>): EnquadramentoRegulatorio => ({ ...BASE, ...patch });

describe("enquadramento regulatório versionado (H27)", () => {
  it("primeira versão nasce com supersedes nulo", () => {
    const h = iniciarEnquadramento(BASE);
    expect(h).toHaveLength(1);
    expect(h[0]).toEqual({ versao: 1, supersedes: null, enquadramento: BASE });
  });

  it("registrar o mesmo enquadramento não cria versão", () => {
    const h = iniciarEnquadramento(BASE);
    const r = registrarEnquadramento(h, com({}));
    expect(r.criouNovaVersao).toBe(false);
    expect(r.historico).toHaveLength(1);
  });

  it("mudança de estágio cria nova versão apontando para a anterior, sem apagar", () => {
    const h1 = iniciarEnquadramento(BASE);
    const r = registrarEnquadramento(h1, com({ estadio: "cT3 cN1 cM0" }));
    expect(r.criouNovaVersao).toBe(true);
    expect(r.historico).toHaveLength(2);
    expect(r.historico[0]).toEqual({ versao: 1, supersedes: null, enquadramento: BASE });
    expect(r.historico[1]).toMatchObject({ versao: 2, supersedes: 1, enquadramento: { estadio: "cT3 cN1 cM0" } });
  });

  it("mudança de linha e de intenção (finalidade) geram novas versões em sequência", () => {
    let h = iniciarEnquadramento(BASE);
    h = registrarEnquadramento(h, com({ linha: 2 })).historico;
    h = registrarEnquadramento(h, com({ linha: 2, finalidade: "Paliativa" })).historico;
    expect(h.map((v) => v.versao)).toEqual([1, 2, 3]);
    expect(h.map((v) => v.supersedes)).toEqual([null, 1, 2]);
    expect(enquadramentoVigente(h)?.enquadramento).toMatchObject({ linha: 2, finalidade: "Paliativa" });
  });

  it("histórico de entrada não é mutado pelo registro", () => {
    const h1 = iniciarEnquadramento(BASE);
    const antes = JSON.stringify(h1);
    registrarEnquadramento(h1, com({ estadio: "cT4" }));
    expect(JSON.stringify(h1)).toBe(antes);
  });

  it("texto informado é preservado literalmente (nenhuma tradução de vocabulário)", () => {
    const h = iniciarEnquadramento(com({ finalidade: "  Intenção Curativa Sintética  ", biomarcador: "BRCA2 (sintético)" }));
    expect(h[0]!.enquadramento.finalidade).toBe("  Intenção Curativa Sintética  ");
    expect(h[0]!.enquadramento.biomarcador).toBe("BRCA2 (sintético)");
  });

  it("campos ausentes ficam null (PENDENTE), não viram valor padrão", () => {
    const h = iniciarEnquadramento(com({ estadio: null, sigtap: null, prioridade: null, competencia: null, linha: null }));
    expect(h[0]!.enquadramento).toMatchObject({ estadio: null, sigtap: null, prioridade: null, competencia: null, linha: null });
  });

  it("SIGTAP com máscara é normalizado para 10 dígitos", () => {
    const h = iniciarEnquadramento(com({ sigtap: "03.04.01.005-7" }));
    expect(h[0]!.enquadramento.sigtap).toBe("0304010057");
  });

  it("rejeita entradas inválidas", () => {
    expect(() => iniciarEnquadramento(com({ cid: "C6" }))).toThrow("CID_INVALIDO");
    expect(() => iniciarEnquadramento(com({ sigtap: "123" }))).toThrow("SIGTAP_INVALIDO");
    expect(() => iniciarEnquadramento(com({ competencia: "2026-13" }))).toThrow("COMPETENCIA_INVALIDA");
    expect(() => iniciarEnquadramento(com({ prioridade: "PRIORITÁRIO" as never }))).toThrow("PRIORIDADE_INVALIDA");
    expect(() => iniciarEnquadramento(com({ linha: 0 }))).toThrow("LINHA_INVALIDA");
    expect(() => iniciarEnquadramento(com({ diagnostico: "   " }))).toThrow("DIAGNOSTICO_VAZIO");
    expect(() => iniciarEnquadramento(com({ proveniencia: "" }))).toThrow("PROVENIENCIA_VAZIA");
  });

  it("historicoEnquadramento devolve cópia independente, na ordem cronológica", () => {
    const h = registrarEnquadramento(iniciarEnquadramento(BASE), com({ estadio: "cT3" })).historico;
    const copia = historicoEnquadramento(h);
    copia[0]!.enquadramento.estadio = "alterado";
    expect(h[0]!.enquadramento.estadio).toBe("cT2 cN0 cM0");
    expect(copia.map((v) => v.versao)).toEqual([1, 2]);
  });

  it("enquadramentoVigente em histórico vazio é null", () => {
    expect(enquadramentoVigente([])).toBeNull();
  });
});
