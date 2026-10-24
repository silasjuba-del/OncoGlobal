import { describe, expect, it } from "vitest";
import { executarConfirmacao } from "../../src/kernel/comandos/index.js";
import { listarEventos, salvarDraft } from "../../src/kernel/comandos/portas.js";
import { confirmar, type Confirmacao } from "../../src/kernel/ledger/writeRouter.js";
import {
  G2_CONTEXTO, G2_INSTANTE_BASE, G2_INSTANTE_EXPIRADO, G2_INSTANTE_RETRY,
  criarBancoMemoriaG2, criarFonteSinteticaG2, criarSessaoSinteticaG2,
} from "../fixtures/g2-integridade.js";

// Sessão original: válida de BASE até 11:00. Sessão nova: emitida no RETRY, depois do instante original.
const sessaoOriginal = criarSessaoSinteticaG2();
const sessaoNova = criarSessaoSinteticaG2({ emitidaEm: G2_INSTANTE_RETRY, expiraEm: "2026-10-10T13:00:00.000Z" });

function pedido(sufixo: string): Confirmacao {
  return {
    operationId: `op-g3c-${sufixo}`, ...G2_CONTEXTO, reviewDecisionId: `rev-g3c-${sufixo}`,
    sessao: sessaoOriginal, em: G2_INSTANTE_BASE,
    registros: [{ draftId: `draft-g3c-${sufixo}`, expectedRevision: 0, eventId: `ev-g3c-${sufixo}`, tipo: "FATO",
      payload: { campo: "observacao", valor: `nota sintética ${sufixo}`, contexto: { ...G2_CONTEXTO } },
      fontes: [criarFonteSinteticaG2(`fonte-g3c-${sufixo}`)], revisao: "CONFIRMADO" }],
  };
}

function gravarOriginal(sufixo: string) {
  const db = criarBancoMemoriaG2(), req = pedido(sufixo);
  salvarDraft(db, { draftId: req.registros[0]!.draftId, patientId: G2_CONTEXTO.patientId, sourceId: `fonte-g3c-${sufixo}`,
    rawRef: "raw-g3c", payload: req.registros[0]!.payload, diagnostics: [], revision: 0, criadoEm: G2_INSTANTE_BASE });
  expect(confirmar(db, req)).toEqual({ estado: "GRAVADA", resultRef: `ev-g3c-${sufixo}` });
  return { db, req };
}

describe("G3c · replay: autorização no relógio atual, criadoEm original só como identidade", () => {
  it("retry com relógio avançado e sem pino manual é REPLAY, sem duplicar nem conflitar", () => {
    const { db, req } = gravarOriginal("sem-pino");
    try {
      expect(confirmar(db, { ...req, em: G2_INSTANTE_RETRY, autorizadoEm: G2_INSTANTE_RETRY }))
        .toEqual({ estado: "REPLAY", resultRef: "ev-g3c-sem-pino" });
      expect(listarEventos(db, G2_CONTEXTO.patientId)).toHaveLength(1);
      expect(listarEventos(db, G2_CONTEXTO.patientId)[0]!.criadoEm).toBe(G2_INSTANTE_BASE);
    } finally { db.close(); }
  });

  it("replay com sessão expirada no relógio atual é negado, mesmo com o instante original pinado", () => {
    const { db, req } = gravarOriginal("expirada");
    try {
      expect(confirmar(db, { ...req, autorizadoEm: G2_INSTANTE_EXPIRADO }))
        .toEqual({ estado: "NEGADA", resultRef: null, motivo: "SESSAO_EXPIRADA" });
      expect(listarEventos(db, G2_CONTEXTO.patientId)).toHaveLength(1);
    } finally { db.close(); }
  });

  it("retry por sessão nova, emitida depois do instante original, é REPLAY pelo caminho canônico", () => {
    const { db, req } = gravarOriginal("sessao-nova");
    try {
      expect(executarConfirmacao(db, { ...req, sessao: sessaoNova, autorizadoEm: G2_INSTANTE_RETRY }))
        .toEqual({ estado: "REPLAY", resultRef: "ev-g3c-sessao-nova" });
      expect(listarEventos(db, G2_CONTEXTO.patientId)).toHaveLength(1);
    } finally { db.close(); }
  });

  it("escrita nova com sessão não iniciada no relógio atual é negada; sem autorizadoEm vale o instante do pedido", () => {
    const db = criarBancoMemoriaG2();
    try {
      const req = pedido("nova");
      salvarDraft(db, { draftId: req.registros[0]!.draftId, patientId: G2_CONTEXTO.patientId, sourceId: "fonte-g3c-nova",
        rawRef: "raw-g3c", payload: req.registros[0]!.payload, diagnostics: [], revision: 0, criadoEm: G2_INSTANTE_BASE });
      expect(confirmar(db, { ...req, sessao: sessaoNova, autorizadoEm: G2_INSTANTE_BASE }))
        .toEqual({ estado: "NEGADA", resultRef: null, motivo: "SESSAO_NAO_INICIADA" });
      expect(confirmar(db, req)).toEqual({ estado: "GRAVADA", resultRef: "ev-g3c-nova" });
      expect(listarEventos(db, G2_CONTEXTO.patientId)[0]!.criadoEm).toBe(G2_INSTANTE_BASE);
    } finally { db.close(); }
  });
});
