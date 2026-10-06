import { expect, it } from "vitest";
import { abrirLedger } from "../../src/kernel/ledger/db.js";
import { salvarDraft, confirmar } from "../../src/kernel/ledger/writeRouter.js";
import { listarEventos } from "../../src/kernel/ledger/ledger.js";
import { ultimaAdministracaoQtEfetiva } from "../../src/rules/intervaloQt.js";
import { avaliarRadAlerts } from "../../src/rules/radAlerts.js";
import { avaliarLabAlerts } from "../../src/rules/labAlerts.js";
import { avaliarRedFlagsCanal } from "../../src/rules/redFlagsCanal.js";
import { avaliarCtcaeGrau } from "../../src/rules/ctcaeGrau.js";
import { avaliarRecist } from "../../src/rules/recist.js";
import { avaliarEscore } from "../../src/rules/escores.js";
import { avaliarCumulativoAlerta } from "../../src/rules/cumulativoAlerta.js";
import * as f from "./fixtures.js";

it("W3 A09 ancora le evento envelopado produzido pelo WriteRouter", () => {
  const db = abrirLedger(":memory:");
  try {
    const em = "2026-10-05T12:00:00Z";
    const { patientId, episodioId: _episodio, unidadeEfetiva: _unidade, ...admin } = f.administracaoCompleta("a", 50);
    salvarDraft(db, { draftId: "d", patientId, sourceId: "s", rawRef: "opaco", payload: admin, diagnostics: [], revision: 0, criadoEm: em });
    confirmar(db, { operationId: "op", patientId, tumorLotId: "t", encounterId: "e", reviewDecisionId: "r", em,
      sessao: { medicoId: "m", crm: "TESTE", emitidaEm: em, expiraEm: "2026-10-05T13:00:00Z" },
      registros: [{ draftId: "d", expectedRevision: 0, eventId: "ev", tipo: "TreatmentAdministration", payload: admin, fontes: [f.fonteSintetica], revisao: "CONFIRMADO" }] });
    expect(ultimaAdministracaoQtEfetiva(listarEventos(db, patientId), "-03:00", { "ciclo-01": "QT" }).data).toBe("2026-10-01");
  } finally { db.close(); }
});
it.each(["TEP nao descartado.", "TEP nao pode ser excluido."])("W3 A10 incerteza posterior: %s", (texto) => {
  expect(avaliarRadAlerts({ texto, tipoFonte: "TRANSCRIPTION", data: "2026-10-05" }, f.radRuleset).alerts[0]?.tipo).toBe("REVISAO_URGENTE");
});
it("W3 A11 sem melhora nao nega o achado", () => {
  expect(avaliarRadAlerts({ texto: "Sem melhora do TEP.", tipoFonte: "TRANSCRIPTION", data: "2026-10-05" }, f.radRuleset).alerts).toHaveLength(1);
});
it("W3 A12 conversao decimal nao cria conflito artificial", () => {
  const rs = structuredClone(f.labRuleset); rs.analitos[0]!.threshold.min = 0;
  expect(avaliarLabAlerts([{ codigo: "HB", valor: 3, unidade: "dg/dL" }, { codigo: "HB", valor: 0.3, unidade: "g/dL" }], rs).achados[0]?.estado).toBe("VERDE");
});
it("W3 ancora exige modalidade explicita do ciclo sem inventar QT", () => {
  const { patientId: _p, episodioId: _e, unidadeEfetiva: _u, ...a } = f.administracaoCompleta("a", 20);
  expect(ultimaAdministracaoQtEfetiva([a], "-03:00").data).toBeNull();
  expect(ultimaAdministracaoQtEfetiva([a], "-03:00", { "ciclo-01": "QT" }).data).toBe("2026-10-01");
  expect(ultimaAdministracaoQtEfetiva([{ ...a, modalidade: "QT" }], "-03:00", { "ciclo-01": "RT" }).data).toBeNull();
});
it("INV-14 toda saida W3 expoe rastreabilidade inclusive em indisponibilidade", () => {
  const resultados = [
    avaliarLabAlerts([], null),
    avaliarRadAlerts({ texto: "", tipoFonte: "TRANSCRIPTION", data: "" }, null),
    avaliarRedFlagsCanal({ texto: "", contatoId: "c", classificadorOk: false }, null),
    avaliarCumulativoAlerta({ patientId: "p", episodioId: "e", droga: "d", administracoes: [] }, null),
    avaliarCtcaeGrau({ termo: "t", ctcae_version: null, medidas: {} }, null),
    avaliarRecist({ lesoesAtuais: [], baseline: [], nadir: [] }, null),
    avaliarEscore({ scoreId: "s", entradas: {} }, null),
    ultimaAdministracaoQtEfetiva([], "-03:00"),
  ];
  for (const r of resultados) {
    expect(r.rulesetVersao).toBeTruthy();
    expect(Array.isArray(r.inputs_used)).toBe(true);
    expect(r.inputs_missing.length).toBeGreaterThan(0);
  }
});
