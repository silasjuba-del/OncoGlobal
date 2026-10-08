// W11-H26 · Biblioteca transversal de emergências. Só dados sintéticos.
// Cada caso procura o que quebra: padrão sem evidência, porcentagem, dose, PHI, prioridade decidida pela máquina.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  avaliarEmergenciasTransversais,
  type CorpusEmergencias,
} from "../../src/rules/emergenciasTransversais.js";

const ROOT = resolve(__dirname, "..", "..");
const corpus = JSON.parse(
  readFileSync(resolve(ROOT, "corpus/rulesets/emergencias-transversais.v1.json"), "utf8"),
) as CorpusEmergencias;

const ids = (r: ReturnType<typeof avaliarEmergenciasTransversais>) => r.padroes.map((p) => p.id);

describe("emergências transversais · padrão, evidências e pendências", () => {
  it("compressão medular com dois achados presentes é padrão compatível, com pendências listadas", () => {
    const r = avaliarEmergenciasTransversais(corpus, {
      achadosPresentes: ["cancer_conhecido", "dor_vertebral"],
    });
    const cm = r.padroes.find((p) => p.id === "COMPRESSAO_MEDULAR");
    expect(cm).toBeDefined();
    expect(cm?.padraoCompativel).toBe(true);
    expect(cm?.evidenciasPresentes.map((a) => a.id)).toEqual(["cancer_conhecido", "dor_vertebral"]);
    expect(cm?.evidenciasAusentes.map((a) => a.id)).toContain("deficit_motor_sensitivo");
    expect(cm?.evidenciasAusentes.map((a) => a.id)).toContain("rm_coluna");
  });

  it("um único achado de compressão medular não é padrão compatível, mas aparece como evidência", () => {
    const r = avaliarEmergenciasTransversais(corpus, { achadosPresentes: ["dor_vertebral"] });
    const cm = r.padroes.find((p) => p.id === "COMPRESSAO_MEDULAR");
    expect(cm?.padraoCompativel).toBe(false);
    expect(cm?.evidenciasPresentes).toHaveLength(1);
  });

  it("neutropenia febril: padrão exige febre e neutropenia; kit tem OUTROS por último", () => {
    const r = avaliarEmergenciasTransversais(corpus, { achadosPresentes: ["febre", "anc_baixo"] });
    const nf = r.padroes.find((p) => p.id === "NEUTROPENIA_FEBRIL");
    expect(nf?.padraoCompativel).toBe(true);
    const nomes = nf?.kit.map((c) => c.id) ?? [];
    expect(nomes).toContain("DESTINO");
    expect(nomes).toContain("LAB");
    expect(nomes.at(-1)).toBe("OUTROS");
  });

  it("hipercalcemia: achado isolado de cálcio elevado gera padrão e pendências de função renal", () => {
    const r = avaliarEmergenciasTransversais(corpus, { achadosPresentes: ["calcio_elevado"] });
    const hc = r.padroes.find((p) => p.id === "HIPERCALCEMIA");
    expect(hc?.padraoCompativel).toBe(true);
    expect(hc?.evidenciasAusentes.map((a) => a.id)).toContain("funcao_renal");
  });

  it("sem achado presente nenhuma emergência aparece", () => {
    const r = avaliarEmergenciasTransversais(corpus, { achadosPresentes: [] });
    expect(r.padroes).toEqual([]);
    expect(r.desconhecidos).toEqual([]);
  });

  it("achado de outro cluster não cria emergência; achado sem padrão não some em silêncio", () => {
    const r = avaliarEmergenciasTransversais(corpus, { achadosPresentes: ["nao_existe_no_corpus", "tosse_seca"] });
    expect(r.desconhecidos).toEqual(["nao_existe_no_corpus"]);
    expect(ids(r)).toEqual(["PNEUMONITE_GRAVE"]);
  });
});

describe("emergências transversais · prioridade é do médico, nunca da máquina", () => {
  it("toda emergência devolvida tem prioridade vazia e decidida pelo médico", () => {
    const r = avaliarEmergenciasTransversais(corpus, {
      achadosPresentes: ["febre", "anc_baixo", "cancer_conhecido", "dor_vertebral", "calcio_elevado"],
    });
    expect(r.padroes.length).toBeGreaterThan(0);
    for (const p of r.padroes) {
      expect(p.prioridade).toBeNull();
      expect(p.prioridadeDecididaPor).toBe("MEDICO");
    }
  });

  it("nenhuma saída contém porcentagem nem probabilidade", () => {
    const r = avaliarEmergenciasTransversais(corpus, {
      achadosPresentes: ["febre", "anc_baixo", "dispneia", "hipotensao", "derrame_pericardico_volumoso"],
    });
    const texto = JSON.stringify(r);
    expect(texto).not.toMatch(/%/);
    expect(texto.toLowerCase()).not.toMatch(/probabilidade|probability|confiança do modelo/);
  });

  it("rascunho permanece não consumível e marcado como RASCUNHO", () => {
    expect(corpus.status).toBe("RASCUNHO");
    expect(corpus.consumivel).toBe(false);
    const r = avaliarEmergenciasTransversais(corpus, { achadosPresentes: ["febre", "anc_baixo"] });
    expect(r.status).toBe("RASCUNHO");
  });
});

describe("emergências transversais · corpus sem dose, sem conduta fixa e sem PHI", () => {
  const texto = readFileSync(resolve(ROOT, "corpus/rulesets/emergencias-transversais.v1.json"), "utf8");

  it("corpus não tem doses (número seguido de unidade de medicamento)", () => {
    expect(texto).not.toMatch(/\d+\s*(mg|mcg|ml|mL|g|UI|unidades)\b/);
  });

  it("corpus não tem porcentagem", () => {
    expect(texto).not.toMatch(/%/);
  });

  it("corpus não cita fármacos específicos como conduta fixa", () => {
    expect(texto.toLowerCase()).not.toMatch(/cefepime|zoledron|calcitonina|denosumabe|corticoide|dexametasona|heparina/);
  });

  it("corpus não contém CPF, CNS, telefone nem e-mail", () => {
    expect(texto).not.toMatch(/\d{3}\.\d{3}\.\d{3}-\d{2}/);
    expect(texto).not.toMatch(/\b\d{15}\b/);
    expect(texto).not.toMatch(/\(?\d{2}\)?\s?9?\d{4}-\d{4}/);
    expect(texto).not.toMatch(/[\w.+-]+@[\w-]+\.[\w.]+/);
  });

  it("todo id de achado e de emergência é único dentro do corpus e o kit só usa categorias declaradas", () => {
    const categorias = new Set(corpus.kitCategorias.map((c) => c.id));
    const idsEmergencia = corpus.emergencias.map((e) => e.id);
    expect(new Set(idsEmergencia).size).toBe(idsEmergencia.length);
    for (const e of corpus.emergencias) {
      for (const k of e.kit) expect(categorias.has(k)).toBe(true);
      const idsAchado = [...e.achados, ...e.pendencias].map((a) => a.id);
      expect(new Set(idsAchado).size).toBe(idsAchado.length);
    }
  });
});

describe("emergências transversais · entrada estruturalmente inválida", () => {
  it("lista de achados que não é de textos lança TypeError", () => {
    expect(() =>
      avaliarEmergenciasTransversais(corpus, { achadosPresentes: [42 as unknown as string] }),
    ).toThrow(TypeError);
  });

  it("não muta o corpus nem a entrada", () => {
    const antes = JSON.stringify(corpus);
    const entrada = { achadosPresentes: ["febre", "anc_baixo"] };
    const congelada = Object.freeze([...entrada.achadosPresentes]);
    avaliarEmergenciasTransversais(corpus, { achadosPresentes: congelada });
    expect(JSON.stringify(corpus)).toBe(antes);
  });

  it("é determinística: mesma entrada, mesma saída", () => {
    const e = { achadosPresentes: ["febre", "anc_baixo", "hematemese", "sangramento_ativo"] };
    expect(avaliarEmergenciasTransversais(corpus, e)).toEqual(avaliarEmergenciasTransversais(corpus, e));
  });
});
