import { describe, expect, it } from "vitest";
import { avaliarPortoesW10, avaliarTriagem } from "../../src/rules/triagem.js";
import { TriagemExtraW10 } from "../../src/contracts/w10/clinico-w10.js";
import { ProvenienciaLaboratorial } from "../../src/contracts/w10/closure.js";
import { ctxBase, fonteSintetica, presente, triagemBase } from "../fixtures/triagem.js";
import { salaoRuleset } from "../fixtures/rulesets.js";

const EXTRA = { pad: 80, crCentesimos: 100 };

function extraComHb(provenienciaHb: ProvenienciaLaboratorial) {
  return { ...EXTRA, provenienciaHb };
}

describe("F05 · unidade e proveniência declarada da hemoglobina", () => {
  it("confere g/dL → décimos de g/dL sem alterar o corte congelado", () => {
    const result = avaliarPortoesW10(triagemBase({ hbDgDl: presente(90) }), extraComHb({
      valorOriginal: 9,
      unidadeOriginal: "g/dL",
      fonte: fonteSintetica("hb-origem-1"),
      dataClinica: "2026-10-01",
    }), salaoRuleset);
    expect(result.corteSalao.motivos).toEqual([]);
    expect(result.corteSalao.pendentes.some((item) => item.codigo.includes("hb.origem"))).toBe(false);
    expect(result.corteSalao.bloqueiaSalvar).toBe(false);
  });

  it.each([
    ["dg/dL", 90],
    ["g/L", 90],
  ] as const)("confere a escala declarada %s contra hbDgDl", (unidadeOriginal, valorOriginal) => {
    const result = avaliarPortoesW10(triagemBase({ hbDgDl: presente(90) }), extraComHb({
      valorOriginal,
      unidadeOriginal,
      fonte: fonteSintetica(`hb-origem-${unidadeOriginal}`),
      dataClinica: "2026-10-01",
    }), salaoRuleset);
    expect(result.corteSalao.pendentes.some((item) => item.codigo.includes("hb.origem"))).toBe(false);
  });

  it("mantém o corte e sinaliza PENDENTE quando origem não concorda com hbDgDl", () => {
    const result = avaliarPortoesW10(triagemBase({ hbDgDl: presente(9) }), extraComHb({
      valorOriginal: 9,
      unidadeOriginal: "g/dL",
      fonte: fonteSintetica("hb-origem-inconsistente"),
      dataClinica: "2026-10-01",
    }), salaoRuleset);
    expect(result.corteSalao.motivos.some((item) => item.codigo === "corteSalao.hb.baixa")).toBe(true);
    expect(result.corteSalao.pendentes.some((item) => item.codigo === "pendente.corteSalao.hb.origem")).toBe(true);
    expect(result.corteSalao.destino).toBe("FILA_MEDICO");
    expect(result.corteSalao.bloqueiaSalvar).toBe(false);
  });

  it("unidade explicitamente ausente fica pendente mesmo quando o corte não dispara", () => {
    const result = avaliarPortoesW10(triagemBase({ hbDgDl: presente(12000) }), extraComHb({
      valorOriginal: 12000,
      unidadeOriginal: null,
      fonte: fonteSintetica("hb-origem-sem-unidade"),
      dataClinica: "2026-10-01",
    }), salaoRuleset);
    expect(result.corteSalao.motivos.some((item) => item.codigo === "corteSalao.hb.baixa")).toBe(false);
    expect(result.corteSalao.pendentes.some((item) => item.codigo === "pendente.corteSalao.hb.origem")).toBe(true);
    expect(result.corteSalao.destino).toBe("FILA_MEDICO");
    expect(result.corteSalao.bloqueiaSalvar).toBe(false);
  });

  it("não elege candidatos de Hb em conflito nem promove esse campo a VERDE", () => {
    const a = fonteSintetica("hb-conflito-a"), b = fonteSintetica("hb-conflito-b");
    const hbConflito = {
      valor: null, estado: "VERMELHO" as const, campo: "CONFLITO" as const,
      motivo: "fontes discordam", fontes: [a, b], revisao: "RAW" as const,
      candidatos: [{ valor: 9, fontes: [a] }, { valor: 90, fontes: [b] }],
    };
    const triagem = triagemBase({ hbDgDl: hbConflito });
    const candidatosOriginais = structuredClone(triagem.hbDgDl.candidatos);
    const result = avaliarPortoesW10(triagem, extraComHb({
      valorOriginal: 9,
      unidadeOriginal: "g/dL",
      fonte: a,
      dataClinica: "2026-10-01",
    }), salaoRuleset);
    expect(result.corteSalao.pendentes.some((item) => item.codigo === "pendente.corteSalao.hb.conflito")).toBe(true);
    expect(result.corteSalao.motivos.some((item) => item.codigo === "corteSalao.hb.baixa")).toBe(false);
    expect(result.corteSalao.destino).toBe("FILA_MEDICO");
    expect(triagem.hbDgDl.valor).toBeNull();
    expect(triagem.hbDgDl.campo).toBe("CONFLITO");
    expect(triagem.hbDgDl.candidatos).toEqual(candidatosOriginais);
    const geral = avaliarTriagem(triagem, ctxBase(), salaoRuleset, {
      valorOriginal: 9, unidadeOriginal: "g/dL", fonte: a, dataClinica: "2026-10-01",
    });
    expect(geral.pendentes.some((item) => item.codigo === "pendente.hbDgDl.conflito")).toBe(true);
  });

  it("usa o schema canônico estrito para proveniência e data clínica", () => {
    const origem = {
      valorOriginal: 9,
      unidadeOriginal: "g/dL",
      fonte: fonteSintetica("hb-schema"),
      dataClinica: "2026-10-01",
    } as const;
    expect(ProvenienciaLaboratorial.safeParse(origem).success).toBe(true);
    expect(TriagemExtraW10.safeParse({ ...EXTRA, provenienciaHb: origem }).success).toBe(true);
    expect(TriagemExtraW10.safeParse({ ...EXTRA, provenienciaHb: { ...origem, dataClinica: "2026-02-30" } }).success).toBe(false);
    expect(TriagemExtraW10.safeParse({ ...EXTRA, provenienciaHb: { ...origem, campoExtra: "não previsto" } }).success).toBe(false);
  });
});
