import { describe, expect, it } from "vitest";
import { criarGateway, memoriaIdempotencia } from "../../src/kernel/gateway/gateway.js";
import { cumulativos } from "../../src/kernel/projections/cumulativos.js";
import { projetarSnapshot } from "../../src/kernel/projections/snapshot.js";
import { TreatmentAdministration } from "../../src/contracts/clinico.js";
import { administracaoCompleta, eventoQt } from "./fixtures.js";
import { Readable } from "node:stream";
import type { IncomingMessage, ServerResponse } from "node:http";
import { abrirLedger } from "../../src/kernel/ledger/db.js";
import { salvarDraft } from "../../src/kernel/ledger/drafts.js";
import { criarGerenciadorSessao } from "../../src/server/sessao.js";
import { rotear } from "../../src/server/rotas.js";

const agora = "2026-10-05T10:00:00Z";
const sessao = { medicoId: "m-sintetico", crm: "CRM-TESTE", emitidaEm: "2026-10-05T09:00:00Z", expiraEm: "2026-10-05T11:00:00Z" };
const intent = { verbo: "IMPRIMIR", objeto: { tipo: "DOCUMENTO", id: "doc-sintetico", versao: 1 }, escopo: { patientId: "p", encounterId: "e" }, destino: null, idempotencyKey: "acao-sintetica-001" };
const base = eventoQt("a", "2026-10-01T10:00:00-03:00");
const fato = (id: string, valor: unknown) => ({ ...base, eventId: id, tipo: "FATO", payload: { reviewDecisionId: "r", data: { campo: "campo-sintetico", valor } } });
function snapshot(eventos: Parameters<typeof projetarSnapshot>[0], propostas: Parameters<typeof projetarSnapshot>[5] = []) {
  return projetarSnapshot(eventos, base.patientId, base.tumorLotId, base.encounterId, "teste", propostas);
}
function administracao(id: string, mg: number) {
  const { patientId: _p, episodioId: _e, unidadeEfetiva: _u, ...data } = administracaoCompleta("mesma-admin", mg);
  TreatmentAdministration.parse(data);
  return { ...base, eventId: id, tipo: "TreatmentAdministration", payload: { reviewDecisionId: "r", data } };
}

describe("Achados adversariais fora da propriedade W3 - expectativas de seguranca", () => {
  it("A01 gateway deve executar uma unica vez em chamadas concorrentes", async () => {
    let chamadas = 0;
    let liberar!: () => void;
    const barreira = new Promise<void>((resolve) => { liberar = resolve; });
    const gateway = criarGateway({ agora: () => agora, auditar: () => {}, store: memoriaIdempotencia(), executores: {
      IMPRIMIR: { executar: async () => { chamadas++; await barreira; return { ok: true, recibo: "r" }; } },
    } });
    const a = gateway.executar(intent, sessao), b = gateway.executar(intent, sessao);
    liberar(); await Promise.all([a, b]);
    expect(chamadas).toBe(1);
  });
  it("A02 gateway nao deve repetir efeito quando executor lanca erro apos executar", async () => {
    let chamadas = 0;
    const gateway = criarGateway({ agora: () => agora, auditar: () => {}, store: memoriaIdempotencia(), executores: {
      IMPRIMIR: { executar: async () => { chamadas++; throw new Error("falha-sintetica-apos-efeito"); } },
    } });
    await gateway.executar(intent, sessao).catch(() => {});
    await gateway.executar(intent, sessao).catch(() => {});
    expect(chamadas).toBe(1);
  });
  it("A03 sessao expirada deve ser comparada por instante, incluindo offset", async () => {
    const gateway = criarGateway({ agora: () => agora, auditar: () => {}, store: memoriaIdempotencia(), executores: {
      IMPRIMIR: { executar: async () => ({ ok: true, recibo: "r" }) },
    } });
    const r = await gateway.executar(intent, { ...sessao, expiraEm: "2026-10-05T12:30:00+03:00" });
    expect(r.decisao).toBe("NEGADA");
  });
  it("A04 projecao cumulativa deve deduplicar adminId", () => {
    expect(cumulativos([administracao("e1", 50), administracao("e2", 50)])[0]?.quantidadeEfetivaMg).toBe(50);
  });
  it("A05 projecao cumulativa deve excluir administracao substituida", () => {
    const anterior = administracao("e1", 50), correcao = { ...administracao("e2", 30), supersedesEventId: "e1" };
    expect(cumulativos([anterior, correcao])[0]?.quantidadeEfetivaMg).toBe(30);
  });
  it("A06 snapshot nao deve chamar RAW de CONFIRMED", () => {
    const r = snapshot([{ ...fato("e1", 3), revisao: "RAW" }]);
    expect(r.campos["campo-sintetico"]).toBeUndefined();
  });
  it("A07 valor ausente deve ser PENDENTE no snapshot", () => {
    expect(snapshot([fato("e1", null)]).campos["campo-sintetico"]?.estado).toBe("PENDENTE");
  });
  it("A08 proposta CURRENT nao deve apagar conflito confirmado", () => {
    const r = snapshot([fato("e1", 10), fato("e2", 20)], [{ campo: "campo-sintetico", valor: 15, sourceId: "s" }]);
    expect(r.campos["campo-sintetico"]?.estado).toBe("VERMELHO");
  });
  it("A13 servidor nao deve assinar conteudo alterado apos exibicao do bundle", async () => {
    const db = abrirLedger(":memory:");
    try {
      const sessoes = criarGerenciadorSessao({ medicoId: "m", crm: "CRM-TESTE", senha: "senha-sintetica-teste", duracaoMs: 60000, agora: () => agora });
      const token = sessoes.login("senha-sintetica-teste")!.token;
      const draft = { draftId: "d", patientId: "p", sourceId: "s", rawRef: "opaco", diagnostics: [], revision: 0, criadoEm: agora,
        payload: { documentId: "doc", documentVersion: 1, documentHash: "hash-exibido", texto: "conteudo-exibido" } };
      salvarDraft(db, draft);
      sessoes.registrarBundleExibido(token, { patientId: "p", encounterId: "e" }, [{ documentId: "doc", documentVersion: 1 }]);
      salvarDraft(db, { ...draft, revision: 1, payload: { ...draft.payload, documentHash: "hash-alterado", texto: "conteudo-nao-exibido" } });
      const comando = { patientId: "p", tumorLotId: "t", encounterId: "e", bloco: "TUDO", registros: [{ id: "d", expectedRevision: 1 }],
        documentosExibidos: [{ documentId: "doc", documentVersion: 1 }], reconhecerAlertas: [], idempotencyKey: "operacao-auditoria-13" };
      const req = Object.assign(Readable.from([JSON.stringify(comando)]), { method: "POST", url: "/consulta/confirmar", headers: { authorization: `Bearer ${token}` } }) as unknown as IncomingMessage;
      let status = 0;
      const res = { writeHead(s: number) { status = s; return this; }, end() {} } as unknown as ServerResponse;
      const gateway = criarGateway({ agora: () => agora, auditar: () => {}, store: memoriaIdempotencia(), executores: {} });
      await rotear({ db, sessoes, gateway, agora: () => agora, log: () => {} }, req, res);
      expect(status).toBe(409);
    } finally { db.close(); }
  });
});
