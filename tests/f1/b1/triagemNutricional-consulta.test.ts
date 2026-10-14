// Thread #17 (P2): a regra D-F1-33 precisa chegar à consulta real. HTTP real + SQLite arquivo, fixtures sintéticos.
import { afterEach, describe, expect, it } from "vitest";
import type { Server } from "node:http";
import type { DatabaseSync } from "node:sqlite";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { abrirLedger } from "../../../src/kernel/ledger/db.js";
import { salvarDraft } from "../../../src/kernel/ledger/drafts.js";
import { listarEventos } from "../../../src/kernel/ledger/ledger.js";
import { confirmar } from "../../../src/kernel/ledger/writeRouter.js";
import { criarGateway, memoriaIdempotencia } from "../../../src/kernel/gateway/gateway.js";
import { criarServidorLocal } from "../../../src/server/http.js";
import { criarGerenciadorSessao } from "../../../src/server/sessao.js";
import { montarPropsFlash } from "../../../src/ui/consulta/flashDaVisao.js";
import { fonteSintetica } from "../../fixtures/triagem.js";

const AGORA = "2026-10-14T09:00:00-03:00";
const dirs: string[] = []; const servers: Server[] = []; const dbs: DatabaseSync[] = [];
afterEach(async () => {
  await Promise.all(servers.splice(0).filter(s => s.listening).map(s => new Promise<void>(r => s.close(() => r()))));
  for (const db of dbs.splice(0)) { try { db.close(); } catch { /* já fechado */ } }
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
});

const ausente = () => ({ valor: null, estado: "PENDENTE", campo: "AUSENTE", motivo: "não consta na fixture sintética", fontes: [], revisao: "RAW" });
const presente = (valor: string, id: string) => ({ valor, estado: "VERDE", campo: "PRESENTE", motivo: "fixture sintética",
  fontes: [fonteSintetica(id)], revisao: "CONFIRMADO" });

async function consultaCom(lotes: { id: string; topografia?: string; cid?: string; encontro?: string; em?: string }[], encontroAntigo?: { id: string; em: string }) {
  const root = mkdtempSync(join(tmpdir(), "f1-b1-nutri-")); dirs.push(root);
  const db = abrirLedger(join(root, "ledger.sqlite")); dbs.push(db);
  const sessoes = criarGerenciadorSessao({ medicoId: "medico-teste", crm: "CRM-TESTE", senha: "senha-sintetica-comprida", duracaoMs: 60_000, agora: () => AGORA });
  const server = criarServidorLocal({ db, sessoes, gateway: criarGateway({ agora: () => AGORA, auditar: () => {}, store: memoriaIdempotencia(), executores: {} }),
    agora: () => AGORA, log: () => {}, configRootDir: join(root, "config") });
  servers.push(server);
  await new Promise<void>(r => server.listening ? r() : server.once("listening", r));
  const addr = server.address(); if (!addr || typeof addr === "string") throw new Error("porta ausente");
  const token = sessoes.login("senha-sintetica-comprida")!.token;
  const PAC = "Paciente Teste Nutri", ENC = "encontro-nutri-01";
  let seq = 0;
  const seed = (tipo: string, payload: unknown, tumorLotId: string | null = null, enc = ENC, em = AGORA) => {
    seq += 1; const id = `nutri-${seq}`;
    salvarDraft(db, { draftId: id, patientId: PAC, sourceId: `src-${id}`, rawRef: "fixture-local", payload: {}, diagnostics: [], revision: 0, criadoEm: em });
    const r = confirmar(db, { operationId: `op-nutri-${String(seq).padStart(3, "0")}`, patientId: PAC, tumorLotId, encounterId: enc,
      reviewDecisionId: `rev-${id}`, sessao: sessoes.obter(token)!, em,
      registros: [{ draftId: id, expectedRevision: 0, eventId: `ev-${id}`, tipo, payload, fontes: [fonteSintetica("medida-nutri")], revisao: "CONFIRMADO" }] });
    expect(r.estado).toBe("GRAVADA");
  };
  const pac = { patientId: PAC, identificadores: [], nome: PAC, nascimento: null, sexoCadastral: "NAO_INFORMADO", divergencia: false };
  if (encontroAntigo) seed("Paciente", pac, null, encontroAntigo.id, encontroAntigo.em);
  seed("Paciente", pac);
  for (const l of lotes) seed("TumorLot", { tumorLotId: l.id, patientId: PAC,
    cid: l.cid ? presente(l.cid, `cid-${l.id}`) : ausente(), topografia: l.topografia ? presente(l.topografia, `topo-${l.id}`) : ausente(),
    histologia: ausente(), estadiamentos: [], finalidadeApac: ausente(), marcos: [] }, l.id, l.encontro ?? ENC, l.em ?? AGORA);
  const antes = listarEventos(db, PAC).length;
  const carregar = async (tumorLotId?: string, encounterId = ENC) => {
    const r = await fetch(`http://127.0.0.1:${addr.port}/consulta/carregar`, { method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ patientId: PAC, encounterId, ...(tumorLotId ? { tumorLotId } : {}) }) });
    return { status: r.status, body: await r.json() as Record<string, any> };
  };
  return { carregar, seed, eventos: () => listarEventos(db, PAC).length, antes };
}

describe("F1-B1 · triagem nutricional chega à consulta (D-F1-33, NRS-2002)", () => {
  it.each([["Esôfago", "Mama"], ["Mama", "Esôfago"]])("conflito: %s e %s no mesmo lote não elegem a primeira versão", async (a, b) => {
    const c = await consultaCom([{ id: "lote-conflito", topografia: a }, { id: "lote-conflito", topografia: b }]);
    const v = await c.carregar("lote-conflito");
    expect(v.status).toBe(200);
    expect(v.body.flash.sugestoesClinicas).toBeUndefined();
    expect(v.body.pendenciasLeitura).toContain("TRIAGEM_NUTRICIONAL_LOTE_AMBIGUO");
    expect(c.eventos()).toBe(c.antes);
  });
  it("peso documentado há mais de 30 dias mantém sugestão nutricional datada, sem liberar dose", async () => {
    const c = await consultaCom([{ id: "lote-mama", topografia: "Mama" }]);
    c.seed("Weight", { kg: 50, origem: "MEDIDO", data: "2026-09-01", sourceId: "medida-nutri" });
    c.seed("FATO", { campo: "alturaCm", valor: 170 });
    const antes = c.eventos();
    const v = await c.carregar();
    expect(v.body.flash.sugestoesClinicas?.[0]).toMatch(/IMC 17\.3 < 18/);
    expect(v.body.flash.sugestoesClinicas?.[0]).toContain("2026-09-01");
    expect(v.body.flash.sugestoesClinicas?.[0]).toContain("conferir atualidade");
    expect(v.body.avaliacaoClinica.dadosCorporais.pesoKg).toBeNull();
    expect(v.body.avaliacaoClinica.dadosNutricionais.sourceId).toBe("medida-nutri");
    expect(c.eventos()).toBe(antes);
  });
  it.each(["conflito", "futuro", "sem fonte"])("peso %s não produz sugestão por IMC", async (caso) => {
    const c = await consultaCom([{ id: "lote-mama", topografia: "Mama" }]);
    c.seed("Weight", { kg: 50, origem: "MEDIDO", data: caso === "futuro" ? "2026-10-15" : "2026-09-01",
      sourceId: caso === "sem fonte" ? "nao-vinculada" : "medida-nutri" });
    if (caso === "conflito") c.seed("Weight", { kg: 80, origem: "MEDIDO", data: "2026-09-01", sourceId: "medida-nutri" });
    c.seed("FATO", { campo: "alturaCm", valor: 170 });
    const v = await c.carregar();
    expect(v.body.flash.sugestoesClinicas).toBeUndefined();
  });
  it("IMC documentado ainda sugere quando o lote conflita, sem escolher um tumor", async () => {
    const c = await consultaCom([{ id: "lote-conflito", topografia: "Esôfago" }, { id: "lote-conflito", topografia: "Mama" }]);
    c.seed("Weight", { kg: 50, origem: "MEDIDO", data: "2026-10-14", sourceId: "medida-nutri" });
    c.seed("FATO", { campo: "alturaCm", valor: 170 });
    const v = await c.carregar("lote-conflito");
    expect(v.body.flash.sugestoesClinicas?.[0]).toContain("IMC 17.3 < 18");
    expect(v.body.flash.sugestoesClinicas?.[0]).not.toContain("esôfago");
    expect(v.body.pendenciasLeitura).toContain("TRIAGEM_NUTRICIONAL_LOTE_AMBIGUO");
  });
  it("positivo: lote de esôfago confirmado mostra a sugestão na Flash, sem gravar nada", async () => {
    const c = await consultaCom([{ id: "lote-esofago", topografia: "Esôfago torácico" }]);
    const v = await c.carregar();
    expect(v.status).toBe(200);
    expect(v.body.flash.sugestoesClinicas).toEqual(["Sugestão: triagem nutricional (NRS-2002) — câncer de esôfago"]);
    expect(v.body.flash.avisos).not.toContain(v.body.flash.sugestoesClinicas[0]);
    expect(c.eventos()).toBe(c.antes);
    const props = montarPropsFlash(v.body as any, null, () => {}, () => {});
    expect(props.sugestoesClinicas).toEqual(v.body.flash.sugestoesClinicas);
    expect(props.acoesHoje).toEqual([]);
  });
  it("positivo: CID C16 confirmado sem topografia também sugere (estômago)", async () => {
    const v = await (await consultaCom([{ id: "lote-gastrico", cid: "C16.9" }])).carregar();
    expect(v.body.flash.sugestoesClinicas).toEqual(["Sugestão: triagem nutricional (NRS-2002) — câncer de estômago"]);
  });
  it("negativo: lote de mama sem IMC não mostra sugestão (PENDENTE não polui a Flash)", async () => {
    const v = await (await consultaCom([{ id: "lote-mama", topografia: "Mama" }])).carregar();
    expect(v.status).toBe(200);
    expect(v.body.flash.sugestoesClinicas).toBeUndefined();
  });
  it("adversarial: dois lotes (esôfago + mama) com o de mama selecionado não herdam a sugestão do outro lote", async () => {
    const c = await consultaCom([{ id: "lote-esofago", topografia: "Esôfago" }, { id: "lote-mama", topografia: "Mama" }]);
    const mama = await c.carregar("lote-mama");
    expect(mama.status).toBe(200);
    expect(mama.body.flash.sugestoesClinicas).toBeUndefined();
    const esofago = await c.carregar("lote-esofago");
    expect(esofago.body.flash.sugestoesClinicas?.[0]).toMatch(/câncer de esôfago/);
  });
  it("adversarial (horizonte): encontro antigo reaberto não usa lote de esôfago confirmado em encontro posterior", async () => {
    const c = await consultaCom([{ id: "lote-esofago", topografia: "Esôfago", em: "2026-10-14T08:00:00-03:00" }],
      { id: "encontro-antigo", em: "2026-09-01T09:00:00-03:00" });
    const antigo = await c.carregar("lote-esofago", "encontro-antigo");
    expect(antigo.status).toBe(200);
    expect(antigo.body.flash.sugestoesClinicas).toBeUndefined();
    const atual = await c.carregar("lote-esofago");
    expect(atual.body.flash.sugestoesClinicas?.[0]).toMatch(/câncer de esôfago/);
  });
});
