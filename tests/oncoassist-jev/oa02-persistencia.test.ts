import { createHash } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import { afterEach, describe, expect, it } from "vitest";
import { HistoricoOncoassist } from "../../src/contracts/api/oncoassist.js";
import { CONTEXTO, iniciarProcesso } from "./oa02-reabertura-worker.js";

const CLASSIFICAR = "/consulta/oncoassist/classificar-fonte";
const HISTORICO = "/consulta/oncoassist/historico";
const pedido = (operationId = "op-sintetica-1") => ({ ...CONTEXTO, draftId: "fonte-1", operationId });
const ativos: Awaited<ReturnType<typeof iniciarProcesso>>[] = [];
function alterarPoliticaCapturada(banco: string, politicaVersao: string) {
  const db = new DatabaseSync(banco);
  try {
    const drafts = db.prepare("SELECT draftId, payload FROM draft_envelope").all() as Array<{ draftId: string; payload: string }>;
    const draft = drafts.find(item => JSON.parse(item.payload).kind === "JEV_CLASSIFICACAO_RASCUNHO");
    if (!draft) throw new Error("OA02_RASCUNHO_AUSENTE");
    const payload = JSON.parse(draft.payload);
    payload.auditoria.politicaVersao = politicaVersao;
    db.prepare("UPDATE draft_envelope SET payload=? WHERE draftId=?").run(JSON.stringify(payload), draft.draftId);
  } finally { db.close(); }
}
async function ambiente(opcoes: Parameters<typeof iniciarProcesso>[0] = {}) {
  const app = await iniciarProcesso(opcoes); ativos.push(app); return app;
}
afterEach(async () => { for (const app of ativos.splice(0)) await app.parar(); });

describe("OA02 · HTTP e SQLite durável com Jev sintético em processos isolados", () => {
  it("persiste proveniência completa, replay exato e nova revisão sem criar clinical_event", async () => {
    const app = await ambiente();
    const primeiro = await app.post(CLASSIFICAR, pedido());
    expect(primeiro.status).toBe(200);
    expect(primeiro.body).toMatchObject({ status: "PROPOSTA", categoria: "LAB", modelo: "jev-1.0",
      revisaoObrigatoria: true, auditoria: { ...CONTEXTO, draftId: "fonte-1", segmentId: "segmento-1",
        sourceId: "documento-1", fonteRevision: 0, propostaRevision: 1, operationId: "op-sintetica-1",
        politicaVersao: "OA02-JEV-MARCADORES-v1", mecanismo: "JEV_MARCADORES_DOCUMENTAIS", provedor: null,
        capturadoPor: { tipo: "SESSAO", id: "medico-oa02" }, capturadoEm: "2026-10-19T12:00:00.000Z" } });
    expect(primeiro.body.auditoria.fonteSha256).toBe(createHash("sha256").update("Hemograma sintético").digest("hex"));
    expect((await app.post(CLASSIFICAR, pedido())).texto).toBe(primeiro.texto);
    const segundo = await app.post(CLASSIFICAR, pedido("op-sintetica-2"));
    expect(segundo.body.auditoria.propostaRevision).toBe(2);
    expect(segundo.body.auditoria.propostaId).not.toBe(primeiro.body.auditoria.propostaId);
    const historico = await app.post(HISTORICO, CONTEXTO);
    expect(historico.body.propostas.map((p: any) => p.resposta)).toEqual([segundo.body, primeiro.body]);
    expect(historico.body.propostas.map((p: any) => p.validadePolitica)).toEqual(["MESMA_VERSAO", "MESMA_VERSAO"]);
    const stats = await app.comando("stats");
    expect(stats.chamadas).toBe(2);
    expect(stats.clinicalEvents).toBe(app.baseline);
    expect(stats.transacoesNoTransporte).toEqual([false, false]);
    expect(stats.marcadores.every((s: string) => s.startsWith("Marcadores documentais (vocabulário fechado):"))).toBe(true);
    expect(JSON.stringify(stats.logs)).not.toContain("Hemograma");
    expect(JSON.stringify(stats.drafts.filter((d: any) => d.payload.kind?.startsWith("JEV_")))).not.toContain("Hemograma sintético");
  }, 30_000);

  it("compara a política capturada na leitura do histórico sem alterar o registro nem chamar Jev", async () => {
    const app = await ambiente();
    const original = await app.post(CLASSIFICAR, pedido());
    alterarPoliticaCapturada(app.banco, "OA02-JEV-MARCADORES-v0");
    const historico = await app.post(HISTORICO, CONTEXTO);
    expect(historico.body.propostas[0]).toMatchObject({
      validade: "ATUAL", validadePolitica: "VERSAO_DIFERENTE", resposta: original.body,
      auditoria: { politicaVersao: "OA02-JEV-MARCADORES-v0", mecanismo: "JEV_MARCADORES_DOCUMENTAIS" },
    });
    expect(await app.comando("stats")).toMatchObject({ chamadas: 1, clinicalEvents: app.baseline });
  }, 30_000);

  it("política capturada vazia é não verificável e contrato aceita histórico legado sem o campo novo", async () => {
    const app = await ambiente();
    const original = await app.post(CLASSIFICAR, pedido());
    alterarPoliticaCapturada(app.banco, "");
    const historico = await app.post(HISTORICO, CONTEXTO);
    expect(historico.body.propostas[0]).toMatchObject({ validadePolitica: "NAO_VERIFICAVEL",
      resposta: original.body, auditoria: { politicaVersao: "" } });
    const legado = structuredClone(historico.body);
    delete legado.propostas[0].validadePolitica;
    expect(HistoricoOncoassist.parse(legado).propostas[0]?.validadePolitica).toBeUndefined();
    expect(await app.comando("stats")).toMatchObject({ chamadas: 1, clinicalEvents: app.baseline });
  }, 30_000);

  it("reinicia em outro processo, recupera histórico e replay com provedor desligado e sem nova LLM", async () => {
    const app = await ambiente();
    const original = await app.post(CLASSIFICAR, pedido());
    const pid = app.pid;
    await app.parar();
    const novo = await ambiente({ banco: app.banco, habilitado: false });
    expect(novo.pid).not.toBe(pid);
    expect(novo.token).not.toBe(app.token);
    expect((await novo.post(HISTORICO, CONTEXTO, undefined, app.token)).status).toBe(401);
    expect((await novo.post("/consulta/oncoassist/status", {})).body).toEqual({ status: "PENDENTE", motivo: "DESABILITADO" });
    expect((await novo.post(HISTORICO, CONTEXTO)).body.propostas[0]).toMatchObject({ validade: "ATUAL", resposta: original.body });
    expect((await novo.post(CLASSIFICAR, pedido())).texto).toBe(original.texto);
    expect(await novo.comando("stats")).toMatchObject({ chamadas: 0, clinicalEvents: app.baseline });
  }, 30_000);

  it("duas requisições em processos concorrentes compartilham reserva UNIQUE e resultado vencedor", async () => {
    const a = await ambiente({ controlado: true });
    const b = await ambiente({ banco: a.banco, controlado: true });
    const pendente = a.post(CLASSIFICAR, pedido());
    await expect.poll(async () => (await a.comando("stats")).chamadas).toBe(1);
    const repetida = await b.post(CLASSIFICAR, pedido());
    expect(repetida.body).toMatchObject({ status: "PENDENTE", codigo: "OPERACAO_PENDENTE" });
    expect((await b.comando("stats")).chamadas).toBe(0);
    await a.comando("liberar");
    const primeira = await pendente;
    expect((await b.post(CLASSIFICAR, pedido())).texto).toBe(primeira.texto);
    const stats = await b.comando("stats");
    expect(stats.drafts.filter((d: any) => d.payload.kind === "JEV_CLASSIFICACAO_RASCUNHO")).toHaveLength(1);
    expect(stats.clinicalEvents).toBe(a.baseline);
  }, 30_000);

  it("queda durante await preserva reserva PENDENTE e reabertura não reexecuta", async () => {
    const a = await ambiente({ controlado: true });
    const request = a.post(CLASSIFICAR, pedido()).catch(() => null);
    await expect.poll(async () => (await a.comando("stats")).chamadas).toBe(1);
    await a.parar(); await request;
    const b = await ambiente({ banco: a.banco });
    expect((await b.post(HISTORICO, CONTEXTO)).body.propostas[0]).toMatchObject({ estado: "PENDENTE", resposta: null });
    expect((await b.post(CLASSIFICAR, pedido())).body).toMatchObject({ status: "PENDENTE", codigo: "OPERACAO_PENDENTE" });
    expect((await b.comando("stats")).chamadas).toBe(0);
    expect((await b.post(CLASSIFICAR, pedido("nova-acao-deliberada"))).body.auditoria.propostaRevision).toBe(2);
  }, 30_000);

  it("mesma operação com fonte divergente é recusada e preserva original e evidência inerte", async () => {
    const app = await ambiente();
    const original = await app.post(CLASSIFICAR, pedido());
    expect(await app.post(CLASSIFICAR, { ...pedido(), draftId: "fonte-2" }))
      .toMatchObject({ status: 409, body: { codigo: "OPERACAO_DIVERGENTE" } });
    expect((await app.post(CLASSIFICAR, pedido())).texto).toBe(original.texto);
    const stats = await app.comando("stats");
    const conflitos = stats.drafts.filter((d: any) => d.payload.kind === "JEV_DIVERGENCIA_RASCUNHO");
    expect(conflitos).toHaveLength(1);
    expect(conflitos[0].payload).toMatchObject({ propostaId: original.body.auditoria.propostaId, revisaoObrigatoria: true,
      tentativa: { contexto: CONTEXTO, draftId: "fonte-2", fonte: { sourceId: "documento-2" } } });
    expect(stats.chamadas).toBe(1);
    expect(stats.clinicalEvents).toBe(app.baseline);
    expect(await app.comando("promover", { draftId: conflitos[0].draftId })).toMatchObject({ estado: "NEGADA" });
  }, 30_000);

  it.each(["revision", "hash", "paciente", "encontro", "lote"])(
    "fonte alterada (%s) invalida replay/uso atual, preservando histórico", async modo => {
      const app = await ambiente();
      const original = await app.post(CLASSIFICAR, pedido());
      await app.comando("fonte", { modo });
      expect(await app.post(CLASSIFICAR, pedido())).toMatchObject({ status: 409, body: { codigo: "FONTE_ALTERADA" } });
      expect((await app.post(HISTORICO, CONTEXTO)).body.propostas[0]).toMatchObject({
        validade: "FONTE_ALTERADA", validadePolitica: "MESMA_VERSAO", resposta: original.body,
      });
      const stats = await app.comando("stats");
      expect(stats.chamadas).toBe(1);
      expect(stats.clinicalEvents).toBe(app.baseline);
      if (modo === "revision" || modo === "hash") {
        const nova = await app.post(CLASSIFICAR, pedido("nova-fonte"));
        expect(nova.body.auditoria.propostaRevision).toBe(2);
        expect(nova.body.auditoria.fonteRevision).toBe(modo === "revision" ? 1 : 0);
      }
    }, 30_000,
  );

  it.each(["revision", "hash", "sessao", "patientId", "encounterId", "tumorLotId"])(
    "revalida após await quando muda %s, sem concluir proposta ou gravar evento", async modo => {
      const app = await ambiente({ controlado: true });
      const pendente = app.post(CLASSIFICAR, pedido());
      await expect.poll(async () => (await app.comando("stats")).chamadas).toBe(1);
      if (modo === "sessao") await app.comando("expirar");
      else if (modo === "revision" || modo === "hash") await app.comando("fonte", { modo });
      else await app.comando("selecionar", { contexto: { ...CONTEXTO, [modo]: "contexto-novo" } });
      await app.comando("liberar");
      const result = await pendente;
      expect(result.status).toBe(modo === "sessao" ? 401 : 409);
      expect(result.body).toEqual({ codigo: modo === "sessao" ? "SESSAO_INVALIDA"
        : modo === "revision" || modo === "hash" ? "FONTE_ALTERADA" : "CONTEXTO_CONSULTA_ALTERADO" });
      const stats = await app.comando("stats");
      expect(stats.drafts.find((d: any) => d.payload.kind === "JEV_CLASSIFICACAO_RASCUNHO").payload)
        .toMatchObject({ estado: "PENDENTE", resposta: null });
      expect(stats.clinicalEvents).toBe(app.baseline);
    }, 30_000,
  );

  it("histórico/replay exigem sessão e contexto atuais em cada leitura", async () => {
    const app = await ambiente();
    await app.post(CLASSIFICAR, pedido());
    for (const campo of ["patientId", "encounterId", "tumorLotId"]) {
      const outro = { ...CONTEXTO, [campo]: "outro-contexto" };
      expect((await app.post(HISTORICO, outro)).status).toBe(409);
      await app.comando("selecionar", { contexto: outro });
      expect((await app.post(HISTORICO, outro)).body.propostas).toEqual([]);
      expect((await app.post(CLASSIFICAR, pedido())).status).toBe(409);
      expect(await app.post(CLASSIFICAR, { ...pedido(), ...outro })).toMatchObject({ status: 409, body: { codigo: "OPERACAO_DIVERGENTE" } });
      await app.comando("selecionar", { contexto: CONTEXTO });
    }
    await app.comando("expirar");
    expect((await app.post(HISTORICO, CONTEXTO)).status).toBe(401);
    expect((await app.post(CLASSIFICAR, pedido())).status).toBe(401);
  }, 30_000);

  it("novo kind não confirma via writeRouter nem rota genérica, inclusive com tipo FATO forjado", async () => {
    const app = await ambiente();
    const result = await app.post(CLASSIFICAR, pedido());
    const draftId = result.body.auditoria.propostaId;
    expect(await app.post("/consulta/rascunho", { draftId }))
      .toMatchObject({ status: 409, body: { codigo: "PROPOSTA_DOCUMENTAL_USAR_HISTORICO" } });
    expect(await app.comando("promover", { draftId })).toEqual({ estado: "NEGADA", resultRef: null, motivo: "PROPOSTA_DOCUMENTAL_NAO_PROMOVIVEL" });
    for (const expectedRevision of [0, 1]) expect(await app.post("/consulta/rascunho/revisar", {
      draftId, patientId: CONTEXTO.patientId, expectedRevision,
    })).toMatchObject({ status: 409, body: { codigo: "PROPOSTA_DOCUMENTAL_NAO_PROMOVIVEL" } });
    expect((await app.comando("stats")).clinicalEvents).toBe(app.baseline);
  }, 30_000);

  it("consumidor legado sem operationId tem replay durável e entrada não aceita fonte/modelo/ator do cliente", async () => {
    const app = await ambiente();
    const legado = { ...CONTEXTO, draftId: "fonte-1" };
    for (const extra of [{ texto: "injetado" }, { modelo: "jev-1.0" }, { provedor: "inventado" }, { capturadoPor: "outro" }])
      expect((await app.post(CLASSIFICAR, { ...legado, ...extra })).status).toBe(400);
    const original = await app.post(CLASSIFICAR, legado);
    expect(original.body.auditoria.operationId).toMatch(/^legado-/);
    expect((await app.post(CLASSIFICAR, legado)).texto).toBe(original.texto);
    expect((await app.comando("stats")).chamadas).toBe(1);
  }, 30_000);
});
