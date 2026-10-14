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
  regraId?: string;
  motivoInativo?: string;
}

const json = JSON.parse(readFileSync("corpus/rulesets/interacoes.v1.json", "utf8")) as {
  interacoes: Item[];
};

describe("GROK-08 semaforoInteracoes", () => {
  it("F0-COMPLEMENTO preserva34 legados e ativa somente novos pares com suporte aplicável", () => {
    expect(json.interacoes.filter(i => !i.regraId)).toHaveLength(34);
    expect(json.interacoes.filter(i => i.regraId)).toHaveLength(11);
    expect(json.interacoes.filter((i) => i.ativo)).toHaveLength(8);
    expect(json.interacoes.some(i => i.ativo && i.drogaA === "capecitabina" && i.drogaBouClasse === "varfarina")).toBe(true);
    expect(json.interacoes.filter((i) => !i.ativo && !i.regraId).every((i) => i.fonte.referencia === "[VERIFICAR]")).toBe(true);
    expect(json.interacoes.filter(i => !i.regraId).every((i) => i.mecanismo === null && i.severidade === null)).toBe(true);
    const pares = json.interacoes.map((i) => `${i.drogaA}×${i.drogaBouClasse}`);
    expect(pares.filter((p) => p.includes("TKI"))).toHaveLength(2);
    expect(json.interacoes.filter((i) => i.csvN !== undefined)).toHaveLength(30);
    expect(json.interacoes.some((i) => i.gravidadeEditorial?.startsWith("Contraindicada"))).toBe(true);
  });

  it("capecitabina e varfarina no arquivo real ficam VERMELHO e não bloqueiam", () => {
    const r = semaforoInteracoes({ medicamentos: ["capecitabina", "varfarina"] }, json);
    expect(r.estado).toBe("VERMELHO");
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
      fonte: { tipo: "LITERATURA", referencia: "fonte sintética para teste", trecho: "trecho que sustenta (K-27)" },
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

  it("F0-COMPLEMENTO: boolean de checagem e regra alheia não provam cobertura", () => {
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
    expect(completa.estado).toBe("PENDENTE");
    expect(completa.motivo).toContain("cobertura documental");
    expect(completa.bloqueiaSalvar).toBe(false);
  });
});
