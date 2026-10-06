import { describe, expect, it } from "vitest";
import { escolherDataClinica, idadeNaData } from "../../src/rules/w8/dataClinica.js";

describe("AG-03 · Data clínica e idade derivada (lições T1–T2)", () => {
  it("T1: seleciona dataClinica quando presente e válida", () => {
    const res = escolherDataClinica({
      dataClinica: "2026-03-10",
      dataEmissao: "2026-03-15",
      dataAssinaturaDigital: "2026-03-16",
      dataExtracaoSistema: "2026-05-01",
    });
    expect(res).toEqual({
      data: "2026-03-10",
      estado: "VERDE",
      motivo: "data clínica de coleta/realização identificada",
    });
  });

  it("T1: retorna PENDENTE se dataClinica estiver ausente, mesmo com emissão/extração/assinatura", () => {
    const res = escolherDataClinica({
      dataClinica: null,
      dataEmissao: "2026-03-15",
      dataAssinaturaDigital: "2026-03-16",
      dataExtracaoSistema: "2026-05-01",
    });
    expect(res.estado).toBe("PENDENTE");
    expect(res.data).toBeNull();
    expect(res.motivo).toContain("não substituem data clínica (T1)");
  });

  it("T1: formato inválido resulta em PENDENTE", () => {
    const res = escolherDataClinica({
      dataClinica: "10/03/2026",
    });
    expect(res.estado).toBe("PENDENTE");
    expect(res.data).toBeNull();
    expect(res.motivo).toContain("inválida");
  });

  it("T2: calcula idade derivada exata na data de referência", () => {
    // Aniversário já passou na data de referência
    const res = idadeNaData("1960-05-10", "2026-06-01");
    expect(res).toEqual({
      idadeAnos: 66,
      estado: "VERDE",
      motivo: "idade calculada estritamente por derivação cronológica na data de referência (T2)",
    });

    // Aniversário ainda não passou no ano de referência
    const resAntes = idadeNaData("1960-05-10", "2026-04-01");
    expect(resAntes.idadeAnos).toBe(65);
    expect(resAntes.estado).toBe("VERDE");
  });

  it("T2: respeita offset injetado sem invocar Date.now()", () => {
    // 1960-05-10 até 2026-05-09 (65 anos); + 2 dias de offset vira 2026-05-11 (66 anos)
    const resOffset = idadeNaData("1960-05-10", "2026-05-09", 2);
    expect(resOffset.idadeAnos).toBe(66);
  });

  it("T2: retorna PENDENTE se data de nascimento for posterior à data de referência ou ausente", () => {
    const resFuturo = idadeNaData("2026-05-10", "2025-05-10");
    expect(resFuturo.estado).toBe("PENDENTE");
    expect(resFuturo.idadeAnos).toBeNull();

    const resAusente = idadeNaData(null, "2026-05-10");
    expect(resAusente.estado).toBe("PENDENTE");
    expect(resAusente.idadeAnos).toBeNull();
  });
});
