// FUGU-EIXO-05: somente dados sintéticos e HTTP loopback. O log estruturado do
// servidor e a porta de auditoria do gateway são observáveis aqui; coletores
// externos, stdout/stderr e transporte externo não são cobertos por esta fixture.
// Resposta clínica LOCAL bem-sucedida não é saída de erro nem egress externo.
import { describe, expect, it } from "vitest";
import {
  criarGateway, memoriaIdempotencia, type RegistroAuditoria,
} from "../../src/kernel/gateway/gateway.js";
import { criarServidorLocal } from "../../src/server/http.js";
import { artefatoAssinado } from "../server/_artefatoAssinado.js";
import { ambienteHttp } from "../server/http-fixture.js";

const PACIENTE = "Paciente Teste 05";
const SEGREDO = "segredo-sintetico-05-NAO-ECOAR";
const AGORA = "2026-10-05T12:00:00Z";
const SESSAO = {
  medicoId: "medico-teste", crm: "CRM-TESTE", emitidaEm: AGORA,
  expiraEm: "2026-10-05T12:01:00Z",
};

function acao(verbo: "IMPRIMIR" | "ENVIAR_EMAIL" = "IMPRIMIR") {
  return {
    verbo, objeto: { tipo: "DOCUMENTO", id: "doc-sintetico-05", versao: 1 },
    escopo: { patientId: PACIENTE, encounterId: "encontro-sintetico-05" },
    destino: null, idempotencyKey: `chave-${SEGREDO}`,
  };
}

function logsSemEco(logs: unknown, proibidos: readonly string[]): void {
  const trilha = JSON.stringify(logs);
  for (const proibido of proibidos) expect(trilha).not.toContain(proibido);
}

function semEco(saida: unknown, logs: unknown, proibidos: readonly string[]): void {
  const texto = typeof saida === "string" ? saida : JSON.stringify(saida);
  for (const proibido of proibidos) expect(texto).not.toContain(proibido);
  logsSemEco(logs, proibidos);
}

function falhaHttp(
  ambiente: Awaited<ReturnType<typeof ambienteHttp>>,
  resposta: { status: number; body: string },
  status: number, codigo: string, rota: string,
): void {
  expect(resposta.status).toBe(status);
  expect(JSON.parse(resposta.body)).toEqual({ codigo });
  expect(ambiente.logs.at(-1)).toEqual({ rota, codigo, status });
  semEco(resposta.body, ambiente.logs, [PACIENTE, SEGREDO, ambiente.token]);
}

describe("FUGU-EIXO-05 · falhas HTTP não refletem PHI, segredo nem token", () => {
  it("401 de login e de sessão rejeitada não devolvem senha, paciente ou bearer", async () => {
    const f = await ambienteHttp();
    try {
      const login = await f.request("/login", "POST",
        JSON.stringify({ senha: `${PACIENTE} ${SEGREDO}` }), undefined, "application/json");
      falhaHttp(f, login, 401, "LOGIN_NEGADO", "login");

      const sessao = await f.request("/acao", "POST",
        JSON.stringify(acao()), SEGREDO, "application/json");
      falhaHttp(f, sessao, 401, "SESSAO_INVALIDA", "acao");
      expect(f.efeitos()).toBe(0);
    } finally { await f.close(); }
  });

  it("400 de JSON inválido e de schema estrito não ecoam o corpo", async () => {
    const f = await ambienteHttp();
    try {
      const invalido = await f.request("/acao", "POST",
        `{"patientId":"${PACIENTE}","segredo":"${SEGREDO}",`,
        f.token, "application/json");
      falhaHttp(f, invalido, 400, "JSON_INVALIDO", "acao");

      const campoExtra = await f.request("/acao", "POST",
        JSON.stringify({ ...acao(), segredo: SEGREDO }), f.token, "application/json");
      falhaHttp(f, campoExtra, 400, "PAYLOAD_INVALIDO", "acao");
      expect(f.efeitos()).toBe(0);
    } finally { await f.close(); }
  });

  it("400 da extração clínica não devolve transcrição sintética nem campo secreto inválido", async () => {
    const f = await ambienteHttp();
    try {
      const erro = await f.request("/consulta/extrair", "POST", JSON.stringify({
        recordingId: "gravacao-sintetica-05", sourceId: "fonte-sintetica-05",
        sourceType: "medical_note", rawTranscript: `Anotação clínica de ${PACIENTE}.`,
        segredo: SEGREDO, // campo extra é recusado pelo schema estrito da rota.
      }), f.token, "application/json");
      falhaHttp(f, erro, 400, "PAYLOAD_INVALIDO", "extrair");
      expect(f.efeitos()).toBe(0);
    } finally { await f.close(); }
  });

  it("404 não registra nem reflete identificador codificado no caminho HTTP", async () => {
    const f = await ambienteHttp();
    try {
      const pacienteNaUrl = encodeURIComponent(PACIENTE);
      const erro = await f.request(`/nao-existe/${pacienteNaUrl}?chave=${SEGREDO}`,
        "POST", "{}", f.token, "application/json");
      falhaHttp(f, erro, 404, "ROTA_NAO_ENCONTRADA", "desconhecida");
      semEco(erro.body, f.logs, [pacienteNaUrl]);
    } finally { await f.close(); }
  });

  it("415 de tipo inválido e 409 de artefato não assinado não ecoam o pedido", async () => {
    const f = await ambienteHttp();
    try {
      const tipo = await f.request("/acao", "POST",
        JSON.stringify(acao()), f.token, "text/plain");
      falhaHttp(f, tipo, 415, "CONTENT_TYPE_INVALIDO", "acao");

      // Sem artefato assinado no ledger, a autorização do servidor deve negar.
      const assinatura = await f.request("/acao", "POST",
        JSON.stringify(acao()), f.token, "application/json");
      falhaHttp(f, assinatura, 409, "ARTEFATO_NAO_ASSINADO", "acao");
      expect(f.efeitos()).toBe(0);
    } finally { await f.close(); }
  });

  it("500 de idempotência corrompida no SQLite não expõe entrada nem erro interno", async () => {
    const f = await ambienteHttp();
    try {
      artefatoAssinado(f.db, { patientId: PACIENTE, encounterId: acao().escopo.encounterId,
        documentId: acao().objeto.id });
      // O store real do /acao faz JSON.parse deste registro e lança no router.
      f.db.prepare(`INSERT INTO action_idempotency(chave,payloadHash,resultado,atualizadoEm)
        VALUES (?,?,?,?)`).run(acao().idempotencyKey, "hash-sintetico",
        `{"paciente":"${PACIENTE}","segredo":"${SEGREDO}",`, AGORA);
      const erro = await f.request("/acao", "POST",
        JSON.stringify(acao()), f.token, "application/json");
      falhaHttp(f, erro, 500, "ERRO_INTERNO", "acao");
      expect(f.efeitos()).toBe(0);
    } finally { await f.close(); }
  });

  it("erro do executor no gateway real chega a /acao apenas como código, sem mensagem sensível", async () => {
    const f = await ambienteHttp();
    const auditorias: RegistroAuditoria[] = [];
    const logs: typeof f.logs = [];
    let chamadas = 0;
    const gateway = criarGateway({
      agora: () => AGORA, store: memoriaIdempotencia(), auditar: (r) => { auditorias.push(r); },
      executores: { IMPRIMIR: { executar: async () => {
        chamadas++;
        throw new Error(`${PACIENTE} ${SEGREDO}`);
      } } },
    });
    const server = criarServidorLocal({
      db: f.db, sessoes: f.sessoes, gateway, agora: () => AGORA,
      log: (entry) => { logs.push(entry); },
    });
    try {
      await new Promise<void>((resolve) => server.listening ? resolve() : server.once("listening", resolve));
      const address = server.address();
      if (!address || typeof address === "string") throw new Error("PORTA_AUSENTE");
      artefatoAssinado(f.db, { patientId: PACIENTE, encounterId: acao().escopo.encounterId,
        documentId: acao().objeto.id });
      const response = await fetch(`http://127.0.0.1:${address.port}/acao`, {
        method: "POST",
        headers: { Authorization: `Bearer ${f.token}`, "Content-Type": "application/json" },
        body: JSON.stringify(acao()),
      });
      const body = await response.text();
      // O contrato HTTP atual usa 200 também para OUTCOME_UNKNOWN: decisão != sucesso.
      expect(response.status).toBe(200);
      expect(JSON.parse(body)).toEqual({
        decisao: "OUTCOME_UNKNOWN", motivoCodigo: "EXCECAO_NO_EXECUTOR_SEM_REENVIO",
      });
      expect(logs.at(-1)).toEqual({
        rota: "acao", codigo: "EXCECAO_NO_EXECUTOR_SEM_REENVIO", status: 200,
      });
      expect(chamadas).toBe(1);
      semEco(body, [...logs, ...auditorias], [PACIENTE, SEGREDO, f.token]);
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
      await f.close();
    }
  });

  it("leitura clínica autenticada do rascunho LOCAL pode devolver o texto sintético", async () => {
    const f = await ambienteHttp();
    try {
      const texto = `Anotação local de ${PACIENTE}: material sintético para revisão médica.`;
      const extracao = await f.request("/consulta/extrair", "POST", JSON.stringify({
        recordingId: "gravacao-sintetica-05", sourceId: "fonte-sintetica-05",
        sourceType: "medical_note", rawTranscript: texto,
      }), f.token, "application/json");
      expect(extracao.status).toBe(201);
      const { draftId } = JSON.parse(extracao.body) as { draftId: string };
      expect(typeof draftId).toBe("string");
      const carregado = await f.request("/consulta/rascunho", "POST",
        JSON.stringify({ draftId }), f.token, "application/json");
      expect(carregado.status).toBe(200);
      const local = JSON.parse(carregado.body) as {
        draft: { payload: { input: { rawTranscript: string } } };
      };
      expect(local.draft.payload.input.rawTranscript).toBe(texto);
      expect(carregado.body).toContain(PACIENTE); // prontuário local, não saída de erro.
      logsSemEco(f.logs, [PACIENTE, SEGREDO, f.token]); // apenas o log segue sem PHI.
      expect(f.efeitos()).toBe(0);
    } finally { await f.close(); }
  });
});

describe("FUGU-EIXO-05 · auditoria e falhas do gateway sem egress externo", () => {
  it("exceção da validação de saída não ecoa PHI/segredo na decisão nem na auditoria", async () => {
    const auditorias: RegistroAuditoria[] = [];
    let chamadas = 0;
    const gateway = criarGateway({
      agora: () => AGORA, store: memoriaIdempotencia(), auditar: (r) => { auditorias.push(r); },
      executores: { ENVIAR_EMAIL: { executar: async () => {
        chamadas++;
        return { ok: true, recibo: "recibo-sintetico" };
      } } },
      validarSaida: () => { throw new Error(`${PACIENTE} ${SEGREDO}`); },
    });
    const resultado = await gateway.executar(acao("ENVIAR_EMAIL"), SESSAO);
    expect(resultado).toEqual({ decisao: "NEGADA", motivoCodigo: "CONTEXTO_SAIDA_INDISPONIVEL" });
    expect(auditorias).toEqual([{
      acaoPedida: "ENVIAR_EMAIL", decisao: "NEGADA",
      motivoCodigo: "CONTEXTO_SAIDA_INDISPONIVEL", em: AGORA,
    }]);
    expect(chamadas).toBe(0);
    semEco(resultado, auditorias, [PACIENTE, SEGREDO]);
  });

  it("código de negativa não confiável da validação não vira código público nem log", async () => {
    const auditorias: RegistroAuditoria[] = [];
    const gateway = criarGateway({
      agora: () => AGORA, store: memoriaIdempotencia(), auditar: (r) => { auditorias.push(r); },
      executores: {},
      validarSaida: () => ({ ok: false, codigo: `${PACIENTE} ${SEGREDO}` }),
    });
    const resultado = await gateway.executar(acao("ENVIAR_EMAIL"), SESSAO);
    expect(resultado).toEqual({ decisao: "NEGADA", motivoCodigo: "SAIDA_NAO_AUTORIZADA" });
    expect(auditorias.at(-1)).toMatchObject({
      acaoPedida: "ENVIAR_EMAIL", decisao: "NEGADA", motivoCodigo: "SAIDA_NAO_AUTORIZADA",
    });
    semEco(resultado, auditorias, [PACIENTE, SEGREDO]);
  });

  it.each([
    { cenario: "falha certa", retorno: { ok: false as const, incerto: false, erro: `${PACIENTE} ${SEGREDO}` },
      decisao: "FALHOU", codigo: "FALHA_EXECUTOR" },
    { cenario: "falha incerta", retorno: { ok: false as const, incerto: true, erro: `${PACIENTE} ${SEGREDO}` },
      decisao: "OUTCOME_UNKNOWN", codigo: "RESULTADO_INCERTO_SEM_REENVIO" },
  ])("$cenario do executor não reflete mensagem na saída ou auditoria", async ({ retorno, decisao, codigo }) => {
    const auditorias: RegistroAuditoria[] = [];
    const gateway = criarGateway({
      agora: () => AGORA, store: memoriaIdempotencia(), auditar: (r) => { auditorias.push(r); },
      executores: { IMPRIMIR: { executar: async () => retorno } },
    });
    const resultado = await gateway.executar(acao(), SESSAO);
    expect(resultado).toEqual({ decisao, motivoCodigo: codigo });
    expect(auditorias.at(-1)).toMatchObject({
      acaoPedida: "IMPRIMIR", decisao: "PERMITIDA", motivoCodigo: codigo,
    });
    semEco(resultado, auditorias, [PACIENTE, SEGREDO]);
  });
});
