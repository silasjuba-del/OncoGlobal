import { describe, expect, it } from "vitest";
import { avaliarHierarquiaFonte } from "../../src/rules/w8/hierarquiaFonte.js";

describe("AG-05 · Hierarquia de fonte (lições E1–E3)", () => {
  it("E1: primária prevalece e secundária concordante corrobora com estado VERDE", () => {
    const res = avaliarHierarquiaFonte(
      { natureza: "PRIMARIA", valor: "Adenocarcinoma acinar Gleason 3+4" },
      { natureza: "SECUNDARIA", valor: "Adenocarcinoma acinar Gleason 3+4" },
    );
    expect(res).toEqual({
      valorEleito: "Adenocarcinoma acinar Gleason 3+4",
      origem: "PRIMARIA_CONFIRMADA",
      estado: "VERDE",
      motivo: "laudo primário comprobatório prevalece e fonte secundária corrobora (E1)",
      corrobora: true,
      conflito: false,
    });
  });

  it("E1: primária prevalece mas divergência com secundária gera conflito VERMELHO", () => {
    const res = avaliarHierarquiaFonte(
      { natureza: "PRIMARIA", valor: "Gleason 3+4" },
      { natureza: "SECUNDARIA", valor: "Gleason 4+4" },
    );
    expect(res.estado).toBe("VERMELHO");
    expect(res.origem).toBe("CONFLITO_ENTRE_FONTES");
    expect(res.conflito).toBe(true);
    expect(res.valorEleito).toBe("Gleason 3+4"); // laudo primário preservado
  });

  it("E2: valor exclusivo em secundária vira MENCIONADO_SEM_LAUDO e PENDENTE", () => {
    const res = avaliarHierarquiaFonte(
      null, // Sem laudo primário de laboratório
      { natureza: "SECUNDARIA", valor: 14.5, descricao: "PSA citado em receituário do urologista" },
    );
    expect(res).toEqual({
      valorEleito: 14.5,
      origem: "MENCIONADO_SEM_LAUDO",
      estado: "PENDENTE",
      motivo: "mencionado em documento secundário de outro médico, sem laudo comprobatório (E2)",
      corrobora: false,
      conflito: false,
    });
  });

  it("E3: categoria sem número (ex.: 'PIRADS' sem valor) resulta em CATEGORIA_SEM_VALOR e PENDENTE", () => {
    const res1 = avaliarHierarquiaFonte(
      null,
      { natureza: "SECUNDARIA", categoria: "PIRADS", escore: null },
    );
    expect(res1.estado).toBe("PENDENTE");
    expect(res1.origem).toBe("CATEGORIA_SEM_VALOR");
    expect(res1.motivo).toContain("proibido inferir classificação");

    const res2 = avaliarHierarquiaFonte(
      null,
      { natureza: "SECUNDARIA", valor: "PIRADS" }, // apenas a sigla
    );
    expect(res2.estado).toBe("PENDENTE");
    expect(res2.origem).toBe("CATEGORIA_SEM_VALOR");
  });

  it("documento administrativo isolado não estabelece fato clínico", () => {
    const res = avaliarHierarquiaFonte(
      null,
      null,
      { natureza: "ADMINISTRATIVA", valor: "Procedimento SIGTAP 0301010072" },
    );
    expect(res.estado).toBe("PENDENTE");
    expect(res.origem).toBe("ADMINISTRATIVO_IGNORADO");
  });
});
