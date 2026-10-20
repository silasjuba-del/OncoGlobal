import { describe, expect, it } from "vitest";
import { ConteudoPrescricaoExecutavel } from "../../src/contracts/api/prescricaoExecutavel.js";
import type { ItemPrescricaoExecutavel as ItemExecutavel } from "../../src/contracts/api/prescricaoExecutavel.js";
import { avaliarDocumentoExecutavel } from "../../src/rules/prescricao/documentoExecutavel.js";

const item = (overrides: Partial<ItemExecutavel["item"]> = {}): ItemExecutavel => ({
  itemId: "item-estavel-1",
  item: {
    drug: "Fármaco sintético alfa",
    classe: "QT",
    sequence: 1,
    standardDose: 50,
    doseBasis: "MG_M2",
    calculatedDose: 1.5,
    prescribedDose: 1.5,
    unit: "mg",
    adjustmentPercent: null,
    adjustmentReason: null,
    route: "EV",
    diluent: "SF 0,9%",
    finalVolumeMl: 250,
    infusionTime: "60 min",
    days: ["d1", "d8"],
    observacao: "Observação sintética preservada",
    source: "PROTOCOL",
    overrideMotivo: null,
    ...overrides,
  },
});

const conteudo = (overrides: Record<string, unknown> = {}) => ({
  schema: "PrescricaoExecutavel@1",
  contexto: {
    patientId: "paciente-sintetico",
    encounterId: "encontro-sintetico",
    tumorLotId: "lote-sintetico",
    episodioId: "episodio-sintetico",
    cicloId: "ciclo-sintetico",
  },
  documentId: "prescricao-sintetica",
  documentVersion: 1,
  protocoloId: "protocolo-sintetico-v1",
  dataPrevista: "2026-10-20",
  motivo: "Ajuste para revisão sintética",
  itens: [item()],
  origemProposta: { draftId: "proposta-sintetica", revision: 2, hash: "a".repeat(64) },
  ...overrides,
});

describe("documento executável de prescrição", () => {
  it("preserva item completo, itemId, fonte e dose fracionária sem mutação", () => {
    const input = conteudo();
    const before = structuredClone(input);
    const result = avaliarDocumentoExecutavel(input);

    expect(result.ok).toBe(true);
    expect(result.conteudo).not.toBeNull();
    expect(result.conteudo?.itens[0]).toEqual(input.itens[0]);
    expect(result.conteudo?.itens[0]?.item.prescribedDose).toBe(1.5);
    expect(result.texto).toContain("1,5 mg");
    expect(result.texto).toContain("EV");
    expect(result.texto).toContain("SF 0,9%");
    expect(result.texto).toContain("250 mL");
    expect(result.texto).toContain("60 min");
    expect(result.texto).toContain("d1, d8");
    expect(result.texto).toContain("Ajuste para revisão sintética");
    expect(result.conteudo?.origemProposta?.draftId).toBe("proposta-sintetica");
    expect(result.texto).not.toContain("episodio-sintetico");
    expect(input).toEqual(before);
  });

  it("usa identidade confirmada e números clínicos na folha, mantendo IDs na estrutura auditável", () => {
    const r = avaliarDocumentoExecutavel(conteudo({ pacienteNome: "Paciente Exemplo Sintético", linha: 2, numeroCiclo: 3 }));
    expect(r.texto).toContain("Paciente: Paciente Exemplo Sintético");
    expect(r.texto).toContain("Versão 1 · Linha 2 · Ciclo 3");
    expect(r.texto).not.toContain("prescricao-sintetica");
    expect(r.conteudo?.documentId).toBe("prescricao-sintetica");
  });

  it("aceita percentual explícito de 25 sem arredondar dose nem alterar campos não relacionados", () => {
    const adjusted = item({
      adjustmentPercent: -25,
      adjustmentReason: "Redução sintética explicitamente escolhida",
      calculatedDose: 2,
      prescribedDose: 1.5,
    });
    const result = avaliarDocumentoExecutavel(conteudo({ itens: [adjusted] }));

    expect(result.ok).toBe(true);
    expect(result.conteudo?.itens[0]?.item.adjustmentPercent).toBe(-25);
    expect(result.conteudo?.itens[0]?.item.prescribedDose).toBe(1.5);
    expect(result.conteudo?.itens[0]?.item.route).toBe("EV");
    expect(result.conteudo?.itens[0]?.item.diluent).toBe("SF 0,9%");
    expect(result.conteudo?.itens[0]?.item.days).toEqual(["d1", "d8"]);
  });

  it("não declara percentual incompatível com a dose final nem com referência ausente", () => {
    for (const calculatedDose of [null, 100]) {
      const r = avaliarDocumentoExecutavel(conteudo({ itens: [item({
        calculatedDose, prescribedDose: 50, adjustmentPercent: -25, adjustmentReason: "Motivo sintético",
      })] }));
      expect(r.ok).toBe(false);
      expect(r.pendencias.join(" ")).toMatch(/percentual/i);
    }
  });

  it("não aceita uma incompatibilidade de dose por overflow na aritmética do percentual", () => {
    const r = avaliarDocumentoExecutavel(conteudo({ itens: [item({
      calculatedDose: 1e308, prescribedDose: 1, adjustmentPercent: -25, adjustmentReason: "Caso adversarial numérico",
    })] }));
    expect(r.ok).toBe(false);
    expect(r.pendencias.join(" ")).toMatch(/incompatível/);
  });

  it("preserva refinements legados de motivo de ajuste e override manual QT", () => {
    const semMotivoAjuste = avaliarDocumentoExecutavel(conteudo({ itens: [item({
      adjustmentPercent: -25,
      adjustmentReason: null,
    })] }));
    const manualSemOverride = avaliarDocumentoExecutavel(conteudo({ itens: [item({
      source: "MANUAL",
      overrideMotivo: null,
    })] }));
    const manualComOverride = avaliarDocumentoExecutavel(conteudo({ itens: [item({
      source: "MANUAL",
      overrideMotivo: "Motivo sintético",
    })] }));

    expect(semMotivoAjuste.ok).toBe(false);
    expect(semMotivoAjuste.conteudo).toBeNull();
    expect(manualSemOverride.ok).toBe(false);
    expect(manualSemOverride.conteudo).toBeNull();
    expect(manualComOverride.ok).toBe(true);
  });

  it.each([NaN, Infinity, -Infinity, -100, 0, 1, 100])("rejeita adjustmentPercent fora de -99..-1: %s", value => {
    const result = avaliarDocumentoExecutavel(conteudo({ itens: [item({ adjustmentPercent: value, adjustmentReason: "motivo sintético" })] }));
    expect(result.ok).toBe(false);
    expect(result.conteudo).toBeNull();
    expect(result.pendencias.length).toBeGreaterThan(0);
  });

  it("mantém pendência para dose prescrita ausente", () => {
    const dose = null;
    const result = avaliarDocumentoExecutavel(conteudo({ itens: [item({ prescribedDose: dose })] }));
    expect(result.ok).toBe(false);
    expect(result.conteudo?.itens[0]?.item.prescribedDose).toBe(dose);
    expect(result.pendencias.join(" ")).toMatch(/dose/i);
  });

  it("rejeita dose zero como conteúdo incompatível com PrescriptionItem", () => {
    const result = avaliarDocumentoExecutavel(conteudo({ itens: [item({ prescribedDose: 0 })] }));
    expect(result.ok).toBe(false);
    expect(result.conteudo).toBeNull();
    expect(result.pendencias.length).toBeGreaterThan(0);
  });

  it.each(["mg/m2", "mg/m²", "mg/kg", "mcg/kg", "AUC"]) ("não trata unidade denominadora %s como dose final executável", unit => {
    const result = avaliarDocumentoExecutavel(conteudo({ itens: [item({ unit })] }));
    expect(result.ok).toBe(false);
    expect(result.pendencias.join(" ")).toMatch(/unidade|denominador|dose final/i);
  });

  it("recusa sequenciamento pendente e resgate condicional sem plano individual estruturado", () => {
    const alternado = item({ sequenciamentoPendente: "ciclos alternados sem ordem definida" });
    const resgate = item({ resgateMtx: {
      inicioAposHoras: 24, intervaloHoras: 6, primeirasDosesEV: 4,
      viasPosteriores: ["EV", "VO"], ateNivelInferiorMicromolL: 0.1, fonte: "protocolo sintético",
    } });
    const sequenciaResult = avaliarDocumentoExecutavel(conteudo({ itens: [alternado] }));
    const resgateResult = avaliarDocumentoExecutavel(conteudo({ itens: [resgate] }));

    expect(sequenciaResult.ok).toBe(false);
    expect(sequenciaResult.pendencias.join(" ")).toMatch(/sequenciamento/i);
    expect(resgateResult.ok).toBe(false);
    expect(resgateResult.pendencias.join(" ")).toMatch(/resgate/i);
  });

  it("mostra parâmetros de preparo nulos como não informados e avisos, sem inventar não se aplica", () => {
    const result = avaliarDocumentoExecutavel(conteudo({ itens: [item({ diluent: null, finalVolumeMl: null, infusionTime: null })] }));

    expect(result.ok).toBe(true);
    expect(result.texto).toMatch(/diluente: não informado/i);
    expect(result.texto).toMatch(/volume final: não informado/i);
    expect(result.texto).toMatch(/tempo de infusão: não informado/i);
    expect(result.texto).not.toMatch(/não se aplica/i);
    expect(result.avisos.join(" ")).toMatch(/diluente/i);
    expect(result.avisos.join(" ")).toMatch(/volume/i);
    expect(result.avisos.join(" ")).toMatch(/infusão/i);
  });

  it("marca parâmetros de preparo EV ausentes como avisos explícitos de revisão", () => {
    const result = avaliarDocumentoExecutavel(conteudo({ itens: [item({ diluent: null, finalVolumeMl: null, infusionTime: null })] }));
    expect(result.avisos.join(" ")).toMatch(/preparo.*EV|EV.*preparo/i);
  });

  it("rejeita sequências ou itemIds duplicados e metadados de assinatura fornecidos no conteúdo", () => {
    const duplicateSequence = { ...item(), itemId: "item-estavel-2", item: { ...item().item, sequence: 1 } };
    const duplicateItemId = { ...item(), item: { ...item().item, sequence: 2 } };
    const duplicated = avaliarDocumentoExecutavel(conteudo({ itens: [item(), duplicateSequence] }));
    const idsDuplicados = avaliarDocumentoExecutavel(conteudo({ itens: [item(), duplicateItemId] }));
    const forged = avaliarDocumentoExecutavel(conteudo({ signature: { documentHash: "a".repeat(64) }, actorId: "medico-cliente", status: "ASSINADO" }));

    expect(duplicated.ok).toBe(false);
    expect(idsDuplicados.ok).toBe(false);
    expect(forged.ok).toBe(false);
    expect(forged.conteudo).toBeNull();
  });

  it("schema válido porém não executável conserva conteúdo e texto para revisão", () => {
    const result = avaliarDocumentoExecutavel(conteudo({ itens: [item({ route: "" as never })] }));
    expect(result.ok).toBe(false);
    expect(result.conteudo).toBeNull();
    expect(result.texto).toBeNull();
    const pending = avaliarDocumentoExecutavel(conteudo({ itens: [item({ prescribedDose: null })] }));
    expect(pending.ok).toBe(false);
    expect(pending.conteudo).not.toBeNull();
    expect(pending.texto).not.toBeNull();
  });
});
