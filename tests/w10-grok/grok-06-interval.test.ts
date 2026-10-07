// GROK-06 · INTERVAL_PROGRESSION no Paciente Teste 10 (D-W9-43). Nunca gera M1.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  intervalProgression,
  lerIntervalo,
  type ExameSeriado,
  type LacunasNaoSei,
} from "../../src/rules/intervalProgression.js";

const rs = lerIntervalo(JSON.parse(readFileSync("corpus/rulesets/rads-interval.v1.json", "utf8")));

const vazio = (): LacunasNaoSei => ({
  histologia: null,
  tnm: null,
  re: null,
  rp: null,
  her2: null,
  dataCirurgia: null,
  tratamentoSistemico: null,
});

const anterior = (over: Partial<ExameSeriado> = {}): ExameSeriado => ({
  data: "2028-05-14",
  metodo: "CO",
  sitio: "L5",
  lateralidade: null,
  medidaMm: null,
  descricao: "foco prévio",
  exameDirigido: null,
  ...over,
});

const atual = (over: Partial<ExameSeriado> = {}): ExameSeriado => ({
  data: "2029-08-19",
  metodo: "cintilografia óssea",
  sitio: "L5",
  lateralidade: "à esquerda",
  medidaMm: null,
  descricao: "foco de hipercaptação em L5 à esquerda, aumentado em relação à CO de 14/05/28; pode ser degenerativo/inflamatório",
  exameDirigido: "RM lombar",
  ...over,
});

describe("GROK-06 intervalProgression", () => {
  it("PT10: L5 da CO 2028 para a cintilografia 2029 é ALERTA e não gera M1", () => {
    const r = intervalProgression(anterior(), atual(), rs, vazio());
    expect(r.flag).toBe("INTERVAL_PROGRESSION");
    expect(r.estado).toBe("ALERTA");
    expect(r.bloqueiaSalvar).toBe(false);
    expect(r.geraM1).toBe(false);
    expect(r.sitio).toBe("L5");
    expect(r.lateralidade).toBe("à esquerda");
    expect(r.exameDirigido).toBe("RM lombar");
    expect(r.motivos[0]?.texto).toContain("L5");
    expect(r.motivos[0]?.texto).toContain("à esquerda");
    expect(r.motivos[0]?.texto).toContain("Não gera M1");
    expect(r.motivos[0]?.texto).toContain("D-W9-43");
    expect(r.motivos[0]?.texto).toContain("2028-05-14");
    expect(r.motivos[0]?.texto).toContain("2029-08-19");
    expect(JSON.stringify(r)).not.toContain("\"geraM1\":true");
    const codigos = r.pendencias.map((p) => p.codigo);
    expect(codigos).toContain("pendente.exame.dirigido");
    expect(r.pendencias.find((p) => p.codigo === "pendente.exame.dirigido")?.texto).toContain("RM lombar");
    for (const chave of ["histologia", "tnm", "re", "rp", "her2", "dataCirurgia", "tratamentoSistemico"]) {
      expect(codigos).toContain(`naoSei.${chave}`);
    }
    expect(r.pendencias.map((p) => p.texto).join(" ")).toContain("NÃO SEI");
  });

  it("etiologia degenerativa no laudo não apaga a flag", () => {
    const r = intervalProgression(anterior(), atual(), rs, null);
    expect(r.flag).toBe("INTERVAL_PROGRESSION");
    expect(r.pendencias.map((p) => p.codigo).some((c) => c.startsWith("naoSei."))).toBe(false);
  });

  it("sítio diferente, método diferente ou texto sem aumento não flagra", () => {
    expect(intervalProgression(anterior(), atual({ sitio: "L4", lateralidade: null, descricao: "aumentado em relação à CO" }), rs).flag).toBeNull();
    expect(intervalProgression(anterior(), atual({ metodo: "TC de tórax" }), rs).flag).toBeNull();
    expect(intervalProgression(anterior(), atual({ descricao: "captação estável em relação à CO" }), rs).flag).toBeNull();
    expect(intervalProgression(anterior(), atual({ descricao: "sem aumento da captação" }), rs).estado).toBe("SEM_ALERTA");
  });

  it("medida igual passa; medida maior flagra; medida menor não flagra", () => {
    const igual = intervalProgression(
      anterior({ medidaMm: 12, descricao: null }),
      atual({ medidaMm: 12, descricao: null, lateralidade: "à esquerda" }),
      rs,
    );
    expect(igual.flag).toBeNull();
    expect(igual.geraM1).toBe(false);
    const maior = intervalProgression(
      anterior({ medidaMm: 12, descricao: null }),
      atual({ medidaMm: 13, descricao: null }),
      rs,
    );
    expect(maior.flag).toBe("INTERVAL_PROGRESSION");
    expect(maior.geraM1).toBe(false);
    const menor = intervalProgression(
      anterior({ medidaMm: 13, descricao: null }),
      atual({ medidaMm: 12, descricao: "aumentado em relação à CO" }),
      rs,
    );
    expect(menor.flag).toBeNull();
    expect(menor.pendencias.map((p) => p.codigo)).toContain("pendente.aumento.conflito");
    expect(menor.geraM1).toBe(false);
  });

  it("medida ausente não vira zero; método ausente fica PENDENTE", () => {
    const semNumero = intervalProgression(
      anterior({ medidaMm: null, descricao: "foco prévio" }),
      atual({ medidaMm: null, descricao: "foco estável" }),
      rs,
    );
    expect(semNumero.flag).toBeNull();
    expect(semNumero.geraM1).toBe(false);
    const semMetodo = intervalProgression(anterior({ metodo: null }), atual(), rs);
    expect(semMetodo.flag).toBeNull();
    expect(semMetodo.estado).toBe("PENDENTE");
    expect(semMetodo.pendencias.map((p) => p.codigo)).toContain("pendente.exame.metodo");
  });

  it("lateralidade divergente não some e não vira M1", () => {
    const r = intervalProgression(
      anterior({ lateralidade: "à direita" }),
      atual({ lateralidade: "à esquerda" }),
      rs,
    );
    expect(r.flag).toBeNull();
    expect(r.geraM1).toBe(false);
    expect(r.estado).toBe("PENDENTE");
    expect(r.pendencias.map((p) => p.codigo)).toContain("pendente.lateralidade");
    expect(r.pendencias.find((p) => p.codigo === "pendente.lateralidade")?.texto).toContain("D-W9-05");
  });

  it("NÃO SEI preenchido sai da lista; histologia ausente permanece", () => {
    const lacunas = vazio();
    const r = intervalProgression(anterior(), atual(), rs, { ...lacunas, histologia: "carcinoma ductal" });
    expect(r.pendencias.map((p) => p.codigo)).not.toContain("naoSei.histologia");
    expect(r.pendencias.map((p) => p.codigo)).toContain("naoSei.tnm");
  });
});
