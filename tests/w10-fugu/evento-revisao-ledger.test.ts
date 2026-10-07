import { afterEach, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { abrirLedger } from "../../src/kernel/ledger/db.js";
import { gravarOperacao, hashPayload, listarEventos } from "../../src/kernel/ledger/ledger.js";
import type { ReviewAction } from "../../src/kernel/extracao/tipos.js";
import { montarOperacaoDeRevisao, TIPO_EVENTO_REVISAO } from "../../src/kernel/extracao/eventoRevisao.js";

const dirs: string[] = [];
function fixture() {
  const dir = mkdtempSync(join(tmpdir(), "oncoglobal-revisao-"));
  dirs.push(dir);
  return abrirLedger(join(dir, "test.sqlite"));
}
afterEach(() => { for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true }); });

const acao: ReviewAction = {
  exceptionId: "exc:UNLINKED_PATIENT:pt10:0",
  acao: "LIGAR_PACIENTE",
  medicoId: "medico-teste",
  em: "2026-10-07T09:00:00-03:00",
  patientId: "P07",
};
const contexto = {
  operationId: "op-revisao-1", eventId: "evento-revisao-1",
  patientId: "P07", tumorLotId: "tumor-01", encounterId: "consulta-01",
};

describe("FUGU-09 · interface do ledger para a decisão de revisão", () => {
  it("o ledger real grava a operação (GRAVADA) e o evento carrega reviewDecisionId", () => {
    const db = fixture();
    const { operation, eventos, tipo } = montarOperacaoDeRevisao(acao, contexto);
    expect(tipo).toBe(TIPO_EVENTO_REVISAO);
    expect(operation.payloadHash).toBe(hashPayload(eventos));
    expect(gravarOperacao(db, operation, eventos).estado).toBe("GRAVADA");
    const gravados = listarEventos(db, "P07");
    expect(gravados).toHaveLength(1);
    expect(gravados[0]).toMatchObject({
      tipo: "ReviewDecision", eventIndex: 0, revisao: "CONFIRMADO",
      criadoPor: { tipo: "SESSAO", id: "medico-teste" },
    });
    expect((gravados[0]!.payload as { reviewDecisionId: string }).reviewDecisionId)
      .toBe("exc:UNLINKED_PATIENT:pt10:0");
    expect(gravados[0]!.payload).toMatchObject({ data: { acao: "LIGAR_PACIENTE", patientId: "P07" } });
    db.close();
  });

  it("o mesmo payload é REPLAY (idempotente), não duplica evento", () => {
    const db = fixture();
    const { operation, eventos } = montarOperacaoDeRevisao(acao, contexto);
    expect(gravarOperacao(db, operation, eventos).estado).toBe("GRAVADA");
    expect(gravarOperacao(db, operation, eventos).estado).toBe("REPLAY");
    expect(db.prepare("SELECT COUNT(*) AS n FROM clinical_event").get()?.n).toBe(1);
    db.close();
  });

  it("evento sem reviewDecisionId é NEGADO pelo ledger — por isso o builder o exige", () => {
    const db = fixture();
    const { operation, eventos } = montarOperacaoDeRevisao(acao, contexto);
    const semDecisao = eventos.map((e) => ({
      ...e, payload: { data: (e.payload as { data: unknown }).data },
    }));
    const r = gravarOperacao(db, { ...operation, payloadHash: hashPayload(semDecisao) }, semDecisao);
    expect(r).toMatchObject({ estado: "NEGADA", motivo: "REVIEW_DECISION_REQUIRED" });
    expect(listarEventos(db, "P07")).toEqual([]);
    db.close();
  });

  it("descartar sem motivo e ligar sem paciente são recusados antes de tocar o ledger", () => {
    expect(() => montarOperacaoDeRevisao({ ...acao, acao: "DESCARTAR" }, contexto)).toThrow("motivo");
    expect(() => montarOperacaoDeRevisao(
      { exceptionId: "e", acao: "LIGAR_PACIENTE", medicoId: "medico-teste", em: "2026-10-07T09:00:00-03:00" },
      contexto,
    )).toThrow("patientId");
    expect(() => montarOperacaoDeRevisao(acao, { ...contexto, encounterId: "  " })).toThrow("encounterId");
  });

  it("a autoridade vem da sessão: o evento nunca nasce de agente nem sem médico", () => {
    const { eventos } = montarOperacaoDeRevisao(acao, contexto);
    expect(eventos[0]!.criadoPor).toEqual({ tipo: "SESSAO", id: "medico-teste" });
    expect(eventos[0]!.revisao).toBe("CONFIRMADO");
    expect(() => montarOperacaoDeRevisao({ ...acao, medicoId: " " }, contexto)).toThrow("médico");
  });

  it("correção preserva o valor corrigido e o motivo do descarte fica registrado", () => {
    const corrigido = montarOperacaoDeRevisao({
      ...acao, acao: "CORRIGIR", valorCorrigido: { marker: "HER2", value: "2+" },
    }, contexto);
    expect(corrigido.eventos[0]!.payload).toMatchObject({
      data: { acao: "CORRIGIR", valorCorrigido: { marker: "HER2", value: "2+" } },
    });
    const descartado = montarOperacaoDeRevisao({ ...acao, acao: "DESCARTAR", motivo: "duplicado" }, contexto);
    expect(descartado.eventos[0]!.payload).toMatchObject({ data: { acao: "DESCARTAR", motivo: "duplicado" } });
  });
});