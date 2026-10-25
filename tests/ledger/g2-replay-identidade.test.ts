// G2 · Caracterização de Replay, Identidade, Contexto e Sessão no Ledger e Funil de Escrita (Cenários 1, 2, 3 e 4).
// Base: 52b8f7a04c2e467c5c3b3cb93bc38a7673cc4c93 (codex/estabilizacao-g01-reconciliacao).
import { describe, expect, it } from "vitest";
import { executarConfirmacao } from "../../src/kernel/comandos/index.js";
import { criarWriterClinicoGateway } from "../../src/kernel/gateway/writerClinico.js";
import { salvarDraft } from "../../src/kernel/ledger/drafts.js";
import { listarEventos } from "../../src/kernel/ledger/ledger.js";
import { confirmar, motivoInvarianteEscrita } from "../../src/kernel/ledger/writeRouter.js";
import { hashCanonico } from "../../src/rules/conteudoCanonico.js";
import {
  criarBancoMemoriaG2,
  criarFonteSinteticaG2,
  criarSessaoSinteticaG2,
  G2_CONTEXTO,
  G2_INSTANTE_BASE,
  G2_INSTANTE_EXPIRADO,
  G2_INSTANTE_RETRY,
  G2_OUTRO_CONTEXTO,
} from "../fixtures/g2-integridade.js";

describe("G2 · Cenário 1: Replay com relógio avançado e pinagem de criadoEm (OG-001 / D-03)", () => {
  it("caracteriza writeRouter.confirmar direto: mesmo em retorna REPLAY; novo em sem pinar criadoEm gera OPERATION_HASH_CONFLICT", () => {
    const db = criarBancoMemoriaG2();
    try {
      const sessao = criarSessaoSinteticaG2();
      const payload = { campo: "hemoglobina", valor: 10.4 };
      salvarDraft(db, {
        draftId: "draft-c1-direto",
        patientId: G2_CONTEXTO.patientId,
        sourceId: "fonte-c1",
        rawRef: "raw-c1",
        payload,
        diagnostics: [],
        revision: 0,
        criadoEm: G2_INSTANTE_BASE,
      });

      const baseReq = {
        operationId: "op-c1-direto",
        patientId: G2_CONTEXTO.patientId,
        tumorLotId: G2_CONTEXTO.tumorLotId,
        encounterId: G2_CONTEXTO.encounterId,
        reviewDecisionId: "rev-c1-direto",
        sessao,
        em: G2_INSTANTE_BASE,
        registros: [
          {
            draftId: "draft-c1-direto",
            expectedRevision: 0,
            eventId: "ev-c1-direto",
            tipo: "FATO",
            payload,
            fontes: [criarFonteSinteticaG2("fonte-c1")],
            revisao: "CONFIRMADO" as const,
          },
        ],
      };

      const primeira = confirmar(db, baseReq);
      expect(primeira).toEqual({ estado: "GRAVADA", resultRef: "ev-c1-direto" });
      expect(listarEventos(db, G2_CONTEXTO.patientId)).toHaveLength(1);

      // Replay mantendo o mesmo instante original (como fazem os 6 chamadores que pinam operation.criadoEm):
      const replayMesmoInstante = confirmar(db, baseReq);
      expect(replayMesmoInstante).toEqual({ estado: "REPLAY", resultRef: "ev-c1-direto" });
      expect(listarEventos(db, G2_CONTEXTO.patientId)).toHaveLength(1);

      // Invertido em G3c (OG-001 / D-03 corrigidos): o kernel remonta o replay com o criadoEm já gravado da
      // operação; um chamador que não pine `em` e passe `G2_INSTANTE_RETRY` obtém REPLAY (antes: OPERATION_HASH_CONFLICT).
      const retryRelogioAvancadoSemPino = confirmar(db, { ...baseReq, em: G2_INSTANTE_RETRY });
      expect(retryRelogioAvancadoSemPino).toEqual({ estado: "REPLAY", resultRef: "ev-c1-direto" });
      // Invariante preservada: mesmo quando negado, o evento original não é duplicado nem alterado.
      expect(listarEventos(db, G2_CONTEXTO.patientId)).toHaveLength(1);
    } finally {
      db.close();
    }
  });

  it("caracteriza writerClinico.persistir: pina operation.criadoEm e retorna REPLAY com relógio avançado sem duplicar evento", () => {
    const db = criarBancoMemoriaG2();
    try {
      let agora = G2_INSTANTE_BASE;
      const sessao = criarSessaoSinteticaG2();
      const payload = {
        patientId: G2_CONTEXTO.patientId,
        encounterId: G2_CONTEXTO.encounterId,
        horario: "09:30",
        data: "2026-10-10",
      };
      salvarDraft(db, {
        draftId: "draft-c1-writer",
        patientId: G2_CONTEXTO.patientId,
        sourceId: "fonte-c1-writer",
        rawRef: "raw-c1-writer",
        payload,
        diagnostics: [],
        revision: 0,
        criadoEm: G2_INSTANTE_BASE,
      });

      const writer = criarWriterClinicoGateway({ db, agora: () => agora });
      const pedido = {
        operationId: "op-c1-writer",
        reviewDecisionId: "rev-c1-writer",
        ator: { tipo: "SESSAO" as const, id: sessao.medicoId },
        sessao,
        acaoMedicaExplicita: true,
        contexto: { ...G2_CONTEXTO },
        bundleExibidoNoServidor: [
          {
            documentId: "draft-c1-writer",
            documentVersion: 1,
            draftId: "draft-c1-writer",
            conteudoHash: hashCanonico(payload),
          },
        ],
        documentosAssinadosNoPedido: [{ documentId: "draft-c1-writer", documentVersion: 1 }],
        registros: [
          {
            draftId: "draft-c1-writer",
            expectedRevision: 0,
            eventId: "ev-c1-writer",
            tipo: "AgendaEntry",
            payload,
            fontes: [],
            revisao: "CONFIRMADO" as const,
          },
        ],
      };

      expect(writer.persistir(pedido)).toEqual({
        decisao: "PERSISTIDA",
        motivoCodigo: "ESCRITA_CLINICA_PERSISTIDA",
        resultRef: "ev-c1-writer",
      });

      // Avança o relógio dentro da validade da sessão: writerClinico.ts:179-181 lê operation.criadoEm e obtém REPLAY.
      agora = G2_INSTANTE_RETRY;
      expect(writer.persistir(pedido)).toEqual({
        decisao: "REPLAY",
        motivoCodigo: "ESCRITA_REPLAY_IDEMPOTENTE",
        resultRef: "ev-c1-writer",
      });
      expect(listarEventos(db, G2_CONTEXTO.patientId)).toHaveLength(1);
    } finally {
      db.close();
    }
  });
});

describe("G2 · Cenário 2: Mesma chave com payload divergente -> OPERATION_HASH_CONFLICT", () => {
  it("nega reutilização de operationId com payload ou reviewDecisionId alterado e preserva evento original e auditoria", () => {
    const db = criarBancoMemoriaG2();
    try {
      const sessao = criarSessaoSinteticaG2();
      salvarDraft(db, {
        draftId: "draft-c2",
        patientId: G2_CONTEXTO.patientId,
        sourceId: "fonte-c2",
        rawRef: "raw-c2",
        payload: { campo: "potassio", valor: 4.1 },
        diagnostics: [],
        revision: 0,
        criadoEm: G2_INSTANTE_BASE,
      });

      const original = {
        operationId: "op-c2-conflito",
        patientId: G2_CONTEXTO.patientId,
        tumorLotId: G2_CONTEXTO.tumorLotId,
        encounterId: G2_CONTEXTO.encounterId,
        reviewDecisionId: "rev-c2-original",
        sessao,
        em: G2_INSTANTE_BASE,
        registros: [
          {
            draftId: "draft-c2",
            expectedRevision: 0,
            eventId: "ev-c2-original",
            tipo: "FATO",
            payload: { campo: "potassio", valor: 4.1 },
            fontes: [criarFonteSinteticaG2("fonte-c2")],
            revisao: "CONFIRMADO" as const,
          },
        ],
      };

      expect(confirmar(db, original)).toEqual({ estado: "GRAVADA", resultRef: "ev-c2-original" });

      // Mesmo operationId e mesmo instante, mas valor do fato adulterado:
      const conflitoValor = confirmar(db, {
        ...original,
        registros: [{ ...original.registros[0]!, payload: { campo: "potassio", valor: 6.8 } }],
      });
      expect(conflitoValor).toEqual({
        estado: "NEGADA",
        resultRef: null,
        motivo: "OPERATION_HASH_CONFLICT",
      });

      const eventos = listarEventos(db, G2_CONTEXTO.patientId);
      expect(eventos).toHaveLength(1);
      expect(eventos[0]?.payload).toEqual({
        reviewDecisionId: "rev-c2-original",
        data: { campo: "potassio", valor: 4.1 },
      });

      const auditoriasNegadas = db
        .prepare("SELECT acaoPedida, decisao, motivoCodigo FROM audit_event WHERE decisao='NEGADA'")
        .all();
      expect(auditoriasNegadas).toContainEqual({
        acaoPedida: "GRAVAR_OPERACAO",
        decisao: "NEGADA",
        motivoCodigo: "OPERATION_HASH_CONFLICT",
      });
    } finally {
      db.close();
    }
  });
});

describe("G2 · Cenário 3: Divergência de ator, patientId, encounterId e tumorLotId no replay e na escrita", () => {
  it("nega replay quando medicoId, patientId, encounterId ou tumorLotId divergem da operação gravada", () => {
    const db = criarBancoMemoriaG2();
    try {
      const sessaoA = criarSessaoSinteticaG2({ medicoId: "medico-a", crm: "CRM-A" });
      const sessaoB = criarSessaoSinteticaG2({ medicoId: "medico-b", crm: "CRM-B" });
      salvarDraft(db, {
        draftId: "draft-c3",
        patientId: G2_CONTEXTO.patientId,
        sourceId: "fonte-c3",
        rawRef: "raw-c3",
        payload: { campo: "neutrofilos", valor: 2100 },
        diagnostics: [],
        revision: 0,
        criadoEm: G2_INSTANTE_BASE,
      });

      const base = {
        operationId: "op-c3-escopo",
        patientId: G2_CONTEXTO.patientId,
        tumorLotId: G2_CONTEXTO.tumorLotId,
        encounterId: G2_CONTEXTO.encounterId,
        reviewDecisionId: "rev-c3-escopo",
        sessao: sessaoA,
        em: G2_INSTANTE_BASE,
        registros: [
          {
            draftId: "draft-c3",
            expectedRevision: 0,
            eventId: "ev-c3-escopo",
            tipo: "FATO",
            payload: { campo: "neutrofilos", valor: 2100 },
            fontes: [criarFonteSinteticaG2("fonte-c3")],
            revisao: "CONFIRMADO" as const,
          },
        ],
      };

      expect(confirmar(db, base).estado).toBe("GRAVADA");

      // Como criadoPor.id, patientId, encounterId e tumorLotId integram o ClinicalEvent,
      // qualquer divergência no retry com a mesma operationId bate em OPERATION_HASH_CONFLICT.
      for (const mutacao of [
        { rotulo: "outro médico", req: { ...base, sessao: sessaoB } },
        { rotulo: "outro paciente", req: { ...base, patientId: G2_OUTRO_CONTEXTO.patientId } },
        { rotulo: "outro encontro", req: { ...base, encounterId: G2_OUTRO_CONTEXTO.encounterId } },
        { rotulo: "outro lote tumoral", req: { ...base, tumorLotId: G2_OUTRO_CONTEXTO.tumorLotId } },
        { rotulo: "lote null vs preenchido", req: { ...base, tumorLotId: null } },
      ]) {
        expect(confirmar(db, mutacao.req), mutacao.rotulo).toEqual({
          estado: "NEGADA",
          resultRef: null,
          motivo: "OPERATION_HASH_CONFLICT",
        });
      }
      expect(listarEventos(db, G2_CONTEXTO.patientId)).toHaveLength(1);
    } finally {
      db.close();
    }
  });

  it("porta comum e writerClinico recusam divergência de paciente, encontro e lote do draft", () => {
    const db = criarBancoMemoriaG2();
    try {
      const sessao = criarSessaoSinteticaG2();
      const payloadComContexto = {
        campo: "observacao",
        valor: "nota vinculada ao encontro 01",
        contexto: {
          patientId: G2_CONTEXTO.patientId,
          encounterId: G2_CONTEXTO.encounterId,
          tumorLotId: G2_CONTEXTO.tumorLotId,
        },
      };
      salvarDraft(db, {
        draftId: "draft-c3-contexto",
        patientId: G2_CONTEXTO.patientId,
        sourceId: "fonte-c3-ctx",
        rawRef: "raw-c3-ctx",
        payload: payloadComContexto,
        diagnostics: [],
        revision: 0,
        criadoEm: G2_INSTANTE_BASE,
      });

      // 1) Caminho canônico `executarConfirmacao` (`src/kernel/comandos/index.ts:17-21`):
      // Rejeita se `encounterId` ou `tumorLotId` do pedido divergir de `draft.payload.contexto`.
      expect(() =>
        executarConfirmacao(db, {
          operationId: "op-c3-cmd-encontro",
          patientId: G2_CONTEXTO.patientId,
          encounterId: "outro-encontro-divergente",
          tumorLotId: G2_CONTEXTO.tumorLotId,
          reviewDecisionId: "rev-c3-cmd",
          sessao,
          em: G2_INSTANTE_BASE,
          registros: [
            {
              draftId: "draft-c3-contexto",
              expectedRevision: 0,
              eventId: "ev-c3-cmd",
              tipo: "FATO",
              payload: payloadComContexto,
              fontes: [criarFonteSinteticaG2("fonte-c3-ctx")],
              revisao: "CONFIRMADO",
            },
          ],
        }),
      ).toThrow("DRAFT_ENCONTRO_DIVERGENTE");

      expect(() =>
        executarConfirmacao(db, {
          operationId: "op-c3-cmd-lote",
          patientId: G2_CONTEXTO.patientId,
          encounterId: G2_CONTEXTO.encounterId,
          tumorLotId: "outro-lote-divergente",
          reviewDecisionId: "rev-c3-cmd",
          sessao,
          em: G2_INSTANTE_BASE,
          registros: [
            {
              draftId: "draft-c3-contexto",
              expectedRevision: 0,
              eventId: "ev-c3-cmd",
              tipo: "FATO",
              payload: payloadComContexto,
              fontes: [criarFonteSinteticaG2("fonte-c3-ctx")],
              revisao: "CONFIRMADO",
            },
          ],
        }),
      ).toThrow("DRAFT_LOTE_DIVERGENTE");

      // 2) Caminho `writerClinico.persistir` (`src/kernel/gateway/writerClinico.ts:146-150`):
      // Também passa pela porta comum: paciente, encontro e lote do draft precisam coincidir.
      const hashFonte = "3".repeat(64);
      const writer = criarWriterClinicoGateway({
        db,
        agora: () => G2_INSTANTE_BASE,
        hashFonteOriginal: () => hashFonte,
      });

      const negadoOutroPaciente = writer.persistir({
        operationId: "op-c3-writer-pac",
        reviewDecisionId: "rev-c3-writer-pac",
        ator: { tipo: "SESSAO", id: sessao.medicoId },
        sessao,
        acaoMedicaExplicita: true,
        contexto: {
          patientId: G2_OUTRO_CONTEXTO.patientId,
          encounterId: G2_CONTEXTO.encounterId,
          tumorLotId: G2_CONTEXTO.tumorLotId,
        },
        bundleExibidoNoServidor: [
          {
            documentId: "draft-c3-contexto",
            documentVersion: 1,
            draftId: "draft-c3-contexto",
            conteudoHash: hashCanonico(payloadComContexto),
          },
        ],
        documentosAssinadosNoPedido: [{ documentId: "draft-c3-contexto", documentVersion: 1 }],
        registros: [
          {
            draftId: "draft-c3-contexto",
            expectedRevision: 0,
            eventId: "ev-c3-writer-pac",
            tipo: "FATO",
            payload: payloadComContexto,
            fontes: [criarFonteSinteticaG2("fonte-c3-ctx", hashFonte)],
            revisao: "CONFIRMADO",
          },
        ],
      });
      expect(negadoOutroPaciente).toEqual({
        decisao: "NEGADA",
        motivoCodigo: "IDENTIDADE_PACIENTE_DIVERGENTE",
        resultRef: null,
      });

      // L4: a lacuna caracterizada passa a ser uma recusa, sem evento gravado.
      const aceitoEncontroDivergenteNoWriter = writer.persistir({
        operationId: "op-c3-writer-enc-div",
        reviewDecisionId: "rev-c3-writer-enc-div",
        ator: { tipo: "SESSAO", id: sessao.medicoId },
        sessao,
        acaoMedicaExplicita: true,
        contexto: {
          patientId: G2_CONTEXTO.patientId,
          encounterId: "encontro-divergente-do-draft",
          tumorLotId: null,
        },
        bundleExibidoNoServidor: [
          {
            documentId: "draft-c3-contexto",
            documentVersion: 1,
            draftId: "draft-c3-contexto",
            conteudoHash: hashCanonico(payloadComContexto),
          },
        ],
        documentosAssinadosNoPedido: [{ documentId: "draft-c3-contexto", documentVersion: 1 }],
        registros: [
          {
            draftId: "draft-c3-contexto",
            expectedRevision: 0,
            eventId: "ev-c3-writer-enc-div",
            tipo: "FATO",
            payload: payloadComContexto,
            fontes: [criarFonteSinteticaG2("fonte-c3-ctx", hashFonte)],
            revisao: "CONFIRMADO",
          },
        ],
      });
      expect(aceitoEncontroDivergenteNoWriter).toMatchObject({decisao:"NEGADA",motivoCodigo:"DRAFT_ENCONTRO_DIVERGENTE"});
      expect(listarEventos(db,G2_CONTEXTO.patientId).some(e=>e.operationId==="op-c3-writer-enc-div")).toBe(false);
    } finally {
      db.close();
    }
  });
});

describe("G2 · Cenário 4: Sessão expirada / não iniciada no instante da tentativa vs instante original (OG-001)", () => {
  it("caracteriza OG-001 em writeRouter.confirmar: escrita nova barra sessão expirada, mas replay precede motivoInvarianteEscrita", () => {
    const db = criarBancoMemoriaG2();
    try {
      const sessaoValidaNaOrigem = criarSessaoSinteticaG2({
        emitidaEm: "2026-10-10T10:00:00.000Z",
        expiraEm: "2026-10-10T11:00:00.000Z",
      });
      const sessaoExpiradaNaOrigem = criarSessaoSinteticaG2({
        emitidaEm: "2026-10-10T08:00:00.000Z",
        expiraEm: "2026-10-10T09:00:00.000Z",
      });

      expect(motivoInvarianteEscrita({ sessao: sessaoExpiradaNaOrigem, em: G2_INSTANTE_BASE })).toBe(
        "SESSAO_EXPIRADA",
      );
      expect(
        motivoInvarianteEscrita({
          sessao: criarSessaoSinteticaG2({
            emitidaEm: "2026-10-10T10:30:00.000Z",
            expiraEm: "2026-10-10T11:30:00.000Z",
          }),
          em: G2_INSTANTE_BASE,
        }),
      ).toBe("SESSAO_NAO_INICIADA");

      salvarDraft(db, {
        draftId: "draft-c4",
        patientId: G2_CONTEXTO.patientId,
        sourceId: "fonte-c4",
        rawRef: "raw-c4",
        payload: { campo: "plaquetas", valor: 180000 },
        diagnostics: [],
        revision: 0,
        criadoEm: G2_INSTANTE_BASE,
      });

      const req = {
        operationId: "op-c4-sessao",
        patientId: G2_CONTEXTO.patientId,
        tumorLotId: G2_CONTEXTO.tumorLotId,
        encounterId: G2_CONTEXTO.encounterId,
        reviewDecisionId: "rev-c4-sessao",
        sessao: sessaoValidaNaOrigem,
        em: G2_INSTANTE_BASE,
        registros: [
          {
            draftId: "draft-c4",
            expectedRevision: 0,
            eventId: "ev-c4-sessao",
            tipo: "FATO",
            payload: { campo: "plaquetas", valor: 180000 },
            fontes: [criarFonteSinteticaG2("fonte-c4")],
            revisao: "CONFIRMADO" as const,
          },
        ],
      };

      // 1) Escrita nova com sessão expirada é NEGADA:
      expect(confirmar(db, { ...req, operationId: "op-c4-negada", sessao: sessaoExpiradaNaOrigem })).toEqual({
        estado: "NEGADA",
        resultRef: null,
        motivo: "SESSAO_EXPIRADA",
      });
      expect(listarEventos(db, G2_CONTEXTO.patientId)).toHaveLength(0);

      // 2) Escrita original com sessão válida grava:
      expect(confirmar(db, req)).toEqual({ estado: "GRAVADA", resultRef: "ev-c4-sessao" });

      // 3) Invertido em G3c (OG-001 corrigido): a sessão é validada antes do replay, no relógio da requisição
      // (`autorizadoEm`, ausente = `em`). Replay direto no kernel com sessão expirada é negado (antes: REPLAY).
      const replayComSessaoExpiradaDiretoNoKernel = confirmar(db, {
        ...req,
        sessao: sessaoExpiradaNaOrigem,
      });
      expect(replayComSessaoExpiradaDiretoNoKernel).toEqual({
        estado: "NEGADA",
        resultRef: null,
        motivo: "SESSAO_EXPIRADA",
      });
      expect(listarEventos(db, G2_CONTEXTO.patientId)).toHaveLength(1);

      // 4) Já no `writerClinico.persistir` (`writerClinico.ts:108`), a sessão é validada contra o relógio atual (`deps.agora()`)
      // ANTES de consultar `operation.criadoEm` e chamar `confirmar`:
      const writerExpirado = criarWriterClinicoGateway({
        db,
        agora: () => G2_INSTANTE_EXPIRADO,
      });
      const resWriterExpirado = writerExpirado.persistir({
        operationId: req.operationId,
        reviewDecisionId: req.reviewDecisionId,
        ator: { tipo: "SESSAO", id: sessaoValidaNaOrigem.medicoId },
        sessao: sessaoValidaNaOrigem,
        acaoMedicaExplicita: true,
        contexto: { ...G2_CONTEXTO },
        bundleExibidoNoServidor: [
          {
            documentId: "draft-c4",
            documentVersion: 1,
            draftId: "draft-c4",
            conteudoHash: hashCanonico({ campo: "plaquetas", valor: 180000 }),
          },
        ],
        documentosAssinadosNoPedido: [{ documentId: "draft-c4", documentVersion: 1 }],
        registros: req.registros,
      });
      expect(resWriterExpirado).toEqual({
        decisao: "NEGADA",
        motivoCodigo: "SESSAO_EXPIRADA",
        resultRef: null,
      });
    } finally {
      db.close();
    }
  });
});
