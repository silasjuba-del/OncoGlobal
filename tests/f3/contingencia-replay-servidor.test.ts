import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { DatabaseSync } from "node:sqlite";
import { afterEach, expect, it, vi } from "vitest";
import { GerarContingenciaSalao, ContingenciaSalaoResposta } from "../../src/contracts/api/salaoContingencia.js";
import { abrirLedger } from "../../src/kernel/ledger/db.js";
import { criarGateway, memoriaIdempotencia } from "../../src/kernel/gateway/gateway.js";
import { hashCanonico } from "../../src/modules/hash.js";
import { operarContingenciaSalao } from "../../src/server/salaoContingencia.js";
import { garantirSchemaSalaoF3, gerarFolhaContingenciaSalaoF3 } from "../../src/server/salaoF3.js";
import { criarGerenciadorSessao } from "../../src/server/sessao.js";
import type { ServidorDeps } from "../../src/server/rotas.js";
import { ambiente, ctx, EM } from "../bateria2/fixtures.js";

// Simula troca/indisponibilidade do template sem alterar corpus ou arquivos reais.
vi.mock("node:fs", async original => {
  const real = await original<typeof import("node:fs")>();
  return { ...real, readFileSync: vi.fn(real.readFileSync) };
});
const bancos: DatabaseSync[] = [], pastas: string[] = [];
const contexto = { patientId: ctx.patientId, encounterId: ctx.encounterId, tumorLotId: null };
const origem = "Registro operacional informado pelo médico; não substitui prescrição assinada.";
function preparar() {
  const pasta = mkdtempSync(join(tmpdir(), "f3-replay-servidor-")); pastas.push(pasta);
  const caminho = join(pasta, "ledger.sqlite"), a = ambiente(caminho); bancos.push(a.db);
  let db = a.db, agora = EM, sessoes = a.acesso.sessoes, token = a.acesso.token;
  const paciente = { patientId: ctx.patientId, nome: "Paciente Sintetico Nome Inicial", identificadores: [], nascimento: null, sexoCadastral: "NAO_INFORMADO", divergencia: false };
  a.seed("Paciente", paciente, "CONFIRMADO", contexto);
  a.seed("AgendaEntry", { patientId: ctx.patientId, encounterId: ctx.encounterId, data: "2026-10-19", horario: "15:00" }, "CONFIRMADO", contexto);
  sessoes.selecionarConsulta(token, contexto);
  const deps: ServidorDeps = { get db() { return db; }, get sessoes() { return sessoes; }, agora: () => agora, log: () => {},
    gateway: criarGateway({ agora: () => agora, auditar: () => {}, store: memoriaIdempotencia(), executores: {} }) };
  const pedido = GerarContingenciaSalao.parse({ patientId: ctx.patientId, encounterId: ctx.encounterId, operationId: "operacao-sintetica", destino: "FILA_MEDICO",
    emergenciaAtiva: false, alertasOperacionaisE1: [], resumoTriagem: { relato: "Registro sintetico", outro: "Outro campo" } });
  const folhaId = `folha-${createHash("sha256").update(JSON.stringify([ctx.patientId, ctx.encounterId, pedido.operationId])).digest("hex")}`;
  const gerar = (raw: unknown = pedido) => operarContingenciaSalao(deps, token, "gerarContingenciaSalao", raw);
  return { ...a, deps, pedido, folhaId, caminho, get db() { return db; }, gerar,
    linhas: () => db.prepare("SELECT * FROM salao_folha_contingencia ORDER BY folhaId").all(),
    setAgora: (em: string) => { agora = em; },
    corrigirNome: () => a.seed("Paciente", { ...paciente, nome: "Paciente Sintetico Nome Corrigido" }, "CONFIRMADO", contexto),
    trocarMedico: () => {
      sessoes = criarGerenciadorSessao({ medicoId: "medico-b-sintetico", crm: "CRM-B-SINTETICO", senha: "senha-sintetica-replay", duracaoMs: 86400000, agora: () => agora });
      token = sessoes.login("senha-sintetica-replay")!.token; sessoes.selecionarConsulta(token, contexto);
    },
    tokenAtual: () => token,
    reabrir: () => { db.close(); db = abrirLedger(caminho); bancos.push(db); },
    entradaLegada: () => ({ folhaId, patientId: ctx.patientId, encounterId: ctx.encounterId, nomePaciente: paciente.nome,
      dataImpressao: "2026-10-19", destino: pedido.destino, emergenciaAtiva: false, alertasOperacionaisE1: [], resumoTriagem: { ...pedido.resumoTriagem, Origem: origem } }),
  };
}
function folha(r: ReturnType<typeof operarContingenciaSalao>) {
  expect(r.status).toBe(200); return ContingenciaSalaoResposta.parse(r.body).folha;
}
afterEach(() => {
  vi.restoreAllMocks(); vi.mocked(readFileSync).mockReset();
  for (const db of bancos.splice(0)) { try { db.close(); } catch { /* ja fechado */ } }
  for (const pasta of pastas.splice(0)) rmSync(pasta, { recursive: true, force: true });
});

it("persiste fingerprint calculado do pedido validado junto da folha e sem efeitos clinicos", () => {
  const a = preparar(), antes = a.db.prepare("SELECT * FROM clinical_event").all();
  const f = folha(a.gerar()); const rows = a.linhas(); expect(rows).toHaveLength(1);
  expect(rows[0]).toMatchObject({ pedidoSha256: hashCanonico(a.pedido), folhaJson: JSON.stringify(f), geradoEm: EM });
  expect(f.htmlImprimivel).toContain("Paciente Sintetico Nome Inicial");
  expect(a.db.prepare("SELECT * FROM clinical_event").all()).toEqual(antes);
  expect(a.gerar({ ...a.pedido, pedidoSha256: "a".repeat(64) })).toEqual({ status: 400, body: { codigo: "PAYLOAD_INVALIDO" } });
  expect(a.linhas()).toEqual(rows);
});

it("replay apos correcao de nome, outro medico, meia-noite e reinicio retorna o HTML original", () => {
  const a = preparar(), original = folha(a.gerar()), rows = a.linhas();
  a.corrigirNome(); a.setAgora("2026-10-20T03:01:00.000Z"); a.trocarMedico(); a.reabrir();
  expect(folha(a.gerar())).toEqual(original); expect(a.linhas()).toEqual(rows);
  expect(original.htmlImprimivel).toContain("medico-sintetico-a");
  expect(original.dataImpressao).toBe("2026-10-19");
  const hist = operarContingenciaSalao(a.deps, a.tokenAtual(), "historicoContingenciaSalao", { patientId: ctx.patientId, encounterId: ctx.encounterId });
  expect(hist).toMatchObject({ status: 200, body: { folhas: [original] } });
});

it("ordem de chaves e normalizacao do contrato nao mudam identidade do pedido", () => {
  const a = preparar(), original = folha(a.gerar()), rows = a.linhas();
  const p = a.pedido;
  const reordenado = { resumoTriagem: { outro: " Outro campo ", relato: " Registro sintetico " }, alertasOperacionaisE1: [], emergenciaAtiva: false,
    destino: p.destino, operationId: p.operationId, encounterId: p.encounterId, patientId: p.patientId };
  expect(folha(a.gerar(reordenado))).toEqual(original); expect(a.linhas()).toEqual(rows);
});

it.each(["nome", "template-indisponivel", "template-alterado"])("replay nao renderiza novamente com metadados atuais: %s", caso => {
  const a = preparar(), original = folha(a.gerar()), rows = a.linhas(), ler = vi.mocked(readFileSync); ler.mockClear();
  if (caso === "nome") a.corrigirNome();
  if (caso === "template-indisponivel") ler.mockImplementation(() => { throw Error("template indisponivel sintetico"); });
  if (caso === "template-alterado") ler.mockImplementation(() => JSON.stringify({ id: "template-sintetico-alterado", versao: "nova" }));
  expect(folha(a.gerar())).toEqual(original); expect(ler).not.toHaveBeenCalled(); expect(a.linhas()).toEqual(rows);
  if (caso === "template-indisponivel") expect(a.gerar({ ...a.pedido, operationId: "nova-operacao" }).status).toBe(503);
  if (caso === "template-alterado") expect(folha(a.gerar({ ...a.pedido, operationId: "nova-operacao" })).htmlImprimivel).toContain("template-sintetico-alterado");
});

it.each([
  { destino: "SALAO" }, { emergenciaAtiva: true }, { alertasOperacionaisE1: ["Outro alerta sintetico"] },
  { resumoTriagem: { relato: "Texto diferente" } }, { resumoTriagem: { relato: "Registro sintetico", outro: "Outro campo", Origem: "Fonte alegada" } },
])("mesma operacao com pedido divergente retorna conflito sem tocar original: %j", mudanca => {
  const a = preparar(); a.gerar(); const rows = a.linhas(); vi.mocked(readFileSync).mockClear();
  expect(a.gerar({ ...a.pedido, ...mudanca })).toEqual({ status: 409, body: { codigo: "FOLHA_ID_CONFLITANTE" } });
  expect(a.linhas()).toEqual(rows); expect(readFileSync).not.toHaveBeenCalled();
});

it("replay preserva sessao valida e contexto selecionado; expiracao nao e contornada", () => {
  const a = preparar(); a.gerar(); const rows = a.linhas();
  expect(operarContingenciaSalao(a.deps, "token-invalido", "gerarContingenciaSalao", a.pedido).status).toBe(401);
  expect(a.gerar({ ...a.pedido, patientId: "outro-paciente" }).status).toBe(409);
  a.deps.sessoes.selecionarConsulta(a.tokenAtual(), { ...contexto, encounterId: "outro-encontro" });
  expect(a.gerar().status).toBe(409);
  a.deps.sessoes.selecionarConsulta(a.tokenAtual(), contexto); a.setAgora("2026-10-21T18:00:00.000Z");
  expect(a.gerar().status).toBe(401); expect(a.linhas()).toEqual(rows);
});

it("mudanca de contexto antes do BEGIN e revalidada dentro da transacao", () => {
  const a = preparar(); a.gerar(); const rows = a.linhas(), exec = a.db.exec.bind(a.db); let mudou = false;
  vi.spyOn(a.db, "exec").mockImplementation(sql => {
    if (sql === "BEGIN IMMEDIATE" && !mudou) { mudou = true; a.deps.sessoes.selecionarConsulta(a.tokenAtual(), null); }
    return exec(sql);
  });
  expect(a.gerar().status).toBe(409); expect(mudou).toBe(true); expect(a.linhas()).toEqual(rows);
});

it.each([false, true])("duas conexoes serializam leitura do hash e preservam o vencedor (divergente=%s)", divergente => {
  const a = preparar(); garantirSchemaSalaoF3(a.db);
  const b = abrirLedger(a.caminho); bancos.push(b); b.exec("PRAGMA busy_timeout=0");
  const depsB: ServidorDeps = { ...a.deps, db: b }, pedidoB = divergente ? { ...a.pedido, resumoTriagem: { relato: "Vencedor diferente" } } : a.pedido;
  const exec = a.db.exec.bind(a.db), prepararSql = a.db.prepare.bind(a.db); let intercalou = false, sobLock = false;
  let vencedor: ReturnType<typeof operarContingenciaSalao> | undefined;
  vi.spyOn(a.db, "exec").mockImplementation(sql => {
    if (sql === "BEGIN IMMEDIATE" && !intercalou) { intercalou = true; vencedor = operarContingenciaSalao(depsB, a.tokenAtual(), "gerarContingenciaSalao", pedidoB); }
    return exec(sql);
  });
  vi.spyOn(a.db, "prepare").mockImplementation(sql => {
    if (sql.includes("SELECT patientId, encounterId, folhaJson, pedidoSha256")) {
      sobLock = a.db.isTransaction; expect(() => b.exec("BEGIN IMMEDIATE")).toThrow(/locked|busy/i);
    }
    return prepararSql(sql);
  });
  const r = a.gerar(); expect(intercalou).toBe(true); expect(sobLock).toBe(true);
  expect(vencedor?.status).toBe(200);
  if (divergente) expect(r).toEqual({ status: 409, body: { codigo: "FOLHA_ID_CONFLITANTE" } }); else expect(r).toEqual(vencedor);
  expect(a.linhas()).toHaveLength(1); expect(a.linhas()[0]?.pedidoSha256).toBe(hashCanonico(pedidoB));
  expect(JSON.parse(String(a.linhas()[0]?.folhaJson))).toEqual(ContingenciaSalaoResposta.parse(vencedor!.body).folha);
});

it("falha no commit reverte folha e hash juntos; retry posterior pode persistir", () => {
  const a = preparar(); garantirSchemaSalaoF3(a.db); const exec = a.db.exec.bind(a.db); let falhou = false;
  const spy = vi.spyOn(a.db, "exec").mockImplementation(sql => { if (sql === "COMMIT" && !falhou) { falhou = true; throw Error("falha sintetica de commit"); } return exec(sql); });
  expect(a.gerar().status).toBe(503); expect(falhou).toBe(true); expect(a.linhas()).toEqual([]);
  spy.mockRestore(); expect(a.gerar().status).toBe(200); expect(a.linhas()).toHaveLength(1);
});

it("migracao e replay legado preservam NULL e JSON antigo sem fabricar proveniencia", () => {
  const a = preparar(), temporario = abrirLedger(":memory:"); bancos.push(temporario);
  const gerada = gerarFolhaContingenciaSalaoF3(temporario, a.acesso, a.entradaLegada());
  expect(gerada.ok).toBe(true); if (!gerada.ok) throw Error("LEGADO_SINTETICO_FALHOU");
  a.db.exec("CREATE TABLE salao_folha_contingencia (folhaId TEXT PRIMARY KEY, patientId TEXT NOT NULL, encounterId TEXT NOT NULL, folhaJson TEXT NOT NULL, geradoEm TEXT NOT NULL)");
  a.db.prepare("INSERT INTO salao_folha_contingencia VALUES (?, ?, ?, ?, ?)").run(a.folhaId, ctx.patientId, ctx.encounterId, JSON.stringify(gerada.folha), EM);
  const antes = a.linhas()[0]!;
  garantirSchemaSalaoF3(a.db); expect(a.linhas()[0]).toEqual({ ...antes, pedidoSha256: null });
  expect(folha(a.gerar())).toEqual(gerada.folha); expect(a.linhas()[0]).toEqual({ ...antes, pedidoSha256: null });
  a.corrigirNome(); expect(a.gerar().status).toBe(409); expect(a.linhas()[0]).toEqual({ ...antes, pedidoSha256: null });
  expect(a.gerar({ ...a.pedido, operationId: "nova-operacao-legado" }).status).toBe(200);
  expect(a.linhas().filter(r => r.pedidoSha256 === null)).toHaveLength(1);
});

it("chamada direta sem fingerprint continua compativel e append-only", () => {
  const a = preparar(), entrada = a.entradaLegada();
  const original = gerarFolhaContingenciaSalaoF3(a.db, a.acesso, entrada);
  expect(original.ok).toBe(true);
  expect(gerarFolhaContingenciaSalaoF3(a.db, { ...a.acesso, agora: "2026-10-19T18:01:00.000Z" }, entrada)).toEqual(original);
  expect(a.linhas()[0]?.pedidoSha256).toBeNull();
  expect(gerarFolhaContingenciaSalaoF3(a.db, a.acesso, { ...entrada, nomePaciente: "Outro nome" })).toEqual({ ok: false, codigo: "FOLHA_ID_CONFLITANTE" });
  expect(() => a.db.prepare("UPDATE salao_folha_contingencia SET pedidoSha256=?").run("a".repeat(64))).toThrow(/append-only/);
});
