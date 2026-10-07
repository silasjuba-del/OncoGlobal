// GROK-08 · FN-16 semáforo. Catálogo inativo. Vermelho é achado e não bloqueia.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { semaforoInteracoes } from "../../src/rules/semaforoInteracoes.js";

interface Item {
  drogaA: string;
  drogaBouClasse: string;
  ativo: boolean;
  fonte: { referencia: string; trecho: string | null };
  mecanismo: null;
  severidade: null;
  gravidadeEditorial?: string;
  csvN?: number;
}

const json = JSON.parse(readFileSync("corpus/rulesets/interacoes.v1.json", "utf8")) as {
  interacoes: Item[];
};

describe("GROK-08 semaforoInteracoes", () => {
  it("o catálogo importado continua todo inativo e não acrescenta par com TKI", () => {
    expect(json.interacoes).toHaveLength(34);
    expect(json.interacoes.every((i) => i.ativo === false)).toBe(true);
    expect(json.interacoes.every((i) => i.fonte.referencia === "[VERIFICAR]")).toBe(true);
    expect(json.interacoes.every((i) => i.mecanismo === null && i.severidade === null)).toBe(true);
    const pares = json.interacoes.map((i) => `${i.drogaA}×${i.drogaBouClasse}`);
    expect(pares.filter((p) => p.includes("TKI"))).toHaveLength(2);
    expect(json.interacoes.filter((i) => i.csvN !== undefined)).toHaveLength(30);
    expect(json.interacoes.some((i) => i.gravidadeEditorial?.startsWith("Contraindicada"))).toBe(true);
  });

  it("capecitabina e varfarina no arquivo real ficam PENDENTE e não bloqueiam", () => {
    const r = semaforoInteracoes({ medicamentos: ["capecitabina", "varfarina"] }, json);
    expect(r.estado).toBe("PENDENTE");
    expect(r.estado).not.toBe("VERMELHO");
    expect(r.bloqueiaSalvar).toBe(false);
    expect(r.motivo).not.toContain("sem interação");
  });

  it("lista nula, paracetamol sem ruleset ativo e classe ausente não ficam VERDE", () => {
    expect(semaforoInteracoes({ medicamentos: null }, { interacoes: [] }).estado).toBe("PENDENTE");
    expect(semaforoInteracoes({ medicamentos: ["paracetamol"] }, { interacoes: [] }).estado).not.toBe("VERDE");
    const semClasse = semaforoInteracoes({
      medicamentos: [{ nome: "capecitabina", classe: "QT" }],
      checagemCompleta: true,
    }, {
      interacoes: [{
        drogaA: "outro",
        drogaBouClasse: "par",
        ativo: true,
        fonte: { tipo: "LITERATURA", trecho: "trecho que sustenta (K-27)" },
      }],
    });
    expect(semClasse.estado).toBe("PENDENTE");
    expect(semClasse.motivo).toContain("NÃO ONCOLÓGICAS");
  });

  it("par ativo com fonte fica VERMELHO mesmo se a coluna diz Contraindicada, e não bloqueia", () => {
    const base = json.interacoes.find((i) => i.gravidadeEditorial?.startsWith("Contraindicada"));
    if (base === undefined) throw new Error("fixture Contraindicada ausente");
    const drogaA = base.drogaA;
    const drogaBouClasse = base.drogaBouClasse;
    const ativo = {
      ...base,
      ativo: true,
      fonte: { tipo: "LITERATURA", referencia: base.fonte.referencia, trecho: "trecho que sustenta (K-27)" },
    };
    const r = semaforoInteracoes(
      { medicamentos: [drogaA, drogaBouClasse] },
      { interacoes: [ativo] },
    );
    expect(r.estado).toBe("VERMELHO");
    expect(r.bloqueiaSalvar).toBe(false);
    expect(r.motivo).toContain("não bloqueio");
    expect(r.motivo).toContain("D-W9-22d");
  });

  it("sem interação só com checagem completa e ruleset ativo, sem par casado", () => {
    const rs = {
      interacoes: [{
        drogaA: "capecitabina",
        drogaBouClasse: "varfarina",
        ativo: true,
        fonte: { tipo: "LITERATURA", trecho: "trecho que sustenta (K-27)" },
      }],
    };
    const incompleta = semaforoInteracoes({ medicamentos: ["paracetamol"] }, rs);
    expect(incompleta.estado).not.toBe("VERDE");
    const completa = semaforoInteracoes({
      medicamentos: [
        { nome: "paracetamol", classe: "NAO_ONCOLOGICA" },
        { nome: "losartana", classe: "NAO_ONCOLOGICA" },
      ],
      checagemCompleta: true,
    }, rs);
    expect(completa.estado).toBe("VERDE");
    expect(completa.motivo).toContain("sem interação");
    expect(completa.bloqueiaSalvar).toBe(false);
  });
});
