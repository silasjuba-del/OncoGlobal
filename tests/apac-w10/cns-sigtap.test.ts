import { describe, expect, it } from "vitest";
import { calcularCnsDefinitivo, validarCns } from "../../src/apac/cns.js";
import { buscarProcedimento, montarTabelaSigtap } from "../../src/apac/sigtap.js";
import { CNS_OK, CNS_RUIM, lerCsvSigtapReferencia, proc } from "./helpers.js";

describe("W10-INT-APAC-01 · CNS", () => {
  it("aceita definitivo e provisório válidos gerados pelo algoritmo", () => {
    for (const pis of ["10000000001", "20000000002", "17654321098", "25555555555"]) {
      const r = validarCns(calcularCnsDefinitivo(pis));
      expect(r).toMatchObject({ valido: true, tipo: "DEFINITIVO", aviso: "DV_VALIDO_NAO_PROVA_IDENTIDADE" });
    }
    // provisório: constrói número com soma ponderada múltipla de 11
    let achou = "";
    for (let n = 0; n < 1000 && !achou; n++) {
      const base = `70000000000${String(n).padStart(3, "0")}`;
      for (let d = 0; d <= 9; d++) {
        const c = base + d;
        let s = 0;
        for (let i = 0; i < 15; i++) s += Number(c[i]) * (15 - i);
        if (s % 11 === 0) { achou = c; break; }
      }
    }
    expect(validarCns(achou)).toMatchObject({ valido: true, tipo: "PROVISORIO" });
  });
  it("rejeita DV errado, prefixo e formato; tolera máscara", () => {
    expect(validarCns(CNS_RUIM)).toEqual({ valido: false, motivo: "DV" });
    expect(validarCns("300000000000000")).toEqual({ valido: false, motivo: "PREFIXO" });
    expect(validarCns("1234")).toEqual({ valido: false, motivo: "FORMATO" });
    expect(validarCns("1000000000a0000")).toEqual({ valido: false, motivo: "FORMATO" });
    expect(validarCns(`${CNS_OK.slice(0, 3)} ${CNS_OK.slice(3)}`).valido).toBe(true);
  });
  it("cobre o ramo DV=10 (sufixo 001)", () => {
    // procura PIS sintético cujo dv bruto seja 10
    for (let n = 0; n < 5000; n++) {
      const c = calcularCnsDefinitivo(`1${String(n).padStart(10, "0")}`);
      if (c.slice(11, 14) === "001") { expect(validarCns(c).valido).toBe(true); return; }
    }
    throw new Error("nenhum caso DV=10 encontrado");
  });
});

describe("W10-INT-APAC-02 · SIGTAP injetado", () => {
  it("CSV de referência: 52 procedimentos, competência 2026-09, código texto com zeros", () => {
    const { tabela, linhas } = lerCsvSigtapReferencia();
    expect(linhas).toHaveLength(52);
    expect(tabela.competencia).toBe("2026-09");
    expect(Object.keys(tabela.procedimentos)).toHaveLength(52);
    expect(tabela.procedimentos["0301010072"]?.codigo).toBe("0301010072");
    expect(linhas.every((l) => l["uso_apac_automatico"]?.trim() === "NAO")).toBe(true);
  });
  it("busca por competência, sem cair em outra", () => {
    const t = { "2026-09": montarTabelaSigtap("2026-09", [proc()]) };
    expect(buscarProcedimento(t, "2026-09", "03.04.02.004-4").achou).toBe(true);
    expect(buscarProcedimento(t, "2026-10", "0304020044")).toEqual({ achou: false, motivo: "COMPETENCIA_SEM_TABELA" });
    expect(buscarProcedimento(t, "2026-09", "0000000000")).toEqual({ achou: false, motivo: "PROCEDIMENTO_INEXISTENTE" });
  });
  it("rejeita código inválido e duplicado", () => {
    expect(() => montarTabelaSigtap("2026-09", [proc({ codigo: "123" })])).toThrow();
    expect(() => montarTabelaSigtap("2026-09", [proc(), proc()])).toThrow();
    expect(() => montarTabelaSigtap("2026-13", [])).toThrow();
  });
});
