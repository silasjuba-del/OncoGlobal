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

async function consultaCom(lotes: { id: string; topografia?: string; cid?: string }[]) {
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
  const seed = (tipo: string, payload: unknown, tumorLotId: string | null = null) => {
    seq += 1; const id = `nutri-${seq}`;
    salvarDraft(db, { draftId: id, patientId: PAC, sourceId: `src-${id}`, rawRef: "fixture-local", payload: {}, diagnostics: [], revision: 0, criadoEm: AGORA });
    const r = confirmar(db, { operationId: `op-nutri-${String(seq).padStart(3, "0")}`, patientId: PAC, tumorLotId, encounterId: ENC,
      reviewDecisionId: `rev-${id}`, sessao: sessoes.obter(token)!, em: AGORA,
      registros: [{ draftId: id, expectedRevision: 0, eventId: `ev-${id}`, tipo, payload, fontes: [], revisao: "CONFIRMADO" }] });
    expect(r.estado).toBe("GRAVADA");
  };
  seed("Paciente", { patientId: PAC, identificadores: [], nome: PAC, nascimento: null, sexoCadastral: "NAO_INFORMADO", divergencia: false });
  for (const l of lotes) seed("TumorLot", { tumorLotId: l.id, patientId: PAC,
    cid: l.cid ? presente(l.cid, `cid-${l.id}`) : ausente(), topografia: l.topografia ? presente(l.topografia, `topo-${l.id}`) : ausente(),
    histologia: ausente(), estadiamentos: [], finalidadeApac: ausente(), marcos: [] }, l.id);
  const antes = listarEventos(db, PAC).length;
  const carregar = async (tumorLotId?: string) => {
    const r = await fetch(`http://127.0.0.1:${addr.port}/consulta/carregar`, { method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ patientId: PAC, encounterId: ENC, ...(tumorLotId ? { tumorLotId } : {}) }) });
    return { status: r.status, body: await r.json() as Record<string, any> };
  };
  return { carregar, eventos: () => listarEventos(db, PAC).length, antes };
}

describe("F1-B1 · triagem nutricional chega à consulta (D-F1-33, NRS-2002)", () => {
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
});
