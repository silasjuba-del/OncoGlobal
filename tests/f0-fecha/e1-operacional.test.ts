import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { g06E1Destaque } from "../../src/kernel/harness/gates.js";
import { renderizarKit, type EntradaKit, type KitTemplate } from "../../src/impressao/kit.js";

const template = (id: string): KitTemplate => JSON.parse(readFileSync(resolve(process.cwd(), `corpus/templates/${id}.v1.json`), "utf8"));
const base: EntradaKit = {
  cabecalho: { nomeInstituicao: "Instituição Teste", linha2: "Unidade local", cidadeUf: "Cidade/UF" },
  medico: { nome: "Médico Teste", crm: "CRM-SINTÉTICO" }, paciente: {},
};

describe("G-06 · destaque E1 na folha operacional", () => {
  it("bloqueia somente o artefato quando emergência ativa não tem destaque", () => {
    expect(g06E1Destaque({ templateId: "folha-operacional-salao", emergenciaAtiva: true,
      destaqueE1Presente: false })).toMatchObject({ gate: "G-06", decisao: "BLOQUEIA_ARTEFATO" });
    expect(() => renderizarKit(template("folha-operacional-salao"), {
      ...base, emergenciaAtiva: true, folhaOperacionalSalao: true, alertasOperacionais: [],
    })).toThrow("G-06_E1_DESTAQUE_AUSENTE");
  });

  it("passa e imprime destaque E1 inequívoco somente com emergência e conteúdo explícitos", () => {
    const entrada: EntradaKit = { ...base, emergenciaAtiva: true, folhaOperacionalSalao: true,
      alertasOperacionais: ["Ação operacional registrada para revisão imediata."] };
    expect(g06E1Destaque({ templateId: "folha-operacional-salao", emergenciaAtiva: true,
      destaqueE1Presente: true })).toMatchObject({ gate: "G-06", decisao: "PASSA" });
    const renderizado = renderizarKit(template("folha-operacional-salao"), entrada);
    expect(renderizado.html).toContain("E1 — EMERGÊNCIA ATIVA");
    expect(renderizado.html).toContain("Ação operacional registrada para revisão imediata.");
    expect(renderizarKit(template("folha-operacional-salao"), { ...entrada,
      alertasOperacionais: ["Outro conteúdo operacional registrado."] }).hash).not.toBe(renderizado.hash);
  });

  it("não exige alerta na evolução e nunca propaga E1 para esse documento", () => {
    const renderizado = renderizarKit(template("evolucao"), {
      ...base, emergenciaAtiva: true, alertasOperacionais: ["EMERGÊNCIA ATIVA — texto reservado à folha operacional."],
    });
    expect(renderizado.html).not.toContain("EMERGÊNCIA ATIVA");
    expect(renderizado.html).not.toContain("texto reservado à folha operacional");
  });
});
