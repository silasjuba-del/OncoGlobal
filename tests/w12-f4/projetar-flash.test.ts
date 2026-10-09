// W12-F4 · projeção pura da Flash: fato não confirmado ou substituído não entra; data de referência explícita.
import { describe, expect, it } from "vitest";
import type { ClinicalEvent } from "../../src/contracts/operacao.js";
import { lerModeloFlash, projetarFlash } from "../../src/server/flash.js";

const ev = (id: string, tipo: string, data: Record<string, unknown>, over: Partial<ClinicalEvent> = {}): ClinicalEvent => ({
  eventId: id, operationId: `op-${id}`, eventIndex: 0, patientId: "Paciente Teste 42", tumorLotId: null,
  encounterId: "encontro-42", tipo, payload: { reviewDecisionId: "r", data }, fontes: [], revisao: "CONFIRMADO",
  criadoEm: "2026-10-08T12:00:00-03:00", criadoPor: { tipo: "SESSAO", id: "medico-teste" },
  supersedesEventId: null, ...over,
});

describe("W12-F4 · projetarFlash", () => {
  it("fato RAW não entra", () => {
    const r = projetarFlash([ev("a", "ImagingReport", { dataClinica: "2026-10-01", nome: "TC", fraseLaudo: "x" }, { revisao: "RAW" })],
      "2026-10-08", null, null);
    expect(r.exames).toEqual([]);
  });

  it("fato substituído não entra; o substituto entra", () => {
    const r = projetarFlash([
      ev("a", "ImagingReport", { dataClinica: "2026-10-01", nome: "TC", fraseLaudo: "antigo" }),
      ev("b", "ImagingReport", { dataClinica: "2026-10-01", nome: "TC", fraseLaudo: "novo" }, { supersedesEventId: "a" }),
    ], "2026-10-08", null, null);
    expect(r.exames.map((e) => e.fraseLaudo)).toEqual(["novo"]);
  });

  it("a data de referência é a passada: exame depois dela não entra", () => {
    const e = ev("a", "Biopsy", { dataClinica: "2026-10-05", nome: "Biópsia", fraseLaudo: "laudo" });
    expect(projetarFlash([e], "2026-10-04", null, null).exames).toEqual([]);
    expect(projetarFlash([e], "2026-10-05", null, null).exames).toHaveLength(1);
  });

  it("situação desconhecida vira SEM_REFERENCIA; nome ausente usa o tipo do evento, nunca inventa", () => {
    const r = projetarFlash([ev("a", "Biopsy", { dataClinica: "2026-10-01", fraseLaudo: "laudo", situacao: "OK" })],
      "2026-10-08", null, null);
    expect(r.exames[0]).toMatchObject({ nome: "Biopsy", situacao: "SEM_REFERENCIA" });
  });

  it("retorno: último plano vigente; valor inválido vira null", () => {
    const doc = (id: string, dias: unknown, t: string) => ev(id, "DOCUMENTO",
      { data: { tipoDocumento: "FLASH_RETORNO", retornoDias: dias }, signature: {} }, { revisao: "ASSINADO", criadoEm: t });
    expect(projetarFlash([doc("a", 30, "2026-10-01T10:00:00-03:00"), doc("b", 14, "2026-10-02T10:00:00-03:00")],
      "2026-10-08", null, null).retornoDias).toBe(14);
    expect(projetarFlash([doc("a", 30, "2026-10-01T10:00:00-03:00"), doc("b", "quinze", "2026-10-02T10:00:00-03:00")],
      "2026-10-08", null, null).retornoDias).toBeNull();
    expect(projetarFlash([], "2026-10-08", null, null).retornoDias).toBeNull();
  });

  it("modelo: só booleanos completos valem", () => {
    expect(lerModeloFlash({ laboratorio: true, imagem: false })).toEqual({ laboratorio: true, imagem: false });
    expect(lerModeloFlash({ laboratorio: true })).toBeNull();
    expect(lerModeloFlash(null)).toBeNull();
    expect(lerModeloFlash([true, false])).toBeNull();
    const sem = projetarFlash([], "2026-10-08", null, null);
    expect(sem).toMatchObject({ modeloPadraoSalvo: false, laboratorioPreMarcado: false, imagemPreMarcada: false });
  });
});
