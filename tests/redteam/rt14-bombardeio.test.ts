// RT-14 · Bombardeio CONTROLADO do app (S2/S3). Volume com limite explícito:
// todo teste declara orçamento (TEMPO_MAX_MS/MEM_MAX_MB) e FALHA se estourar.
// Nunca roda sem limite; sempre --no-file-parallelism (máquina com ~1,7 GB livres).
import { describe, expect, it } from "vitest";
import { performance } from "node:perf_hooks";
import { segmentarTranscricao } from "../../src/kernel/extracao/segmenter.js";
import { executarPipelineExtracao } from "../../src/orchestration/pipeline-extracao.js";
import { converterEntradaLocal } from "../../src/leitura/caixa-unica.js";
import { ReviewException } from "../../src/contracts/w10/extracao.js";
import { projetarSnapshot } from "../../src/kernel/projections/snapshot.js";
import { abrirLedger } from "../../src/kernel/ledger/db.js";
import { salvarDraft } from "../../src/kernel/ledger/drafts.js";
import { confirmar, type RegistroConfirmacao } from "../../src/kernel/ledger/writeRouter.js";
import { listarEventos } from "../../src/kernel/ledger/ledger.js";
import { criarGateway, memoriaIdempotencia } from "../../src/kernel/gateway/gateway.js";
import type { ClinicalEvent } from "../../src/contracts/operacao.js";

const TEMPO_MAX_MS = 2_000;
const MEM_MAX_MB = 200;

interface Medicao { ms: number; memMb: number }
function medir(bloco: () => void): Medicao {
  const memAntes = process.memoryUsage().heapUsed;
  const t0 = performance.now();
  bloco();
  const ms = performance.now() - t0;
  const memMb = Math.max(0, (process.memoryUsage().heapUsed - memAntes) / 1024 / 1024);
  return { ms, memMb };
}
const dentroDoOrcamento = (m: Medicao) => {
  expect(m.ms, `tempo ${Math.round(m.ms)} ms > orçamento ${TEMPO_MAX_MS} ms`).toBeLessThanOrEqual(TEMPO_MAX_MS);
  expect(m.memMb, `memória ${Math.round(m.memMb)} MB > orçamento ${MEM_MAX_MB} MB`).toBeLessThanOrEqual(MEM_MAX_MB);
};

const EM = "2030-01-01T12:00:00Z";
const SESSAO = { medicoId: "medico-teste", crm: "CRM-TESTE", emitidaEm: EM, expiraEm: "2099-01-01T00:00:00Z" };

describe("RT-14 · rajada de 1.000 eventos no ledger em memória", () => {
  it("20 operações × 50 eventos gravados, listados e projetados dentro do orçamento", () => {
    const db = abrirLedger(":memory:");
    const m = medir(() => {
      for (let op = 0; op < 20; op++) {
        const registros: RegistroConfirmacao[] = [];
        for (let i = 0; i < 50; i++) {
          const draftId = `d-${op}-${i}`;
          salvarDraft(db, { draftId, patientId: "Paciente Teste 07", sourceId: "s", rawRef: "r",
            payload: { campo: `campo-${i}`, valor: `valor-${op}-${i}` }, diagnostics: [], revision: 0, criadoEm: EM });
          registros.push({ draftId, expectedRevision: 0, eventId: `e-${op}-${i}`, tipo: "FATO",
            payload: { campo: `campo-${i}`, valor: `valor-${op}-${i}` }, fontes: [], revisao: "CONFIRMADO" });
        }
        expect(confirmar(db, {
          operationId: `op-${op}`, patientId: "Paciente Teste 07", tumorLotId: "tumor-07",
          encounterId: "enc-07", reviewDecisionId: `rd-${op}`, sessao: SESSAO, em: EM, registros,
        }).estado).toBe("GRAVADA");
      }
      const eventos = listarEventos(db, "Paciente Teste 07");
      expect(eventos).toHaveLength(1000);
      projetarSnapshot(eventos, "Paciente Teste 07", "tumor-07", "enc-07", "v1");
    });
    dentroDoOrcamento(m);
    db.close();
  });
});

describe("RT-14 · 200 segmentos numa gravação", () => {
  it("segmentação de 200 pacientes numa gravação dentro do orçamento", () => {
    const turnos = Array.from({ length: 200 }, (_, i) => ({
      text: `Boa tarde. Chamo: Paciente Teste ${String(i).padStart(4, "0")}, 50 anos, tumor de mama.`,
      startMs: i * 30_000, endMs: i * 30_000 + 25_000, speaker: "medico",
    }));
    const m = medir(() => {
      const segmentos = segmentarTranscricao({
        recordingId: "grav-rt14", sourceId: "plaud-rt14", sourceType: "plaud", turns: turnos,
      });
      expect(segmentos).toHaveLength(200);
    });
    dentroDoOrcamento(m);
  });
});

describe("RT-14 · 500 fatos no mesmo campo: reconciliação estável e determinística", () => {
  it("500 eventos conflitantes no mesmo campo ⇒ VERMELHO estável com hash idêntico em 2 execuções", () => {
    const evento = (id: string, valor: string): ClinicalEvent => ({
      eventId: id, operationId: `op-${id}`, eventIndex: 0, patientId: "Paciente Teste 07",
      tumorLotId: "tumor-07", encounterId: "enc-07", criadoEm: EM, tipo: "FATO",
      revisao: "CONFIRMADO", criadoPor: { tipo: "SESSAO", id: "medico-teste" }, fontes: [],
      supersedesEventId: null, payload: { reviewDecisionId: `rd-${id}`, data: { campo: "regimen", valor } },
    });
    const eventos = Array.from({ length: 500 }, (_, i) => evento(`e-${i}`, `regimen-${i}`));
    const m = medir(() => {
      const a = projetarSnapshot(eventos, "Paciente Teste 07", "tumor-07", "enc-07", "v1");
      const b = projetarSnapshot([...eventos].reverse(), "Paciente Teste 07", "tumor-07", "enc-07", "v1");
      const campoA = a.campos.regimen;
      const campoB = b.campos.regimen;
      expect(campoA?.estado).toBe("VERMELHO"); // conflito nunca colapsa para o último valor
      expect(campoA?.candidatos?.length).toBe(500);
      expect(a.contentHash).toBe(b.contentHash); // determinístico mesmo com ordem invertida
    });
    dentroDoOrcamento(m);
  });
});

describe("RT-14 · documento de 5 MB e 10.000 caixas de revisão", () => {
  it("documento de 5 MB lido e hasheado dentro do orçamento", () => {
    const texto = ("linha sintética do laudo do Paciente Teste 08. ".repeat(1_000) + "\n").repeat(210);
    expect(texto.length).toBeGreaterThan(5 * 1024 * 1024);
    const m = medir(() => {
      const saida = converterEntradaLocal({ id: "doc-5mb", tipo: "TEXT", conteudo: texto,
        recebidoEm: "2030-01-01T09:00:00-03:00" });
      expect(saida.status).toBe("PRONTO");
      expect(saida.documento.hash).toMatch(/^[0-9a-f]{64}$/u);
    });
    dentroDoOrcamento(m);
  });

  it("10.000 caixas de revisão geradas e validadas dentro do orçamento", () => {
    // Sem saudação: fronteira de confiança 0,5 ⇒ REVISAR_FRONTEIRA + UNLINKED_PATIENT por segmento
    const turnos = Array.from({ length: 5_000 }, (_, i) => ({
      text: `Chamo: Paciente Teste ${String(i).padStart(4, "0")}, 50 anos, tumor de mama.`,
      startMs: i * 1_000, endMs: i * 1_000 + 900, speaker: "medico",
    }));
    const m = medir(() => {
      const estado = executarPipelineExtracao({
        recordingId: "grav-rt14b", sourceId: "plaud-rt14b", sourceType: "plaud",
        rawTranscript: turnos.map((t) => t.text).join("\n"),
      });
      // 5.000 segmentos ⇒ 10.000 exceções (UNLINKED_PATIENT + REVISAR_FRONTEIRA por segmento)
      expect(estado.exceptions.length).toBeGreaterThanOrEqual(10_000);
      let validadas = 0;
      for (const e of estado.exceptions) {
        const parsed = ReviewException.safeParse({
          id: `exc-${validadas}`, kind: e.kind, segmentId: e.segmentId, factIds: [...e.factIds],
          reason: e.reason, sourceIds: [...e.sourceIds],
        });
        if (parsed.success) validadas += 1;
      }
      expect(validadas).toBe(estado.exceptions.length);
    });
    dentroDoOrcamento(m);
  });
});

describe("RT-14 · chamadas concorrentes à mesma chave de idempotência", () => {
  it("8 requisições concorrentes ⇒ exatamente 1 EXECUTADA e 7 REPLAY, dentro do orçamento", async () => {
    let executadas = 0;
    const gateway = criarGateway({
      agora: () => EM, auditar: () => {}, store: memoriaIdempotencia(),
      executores: { IMPRIMIR: { executar: async () => {
        await new Promise((r) => setTimeout(r, 25));
        executadas += 1;
        return { ok: true as const, recibo: "r-rt14" };
      } } },
    });
    const intent = {
      verbo: "IMPRIMIR", objeto: { tipo: "DOCUMENTO", id: "doc-rt14", versao: 1 },
      escopo: { patientId: "Paciente Teste 07", encounterId: "enc-07" },
      destino: null, idempotencyKey: "chave-concorrente-1",
    };
    const t0 = performance.now();
    const resultados = await Promise.all(
      Array.from({ length: 8 }, () => gateway.executar(intent, SESSAO)));
    const ms = performance.now() - t0;
    const decisoes = resultados.map((r) => r.decisao);
    expect(decisoes.filter((d) => d === "EXECUTADA")).toHaveLength(1);
    expect(decisoes.filter((d) => d === "REPLAY")).toHaveLength(7);
    expect(executadas).toBe(1); // uma execução, nunca 8 impressões
    expect(ms, `tempo ${Math.round(ms)} ms > orçamento ${TEMPO_MAX_MS} ms`).toBeLessThanOrEqual(TEMPO_MAX_MS);
  });
});
