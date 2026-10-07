// RT-06 · RECIST e morfometria (S1) — FALHAS reais e lacunas do modelo de entrada.
// 1) "Nova lesão" e "linfonodo < 10 mm de eixo curto" não existem no RecistInput: PD por nova
//    lesão é impossível de declarar e linfonodo-alvo é indistinguível (RECIST 1.1 §: nódulo
//    alvo exige eixo curto ≥ 10 mm).
// 2) Unidade (cm × mm) e corte (slice) divergentes não têm validação.
// 3) Skill de morfometria SNC v4.0 (D-W9-57): núcleo TypeScript puro equivalente não existe.
// Dono provável: src/rules/recist.ts + nova morfometria (equipe interna/Grok); contracts.
import { describe, expect, it } from "vitest";

async function probe(mods: readonly string[], nomes: readonly string[]): Promise<unknown> {
  for (const caminho of mods) {
    try {
      const mod = (await import(caminho)) as Record<string, unknown>;
      for (const nome of nomes) {
        if (typeof mod[nome] === "function") return mod[nome];
      }
    } catch {
      // módulo inexistente: continua a sonda
    }
  }
  return null;
}

const MODULOS_MORFOMETRIA = [
  "../../src/rules/morfometria.js",
  "../../src/kernel/extracao/morfometria.js",
  "../../src/kernel/morfometria.js",
] as const;

describe("RT-06 · modelo de entrada do RECIST não cobre a especificação", () => {
  it("SEM_IMPLEMENTACAO: conceito de lesão NOVA / não-alvo existe no RECIST (PD por nova lesão)", async () => {
    const fn = await probe(MODULOS_MORFOMETRIA, ["avaliarRecistComNovasLesoes"]);
    const recist = (await import("../../src/rules/recist.js")) as Record<string, unknown>;
    const campo = recist["RecistInput"];
    expect(fn ?? campo,
      "RecistInput só tem lesoesAtuais/baseline/nadir com o MESMO conjunto de códigos: uma nova " +
      "lesão (metástase) não é representável, logo 'PD por nova lesão' nunca pode ser declarada. " +
      "RT-06 exige: nova lesão ignorada = falha. Dono provável: src/rules/recist.ts + contracts.")
      .toBeTypeOf("function");
  });

  it("lesão nova no meio da série recusa como 'divergente' em vez de virar PD por nova lesão", async () => {
    const { avaliarRecist } = await import("../../src/rules/recist.js");
    const saida = avaliarRecist({
      lesoesAtuais: [{ codigo: "L1", diametroMm: 20, confirmadaPorMedico: true },
        { codigo: "NOVA", diametroMm: 25, confirmadaPorMedico: true }],
      baseline: [{ codigo: "L1", diametroMm: 20, confirmadaPorMedico: true }],
      nadir: [{ codigo: "L1", diametroMm: 20, confirmadaPorMedico: true }],
    }, { id: "recist", versao: "1.0.0", ativo: true, regraId: "R", thresholds: { prPercent: -30, pdPercent: 20, pdAbsoluteMm: 5 } });
    // A saída honesta hoje é recusa (PENDENTE); o que NÃO pode existir é SD/PR como se nada tivesse mudado.
    expect(saida.candidate_response).not.toBe("SD");
    expect(saida.achado.motivo).toMatch(/divergente|nova/iu);
  });

  it("SEM_IMPLEMENTACAO: linfonodo de eixo curto (<10 mm) distinguível como não-alvo", async () => {
    const fn = await probe(["../../src/rules/recist.js", "../../src/rules/tipos-w3.js"],
      ["avaliarLinfonodoAlvo"]);
    const tipos = (await import("../../src/rules/tipos-w3.js")) as Record<string, unknown>;
    expect(fn ?? tipos["eixoCurtoMm"],
      "LesaoRecist só tem {codigo, diametroMm, confirmadaPorMedico}: não há eixo curto nem tipo " +
      "linfonodo. Linfonodo de 8 mm pode ser contado como lesão-alvo sem recusa. Dono: src/rules + contracts.")
      .toBeTypeOf("function");
  });

  it("SEM_IMPLEMENTACAO: validação de unidade (cm × mm) e de corte (slice) por exame", async () => {
    const fn = await probe(["../../src/rules/recist.js"], ["validarUnidadeMedida"]);
    expect(fn,
      "Nenhuma função valida unidade declarada da medida (cm vs mm) nem identifica o corte/slice: " +
      "3,4 cm digitado como 34 muda a soma e a categoria sem alerta; comparar cortes diferentes " +
      "entre exames é indistinguível. RT-06 exige recusa/pendência. Dono: src/rules + extrator.")
      .toBeTypeOf("function");
  });
});

describe("RT-06 · morfometria de lesão em SNC (skill v4.0, D-W9-57)", () => {
  it("SEM_IMPLEMENTACAO: núcleo de morfometria em TypeScript puro existe no repo", async () => {
    const fn = await probe(MODULOS_MORFOMETRIA,
      ["morfometria", "medirLesao", "calcularVolume", "morfometriaCore"]);
    expect(fn,
      "D-W9-57 manda portar o núcleo v4.0 (morfometria_core.py, 36 casos) para função TypeScript " +
      "pura com os mesmos casos de teste. Nenhum módulo de morfometria existe em src/. " +
      "Dono provável: equipe interna (kernel) + curadoria da skill.")
      .toBeTypeOf("function");
  });

  it("escala por anatomia média é recusada (nunca aplicada)", async () => {
    const fn = await probe(MODULOS_MORFOMETRIA, ["medirLesao", "morfometria"]);
    if (typeof fn !== "function") return;
    const saida = await fn({ modo: "2D_CALIBRADO", escala: "ANATOMIA_MEDIA", medidasPx: [120, 90] }) as {
      recusado?: boolean; motivo?: string;
    };
    expect(saida.recusado).toBe(true);
    expect(saida.motivo).toMatch(/anatomia/iu);
  });

  it("MF ausente NÃO vira 1,0 (recusa, nunca correção automática)", async () => {
    const fn = await probe(MODULOS_MORFOMETRIA, ["medirLesao", "morfometria"]);
    if (typeof fn !== "function") return;
    const saida = await fn({ modo: "2D_CALIBRADO", magnificacaoMF: null, medidasPx: [100] }) as {
      recusado?: boolean; fator?: number;
    };
    expect(saida.recusado).toBe(true);
    expect(saida.fator).not.toBe(1);
  });

  it("régua horizontal não calibra a direção vertical (recusa na vertical)", async () => {
    const fn = await probe(MODULOS_MORFOMETRIA, ["medirLesao", "morfometria"]);
    if (typeof fn !== "function") return;
    const saida = await fn({
      modo: "2D_CALIBRADO", regua: { direcao: "HORIZONTAL", comprimentoMm: 30, comprimentoPx: 150 },
      medida: { direcao: "VERTICAL", comprimentoPx: 60 },
    }) as { recusado?: boolean; motivo?: string };
    expect(saida.recusado).toBe(true);
    expect(saida.motivo).toMatch(/vertical|isotrop/iu);
  });

  it("volume com polo truncado é recusado (trapézio só com polos observados)", async () => {
    const fn = await probe(MODULOS_MORFOMETRIA, ["calcularVolume", "medirLesao"]);
    if (typeof fn !== "function") return;
    const saida = await fn({ modo: "3D_GEOMETRICO", fatias: [{ poloSuperior: "TRUNCADO" }] }) as {
      recusado?: boolean; motivo?: string;
    };
    expect(saida.recusado).toBe(true);
    expect(saida.motivo).toMatch(/polo|trunc/iu);
  });

  it("máscara probabilística não serve para medida (recusa)", async () => {
    const fn = await probe(MODULOS_MORFOMETRIA, ["medirLesao", "morfometria"]);
    if (typeof fn !== "function") return;
    const saida = await fn({ modo: "VISUAL", entrada: "MASCARA_PROBABILISTICA" }) as { recusado?: boolean };
    expect(saida.recusado).toBe(true);
  });

  it("toda saída de morfometria termina REVIEW_REQUIRED e nunca classifica resposta (RANO)", async () => {
    const fn = await probe(MODULOS_MORFOMETRIA, ["medirLesao", "morfometria"]);
    if (typeof fn !== "function") return;
    const saida = await fn({ modo: "2D_CALIBRADO", regua: { direcao: "HORIZONTAL", comprimentoMm: 30, comprimentoPx: 150 },
      medida: { direcao: "HORIZONTAL", comprimentoPx: 150 } }) as { reviewRequired?: boolean; resposta?: string };
    expect(saida.reviewRequired).toBe(true);
    expect(saida.resposta).toBeUndefined();
  });
});
