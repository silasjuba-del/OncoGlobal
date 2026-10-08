// W11-H15 · Histórico de tratamento com dados SINTÉTICOS.
import { describe, expect, it } from "vitest";
import {
  projetarHistoricoTratamento,
  type FatoTratamento,
} from "../../src/kernel/projections/historicoTratamento.js";

const c1: FatoTratamento = {
  tipo: "SISTEMICO", id: "adm-c1", data: "2029-03-01", ciclo: 1,
  protocolo: "CISPLATINA+VINORELBINA", doseRelativaPct: 80, previstoEm: "2029-03-01", observacao: null,
};
const c2: FatoTratamento = {
  tipo: "SISTEMICO", id: "adm-c2", data: "2029-04-05", ciclo: 2,
  protocolo: "CISPLATINA+VINORELBINA", doseRelativaPct: null, previstoEm: "2029-03-22",
  observacao: "Atraso de 2 semanas por neutropenia febril (sintético)",
};
const c3: FatoTratamento = {
  tipo: "SISTEMICO", id: "adm-c3", data: "2029-04-26", ciclo: 3,
  protocolo: null, doseRelativaPct: null, previstoEm: "2029-04-26",
  observacao: "Perda de 4 kg em 3 semanas (sintético)",
};
const cirurgia: FatoTratamento = {
  tipo: "CIRURGIA", id: "cir-1", data: "2029-02-10", procedimento: "Lobectomia (sintética)",
  observacao: "Pós-op sem intercorrências (sintético)",
};
const rt: FatoTratamento = {
  tipo: "RT", id: "rt-1", inicio: "2029-05-06", fim: "2029-06-14", fracoes: 30, doseTotalGy: 60,
  boost: "10 Gy (sintético)", topografia: "Mama (sintética)", medicoResponsavel: "Médico Fictício",
  local: "Serviço Sintético", observacao: null,
};

describe("W11-H15 · histórico de tratamento", () => {
  it("ordena cronologicamente sistêmico, cirurgia e RT pelo início", () => {
    const linhas = projetarHistoricoTratamento([rt, c3, c1, cirurgia, c2]);
    expect(linhas.map((l) => l.origem)).toEqual(["cir-1", "adm-c1", "adm-c2", "adm-c3", "rt-1"]);
    expect(linhas.map((l) => l.tipo)).toEqual(["CIRURGIA", "SISTEMICO", "SISTEMICO", "SISTEMICO", "RT"]);
  });

  it("calcula atraso real − previsto quando ambos existem", () => {
    const linhas = projetarHistoricoTratamento([c1, c2, c3]);
    const porOrigem = Object.fromEntries(linhas.map((l) => [l.origem, l]));
    expect(porOrigem["adm-c1"]?.atrasoDias).toBe(0);
    expect(porOrigem["adm-c2"]?.atrasoDias).toBe(14);
    expect(porOrigem["adm-c3"]?.atrasoDias).toBe(0);
  });

  it("atraso fica null quando não há data prevista", () => {
    const [linha] = projetarHistoricoTratamento([{ ...c1, previstoEm: null }]);
    expect(linha?.atrasoDias).toBeNull();
  });

  it("protocolo ausente não é herdado do ciclo anterior: vazio e PENDENTE", () => {
    const linhas = projetarHistoricoTratamento([c1, c2, c3]);
    const ciclo3 = linhas.find((l) => l.origem === "adm-c3");
    expect(ciclo3?.protocoloOuTipo).toBeNull();
    expect(ciclo3?.estado).toBe("PENDENTE");
    expect(ciclo3?.pendencias).toContain("protocolo");
    expect(ciclo3?.pendencias).toContain("doseRelativaPct");
  });

  it("dose relativa só aparece quando confirmada no fato", () => {
    const linhas = projetarHistoricoTratamento([c1, c2]);
    expect(linhas.find((l) => l.origem === "adm-c1")?.doseRelativaPct).toBe(80);
    expect(linhas.find((l) => l.origem === "adm-c2")?.doseRelativaPct).toBeNull();
  });

  it("observação segue o texto do fato e fica vazia quando ausente", () => {
    const linhas = projetarHistoricoTratamento([c1, c2, c3, cirurgia]);
    expect(linhas.find((l) => l.origem === "adm-c1")?.observacao).toBe("");
    expect(linhas.find((l) => l.origem === "adm-c2")?.observacao)
      .toBe("Atraso de 2 semanas por neutropenia febril (sintético)");
    expect(linhas.find((l) => l.origem === "adm-c3")?.observacao)
      .toBe("Perda de 4 kg em 3 semanas (sintético)");
    expect(linhas.find((l) => l.origem === "cir-1")?.observacao)
      .toBe("Pós-op sem intercorrências (sintético)");
  });

  it("cirurgia sem observação fica com texto vazio e sem atraso", () => {
    const [linha] = projetarHistoricoTratamento([{ ...cirurgia, observacao: null }]);
    expect(linha?.observacao).toBe("");
    expect(linha?.atrasoDias).toBeNull();
    expect(linha?.estado).toBe("CONFIRMADO");
  });

  it("RT completa com boost preserva período, frações, dose e médico do fato", () => {
    const [linha] = projetarHistoricoTratamento([rt]);
    expect(linha?.periodo).toEqual({ inicio: "2029-05-06", fim: "2029-06-14" });
    expect(linha?.fracoes).toBe(30);
    expect(linha?.doseTotalGy).toBe(60);
    expect(linha?.boost).toBe("10 Gy (sintético)");
    expect(linha?.medicoResponsavel).toBe("Médico Fictício");
    expect(linha?.local).toBe("Serviço Sintético");
    expect(linha?.estado).toBe("CONFIRMADO");
    expect(linha?.pendencias).toEqual([]);
  });

  it("RT sem frações nem dose total fica PENDENTE nesses campos, sem completar", () => {
    const [linha] = projetarHistoricoTratamento([
      { ...rt, fracoes: null, doseTotalGy: null, boost: null, medicoResponsavel: null, local: null },
    ]);
    expect(linha?.fracoes).toBeNull();
    expect(linha?.doseTotalGy).toBeNull();
    expect(linha?.boost).toBeNull();
    expect(linha?.medicoResponsavel).toBeNull();
    expect(linha?.local).toBeNull();
    expect(linha?.estado).toBe("PENDENTE");
    expect(linha?.pendencias).toEqual(expect.arrayContaining(["fracoes", "doseTotalGy", "medicoResponsavel", "local"]));
  });

  it("nada inventado: campos ausentes continuam nulos ou vazios", () => {
    const [linha] = projetarHistoricoTratamento([
      { tipo: "SISTEMICO", id: "x", data: "2029-01-01", ciclo: null, protocolo: "  ",
        doseRelativaPct: null, previstoEm: null, observacao: "   " },
    ]);
    expect(linha?.protocoloOuTipo).toBeNull();
    expect(linha?.ciclo).toBeNull();
    expect(linha?.doseRelativaPct).toBeNull();
    expect(linha?.atrasoDias).toBeNull();
    expect(linha?.observacao).toBe("");
    expect(linha?.pendencias).toEqual(["protocolo", "ciclo", "doseRelativaPct"]);
  });

  it("empate de data é resolvido pelo id de origem", () => {
    const mesmoDia: FatoTratamento[] = [
      { ...cirurgia, id: "zeta", data: "2029-03-01" },
      { ...cirurgia, id: "alfa", data: "2029-03-01" },
      { ...cirurgia, id: "meio", data: "2029-03-01" },
    ];
    expect(projetarHistoricoTratamento(mesmoDia).map((l) => l.origem)).toEqual(["alfa", "meio", "zeta"]);
  });

  it("determinismo: ordem de entrada não altera a saída", () => {
    const fatos = [rt, c3, c1, cirurgia, c2];
    const a = projetarHistoricoTratamento(fatos);
    const b = projetarHistoricoTratamento([...fatos].reverse());
    expect(b).toEqual(a);
    expect(projetarHistoricoTratamento(fatos)).toEqual(a);
  });

  it("rejeita data fora do formato, data inexistente, fim anterior e origem duplicada", () => {
    expect(() => projetarHistoricoTratamento([{ ...c1, data: "01/03/2029" }])).toThrow(/YYYY-MM-DD/);
    expect(() => projetarHistoricoTratamento([{ ...c1, data: "2029-02-30" }])).toThrow(/não é data existente/);
    expect(() => projetarHistoricoTratamento([{ ...rt, fim: "2029-05-01" }])).toThrow(/fim anterior/);
    expect(() => projetarHistoricoTratamento([c1, { ...c2, id: c1.id }])).toThrow(/origem duplicada/);
  });
});
