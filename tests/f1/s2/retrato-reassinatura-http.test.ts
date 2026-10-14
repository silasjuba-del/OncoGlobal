import { expect, it } from "vitest";
import { abrirLedger } from "../../../src/kernel/ledger/db.js";
import { listarEventos } from "../../../src/kernel/ledger/ledger.js";
import { confirmar, salvarDraft } from "../../../src/kernel/ledger/writeRouter.js";
import { criarGateway, memoriaIdempotencia } from "../../../src/kernel/gateway/gateway.js";
import { criarServidorLocal } from "../../../src/server/http.js";
import { criarGerenciadorSessao } from "../../../src/server/sessao.js";
import type { Retrato } from "../../../src/contracts/f1/retrato.js";

it("HTTP: nova assinatura no dia seguinte preserva fatos da consulta do dia 05 e não incorpora o encontro posterior", async () => {
  const db = abrirLedger(":memory:");
  let instante = "2026-10-12T12:00:00-03:00";
  const agora = () => instante;
  const senha = "senha-sintetica-reassinatura-s2";
  const sessoes = criarGerenciadorSessao({ medicoId: "medico-sintetico-s2", crm: "CRM-SINTETICO", senha, duracaoMs: 60_000, agora });
  const gateway = criarGateway({ agora, auditar: () => {}, store: memoriaIdempotencia(), executores: {} });
  const server = criarServidorLocal({ db, sessoes, gateway, agora, settings: null, log: () => {} });
  const ctx = { patientId: "paciente-sintetico-s2", encounterId: "e0-dia05", tumorLotId: null };
  try {
    await new Promise<void>((resolve, reject) => {
      if (server.listening) resolve();
      else { server.once("listening", resolve); server.once("error", reject); }
    });
    const endereco = server.address();
    if (!endereco || typeof endereco === "string") throw new Error("PORTA_AUSENTE");
    let token = "";
    const post = async (path: string, body: unknown) => {
      const r = await fetch(`http://127.0.0.1:${endereco.port}${path}`, { method: "POST",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify(body) });
      return { status: r.status, data: await r.json() as Record<string, any> };
    };
    const login = async () => {
      const r = await post("/login", { senha }); expect(r.status).toBe(200); token = r.data.token;
    };
    await login();
    const gravar = (eventId: string, tipo: string, payload: unknown, encounterId = ctx.encounterId) => {
      const draftId = `draft-${eventId}`;
      salvarDraft(db, { draftId, patientId: ctx.patientId, sourceId: `fonte-${eventId}`, rawRef: "sintetico", payload: {}, diagnostics: [], revision: 0, criadoEm: instante });
      expect(confirmar(db, { ...ctx, encounterId, operationId: `op-${eventId}`, reviewDecisionId: `review-${eventId}`,
        sessao: sessoes.obter(token)!, em: instante,
        registros: [{ draftId, expectedRevision: 0, eventId, tipo, payload,
          fontes: tipo === "FATO" ? [{ sourceId: `fonte-${eventId}`, classe: "DOCUMENT", localizador: "página sintética", dataClinica: "2026-10-05", dataCaptura: instante, versao: "1", contentHash: `hash-${eventId}` }] : [],
          revisao: "CONFIRMADO" }] }).estado).toBe("GRAVADA");
    };
    gravar("cadastro-s2", "Paciente", { patientId: ctx.patientId, identificadores: [], nome: "Pessoa sintética S2",
      nascimento: null, sexoCadastral: "NAO_INFORMADO", divergencia: false });
    gravar("agenda-e0", "AgendaEntry", { patientId: ctx.patientId, encounterId: ctx.encounterId, data: "2026-10-05", horario: "09:00" });
    gravar("agenda-e1", "AgendaEntry", { patientId: ctx.patientId, encounterId: "e1-dia13", data: "2026-10-13", horario: "09:00" }, "e1-dia13");
    gravar("hb-e0", "FATO", { campo: "extracao.lab:HB", domain: "lab", dataClinica: "2026-10-05", valor: { marker: "HB", value: 8.2, unit: "g/dL" } });
    gravar("hb-e0-posterior", "FATO", { campo: "extracao.lab:HB", domain: "lab", dataClinica: "2026-10-10", valor: { marker: "HB", value: 9, unit: "g/dL" } });
    gravar("hb-e1-retrodatada", "FATO", { campo: "extracao.lab:HB", domain: "lab", dataClinica: "2026-10-05", valor: { marker: "HB", value: 10, unit: "g/dL" } }, "e1-dia13");
    const carregar = async () => {
      const r = await post("/consulta/carregar", ctx); expect(r.status).toBe(200); return r.data.retrato as Retrato;
    };
    const assinar = async (chave: string, dias: number) => {
      const plano = { acoesMarcadas: [], receitasMarcadas: [], apac: { cid: "", sigtap: "", finalidade: "", competencia: "", estado: "PENDENTE", pendencias: [], emitir: false },
        retorno: { dias, examesAntesDoRetorno: [] }, solicitacoes: { laboratorio: [], imagem: [] } };
      const prep = await post("/consulta/flash/preparar", { ...ctx, plano, idempotencyKey: `preparar-${chave}` });
      expect(prep.status).toBe(200);
      expect((await post("/consulta/bundle", { ...ctx, draftIds: prep.data.registros.map((r: { id: string }) => r.id) })).status).toBe(200);
      const r = await post("/consulta/confirmar", { ...ctx, bloco: "TUDO", registros: prep.data.registros,
        documentosExibidos: prep.data.documentos.map((d: { documentId: string; documentVersion: number }) => ({ documentId: d.documentId, documentVersion: d.documentVersion })),
        reconhecerAlertas: [], idempotencyKey: `assinar-${chave}` });
      expect(r).toMatchObject({ status: 200, data: { codigo: "GRAVADA" } });
    };
    const antes = await carregar();
    expect(antes.fatos.some(f => f.ref.eventId === "hb-e0")).toBe(true);
    expect(antes.fatos.some(f => f.ref.eventId === "hb-e1-retrodatada")).toBe(false);
    await assinar("dia12", 14);
    expect((await carregar()).fatos.some(f => f.ref.eventId === "hb-e0-posterior")).toBe(false);
    const assinadosAntes = listarEventos(db, ctx.patientId).filter(e => e.revisao === "ASSINADO");
    expect(assinadosAntes.length).toBeGreaterThan(0);
    instante = "2026-10-13T12:00:00-03:00";
    await login(); await carregar();
    await assinar("dia13", 21);
    const depois = await carregar();
    const marcos = listarEventos(db, ctx.patientId).filter(e => e.tipo === "ConsultaConfirmada");
    expect(marcos.map(e => (e.payload as { data: { dataClinica: string } }).data.dataClinica)).toEqual(["2026-10-12", "2026-10-13"]);
    expect(depois.fatos.find(f => f.ref.eventId === "hb-e0")).toEqual(antes.fatos.find(f => f.ref.eventId === "hb-e0"));
    expect(depois.fatos.some(f => f.ref.eventId === "hb-e1-retrodatada")).toBe(false);
    expect(depois.fatos.some(f => f.ref.eventId === "hb-e0-posterior")).toBe(false);
    expect(depois.integridade.some(p => p.motivo === "DATA_ENCONTRO_AMBIGUA")).toBe(false);
    expect(depois.geradoEm).toBe(instante);
    for (const documento of assinadosAntes) expect(listarEventos(db, ctx.patientId).find(e => e.eventId === documento.eventId)).toEqual(documento);
  } finally {
    await new Promise<void>(resolve => server.close(() => resolve())); db.close();
  }
}, 30_000);
