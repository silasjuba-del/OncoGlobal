// GROK-12 · caso 07. A chave sai do ruleset. Data impressa no topo não entra.
import { describe, expect, it } from "vitest";
import { deduplicarExames } from "../../src/modules/documentos/dedupe.js";
import { escolherDataClinica, gerarChaveDedupe } from "../../src/rules/index.js";

describe("GROK-12 deduplicarExames", () => {
  it("páginas idênticas da cintilografia viram um exame", () => {
    const r = deduplicarExames([
      { arquivo: "07", laboratorio: "MN", numeroExame: "MED-5001", dataEntrada: "2026-07-22", conteudo: "X" },
      { arquivo: "08", laboratorio: "MN", numeroExame: "MED-5001", dataEntrada: "2026-07-22", conteudo: "X" },
    ]);
    expect(r.unicos).toBe(1);
    expect(r.duplicatas).toEqual([{ paginas: ["07", "08"] }]);
  });

  it("reimpressão com data no topo diferente continua um exame", () => {
    const r = deduplicarExames([
      { arquivo: "10", laboratorio: "LAB", numeroExame: "LAB-9004", dataEntrada: "2026-08-06", dataImpressaNoTopo: "2026-08-09", conteudo: "IHQ" },
      { arquivo: "11", laboratorio: "LAB", numeroExame: "LAB-9004", dataEntrada: "2026-08-06", dataImpressaNoTopo: "2026-09-01", conteudo: "IHQ (reimpressão)" },
    ]);
    expect(r.unicos).toBe(1);
  });

  it("RTU e IHQ com o mesmo diagnóstico permanecem dois exames", () => {
    const r = deduplicarExames([
      { arquivo: "09", laboratorio: "LAB", numeroExame: "LAB-9003", dataEntrada: "2026-08-05", conclusao: "adenocarcinoma" },
      { arquivo: "10", laboratorio: "LAB", numeroExame: "LAB-9004", dataEntrada: "2026-08-06", conclusao: "adenocarcinoma" },
    ]);
    expect(r.unicos).toBe(2);
    expect(r.duplicatas).toEqual([]);
  });

  it("campo ausente não vira chave compartilhada", () => {
    const r = deduplicarExames([
      { arquivo: "a", laboratorio: "LAB", dataEntrada: "2026-08-06" },
      { arquivo: "b", laboratorio: "LAB", dataEntrada: "2026-08-06" },
    ]);
    expect(r.unicos).toBe(2);
  });

  it("a lista de campos injetada muda a chave", () => {
    const paginas = [
      { arquivo: "a", laboratorio: "LAB", numeroExame: "1", dataEntrada: "2026-08-01" },
      { arquivo: "b", laboratorio: "LAB", numeroExame: "2", dataEntrada: "2026-08-02" },
    ];
    expect(deduplicarExames(paginas, ["laboratorio"]).unicos).toBe(1);
    expect(deduplicarExames(paginas, ["numeroExame"]).unicos).toBe(2);
  });

  it("o barrel reexporta função do w8 sem copiar o corpo", () => {
    expect(typeof escolherDataClinica).toBe("function");
    expect(gerarChaveDedupe({
      id: "p",
      tipo: "PATOLOGIA_IHQ",
      laboratorio: "LAB",
      numeroExame: "LAB-1",
      dataEntrada: "2026-08-06",
    })).toContain("LAB-1");
  });
});
