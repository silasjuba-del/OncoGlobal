import { describe, expect, it } from "vitest";
import type { ClinicalFact, ReviewAction, ReviewException } from "../../src/kernel/extracao/tipos.js";
import {
  caixaVazia, excecaoDeFarmacoIncerto, excecaoDeNumeroFalado, excecoesDeVinculo,
  montarCaixaRevisao, paraEventoDeRevisao,
} from "../../src/kernel/extracao/caixaRevisao.js";

function fato(over: Partial<ClinicalFact>): ClinicalFact {
  return {
    id: "fato-1", segmentId: "seg-1", patientCandidateId: null, value: null, domain: "lab",
    sourceType: "plaud", evidence: "EXPLICIT", sourceId: "fonte-1", rawEvidence: "linha sintética",
    confidence: 1, requiresConfirmation: false, ...over,
  };
}

const acaoConfirmar: ReviewAction = {
  exceptionId: "exc:UNLINKED_PATIENT:seg-1",
  acao: "CONFIRMAR", medicoId: "medico-teste", em: "2026-10-07T09:00:00-03:00",
};

describe("FUGU-09 · caixa de revisão", () => {
  it("monta itens determinísticos e o resumo no formato da spec §10", () => {
    const comConfirmacao = fato({ id: "fato-confirmar", requiresConfirmation: true });
    const semPendencia = fato({ id: "fato-ok", domain: "symptom", sourceType: "medical_note", value: "dor" });
    const conflito: ReviewException = {
      id: "exc:CONFLICT:seg-1", kind: "CONFLICT", segmentId: "seg-1",
      factIds: [], reason: "M0 × metástase", sourceIds: ["fonte-1"],
    };
    const caixa = montarCaixaRevisao({
      fatos: [comConfirmacao, semPendencia],
      conflitos: [conflito],
      vinculos: excecoesDeVinculo({ id: "seg-1", sourceId: "fonte-1", boundaryReviewRequired: true }),
      faltantes: [], progressoes: [],
    });
    expect(caixa.itens.map((i) => i.kind)).toEqual(["CONFLICT", "REVISAR_FRONTEIRA", "UNLINKED_PATIENT"]);
    expect(caixa.resumo.reconciliadosAutomaticamente).toBe(1);
    expect(caixa.resumo.precisamConfirmacao).toBe(4);
    expect(caixa.resumo.texto).toBe("✓ 1 fatos reconciliados automaticamente · ⚠ 4 precisam confirmação");
    expect(caixa.resumo.lista.length).toBeGreaterThan(0);
    expect(caixaVazia(caixa)).toBe(false);
  });

  it("caixa sem itens e sem confirmação pendente é vazia", () => {
    const caixa = montarCaixaRevisao({
      fatos: [fato({ domain: "symptom", sourceType: "medical_note", value: "dor" })],
      conflitos: [], vinculos: [], faltantes: [], progressoes: [],
    });
    expect(caixaVazia(caixa)).toBe(true);
    expect(caixa.resumo.texto).toBe("✓ 1 fatos reconciliados automaticamente · ⚠ 0 precisam confirmação");
  });

  it("vínculo: fronteira duvidosa pede revisão e todo segmento entra na caixa (D-W9-34a)", () => {
    const comFronteira = excecoesDeVinculo({ id: "seg-1", sourceId: "fonte-1", boundaryReviewRequired: true });
    expect(comFronteira.map((e) => e.kind)).toEqual(["REVISAR_FRONTEIRA", "UNLINKED_PATIENT"]);
    const semFronteira = excecoesDeVinculo({ id: "seg-2", sourceId: "fonte-2", boundaryReviewRequired: false });
    expect(semFronteira.map((e) => e.kind)).toEqual(["UNLINKED_PATIENT"]);
  });

  it("número falado e fármaco incerto geram itens próprios com a origem", () => {
    const falado = excecaoDeNumeroFalado(fato({ id: "n1", requiresConfirmation: true }));
    expect(falado).toMatchObject({ kind: "SPOKEN_NUMBER", factIds: ["n1"], sourceIds: ["fonte-1"] });
    const incerto = excecaoDeFarmacoIncerto(fato({
      id: "d1", domain: "drug", evidence: "INFERRED", regra: "FARMACO-FONETICO",
      value: { raw: "carboplatna", normalizado: "CARBOPLATINA" },
    }));
    expect(incerto.kind).toBe("UNCERTAIN_DRUG");
    expect(incerto.reason).toContain("carboplatna");
  });
});

describe("FUGU-09 · ação do médico vira evento do ledger", () => {
  it("CONFIRMAR produz evento com reviewDecisionId (exigido pelo ledger)", () => {
    const evento = paraEventoDeRevisao(acaoConfirmar, "decisao-1");
    expect(evento.tipo).toBe("ReviewDecision");
    expect(evento.payload).toMatchObject({
      reviewDecisionId: "decisao-1", exceptionId: "exc:UNLINKED_PATIENT:seg-1",
      acao: "CONFIRMAR", medicoId: "medico-teste",
    });
  });

  it("descartar exige motivo e o motivo fica registrado (nada some)", () => {
    expect(() => paraEventoDeRevisao({ ...acaoConfirmar, acao: "DESCARTAR" }, "d-2")).toThrow("motivo");
    const evento = paraEventoDeRevisao({ ...acaoConfirmar, acao: "DESCARTAR", motivo: "duplicado" }, "d-2");
    expect(evento.payload).toMatchObject({ acao: "DESCARTAR", motivo: "duplicado" });
  });

  it("ligar ao paciente exige patientId; corrigir preserva o valor corrigido", () => {
    expect(() => paraEventoDeRevisao({ ...acaoConfirmar, acao: "LIGAR_PACIENTE" }, "d-3")).toThrow("patientId");
    const ligado = paraEventoDeRevisao({ ...acaoConfirmar, acao: "LIGAR_PACIENTE", patientId: "P07" }, "d-3");
    expect(ligado.payload.patientId).toBe("P07");
    const corrigido = paraEventoDeRevisao({
      ...acaoConfirmar, acao: "CORRIGIR", valorCorrigido: { marker: "Hb", value: 11.2 },
    }, "d-4");
    expect(corrigido.payload.acao).toBe("CORRIGIR");
  });

  it("evento sem reviewDecisionId é recusado", () => {
    expect(() => paraEventoDeRevisao(acaoConfirmar, "  ")).toThrow("reviewDecisionId");
  });
});