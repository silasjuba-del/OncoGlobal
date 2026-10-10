// W11-H11 · RETORNO como objeto operacional: prazo + motivo + exames antes do retorno. Só dados sintéticos.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { calcularRetorno, type EntradaRetorno } from "../../src/rules/retorno.js";

const REF = "2026-10-08";
const BASE: EntradaRetorno = {
  prazo: { quantidade: 21, unidade: "DIAS" },
  tipo: "PROGRAMADO",
  motivo: "reavaliação clínica sintética",
  examesAntes: [],
  dataReferencia: REF,
};

describe("prazo calculado por código a partir da data de referência", () => {
  it("21 dias a partir de 2026-10-08 = 2026-10-29", () => {
    const r = calcularRetorno(BASE);
    expect(r.dataAlvo).toBe("2026-10-29");
    expect(r.estado).toBe("PRONTO");
    expect(r.agendamento).toEqual({ data: "2026-10-29", motivo: "reavaliação clínica sintética" });
  });
  it("2 semanas equivalem a 14 dias", () => {
    expect(calcularRetorno({ ...BASE, prazo: { quantidade: 2, unidade: "SEMANAS" } }).dataAlvo).toBe("2026-10-22");
  });
  it("virada de mês e de ano por dias", () => {
    expect(calcularRetorno({ ...BASE, dataReferencia: "2026-12-25", prazo: { quantidade: 10, unidade: "DIAS" } }).dataAlvo)
      .toBe("2027-01-04");
  });
});

describe("exames antes do retorno (data limite = dataAlvo − prazoAntesDias)", () => {
  it("exame 2 dias antes gera pedido com data limite 2026-10-27", () => {
    const r = calcularRetorno({
      ...BASE,
      examesAntes: [{ codigo: "EX-SINT-01", prazoAntesDias: 2 }],
    });
    expect(r.pedidos).toEqual([{ codigo: "EX-SINT-01", dataLimite: "2026-10-27" }]);
    expect(r.estado).toBe("PRONTO");
  });
  it("exame identificado por nome e prazo zero coincide com a data alvo", () => {
    const r = calcularRetorno({ ...BASE, examesAntes: [{ nome: "Hemograma sintético", prazoAntesDias: 0 }] });
    expect(r.pedidos).toEqual([{ nome: "Hemograma sintético", dataLimite: "2026-10-29" }]);
  });
  it("prazo antes que cruza mês volta corretamente (2 dias antes de 2026-11-01 = 2026-10-30)", () => {
    const r = calcularRetorno({
      ...BASE,
      prazo: { quantidade: 24, unidade: "DIAS" },
      examesAntes: [{ codigo: "EX-SINT-02", prazoAntesDias: 2 }],
    });
    expect(r.dataAlvo).toBe("2026-11-01");
    expect(r.pedidos[0]?.dataLimite).toBe("2026-10-30");
  });
  it("exame sem código nem nome vira pendência e não gera pedido", () => {
    const r = calcularRetorno({ ...BASE, examesAntes: [{ prazoAntesDias: 2 }] });
    expect(r.pedidos).toEqual([]);
    expect(r.estado).toBe("PENDENTE");
    expect(r.pendencias).toContain("exame necessário sem código ou nome");
  });
});

describe("meses com fim de mês", () => {
  it("31/01 + 1 mês = 28/02 em ano não bissexto", () => {
    const r = calcularRetorno({ ...BASE, dataReferencia: "2026-01-31", prazo: { quantidade: 1, unidade: "MESES" } });
    expect(r.dataAlvo).toBe("2026-02-28");
  });
  it("31/01 + 1 mês = 29/02 em ano bissexto", () => {
    const r = calcularRetorno({ ...BASE, dataReferencia: "2028-01-31", prazo: { quantidade: 1, unidade: "MESES" } });
    expect(r.dataAlvo).toBe("2028-02-29");
  });
  it("30/04 + 2 meses = 30/06 e 31/08 + 6 meses = 28/02 do ano seguinte", () => {
    expect(calcularRetorno({ ...BASE, dataReferencia: "2026-04-30", prazo: { quantidade: 2, unidade: "MESES" } }).dataAlvo)
      .toBe("2026-06-30");
    expect(calcularRetorno({ ...BASE, dataReferencia: "2026-08-31", prazo: { quantidade: 6, unidade: "MESES" } }).dataAlvo)
      .toBe("2027-02-28");
  });
  it("meses cruzando o ano: 2026-11-15 + 3 meses = 2027-02-15", () => {
    expect(calcularRetorno({ ...BASE, dataReferencia: "2026-11-15", prazo: { quantidade: 3, unidade: "MESES" } }).dataAlvo)
      .toBe("2027-02-15");
  });
});

describe("SEM_RETORNO", () => {
  it("não gera agenda, data alvo nem pedidos, mesmo com exames informados", () => {
    const r = calcularRetorno({
      ...BASE,
      tipo: "SEM_RETORNO",
      prazo: null,
      motivo: null,
      examesAntes: [{ codigo: "EX-SINT-03", prazoAntesDias: 2 }],
    });
    expect(r).toEqual({ estado: "PRONTO", dataAlvo: null, pedidos: [], agendamento: null, pendencias: [] });
  });
});

describe("pendências (PENDENTE, nunca agenda parcial)", () => {
  it("PROGRAMADO sem prazo é PENDENTE", () => {
    const r = calcularRetorno({ ...BASE, prazo: null });
    expect(r.estado).toBe("PENDENTE");
    expect(r.dataAlvo).toBeNull();
    expect(r.agendamento).toBeNull();
    expect(r.pendencias).toEqual(["prazo do retorno ausente"]);
  });
  it("motivo ausente é PENDENTE, inclusive vazio ou só espaços", () => {
    expect(calcularRetorno({ ...BASE, motivo: null }).pendencias).toEqual(["motivo do retorno ausente"]);
    const r = calcularRetorno({ ...BASE, motivo: "   " });
    expect(r.estado).toBe("PENDENTE");
    expect(r.agendamento).toBeNull();
    expect(r.dataAlvo).toBe("2026-10-29");
  });
  it("CONDICIONADO sem condição é PENDENTE", () => {
    const r = calcularRetorno({ ...BASE, tipo: "CONDICIONADO" });
    expect(r.estado).toBe("PENDENTE");
    expect(r.pendencias).toEqual(["condição do retorno ausente"]);
  });
  it("CONDICIONADO com condição e prazo é PRONTO", () => {
    const r = calcularRetorno({ ...BASE, tipo: "CONDICIONADO", condicao: "após TC sintética" });
    expect(r.estado).toBe("PRONTO");
    expect(r.agendamento?.data).toBe("2026-10-29");
  });
  it("pendências acumulam na ordem fixa: prazo, condição, motivo", () => {
    const r = calcularRetorno({ ...BASE, tipo: "CONDICIONADO", prazo: null, motivo: null });
    expect(r.pendencias).toEqual([
      "prazo do retorno ausente",
      "condição do retorno ausente",
      "motivo do retorno ausente",
    ]);
  });
  it("ANTECIPADO com prazo e motivo é PRONTO", () => {
    expect(calcularRetorno({ ...BASE, tipo: "ANTECIPADO", prazo: { quantidade: 7, unidade: "DIAS" } }).dataAlvo)
      .toBe("2026-10-15");
  });
});

describe("validação de entrada malformada", () => {
  it("data de referência inexistente lança erro", () => {
    expect(() => calcularRetorno({ ...BASE, dataReferencia: "2026-02-30" })).toThrow();
  });
  it("prazo negativo ou fracionário lança erro", () => {
    expect(() => calcularRetorno({ ...BASE, prazo: { quantidade: -1, unidade: "DIAS" } })).toThrow();
    expect(() => calcularRetorno({ ...BASE, prazo: { quantidade: 1.5, unidade: "SEMANAS" } })).toThrow();
  });
});

describe("determinismo e pureza", () => {
  it("mesma entrada produz mesma saída em chamadas repetidas", () => {
    const entrada: EntradaRetorno = {
      ...BASE,
      dataReferencia: "2026-01-31",
      prazo: { quantidade: 1, unidade: "MESES" },
      examesAntes: [{ codigo: "EX-SINT-04", prazoAntesDias: 3 }],
    };
    expect(calcularRetorno(entrada)).toEqual(calcularRetorno(entrada));
    expect(JSON.stringify(calcularRetorno(entrada))).toBe(JSON.stringify(calcularRetorno(entrada)));
  });
  it("o módulo não lê relógio nem cria Date (pureza verificada no código-fonte)", () => {
    const fonte = readFileSync(resolve(process.cwd(), "src/rules/retorno.ts"), "utf8");
    expect(fonte).not.toMatch(/Date\.now\(/);
    expect(fonte).not.toMatch(/new Date\(/);
    expect(fonte).not.toMatch(/performance\.now/);
  });
  it("não altera a entrada recebida", () => {
    const entrada: EntradaRetorno = { ...BASE, examesAntes: [{ codigo: "EX-SINT-05", prazoAntesDias: 1 }] };
    const copia = JSON.parse(JSON.stringify(entrada));
    calcularRetorno(entrada);
    expect(entrada).toEqual(copia);
  });
});
