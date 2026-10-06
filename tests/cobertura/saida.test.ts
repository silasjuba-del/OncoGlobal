// KIMI-19 · CP-001: o cliente PEDE, o ledger PROVA — saída externa autorizada via HTTP real.
// Confinado a loopback (127.0.0.1), ledger ":memory:" e dados 100% sintéticos.
// Nenhum efeito real: os executores são portas fake que só contam chamadas.
import { expect, it } from "vitest";
import type { DatabaseSync } from "node:sqlite";
import { ambienteHttp } from "../server/http-fixture.js";
import { salvarDraft } from "../../src/kernel/ledger/drafts.js";
import { confirmar } from "../../src/kernel/ledger/writeRouter.js";

const PACIENTE = "p1", ENCONTRO = "e1";

/** Assina uma versão do documento pelo mesmo caminho do servidor (draft → confirmar). */
function assinarVersao(db: DatabaseSync, o: { documentId: string; versao: number;
  supersedesEventId?: string | null }): string {
  const em = "2026-10-05T12:00:00.000Z";
  const eventId = `ev-assina-${o.documentId}-${o.versao}`;
  const draftId = `draft-${o.documentId}-${o.versao}`;
  salvarDraft(db, { draftId, patientId: PACIENTE, sourceId: "sintetico", rawRef: "opaco", diagnostics: [],
    revision: 0, criadoEm: em, payload: { documentId: o.documentId, documentVersion: o.versao } });
  confirmar(db, { operationId: `op-assina-${o.documentId}-${o.versao}`, patientId: PACIENTE, tumorLotId: null,
    encounterId: ENCONTRO, reviewDecisionId: `revisao-${o.documentId}-${o.versao}`, em,
    sessao: { medicoId: "medico-teste", crm: "CRM-TESTE", emitidaEm: em, expiraEm: "2099-01-01T00:00:00.000Z" },
    registros: [{ draftId, expectedRevision: 0, eventId, tipo: "DOCUMENTO",
      payload: { data: { texto: `documento sintético v${o.versao}` }, signature: { documentId: o.documentId,
        documentVersion: o.versao, documentHash: "0".repeat(64),
        reviewDecisionId: `revisao-${o.documentId}-${o.versao}`, serverActorId: "medico-teste" } },
      fontes: [], revisao: "ASSINADO", supersedesEventId: o.supersedesEventId ?? null }] });
  return eventId;
}

const acao = (verbo: string, id: string, versao = 1, destino: string | null = null, chave?: string) => ({
  verbo, objeto: { tipo: "DOCUMENTO", id, versao },
  escopo: { patientId: PACIENTE, encounterId: ENCONTRO },
  destino, idempotencyKey: chave ?? `k-${verbo}-${id}-v${versao}`,
});

async function post(f: Awaited<ReturnType<typeof ambienteHttp>>, payload: unknown) {
  const r = await f.request("/acao", "POST", JSON.stringify(payload), f.token, "application/json");
  return { status: r.status, body: JSON.parse(r.body) as { codigo?: string; decisao?: string; motivoCodigo?: string } };
}

it("KIMI-19 · artefato ASSINADO imprime 1×; replay com a mesma chave devolve REPLAY sem novo efeito", async () => {
  const f = await ambienteHttp();
  try {
    assinarVersao(f.db, { documentId: "doc-a", versao: 1 });
    const pedido = acao("IMPRIMIR", "doc-a", 1);
    const r1 = await post(f, pedido);
    expect(r1.status).toBe(200);
    expect(r1.body.decisao).toBe("EXECUTADA");
    expect(r1.body.motivoCodigo).toBe("OK");
    expect(f.efeitos()).toBe(1);
    // Mesma chave + mesmo payload: o ledger responde o resultado gravado, não reexecuta.
    const r2 = await post(f, pedido);
    expect(r2.status).toBe(200);
    expect(r2.body.decisao).toBe("REPLAY");
    expect(f.efeitos()).toBe(1); // exatamente UM efeito, mesmo após o reenvio
  } finally { await f.close(); }
});

it("KIMI-19 · documento SUBSTITUÍDO: a versão antiga nunca sai; só a vigente passa", async () => {
  const f = await ambienteHttp();
  try {
    const eventoV1 = assinarVersao(f.db, { documentId: "doc-b", versao: 1 });
    // v2 assinada e confirmada com supersedes → v1 deixa de ser vigente no ledger.
    assinarVersao(f.db, { documentId: "doc-b", versao: 2, supersedesEventId: eventoV1 });
    const antiga = await post(f, acao("IMPRIMIR", "doc-b", 1, null, "k-doc-b-antiga"));
    expect(antiga.status).toBe(409);
    expect(antiga.body.codigo).toBe("ARTEFATO_NAO_ASSINADO");
    expect(f.efeitos()).toBe(0);
    const vigente = await post(f, acao("IMPRIMIR", "doc-b", 2, null, "k-doc-b-vigente"));
    expect(vigente.status).toBe(200);
    expect(vigente.body.decisao).toBe("EXECUTADA");
    expect(f.efeitos()).toBe(1);
  } finally { await f.close(); }
});

it("KIMI-19 · versão nunca assinada e escopo de OUTRO paciente ⇒ recusado (não rouba assinatura alheia)", async () => {
  const f = await ambienteHttp();
  try {
    assinarVersao(f.db, { documentId: "doc-c", versao: 1 });
    // Versão 2 nunca existiu: imprimir "o futuro" é recusado.
    const futura = await post(f, acao("IMPRIMIR", "doc-c", 2, null, "k-doc-c-futura"));
    expect(futura.status).toBe(409);
    expect(futura.body.codigo).toBe("ARTEFATO_NAO_ASSINADO");
    // Mesmo documentId assinado, mas escopo de outro paciente: o ledger procura no paciente do escopo.
    const alheio = await post(f, { ...acao("IMPRIMIR", "doc-c", 1, null, "k-doc-c-alheio"),
      escopo: { patientId: "p2", encounterId: ENCONTRO } });
    expect(alheio.status).toBe(409);
    expect(alheio.body.codigo).toBe("ARTEFATO_NAO_ASSINADO");
    expect(f.efeitos()).toBe(0);
  } finally { await f.close(); }
});

it("KIMI-19 · G-02: canais externos nunca habilitados — WhatsApp/e-mail/agendar recusados mesmo com artefato assinado", async () => {
  const f = await ambienteHttp();
  try {
    assinarVersao(f.db, { documentId: "doc-d", versao: 1 });
    for (const verbo of ["ENVIAR_WHATSAPP", "ENVIAR_EMAIL", "AGENDAR"] as const) {
      const r = await post(f, acao(verbo, "doc-d", 1, null, `k-${verbo}-doc-d`));
      expect(r.status, verbo).toBe(409);
      expect(r.body.codigo, verbo).toBe("CANAL_EXTERNO_NAO_HABILITADO");
    }
    expect(f.efeitos()).toBe(0);
  } finally { await f.close(); }
});

it("KIMI-19 · destino livre é recusado antes de qualquer efeito (DESTINO_NAO_PERMITIDO)", async () => {
  const f = await ambienteHttp();
  try {
    assinarVersao(f.db, { documentId: "doc-e", versao: 1 });
    const r = await post(f, acao("IMPRIMIR", "doc-e", 1, "impressora-do-hall", "k-doc-e-destino"));
    expect(r.status).toBe(409);
    expect(r.body.codigo).toBe("DESTINO_NAO_PERMITIDO");
    expect(f.efeitos()).toBe(0);
  } finally { await f.close(); }
});

it("KIMI-19 · EXPORTAR_APAC: passa pelo gate de assinatura e trava na contenção CP-001b", async () => {
  const f = await ambienteHttp();
  try {
    assinarVersao(f.db, { documentId: "doc-f", versao: 1 });
    // O documento ESTÁ assinado e vigente — a recusa não é falta de assinatura,
    // é a validação de emissão APAC ainda não persistida no ledger.
    const r = await post(f, acao("EXPORTAR_APAC", "doc-f", 1, null, "k-doc-f-apac"));
    expect(r.status).toBe(409);
    expect(r.body.codigo).toBe("VALIDACAO_APAC_NAO_PERSISTIDA");
    expect(f.efeitos()).toBe(0);
  } finally { await f.close(); }
});

it("KIMI-19 · BACKUP_LOCAL é autorizado, mas sem executor ligado o gateway nega VERBO_SEM_EXECUTOR (porta F0 desconectada)", async () => {
  const f = await ambienteHttp();
  try {
    // BACKUP não exige artefato assinado (objeto BACKUP, destino nulo).
    const r = await post(f, { verbo: "BACKUP_LOCAL", objeto: { tipo: "BACKUP", id: "ledger-local", versao: 1 },
      escopo: { patientId: PACIENTE, encounterId: ENCONTRO }, destino: null, idempotencyKey: "k-backup-local" });
    expect(r.status).toBe(409);
    expect(r.body.codigo ?? r.body.motivoCodigo).toBe("VERBO_SEM_EXECUTOR");
    expect(f.efeitos()).toBe(0);
  } finally { await f.close(); }
});
