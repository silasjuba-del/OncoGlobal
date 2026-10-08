// W11-H30 · Segurança e PHI (adversarial). Somente dados sintéticos.
// (a) varredura do repositório por CPF/CNS/telefone/e-mail; só valores sintéticos declarados passam.
// (b) toda rota do servidor exige sessão; a única pública é /login (e a página de login do estúdio).
// (c) servidores locais ligam somente em 127.0.0.1.
// (d) efeito de saída (ENVIAR_EMAIL) com PHI no payload é negado pelo G-02.
// (e) erros e logs nunca ecoam senha, token ou PHI.
// (f) nenhum VITE_* nem literal de segredo no repositório.
import { createHash } from "node:crypto";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { join, relative, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { iniciarEstudio } from "../../src/app/estudio/servidor.js";
import { abrirLedger } from "../../src/kernel/ledger/db.js";
import { criarGateway, memoriaIdempotencia, type EvidenciaSaidaExterna, type RegistroAuditoria } from "../../src/kernel/gateway/gateway.js";
import { g02PhiEgress } from "../../src/kernel/harness/gates.js";
import { criarServidorLocal } from "../../src/server/http.js";
import { criarGerenciadorSessao } from "../../src/server/sessao.js";

const RAIZ = process.cwd();
const SENHA = "senha-sintetica-w11-h30";
const PACIENTE = "Paciente Teste 07";

// ---------- (a) varredura do repositório ----------
const IGNORADOS = new Set(["node_modules", ".git", "dist", "coverage"]);
function arquivos(dir: string, saida: string[] = []): string[] {
  for (const nome of readdirSync(dir)) {
    if (IGNORADOS.has(nome)) continue;
    const caminho = join(dir, nome);
    const st = statSync(caminho);
    if (st.isDirectory()) arquivos(caminho, saida);
    else if (st.isFile() && st.size <= 5_000_000) saida.push(caminho);
  }
  return saida;
}
/** Texto UTF-8 do arquivo; null para binário (contém NUL). */
function textoDe(caminho: string): string | null {
  const texto = readFileSync(caminho, "utf8");
  return texto.includes("\u0000") ? null : texto;
}

// Allowlist explícita: valores sintéticos já declarados em testes/fixtures/docs de planejamento.
// Qualquer outro CPF, CNS, telefone ou e-mail no repositório falha a suíte.
const SINTETICOS = {
  CPF: ["000.000.000-00", "111.111.111-11", "111.444.777-00", "111.444.777-35", "123.456.789-01",
    "123.456.789-09", "529.982.247-24", "529.982.247-25"],
  CNS: ["000000000000000", "000000000000001", "100000000060008", "100000000060018", "300000000000000",
    "345678901234568", "700 0000 0000 0000", "700 0000 0000 0005", "700 1111 2222 3333", "700000000000001",
    "700000000000002", "700000000000004", "700000000000005", "700000000000011", "700000000000012",
    "700000000000099", "704202600001234", "898 0012 3456 7890", "898001234567890"],
  TELEFONE: ["(00) 90000-0001", "(00) 90000-0009", "(11) 90000-0001", "(11) 91234-5678", "(83) 99999-0000",
    "(83) 99999-1234", "(84) 98888-1234", "+55 83 90000-0006", "+55-00-0000-0000", "90000-0002", "91234-5678"],
  EMAIL: ["contato-teste@example.invalid", "contato@exemplo.test", "desconhecido@teste.ts", "joana@exemplo.com",
    "manifesto-test@example.invalid", "maria.souza@exemplo.local", "noreply@anthropic.com",
    "paciente.teste@example.invalid"],
} as const;
type TipoPhi = keyof typeof SINTETICOS;
const PADROES_PHI: { tipo: TipoPhi; re: RegExp }[] = [
  { tipo: "CPF", re: /\b\d{3}\.\d{3}\.\d{3}-\d{2}\b/g },
  { tipo: "CNS", re: /\b\d{15}\b|\b\d{3} \d{4} \d{4} \d{4}\b/g },
  { tipo: "TELEFONE", re: /\(\d{2}\) ?9?\d{4,5}-\d{4}\b|\+55[ -]?\d{2}[ -]?\d{4,5}-?\d{4}\b|\b9\d{4}-\d{4}\b/g },
  // Domínio começa por letra: exclui versões como RADS@1.1.0.md.
  { tipo: "EMAIL", re: /[A-Za-z0-9._%+-]+@[A-Za-z][A-Za-z0-9-]*(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}/g },
];

describe("W11-H30 · (a) varredura de PHI no repositório", () => {
  it("só aparecem CPF, CNS, telefone e e-mail sintéticos já declarados", () => {
    const achados: string[] = [];
    for (const caminho of arquivos(RAIZ)) {
      const texto = textoDe(caminho);
      if (texto === null) continue;
      for (const { tipo, re } of PADROES_PHI)
        for (const m of texto.matchAll(re))
          if (!(SINTETICOS[tipo] as readonly string[]).includes(m[0]))
            achados.push(`${relative(RAIZ, caminho)}: ${tipo} ${m[0]}`);
    }
    expect(achados).toEqual([]);
  }, 60_000);
});

// ---------- (f) segredos e variáveis VITE_ ----------
const SEGREDOS = [/\bsk-ant-[A-Za-z0-9_-]{10,}/, /\bsk-[A-Za-z0-9]{32,}/, /\bAIza[0-9A-Za-z_-]{35}\b/,
  /\bgh[pousr]_[A-Za-z0-9]{36}\b/, /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/];

describe("W11-H30 · (f) segredos e VITE_*", () => {
  it("nenhum literal com formato de segredo no repositório", () => {
    const achados: string[] = [];
    for (const caminho of arquivos(RAIZ)) {
      const texto = textoDe(caminho);
      if (texto === null) continue;
      for (const re of SEGREDOS) if (re.test(texto)) achados.push(`${relative(RAIZ, caminho)}: ${re.source}`);
    }
    expect(achados).toEqual([]);
  });

  it("nenhum VITE_* com nome de segredo (o cliente Vite expõe tudo que começa com VITE_)", () => {
    const nomes = new Set<string>();
    for (const caminho of arquivos(RAIZ)) {
      const texto = textoDe(caminho);
      if (texto === null) continue;
      for (const m of texto.matchAll(/\bVITE_[A-Z0-9_]+/g)) nomes.add(m[0]);
    }
    const sensiveis = [...nomes].filter((n) => /KEY|SECRET|TOKEN|SENHA|PASSWORD|PASS|CREDENC|PRIVAT/i.test(n));
    expect(sensiveis).toEqual([]);
  });
});

// ---------- fixture do servidor local ----------
interface Fixture { base: string; logs: { rota: string; codigo: string; status: number }[]; fechar(): Promise<void> }

async function servidor(): Promise<Fixture> {
  const db = abrirLedger(":memory:");
  const agora = "2026-10-05T12:00:00Z";
  const logs: Fixture["logs"] = [];
  const sessoes = criarGerenciadorSessao({ medicoId: "medico-teste", crm: "CRM-TESTE", senha: SENHA,
    duracaoMs: 60_000, agora: () => agora });
  const gateway = criarGateway({ agora: () => agora, auditar: () => {}, store: memoriaIdempotencia(), executores: {} });
  const server: Server = criarServidorLocal({ db, sessoes, gateway, agora: () => agora, log: (e) => logs.push(e) });
  await new Promise<void>((ok) => (server.listening ? ok() : server.once("listening", ok)));
  const endereco = server.address() as AddressInfo;
  return { base: `http://127.0.0.1:${endereco.port}`, logs,
    fechar: () => new Promise<void>((ok) => { server.close(() => { db.close(); ok(); }); }) };
}

async function comServidor<T>(fn: (s: Fixture) => Promise<T>): Promise<T> {
  const s = await servidor();
  try { return await fn(s); } finally { await s.fechar(); }
}

// ---------- (b) toda rota exige sessão ----------
const ROTAS_PROTEGIDAS = ["/consulta/bundle", "/consulta/confirmar", "/consulta/extrair",
  "/consulta/prescricao/rascunho", "/consulta/rascunho", "/consulta/rascunho/revisar",
  "/consulta/rascunho/preparar-revisao", "/consulta/oncoassist/status", "/consulta/oncoassist/classificar-fonte",
  "/consulta/oncoassist/fontes", "/consulta/carregar", "/consulta/agenda", "/consulta/salao", "/consulta/canal",
  "/consulta/apac", "/consulta/chat", "/consulta/recist", "/consulta/estatistica", "/conhecimento/consultar",
  "/config/perfil", "/config/perfil/salvar", "/config/caixa/ler", "/config/caixa/alterar", "/config/historico",
  "/acao", "/consulta/salao/triagem", "/consulta/salao/liberar", "/consulta/canal/vincular"];

describe("W11-H30 · (b) sessão obrigatória nas rotas do servidor", () => {
  it.each(ROTAS_PROTEGIDAS)("%s recusa POST sem sessão e com token inventado", (rota) => comServidor(async (s) => {
    for (const auth of [{}, { Authorization: `Bearer ${"0".repeat(64)}` }]) {
      const r = await fetch(s.base + rota, { method: "POST",
        headers: { "Content-Type": "application/json", ...auth }, body: "{}" });
      expect(r.status).toBe(401);
      expect(await r.json()).toEqual({ codigo: "SESSAO_INVALIDA" });
    }
  }));

  it("/login é a única rota pública: responde sem sessão (validação do corpo, não 401)", () => comServidor(async (s) => {
    const r = await fetch(s.base + "/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
    expect(r.status).toBe(400);
    expect(await r.json()).toEqual({ codigo: "PAYLOAD_INVALIDO" });
  }));

  it("estúdio local: sem cookie de sessão, só a página de login é servida e nada de PHI vaza", async () => {
    const dir = await mkdtemp(join(tmpdir(), "og-h30-estudio-"));
    const app = await iniciarEstudio({ dataDir: dir, corpusDir: resolve(RAIZ, "corpus"), senha: SENHA,
      medicoId: "medico-teste", crm: "CRM-TESTE" });
    try {
      const login = await fetch(app.url + "/");
      expect(login.status).toBe(200);
      expect(await login.text()).not.toContain("Paciente Teste 001");
      const semSessao: [string, string, string | undefined][] = [
        ["GET", "/exemplo-estudo", undefined], ["GET", "/rascunhos", undefined],
        ["GET", "/documento/qualquer", undefined], ["GET", "/impresso/qualquer", undefined],
        ["GET", "/fonte/qualquer", undefined], ["POST", "/comando", "action=note&revision=1"],
      ];
      for (const [metodo, caminho, corpo] of semSessao) {
        const r = await fetch(app.url + caminho, corpo === undefined ? { method: metodo } : { method: metodo, body: corpo });
        expect(r.status, `${metodo} ${caminho}`).toBe(401);
      }
    } finally {
      await app.encerrar();
      await rm(dir, { recursive: true, force: true });
    }
  });
});

// ---------- (c) somente loopback ----------
const SRC = resolve(RAIZ, "src");

describe("W11-H30 · (c) bind somente em 127.0.0.1", () => {
  it("o servidor local liga em 127.0.0.1 e recusa qualquer outro endereço", async () => {
    const s = await servidor();
    try {
      const porta = Number(new URL(s.base).port);
      expect(porta).toBeGreaterThan(0);
      expect(new URL(s.base).hostname).toBe("127.0.0.1");
    } finally { await s.fechar(); }
    const deps = { db: abrirLedger(":memory:"), sessoes: null as never, gateway: null as never,
      agora: () => "2026-10-05T12:00:00Z", log: () => {} };
    for (const host of ["0.0.0.0", "::", "192.168.0.10"])
      expect(() => criarServidorLocal(deps, { host, port: 0 })).toThrow("BIND_FORA_DO_LOOPBACK");
  });

  it("o estúdio recusa bind fora do loopback", async () => {
    const dir = await mkdtemp(join(tmpdir(), "og-h30-bind-"));
    try {
      await expect(iniciarEstudio({ dataDir: dir, corpusDir: resolve(RAIZ, "corpus"), senha: SENHA,
        medicoId: "medico-teste", crm: "CRM-TESTE", host: "0.0.0.0" })).rejects.toThrow("SOMENTE_LOOPBACK");
    } finally { await rm(dir, { recursive: true, force: true }); }
  });

  it("nenhum módulo de src/ abre listen fora de 127.0.0.1 nem cita 0.0.0.0", () => {
    const achados: string[] = [];
    for (const caminho of arquivos(SRC)) {
      const texto = textoDe(caminho);
      if (texto === null) continue;
      const ref = relative(RAIZ, caminho);
      if (/\.listen\(/.test(texto) && !texto.includes("127.0.0.1")) achados.push(`${ref}: listen sem 127.0.0.1`);
      if (/["'`]0\.0\.0\.0["'`]/.test(texto)) achados.push(`${ref}: 0.0.0.0`);
    }
    expect(achados).toEqual([]);
  });
});

// ---------- (d) G-02 bloqueia envio com PHI ----------
const AGORA_GW = "2026-10-07T12:00:00-03:00";
const SESSAO_GW = { medicoId: "medico-teste", crm: "CRM-TESTE", emitidaEm: AGORA_GW, expiraEm: "2026-10-07T20:00:00-03:00" };
const sha = (s: string) => createHash("sha256").update(s, "utf8").digest("hex");

function evidenciaSaida(payload: string): EvidenciaSaidaExterna {
  const destino = "contato-teste@example.invalid";
  const payloadHash = sha(payload), destinoHash = sha(destino);
  return {
    payload, destinoCanonico: destino,
    artefato: { id: "documento-teste", versao: 1, hash: "sha256-artefato-h30", tipo: "TEXTO", metadados: {} },
    dicionarioPaciente: { nomes: [PACIENTE], identificadores: [] },
    sanitizationReport: { riscoResidual: "BAIXO", versaoSanitizador: "h30-1", payloadHash, destinoHash },
    autorizacao: { patientId: PACIENTE, encounterId: "encontro-teste", artefatoId: "documento-teste", versao: 1,
      artefatoHash: "sha256-artefato-h30", payloadHash, destinoHash, vigente: true },
  };
}

function gatewayComSaida(payload: string) {
  let chamadas = 0;
  const auditoria: RegistroAuditoria[] = [];
  const gw = criarGateway({
    executores: { ENVIAR_EMAIL: { executar: async () => { chamadas++; return { ok: true, recibo: "recibo-h30" }; } } },
    store: memoriaIdempotencia(), agora: () => AGORA_GW, auditar: (r) => auditoria.push(r),
    validarSaida: () => ({ ok: true, evidencia: evidenciaSaida(payload) }),
  });
  return { gw, chamadas: () => chamadas, auditoria };
}

const envioEmail = (chave: string) => ({ verbo: "ENVIAR_EMAIL" as const,
  objeto: { tipo: "DOCUMENTO", id: "documento-teste", versao: 1 },
  escopo: { patientId: PACIENTE, encounterId: "encontro-teste" }, destino: null, idempotencyKey: chave });

describe("W11-H30 · (d) efeito de saída com PHI é negado pelo G-02", () => {
  it.each([
    ["nome do paciente", `${PACIENTE}, retorno sintético`],
    ["CPF", "CPF 111.444.777-35 em texto sintético"],
    ["CNS", "CNS 700000000000001 em texto sintético"],
    ["telefone", "contato (83) 99999-1234 em texto sintético"],
    ["e-mail", "contato: contato@exemplo.test em texto sintético"],
    ["data de nascimento", "nascido em 04/03/1976 em texto sintético"],
  ])("ENVIAR_EMAIL com %s no payload: NEGADA e executor nunca chamado", async (_, payload) => {
    const t = gatewayComSaida(payload);
    expect(await t.gw.executar(envioEmail(`h30-phi-${sha(payload).slice(0, 12)}`), SESSAO_GW))
      .toMatchObject({ decisao: "NEGADA", motivoCodigo: "GATES_SAIDA_NAO_PASSARAM" });
    expect(t.chamadas()).toBe(0);
  });

  it("controle: payload sem PHI passa o G-02 e é executado uma vez", async () => {
    const t = gatewayComSaida("Minuta sintética sem PHI");
    expect((await t.gw.executar(envioEmail("h30-limpo-0001"), SESSAO_GW)).decisao).toBe("EXECUTADA");
    expect(t.chamadas()).toBe(1);
  });

  it("o gate G-02 isolado bloqueia a saída com PHI residual", () => {
    const dic = { nomes: [PACIENTE], identificadores: [] };
    expect(g02PhiEgress(`${PACIENTE} em texto`, dic).decisao).toBe("BLOQUEIA_SAIDA");
    expect(g02PhiEgress("Minuta sintética sem PHI", dic).decisao).toBe("PASSA");
  });
});

// ---------- (e) erros e logs sem segredo nem PHI ----------
describe("W11-H30 · (e) erros e logs sem chave nem PHI", () => {
  it("senha errada e corpo malformado com PHI não ecoam em respostas nem em logs", () => comServidor(async (s) => {
    const errado = await fetch(s.base + "/login", { method: "POST",
      headers: { "Content-Type": "application/json" }, body: JSON.stringify({ senha: `${SENHA}-errada` }) });
    expect(errado.status).toBe(401);
    const corpoErrado = await errado.text();

    const ok = await fetch(s.base + "/login", { method: "POST",
      headers: { "Content-Type": "application/json" }, body: JSON.stringify({ senha: SENHA }) });
    const { token } = (await ok.json()) as { token: string };

    const phi = `${PACIENTE} CPF 111.444.777-35`;
    const malformado = await fetch(s.base + "/consulta/bundle", { method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: `{"patientId": "${phi}"` });
    const corpoRuim = await malformado.text();

    const registros = JSON.stringify(s.logs);
    for (const proibido of [SENHA, token, PACIENTE, "111.444.777-35"]) {
      expect(registros).not.toContain(proibido);
      expect(corpoRuim).not.toContain(proibido);
      expect(corpoErrado).not.toContain(proibido);
    }
  }));
});
