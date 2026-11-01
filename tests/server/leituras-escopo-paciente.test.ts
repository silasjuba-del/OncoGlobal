// Prova da S2.5 extraída de tests/server/leituras-performance.test.ts (codex/fila-documental-20261101, 9f087f3e).
// As demais provas daquele arquivo dependem de mudanças da cadeia ainda fora da main.
// Prova sintética de otimização de leituras e eliminação de trabalho redundante.
// Zero rede externa; exclusivamente dados sintéticos em memória.
import { describe, expect, it } from "vitest";
import { abrirLedger } from "../../src/kernel/ledger/db.js";
import { salvarDraft } from "../../src/kernel/ledger/drafts.js";
import { confirmar } from "../../src/kernel/ledger/writeRouter.js";
import { criarGerenciadorSessao } from "../../src/server/sessao.js";
import { lerPaciente, lerLotes } from "../../src/server/leituras.js";

const AGORA = "2026-10-31T12:00:00.000Z";
const HASH64 = "a".repeat(64);

const campoAusente = {
  valor: null,
  estado: "PENDENTE" as const,
  campo: "AUSENTE" as const,
  motivo: "não informado",
  fontes: [],
  revisao: "RAW" as const,
};

function prepararBancoMultiPaciente() {
  const db = abrirLedger(":memory:");
  const sessoes = criarGerenciadorSessao({
    medicoId: "medico-perf",
    crm: "CRM-PERF",
    senha: "senha-perf-longa",
    duracaoMs: 60_000,
    agora: () => AGORA,
  });
  const token = sessoes.login("senha-perf-longa")!.token;

  for (let i = 1; i <= 5; i++) {
    const pid = `paciente-perf-${i}`;
    const cid = `consulta-perf-${i}`;
    const lid = `lote-perf-${i}`;
    sessoes.selecionarConsulta(token, { patientId: pid, encounterId: cid, tumorLotId: lid });

    salvarDraft(db, {
      draftId: `cad-${i}`,
      patientId: pid,
      sourceId: `src-${i}`,
      rawRef: "perf",
      payload: {},
      diagnostics: [],
      revision: 0,
      criadoEm: AGORA,
    });

    confirmar(db, {
      patientId: pid,
      encounterId: cid,
      tumorLotId: lid,
      operationId: `op-cad-${i}`,
      reviewDecisionId: `rev-cad-${i}`,
      sessao: sessoes.obter(token)!,
      em: AGORA,
      registros: [
        {
          draftId: `cad-${i}`,
          expectedRevision: 0,
          eventId: `ev-cad-${i}`,
          tipo: "Paciente@1",
          fontes: [],
          revisao: "CONFIRMADO",
          payload: {
            patientId: pid,
            nome: `Paciente Perf ${i}`,
            identificadores: [{ tipo: "PRONTUARIO", valor: `PRON-${i}` }],
            nascimento: null,
            sexoCadastral: "NAO_INFORMADO",
            divergencia: false,
          },
        },
        {
          draftId: `cad-${i}`,
          expectedRevision: 0,
          eventId: `ev-lot-${i}`,
          tipo: "TumorLot@1",
          fontes: [],
          revisao: "CONFIRMADO",
          payload: {
            patientId: pid,
            tumorLotId: lid,
            cid: campoAusente,
            topografia: campoAusente,
            histologia: campoAusente,
            estadiamentos: [],
            finalidadeApac: campoAusente,
            marcos: [],
          },
        },
      ],
    });
  }

  return { db, sessoes, token };
}

describe("Desempenho de leituras e composição no servidor", () => {
  it("lerPaciente e lerLotes consultam o ledger com escopo de patientId em vez de varredura global", () => {
    const { db } = prepararBancoMultiPaciente();

    const originalPrepare = db.prepare.bind(db);
    const sqlQueries: string[] = [];
    db.prepare = ((sql: string) => {
      sqlQueries.push(sql);
      return originalPrepare(sql);
    }) as typeof db.prepare;

    try {
      sqlQueries.length = 0;
      const paciente = lerPaciente(db, "paciente-perf-3");
      expect(paciente).not.toBeNull();
      expect(paciente?.patientId).toBe("paciente-perf-3");

      const queryPaciente = sqlQueries.find((q) => q.includes("FROM clinical_event"));
      expect(queryPaciente).toBeDefined();
      expect(queryPaciente).toContain("WHERE patientId=?");
      expect(queryPaciente).not.toBe("SELECT * FROM clinical_event");

      sqlQueries.length = 0;
      const lotes = lerLotes(db, "paciente-perf-3");
      expect(lotes).toHaveLength(1);
      expect(lotes[0]?.tumorLotId).toBe("lote-perf-3");

      const queryLotes = sqlQueries.find((q) => q.includes("FROM clinical_event"));
      expect(queryLotes).toBeDefined();
      expect(queryLotes).toContain("WHERE patientId=?");
    } finally {
      db.prepare = originalPrepare;
      db.close();
    }
  });

});
