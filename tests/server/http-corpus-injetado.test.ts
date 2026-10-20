// Bootstrap HTTP com fichas e banco sem dados de paciente, inteiramente sintéticos.
import { afterEach, expect, it } from "vitest";
import { abrirLedger } from "../../src/kernel/ledger/db.js";
import { criarGateway, memoriaIdempotencia } from "../../src/kernel/gateway/gateway.js";
import { ProtocolTemplate } from "../../src/contracts/w10/prescricao.js";
import type { ServidorDeps } from "../../src/server/rotas.js";
import { criarServidorLocal } from "../../src/server/http.js";
import { criarGerenciadorSessao } from "../../src/server/sessao.js";

const AGORA = "2026-10-20T12:00:00.000Z";
const SENHA = "senha-sintetica-corpus-injetado";
const ambientes: Array<{ server: ReturnType<typeof criarServidorLocal>; db: ReturnType<typeof abrirLedger> }> = [];

afterEach(async () => {
  for (const ambiente of ambientes.splice(0)) {
    await new Promise<void>(resolve => ambiente.server.close(() => resolve()));
    ambiente.db.close();
  }
});

function fichaSintetica(): ProtocolTemplate {
  return ProtocolTemplate.parse({
    templateId: "template-http-sintetico",
    tumor: "Tumor sintético",
    nome: "Ficha de teste",
    cenario: "Cenário sintético sem uso clínico",
    versao: "1.0.0",
    hash: "rotulo-legado-sintetico",
    codigoInstitucional: null,
    intervaloDias: 21,
    ciclos: 4,
    itens: [{ drug: "Fármaco sintético", classe: "QT", sequence: 1, standardDose: 1,
      doseBasis: "FIXED", calculatedDose: null, prescribedDose: null, unit: "mg",
      adjustmentPercent: null, adjustmentReason: null, route: "EV", diluent: null,
      finalVolumeMl: null, infusionTime: null, days: ["d1"], observacao: null,
      source: "PROTOCOL", overrideMotivo: null }],
    limiaresBula: null,
    fonte: "Fonte inteiramente sintética",
    status: "RASCUNHO",
  });
}

async function abrir(corpus: NonNullable<ServidorDeps["corpus"]> | null) {
  const db = abrirLedger(":memory:");
  const sessoes = criarGerenciadorSessao({ medicoId: "medico-http-sintetico", crm: "CRM-SINTETICO",
    senha: SENHA, duracaoMs: 60_000, agora: () => AGORA });
  const gateway = criarGateway({ agora: () => AGORA, store: memoriaIdempotencia(), auditar: () => {}, executores: {} });
  const server = criarServidorLocal({ db, sessoes, gateway, corpus, settings: null,
    agora: () => AGORA, log: () => {} });
  await new Promise<void>((resolve, reject) => {
    if (server.listening) return resolve();
    server.once("error", reject);
    server.once("listening", resolve);
  });
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("PORTA_AUSENTE");
  const token = sessoes.login(SENHA)!.token;
  const ambiente = { server, db };
  ambientes.push(ambiente);
  return {
    ...ambiente,
    request: async (path: string) => {
      const response = await fetch(`http://127.0.0.1:${address.port}${path}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: "{}",
      });
      return { status: response.status, body: await response.json() as { fichas?: Array<Record<string, any>> } };
    },
  };
}

it("usa a ficha sintética injetada no bootstrap HTTP e não grava ClinicalEvent ao listar", async () => {
  const original = fichaSintetica();
  const corpus = { templatesProtocolo: [original] } as unknown as NonNullable<ServidorDeps["corpus"]>;
  const ambiente = await abrir(corpus);
  const antes = Number((ambiente.db.prepare("SELECT COUNT(*) AS n FROM clinical_event").get() as { n: number }).n);

  const resposta = await ambiente.request("/consulta/prescricao/fichas/listar");

  expect(resposta.status).toBe(200);
  expect(resposta.body.fichas).toHaveLength(1);
  expect(resposta.body.fichas?.[0]).toMatchObject({ template: original, revision: 0, revisao: null, estado: "PENDENTE" });
  expect(resposta.body.fichas?.[0]?.contentHash).toMatch(/^[a-f0-9]{64}$/);
  expect(Number((ambiente.db.prepare("SELECT COUNT(*) AS n FROM clinical_event").get() as { n: number }).n)).toBe(antes);
});

it("preserva null de bootstrap e não carrega automaticamente o corpus de disco", async () => {
  const ambiente = await abrir(null);

  const resposta = await ambiente.request("/consulta/prescricao/fichas/listar");

  expect(resposta.status).toBe(200);
  expect(resposta.body.fichas).toEqual([]);
  expect(Number((ambiente.db.prepare("SELECT COUNT(*) AS n FROM clinical_event").get() as { n: number }).n)).toBe(0);
});
