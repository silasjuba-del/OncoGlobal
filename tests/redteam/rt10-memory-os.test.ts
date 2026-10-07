// RT-10 · MEMORY_OS (S0) — provas de DEFESA do ledger e das projeções.
// Evento é imutável após gravado; reuso de chave com payload diferente é NEGADO; conflito
// nunca some; ausente é PENDENTE; proposta nunca vira valor; recomputação é determinística.
import { describe, expect, it } from "vitest";
import { abrirLedger } from "../../src/kernel/ledger/db.js";
import { gravarOperacao, hashPayload, listarEventos, resultadoExistente } from "../../src/kernel/ledger/ledger.js";
import { salvarDraft } from "../../src/kernel/ledger/drafts.js";
import { confirmar } from "../../src/kernel/ledger/writeRouter.js";
import { eventosVigentes, projetarSnapshot } from "../../src/kernel/projections/snapshot.js";
import { criarGateway, memoriaIdempotencia } from "../../src/kernel/gateway/gateway.js";
import { sqliteIdempotencia } from "../../src/kernel/ledger/idempotencia.js";
import { ClinicalEvent, type ClinicalEvent as ClinicalEventT } from "../../src/contracts/operacao.js";

const em = "2030-01-01T12:00:00Z";
const sessao = { medicoId: "medico-teste", crm: "CRM-TESTE", emitidaEm: em, expiraEm: "2030-01-01T13:00:00Z" };

const evento = (
  id: string, campo: string, valor: unknown, criadoEm = em,
  supersedesEventId: string | null = null,
): ClinicalEventT => ({
  eventId: id, operationId: `op-${id}`, eventIndex: 0, patientId: "Paciente Teste 07",
  tumorLotId: "tumor-07", encounterId: "enc-07", criadoEm, tipo: "FATO",
  revisao: "CONFIRMADO", criadoPor: { tipo: "SESSAO", id: "medico-teste" }, fontes: [],
  supersedesEventId,
  payload: { reviewDecisionId: `rd-${id}`, data: { campo, valor } },
});

const projetar = (eventos: readonly ClinicalEvent[]) =>
  projetarSnapshot(eventos, "Paciente Teste 07", "tumor-07", "enc-07", "v1");

describe("RT-10 · evento assinado é imutável", () => {
  it("UPDATE e DELETE em clinical_event são abortados por trigger (append-only)", () => {
    const db = abrirLedger(":memory:");
    const ev = { ...evento("ev-1", "TNM", "cT2N0M0"), operationId: "op-1", eventIndex: 0 };
    const op = { operationId: "op-1", payloadHash: hashPayload([ClinicalEvent.parse(ev)]), resultRef: null, criadoEm: em } as unknown as Parameters<typeof gravarOperacao>[1];
    expect(gravarOperacao(db, op, [ev]).estado).toBe("GRAVADA");
    expect(() => db.prepare("UPDATE clinical_event SET payload = '{}'").run())
      .toThrow(/append-only/iu);
    expect(() => db.prepare("DELETE FROM clinical_event").run())
      .toThrow(/append-only/iu);
    db.close();
  });

  it("mesma operação com payload DIFERENTE ⇒ NEGADA + auditoria OPERATION_HASH_CONFLICT", () => {
    const db = abrirLedger(":memory:");
    const ev1 = { ...evento("ev-1", "TNM", "cT2N0M0"), operationId: "op-1", eventIndex: 0 };
    const ev2 = { ...evento("ev-1", "TNM", "cT3N1M0"), operationId: "op-1", eventIndex: 0 };
    const op1 = { operationId: "op-1", payloadHash: hashPayload([ClinicalEvent.parse(ev1)]), resultRef: null, criadoEm: em } as unknown as Parameters<typeof gravarOperacao>[1];
    gravarOperacao(db, op1, [ev1]);
    const op2 = { ...op1, payloadHash: hashPayload(ev2) };
    const gravacao = resultadoExistente(db, op2);
    expect(gravacao).toMatchObject({ estado: "NEGADA", motivo: "OPERATION_HASH_CONFLICT" });
    db.close();
  });

  it("evento não confirmado (RAW/REVISAR) nunca entra no ledger", () => {
    const db = abrirLedger(":memory:");
    const raw = { ...evento("ev-raw", "TNM", "cT2N0M0"), operationId: "op-raw", eventIndex: 0, revisao: "RAW" as const };
    const op = { operationId: "op-raw", payloadHash: hashPayload([ClinicalEvent.parse(raw)]), resultRef: null, criadoEm: em } as unknown as Parameters<typeof gravarOperacao>[1];
    expect(gravarOperacao(db, op, [raw])).toMatchObject({ estado: "NEGADA", motivo: "REVISAO_NAO_CONFIRMADA" });
    expect(listarEventos(db, "Paciente Teste 07")).toEqual([]);
    db.close();
  });

  it("confirmação humana é obrigatória: sem reviewDecisionId não grava", () => {
    const db = abrirLedger(":memory:");
    salvarDraft(db, { draftId: "d1", patientId: "Paciente Teste 07", sourceId: "s", rawRef: "r",
      payload: {}, diagnostics: [], revision: 0, criadoEm: em });
    expect(() => confirmar(db, {
      operationId: "op-1", patientId: "Paciente Teste 07", tumorLotId: "tumor-07",
      encounterId: "enc-07", reviewDecisionId: "", sessao, em,
      registros: [{ draftId: "d1", expectedRevision: 0, eventId: "e1", tipo: "FATO",
        payload: {}, fontes: [], revisao: "CONFIRMADO" as const }],
    })).toThrow(/REVIEW_DECISION_REQUIRED/);
    db.close();
  });
});

describe("RT-10 · projeção: conflito nunca some; ausente nunca vira verde", () => {
  it("dois valores divergentes no mesmo campo ⇒ VERMELHO com AMBOS os candidatos preservados", () => {
    const saida = projetar([
      evento("e1", "historicalMetastaticDisease", true),
      evento("e2", "historicalMetastaticDisease", false, "2030-02-01T12:00:00Z"),
    ]);
    const campo = saida.campos.historicalMetastaticDisease;
    expect(campo?.estado).toBe("VERMELHO");
    expect(campo?.valor).toBeNull();
    expect(campo?.candidatos).toHaveLength(2);
  });

  it("nova fonte concordante NÃO faz o conflito sumir", () => {
    const eventos = [
      evento("e1", "regimen", "carbo-taxol"),
      evento("e2", "regimen", "GC", "2030-02-01T12:00:00Z"),
      evento("e3", "regimen", "carbo-taxol", "2030-03-01T12:00:00Z"),
    ];
    const campo = projetar(eventos).campos.regimen;
    expect(campo?.estado).toBe("VERMELHO");
    expect(campo?.candidatos?.length).toBeGreaterThanOrEqual(2);
  });

  it("valor ausente (null) é PENDENTE, nunca VERDE", () => {
    const campo = projetar([evento("e1", "TNM", null)]).campos.TNM;
    expect(campo?.estado).toBe("PENDENTE");
    expect(campo?.valor).toBeNull();
  });

  it("proposta nunca substitui valor (A08): fica em .proposta com sourceId", () => {
    const saida = projetarSnapshot([evento("e1", "TNM", "cT2N0M0")],
      "Paciente Teste 07", "tumor-07", "enc-07", "v1",
      [{ campo: "TNM", valor: "cT3N1M0", sourceId: "doc-novo" }]);
    const campo = saida.campos.TNM;
    expect(campo?.valor).toBe("cT2N0M0");
    expect(campo?.proposta).toEqual({ valor: "cT3N1M0", sourceId: "doc-novo" });
  });

  it("recomputação é determinística: mesmo input ⇒ mesmo contentHash", () => {
    const eventos = [evento("e1", "TNM", "cT2N0M0"), evento("e2", "regimen", "GC", "2030-02-01T12:00:00Z")];
    expect(projetar(eventos).contentHash).toBe(projetar([...eventos].reverse()).contentHash);
  });

  it("eventosVigentes remove o superseded e mantém só CONFIRMADO/ASSINADO", () => {
    const velho = evento("e1", "TNM", "cT2N0M0");
    const novo = { ...evento("e2", "TNM", "cT3N1M0", "2030-02-01T12:00:00Z"), supersedesEventId: "e1" };
    const vigentes = eventosVigentes([velho, novo]);
    expect(vigentes.map((e) => e.eventId)).toEqual(["e2"]);
  });
});

describe("RT-10 · idempotência: mesma chave com payload diferente nunca reaproveita resultado", () => {
  const intent = (chave: string, alvo: string) => ({
    verbo: "IMPRIMIR", idempotencyKey: chave,
    escopo: { patientId: "Paciente Teste 07", encounterId: "enc-07" },
    objeto: { tipo: "DOCUMENTO", id: alvo, versao: 1 }, destino: null,
  });

  it("gateway: mesma chave + payload diferente ⇒ CHAVE_REUSADA_PAYLOAD_DIFERENTE", async () => {
    const gateway = criarGateway({
      agora: () => em, auditar: () => {}, store: memoriaIdempotencia(),
      executores: { IMPRIMIR: { executar: async () => ({ ok: true as const, recibo: "r" }) } },
    });
    expect((await gateway.executar(intent("chave-rt10-a", "doc-a"), sessao)).decisao).toBe("EXECUTADA");
    expect((await gateway.executar(intent("chave-rt10-a", "doc-a"), sessao)).decisao).toBe("REPLAY");
    expect((await gateway.executar(intent("chave-rt10-a", "doc-b"), sessao)).motivoCodigo)
      .toBe("CHAVE_REUSADA_PAYLOAD_DIFERENTE");
  });

  it("sqliteIdempotencia: set sem reserva prévia lança IDEMPOTENCIA_SEM_RESERVA", () => {
    const db = abrirLedger(":memory:");
    const store = sqliteIdempotencia(db);
    expect(() => store.set("k-x", {
      payloadHash: "h", resultado: { decisao: "EXECUTADA", motivoCodigo: "OK", recibo: "r" },
    }, em)).toThrow(/IDEMPOTENCIA_SEM_RESERVA/);
    db.close();
  });
});
