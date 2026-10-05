import type { Fonte } from "../../src/contracts/base.js";
import type { ClinicalEvent } from "../../src/contracts/operacao.js";
import type {
  AdministracaoCumulativo,
  CanalRuleset,
  CtcaeRuleset,
  LabRuleset,
  LimiteCumulativo,
  RadRuleset,
  RecistRuleset,
  ScoreRuleset,
} from "../../src/rules/tipos-w3.js";

export const fonteSintetica: Fonte = {
  sourceId: "fonte-teste-01",
  classe: "MANUAL",
  localizador: "fixture",
  dataClinica: "2026-10-05",
  dataCaptura: "2026-10-05T12:00:00-03:00",
  versao: "1",
  contentHash: "hash-fixture",
};

export const labRuleset: LabRuleset = {
  id: "lab-alerts",
  versao: "1.0.0",
  ativo: true,
  analitos: [
    {
      codigo: "HB",
      aliases: ["hemoglobina"],
      threshold: { regraId: "lab.hb.min", ativo: true, unidade: "g/dL", min: 8 },
      conversoes: [{ de: "dg/dL", para: "g/dL", fator: 0.1, regraId: "conv.hb.dgdl", fonte: "fixture" }],
    },
    {
      codigo: "ANC",
      threshold: { regraId: "lab.anc.inativo", ativo: false, unidade: "/uL", min: 1500 },
      conversoes: [],
    },
  ],
};

export const radRuleset: RadRuleset = {
  id: "rad-alerts",
  versao: "1.0.0",
  ativo: true,
  termosEmergencia: [{ codigo: "TEP", termo: "TEP", regraId: "rad.tep" }],
};

export const canalRuleset: CanalRuleset = {
  id: "canal-red-flags",
  versao: "1.0.0",
  ativo: true,
  flags: [{ codigo: "FEBRE_QT", termos: ["febre"], regraId: "canal.febre", templateId: "TPL_EMERGENCIA" }],
};

export const adminBase = {
  cicloId: "ciclo-01",
  prescricaoRef: { documentId: "doc-rx-01", documentVersion: 1 },
  item: 1,
  droga: "DOXO",
  motivo: null,
  inicio: "2026-10-01T09:00:00-03:00",
  fim: "2026-10-01T10:00:00-03:00",
  fonte: fonteSintetica,
};

export const administracaoCompleta = (id: string, mg: number, episodioId = "episodio-01"): AdministracaoCumulativo => ({
  ...adminBase,
  adminId: id,
  quantidadeEfetivaMg: mg,
  status: "COMPLETA",
  patientId: "paciente-teste-01",
  episodioId,
  unidadeEfetiva: "mg",
});

export const administracaoOmitida = (id: string): AdministracaoCumulativo => ({
  ...adminBase,
  adminId: id,
  quantidadeEfetivaMg: 0,
  status: "OMITIDA",
  motivo: "fixture omissao",
  patientId: "paciente-teste-01",
  episodioId: "episodio-01",
  unidadeEfetiva: "mg",
});

export const limiteCumulativo: LimiteCumulativo = {
  id: "limite-cumulativo",
  versao: "1.0.0",
  ativo: true,
  droga: "DOXO",
  unidade: "mg",
  maximo: 100,
  regraId: "cum.doxo",
};

export const ctcaeRuleset: CtcaeRuleset = {
  id: "ctcae",
  versao: "1.0.0",
  ativo: true,
  ctcae_version: "v6",
  termos: [
    {
      termo: "toxicidade-fixture",
      criteriosPorGrau: {
        "2": [{ campo: "valor", operador: ">=", valor: 2 }],
        "3": [{ campo: "valor", operador: ">=", valor: 3, exigeBasal: true }],
      },
    },
  ],
};

export const recistRuleset: RecistRuleset = {
  id: "recist",
  versao: "1.0.0",
  ativo: true,
  regraId: "recist.fixture",
  thresholds: { prPercent: -30, pdPercent: 20, pdAbsoluteMm: 5 },
};

export const scoreRuleset: ScoreRuleset = {
  id: "score-fixture",
  versao: "1.0.0",
  ativo: true,
  scoreId: "SCORE_FIXTURE",
  aplicabilidade: "fixture sintetica",
  entradasObrigatorias: ["a", "b"],
  formula: { tipo: "SOMA", campos: ["a", "b"] },
  interpretacao: [
    { min: 0, max: 2, rotulo: "baixo" },
    { min: 3, max: 10, rotulo: "alto" },
  ],
};

export const eventoQt = (adminId: string, fim: string, status: "COMPLETA" | "PARCIAL" | "OMITIDA" = "COMPLETA"): ClinicalEvent => ({
  eventId: `event-${adminId}`,
  operationId: "op-teste-01",
  eventIndex: 1,
  patientId: "paciente-teste-01",
  tumorLotId: "tumor-teste-01",
  encounterId: "enc-teste-01",
  tipo: "TREATMENT_ADMINISTRATION",
  payload: { ...adminBase, adminId, status, quantidadeEfetivaMg: status === "OMITIDA" ? 0 : 10, motivo: status === "COMPLETA" ? null : "fixture", inicio: fim, fim, modalidade: "QT" },
  fontes: [fonteSintetica],
  revisao: "CONFIRMADO",
  criadoEm: "2026-10-05T12:00:00-03:00",
  criadoPor: { tipo: "SISTEMA", id: "fixture" },
  supersedesEventId: null,
});
