// RT-12 · Harness e gateway (S0) — provas de DEFESA: PHI não sai do PC (G-02), saída
// externa exige artefato ASSINADO do mesmo paciente/encontro/versão (CP-001), destino livre
// é recusado, canais externos estão desligados, replay não reimprime, 500 nunca vaza texto.
import { describe, expect, it } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { contemPhiResidual, desidentificar } from "../../src/kernel/llm/desidentificar.js";
import { g02PhiEgress } from "../../src/kernel/harness/gates.js";
import { autorizarSaida } from "../../src/server/autorizacao.js";
import { ambienteHttp } from "../server/http-fixture.js";
import { artefatoAssinado } from "../server/_artefatoAssinado.js";
import { iniciarEstudio } from "../../src/app/estudio/servidor.js";

const DIC = {
  nomes: ["Maria Alves de Souza"],
  identificadores: ["700000000000001", "111.444.777-35", "(83) 99999-0000"],
};

const intent = (o: Partial<{ verbo: string; id: string; destino: string | null }> = {}) => ({
  verbo: o.verbo ?? "IMPRIMIR",
  objeto: { tipo: "DOCUMENTO", id: o.id ?? "doc-a", versao: 1 },
  escopo: { patientId: "Paciente Teste 01", encounterId: "e1" },
  destino: o.destino ?? null, idempotencyKey: "chave-rt12-teste",
});

describe("RT-12 · G-02: PHI residual barra qualquer saída", () => {
  it("desidentificador encontra NOME, IDENTIFICADOR literal, TELEFONE, E-MAIL e DN", () => {
    const texto = "Maria Alves de Souza, CNS 700000000000001, tel (84) 98888-1234, " +
      "maria.souza@exemplo.local, nascida em 04/03/1976.";
    const saida = desidentificar(texto, DIC);
    const tipos = new Set<string>(saida.achados.map((a) => a.tipo));
    for (const esperado of ["NOME", "IDENTIFICADOR", "TELEFONE", "EMAIL", "DATA_NASC"]) {
      expect(tipos.has(esperado), `esperado ${esperado}`).toBe(true);
    }
    expect(contemPhiResidual(texto, DIC)).toBe(true);
  });

  it("g02PhiEgress bloqueia texto com PHI; texto já tokenizado passa", () => {
    expect(g02PhiEgress("Maria Alves de Souza com febre", DIC).decisao).toBe("BLOQUEIA_SAIDA");
    const tokenizado = desidentificar("Maria Alves de Souza com febre", DIC).texto;
    expect(g02PhiEgress(tokenizado, DIC).decisao).toBe("PASSA");
  });
});

describe("RT-12 · /acao: autorização, replay e não-vazamento", () => {
  it("sem artefato ASSINADO ⇒ 409 ARTEFATO_NAO_ASSINADO; destino livre ⇒ 409; WhatsApp ⇒ 409", async () => {
    const env = await ambienteHttp();
    try {
      const post = (intent_: object) => env.request("/acao", "POST", JSON.stringify(intent_), env.token, "application/json");
      expect((await post(intent({ id: "doc-inexistente" }))).status).toBe(409);
      expect((await post(intent({ id: "doc-inexistente" }))).body).toContain("ARTEFATO_NAO_ASSINADO");
      expect((await post(intent({ destino: "https://fora.do.pc" }))).body).toContain("DESTINO_NAO_PERMITIDO");
      expect((await post(intent({ verbo: "ENVIAR_WHATSAPP" }))).body).toContain("CANAL_EXTERNO_NAO_HABILITADO");
    } finally { await env.close(); }
  });

  it("replay de IMPRIMIR: segundo POST idêntico devolve REPLAY e o efeito acontece UMA vez", async () => {
    const env = await ambienteHttp();
    try {
      artefatoAssinado(env.db, { patientId: "Paciente Teste 01", encounterId: "e1", documentId: "doc-a" });
      const body = JSON.stringify(intent());
      const primeira = await env.request("/acao", "POST", body, env.token, "application/json");
      const segunda = await env.request("/acao", "POST", body, env.token, "application/json");
      expect(primeira.status).toBe(200);
      expect(segunda.body).toContain("REPLAY");
      expect(env.efeitos()).toBe(1);
    } finally { await env.close(); }
  });

  it("PHI no payload nunca ecoa na resposta nem nos logs (400/500 sem texto do erro)", async () => {
    const env = await ambienteHttp();
    try {
      const comNome = JSON.stringify({ verbo: "IMPRIMIR", nome: "Maria Alves de Souza" });
      const r = await env.request("/acao", "POST", comNome, env.token, "application/json");
      expect(r.status).toBe(400);
      expect(r.body).not.toContain("Maria Alves de Souza");
      expect(JSON.stringify(env.logs)).not.toContain("Maria Alves de Souza");
    } finally { await env.close(); }
  });

  it("sem sessão e com sessão expirada ⇒ 401 (nunca executa efeito)", async () => {
    const env = await ambienteHttp();
    try {
      const semAuth = await env.request("/acao", "POST", JSON.stringify(intent()), undefined, "application/json");
      expect(semAuth.status).toBe(401);
      env.now("2026-10-05T13:00:01Z"); // duracaoMs 60s: sessão do token venceu
      const expirada = await env.request("/acao", "POST", JSON.stringify(intent()), env.token, "application/json");
      expect(expirada.status).toBe(401);
      expect(env.efeitos()).toBe(0);
    } finally { await env.close(); }
  });
});

describe("RT-12 · estúdio: origem de fora é recusada (403 ORIGEM_INVALIDA)", () => {
  it("POST /entrar com Origin externo ⇒ 403; Host/Path traversal ⇒ 404", async () => {
    const dir = await mkdtemp(join(tmpdir(), "og-redteam-"));
    let app: Awaited<ReturnType<typeof iniciarEstudio>> | null = null;
    try {
      app = await iniciarEstudio({
        dataDir: dir, corpusDir: resolve("corpus"), senha: "senha-sintetica-comprida",
        medicoId: "medico-teste", crm: "CRM-TESTE",
      });
      const externo = await fetch(app.url + "/entrar", {
        method: "POST", headers: { Origin: "https://externo.invalid" },
        body: new URLSearchParams({ senha: "senha-sintetica-comprida" }), redirect: "manual",
      });
      expect(externo.status).toBe(403);
      const traversal = await fetch(app.url.replace(/\/$/, "") + "/fonte/..%2f..%2fsegredo");
      expect([401, 404]).toContain(traversal.status);
    } finally {
      await app?.encerrar();
      await rm(dir, { recursive: true, force: true });
    }
  });
});
