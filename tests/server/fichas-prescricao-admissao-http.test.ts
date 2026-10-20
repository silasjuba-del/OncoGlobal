// Fichas de protocolo e contextos inteiramente sintéticos; HTTP real em loopback.
import { createServer, type Server } from "node:http";
import { afterEach, expect, it } from "vitest";
import { abrirLedger } from "../../src/kernel/ledger/db.js";
import { criarGateway, memoriaIdempotencia } from "../../src/kernel/gateway/gateway.js";
import { hashCanonico } from "../../src/modules/hash.js";
import { criarGerenciadorSessao } from "../../src/server/sessao.js";
import { rotear, type ServidorDeps } from "../../src/server/rotas.js";
import type { ProtocolTemplate } from "../../src/contracts/w10/prescricao.js";

const AGORA = "2026-10-20T12:00:00.000Z";
const SENHA = "senha-sintetica-admissao-fichas";
const servidores: Array<{ server: Server; db: ReturnType<typeof abrirLedger> }> = [];

afterEach(async () => {
  for (const item of servidores.splice(0)) {
    await new Promise<void>(resolve => item.server.close(() => resolve()));
    item.db.close();
  }
});

function template(overrides: Partial<ProtocolTemplate> = {}): ProtocolTemplate {
  return {
    templateId: "ficha-prescricao-sintetica",
    tumor: "Tumor inteiramente sintético",
    nome: "Esquema demonstrativo sintético",
    cenario: "Cenário de teste, sem uso clínico",
    versao: "1.0.0",
    hash: "rotulo-legado-sintetico",
    codigoInstitucional: null,
    intervaloDias: 21,
    ciclos: 4,
    itens: [{
      drug: "Fármaco sintético A",
      classe: "QT",
      sequence: 1,
      standardDose: 10,
      doseBasis: "FIXED",
      calculatedDose: null,
      prescribedDose: null,
      unit: "mg",
      adjustmentPercent: null,
      adjustmentReason: null,
      route: "EV",
      diluent: null,
      finalVolumeMl: null,
      infusionTime: null,
      days: ["d1"],
      observacao: null,
      source: "PROTOCOL",
      overrideMotivo: null,
    }],
    limiaresBula: null,
    fonte: "Referência integralmente sintética de teste",
    status: "RASCUNHO",
    ...overrides,
  };
}

async function abrir(templates: ProtocolTemplate[] = [template()]) {
  let agora = AGORA;
  const db = abrirLedger(":memory:");
  const sessoes = criarGerenciadorSessao({ medicoId: "medico-sintetico", crm: "CRM-SINTETICO",
    senha: SENHA, duracaoMs: 60_000, agora: () => agora });
  const gateway = criarGateway({ agora: () => agora, store: memoriaIdempotencia(), auditar: () => {}, executores: {} });
  const corpus = { templatesProtocolo: templates } as unknown as NonNullable<ServidorDeps["corpus"]>;
  const deps: ServidorDeps = { db, sessoes, gateway, corpus, agora: () => agora, log: () => {} };
  const server = createServer((req, res) => {
    void rotear(deps, req, res).catch(() => {
      if (!res.headersSent) res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ codigo: "ERRO_HTTP_TESTE" }));
    });
  });
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("PORTA_AUSENTE");
  const token = sessoes.login(SENHA)!.token;
  servidores.push({ server, db });
  return {
    db, token,
    now: (value: string) => { agora = value; },
    request: async (path: string, body: unknown, bearer: string | null = token) => {
      const response = await fetch(`http://127.0.0.1:${address.port}${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(bearer ? { Authorization: `Bearer ${bearer}` } : {}) },
        body: JSON.stringify(body),
      });
      return { status: response.status, body: await response.json() as Record<string, any> };
    },
  };
}

async function listar(a: Awaited<ReturnType<typeof abrir>>) {
  return a.request("/consulta/prescricao/fichas/listar", {});
}

function fichaDa(resposta: { body: Record<string, any> }): Record<string, any> {
  return resposta.body.ficha ?? resposta.body;
}

function pedidoRevisao(ficha: Record<string, any>, extra: Record<string, unknown> = {}) {
  return {
    templateId: ficha.template.templateId,
    versao: ficha.template.versao,
    expectedContentHash: ficha.contentHash,
    expectedRevision: ficha.revision,
    decisao: "CONFERIR",
    motivo: "Revisão médica de ficha sintética",
    idempotencyKey: "revisar-ficha-sintetica-1",
    ...extra,
  };
}

it("lista template sintético intacto com digest de conteúdo e ignora status auto declarado", async () => {
  const original = template({ status: "CONFERIDA_MEDICO" });
  const a = await abrir([original]);

  const resposta = await listar(a);
  expect(resposta.status).toBe(200);
  expect(resposta.body.fichas).toHaveLength(1);
  const ficha = resposta.body.fichas[0];
  expect(ficha).toMatchObject({ template: original, revision: 0, revisao: null, estado: "PENDENTE", bloqueios: [] });
  expect(ficha.contentHash).toBe(hashCanonico(original));
  expect(ficha.contentHash).toMatch(/^[a-f0-9]{64}$/);
  expect(ficha.template.fonte).toBe(original.fonte);
});

it("exige sessão válida e não aceita identidade de ator vinda do cliente", async () => {
  const a = await abrir();
  expect((await a.request("/consulta/prescricao/fichas/listar", {}, null)).status).toBe(401);
  const ficha = (await listar(a)).body.fichas[0];
  expect((await a.request("/consulta/prescricao/fichas/revisar", pedidoRevisao(ficha, { medicoId: "ator-forjado" }))).status).toBe(400);
  a.now("2026-10-20T12:01:01.000Z");
  expect((await listar(a)).status).toBe(401);
});

it("rejeita hash e revisão obsoletos com conflito HTTP", async () => {
  const a = await abrir();
  const ficha = (await listar(a)).body.fichas[0];
  expect((await a.request("/consulta/prescricao/fichas/revisar", pedidoRevisao(ficha,
    { expectedContentHash: "0".repeat(64) }))).status).toBe(409);
  expect((await a.request("/consulta/prescricao/fichas/revisar", pedidoRevisao(ficha,
    { expectedRevision: 1 }))).status).toBe(409);
});

it("registra revisão médica atribuída à sessão e retry idempotente sem nova revisão", async () => {
  const a = await abrir([template({ status: "RASCUNHO" })]);
  const eventosAntes = Number((a.db.prepare("SELECT COUNT(*) AS n FROM clinical_event").get() as { n: number }).n);
  const original = (await listar(a)).body.fichas[0];
  const pedido = pedidoRevisao(original);
  const primeira = await a.request("/consulta/prescricao/fichas/revisar", pedido);
  expect(primeira.status).toBe(200);
  const fichaRevisada = fichaDa(primeira);
  expect(fichaRevisada).toMatchObject({ revision: 1, estado: "CONFERIDA", template: original.template });
  expect(fichaRevisada.revisao).toMatchObject({ templateId: original.template.templateId,
    versao: original.template.versao, revision: 1, decisao: "CONFERIR", medicoId: "medico-sintetico",
    motivo: pedido.motivo, contentHash: original.contentHash });
  expect(fichaRevisada.revisao.em).toBe(AGORA);
  expect(fichaRevisada.revisao.reviewHash).toMatch(/^[a-f0-9]{64}$/);

  const retry = await a.request("/consulta/prescricao/fichas/revisar", pedido);
  expect(retry.status).toBe(200);
  expect(fichaDa(retry).revision).toBe(1);
  expect(fichaDa(retry).revisao.reviewHash).toBe(fichaRevisada.revisao.reviewHash);
  expect(Number((a.db.prepare("SELECT COUNT(*) AS n FROM clinical_event").get() as { n: number }).n)).toBe(eventosAntes);

  const conflitoReplay = await a.request("/consulta/prescricao/fichas/revisar", pedidoRevisao(original,
    { motivo: "Pedido diferente com mesma chave" }));
  expect(conflitoReplay.status).toBe(409);
});

it("inativa e reconfere a ficha por revisões sequenciais", async () => {
  const a = await abrir();
  const inicial = (await listar(a)).body.fichas[0];
  const conferida = fichaDa(await a.request("/consulta/prescricao/fichas/revisar", pedidoRevisao(inicial)));
  expect(conferida.revision).toBe(1);
  expect(conferida.estado).toBe("CONFERIDA");

  const inativada = fichaDa(await a.request("/consulta/prescricao/fichas/revisar", pedidoRevisao(conferida,
    { expectedRevision: 1, decisao: "INATIVAR", motivo: "Inativação sintética", idempotencyKey: "inativar-ficha-1" })));
  expect(inativada.revision).toBe(2);
  expect(inativada.estado).toBe("INATIVA");
  expect(inativada.revisao).toMatchObject({ revision: 2, decisao: "INATIVAR", medicoId: "medico-sintetico" });

  const reconferida = fichaDa(await a.request("/consulta/prescricao/fichas/revisar", pedidoRevisao(inativada,
    { expectedRevision: 2, decisao: "CONFERIR", motivo: "Nova conferência sintética", idempotencyKey: "reconferir-ficha-1" })));
  expect(reconferida.revision).toBe(3);
  expect(reconferida.estado).toBe("CONFERIDA");
  expect(reconferida.revisao).toMatchObject({ revision: 3, decisao: "CONFERIR", medicoId: "medico-sintetico" });
});

it("bloqueia colisão de templateId/versão sem eleger um template", async () => {
  const primeiro = template({ status: "RASCUNHO" });
  const segundo = template({ nome: "Outro conteúdo sintético", fonte: "Outra fonte sintética" });
  const a = await abrir([primeiro, segundo]);
  const lista = await listar(a);
  expect(lista.status).toBe(200);
  expect(lista.body.fichas).toHaveLength(1);
  expect(lista.body.fichas[0].bloqueios.length).toBeGreaterThan(0);

  const tentativa = await a.request("/consulta/prescricao/fichas/revisar", {
    templateId: primeiro.templateId, versao: primeiro.versao,
    expectedContentHash: hashCanonico(primeiro), expectedRevision: 0,
    decisao: "CONFERIR", motivo: "Revisão em identidade duplicada", idempotencyKey: "colisao-1",
  });
  expect(tentativa.status).toBe(409);
});
