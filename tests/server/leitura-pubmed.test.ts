import { describe, expect, it } from "vitest";
import { ambienteHttp } from "./http-fixture.js";
import { salvarDraft, lerDraft, listarDrafts, listarDraftsSemVinculo } from "../../src/kernel/ledger/drafts.js";
import { confirmar } from "../../src/kernel/ledger/writeRouter.js";
import { fonteSintetica, triagemBase } from "../fixtures/triagem.js";
import { criarTransportePubMed } from "../../src/kernel/gateway/executores/pubmed.js";
import type { ReadTransport } from "../../src/kernel/gateway/gateway.js";
import type { DatabaseSync } from "node:sqlite";
import { LIMITE_LISTA_RASCUNHOS_PUBMED } from "../../src/contracts/leituraPubMed.js";
import { montarPedidoPubMed } from "../../src/ui/api/pesquisaPubMed.js";

const AGORA = "2026-10-05T12:00:00Z";
const CONSULTA = "pembrolizumab metastatic nsclc";

function pedido(payload: { query?: string; refs?: string[] }, requestId = "pubmed-req-01") {
  return JSON.stringify({ requestId, purpose: "RESEARCH", destination: "PUBMED", payload, timeoutMs: 1000 });
}

function referencia(pmid = "12345678") {
  return {
    pmid, titulo: "Pembrolizumab in metastatic NSCLC", periodico: "N Engl J Med", publicadoEm: "2026",
    url: `https://pubmed.ncbi.nlm.nih.gov/${pmid}/`, recuperadoEm: AGORA, fatoClinico: false as const,
  };
}

async function plantar(transporte?: ReadTransport, selecionar = true) {
  const a = await ambienteHttp(transporte ? { transportePubMed: transporte } : {});
  const triagem = triagemBase();
  const contexto = { patientId: triagem.patientId, encounterId: triagem.encounterId, tumorLotId: null as null };
  salvarDraft(a.db, { draftId: "cadastro-sintetico", patientId: contexto.patientId, sourceId: "fixture",
    rawRef: "fixture-local", payload: {}, diagnostics: [], revision: 0, criadoEm: AGORA });
  expect(confirmar(a.db, { ...contexto, operationId: "cadastro-sintetico-op", reviewDecisionId: "revisao-cadastro",
    sessao: a.sessoes.obter(a.token)!, em: AGORA, registros: [{ draftId: "cadastro-sintetico", expectedRevision: 0,
      eventId: "cadastro-evento", tipo: "Paciente", fontes: [fonteSintetica()], revisao: "CONFIRMADO", payload: {
        patientId: contexto.patientId, nome: "Paciente sintético", identificadores: [], nascimento: null,
        sexoCadastral: "NAO_INFORMADO", divergencia: false } }] }).estado).toBe("GRAVADA");
  if (selecionar) a.sessoes.selecionarConsulta(a.token, contexto);
  return { a, contexto };
}

function gravarBibliografica(db: DatabaseSync, draftId: string, criadoEm: string,
  referencias: ReturnType<typeof referencia>[], patientId: string | null = null) {
  salvarDraft(db, {
    draftId, patientId, sourceId: "ncbi-eutils-pubmed", rawRef: `pubmed-local:${draftId}`,
    revision: 0, criadoEm, diagnostics: ["REFERENCIA_BIBLIOGRAFICA", "NAO_E_FATO_CLINICO"],
    payload: { kind: "PUBMED_REFERENCIAS_RASCUNHO", consultaHash: "ab".repeat(32),
      referencias, criaEventoClinico: false, consultaClinica: false },
  });
}

function eventos(db: DatabaseSync) {
  const row = db.prepare("SELECT count(*) AS n FROM clinical_event").get() as { n: number } | undefined;
  return Number(row?.n ?? 0);
}

describe("leitura PubMed", () => {
  it("exige consulta selecionada e não chama o transporte", async () => {
    let chamadas = 0;
    const transporte: ReadTransport = async () => { chamadas++; return { referencias: [] }; };
    const { a } = await plantar(transporte, false);
    try {
      const r = await a.request("/consulta/leitura", "POST", pedido({ query: CONSULTA }), a.token, "application/json");
      expect(r.status).toBe(409);
      expect(JSON.parse(r.body)).toEqual({ codigo: "CONTEXTO_CONSULTA_NAO_SELECIONADO" });
      expect(chamadas).toBe(0);
      expect(listarDraftsSemVinculo(a.db)).toEqual([]);
    } finally { await a.close(); }
  });

  it("barra o nome conhecido antes do transporte e não grava rascunho", async () => {
    let chamadas = 0;
    const transporte: ReadTransport = async () => { chamadas++; return { referencias: [referencia()] }; };
    const { a, contexto } = await plantar(transporte);
    try {
      const antes = eventos(a.db);
      const r = await a.request("/consulta/leitura", "POST", pedido({ query: "Paciente sintético pembrolizumab" }), a.token, "application/json");
      expect(r.status).toBe(409);
      expect(JSON.parse(r.body)).toEqual({ codigo: "READ_PHI_NAO_VALIDADA" });
      expect(chamadas).toBe(0);
      expect(eventos(a.db)).toBe(antes);
      expect(listarDrafts(a.db, contexto.patientId).map((d) => d.draftId)).toEqual(["cadastro-sintetico"]);
      expect(JSON.stringify(a.logs)).not.toContain("Paciente");
    } finally { await a.close(); }
  });

  it("persiste referência bibliográfica fora do prontuário e repete sem nova rede", async () => {
    const urls: string[] = [];
    const cliente = (async (entrada: URL | RequestInfo, init?: RequestInit) => {
      const url = entrada instanceof URL ? entrada : new URL(String(entrada));
      urls.push(url.toString());
      expect(init).toMatchObject({ method: "GET", redirect: "error" });
      expect(url.origin).toBe("https://eutils.ncbi.nlm.nih.gov");
      expect(url.toString()).not.toMatch(/paciente|medico-teste|CRM-TESTE/i);
      const corpo = url.pathname.endsWith("/esearch.fcgi")
        ? { esearchresult: { idlist: ["12345678"] } }
        : { result: { "12345678": { uid: "12345678", title: "Pembrolizumab in metastatic NSCLC", source: "N Engl J Med", pubdate: "2026" } } };
      const bytes = new TextEncoder().encode(JSON.stringify(corpo));
      return { ok: true, headers: { get: () => String(bytes.byteLength) }, arrayBuffer: async () => {
        const copia = new Uint8Array(bytes.byteLength); copia.set(bytes); return copia.buffer;
      } } as unknown as Response;
    }) as typeof fetch;
    const { a, contexto } = await plantar(criarTransportePubMed({ cliente, agora: () => AGORA }));
    try {
      const antes = eventos(a.db);
      const primeiro = await a.request("/consulta/leitura", "POST", pedido({ query: CONSULTA }), a.token, "application/json");
      expect(primeiro.status).toBe(201);
      const salvo = JSON.parse(primeiro.body);
      expect(salvo).toMatchObject({ codigo: "REFERENCIAS_SALVAS", revision: 0, criaEventoClinico: false, consultaClinica: false });
      expect(salvo.referencias).toEqual([referencia()]);
      const draft = lerDraft(a.db, salvo.draftId);
      expect(draft?.patientId).toBeNull();
      expect(draft?.rawRef).toBe(`pubmed-local:${salvo.draftId}`);
      expect(String(draft?.rawRef)).not.toMatch(/^https?:/i);
      expect(draft?.payload).toMatchObject({ kind: "PUBMED_REFERENCIAS_RASCUNHO", criaEventoClinico: false, consultaClinica: false });
      expect(listarDrafts(a.db, contexto.patientId).some((item) => item.draftId === salvo.draftId)).toBe(false);
      expect(eventos(a.db)).toBe(antes);
      expect(urls).toHaveLength(2);
      const replay = await a.request("/consulta/leitura", "POST", pedido({ query: CONSULTA }), a.token, "application/json");
      expect(replay.status).toBe(200);
      expect(JSON.parse(replay.body)).toMatchObject({ codigo: "REPLAY", draftId: salvo.draftId, revision: 0 });
      expect(urls).toHaveLength(2);
      const divergente = await a.request("/consulta/leitura", "POST", pedido({ query: "osimertinib egfr nsclc" }), a.token, "application/json");
      expect(divergente.status).toBe(409);
      expect(JSON.parse(divergente.body)).toEqual({ codigo: "READ_OPERACAO_DIVERGENTE" });
      expect(urls).toHaveLength(2);
      expect(lerDraft(a.db, salvo.draftId)?.revision).toBe(0);
      expect(JSON.stringify(a.logs)).not.toContain(CONSULTA);
      expect(JSON.stringify(a.logs)).not.toContain(contexto.patientId);
    } finally { await a.close(); }
  });

  it("recusa consulta com forma de identificador antes de qualquer fetch", async () => {
    const urls: string[] = [];
    const cliente = (async (entrada: URL | RequestInfo) => {
      urls.push(String(entrada));
      throw new Error("REDE_PROIBIDA");
    }) as typeof fetch;
    const { a } = await plantar(criarTransportePubMed({ cliente, agora: () => AGORA }));
    try {
      const antes = eventos(a.db);
      const r = await a.request("/consulta/leitura", "POST", pedido({ query: "000.000.000-00" }), a.token, "application/json");
      expect(r.status).toBe(502);
      expect(JSON.parse(r.body)).toEqual({ codigo: "READ_TRANSPORTE_FALHOU" });
      expect(urls).toEqual([]);
      expect(eventos(a.db)).toBe(antes);
      expect(listarDraftsSemVinculo(a.db)).toEqual([]);
    } finally { await a.close(); }
  });
});

describe("lista local de rascunhos PubMed", () => {
  it("exige consulta aberta e corpo vazio", async () => {
    const { a } = await plantar(undefined, false);
    try {
      const semConsulta = await a.request("/consulta/leitura/rascunhos", "POST", "{}", a.token, "application/json");
      expect(semConsulta.status).toBe(409);
      expect(JSON.parse(semConsulta.body)).toEqual({ codigo: "CONTEXTO_CONSULTA_NAO_SELECIONADO" });
    } finally { await a.close(); }
    const aberto = await plantar();
    try {
      const invalido = await aberto.a.request("/consulta/leitura/rascunhos", "POST",
        JSON.stringify({ patientId: aberto.contexto.patientId }), aberto.a.token, "application/json");
      expect(invalido.status).toBe(400);
      expect(JSON.parse(invalido.body)).toEqual({ codigo: "PAYLOAD_INVALIDO" });
      expect(invalido.body).not.toContain(aberto.contexto.patientId);
    } finally { await aberto.a.close(); }
  });

  it("devolve só metadado bibliográfico local, sem prontuário e sem rede", async () => {
    const { a, contexto } = await plantar();
    try {
      const antes = eventos(a.db);
      const prontuarioAntes = listarDrafts(a.db, contexto.patientId).map((item) => item.draftId);
      gravarBibliografica(a.db, "pubmed-antigo", "2026-10-05T12:00:01Z", [referencia("11111111")]);
      gravarBibliografica(a.db, "pubmed-recente", "2026-10-05T12:00:02Z", [referencia("22222222")]);
      gravarBibliografica(a.db, "pubmed-vinculado", AGORA, [referencia("33333333")], contexto.patientId);
      salvarDraft(a.db, { draftId: "pubmed-ilegivel", patientId: null, sourceId: "ncbi-eutils-pubmed",
        rawRef: "pubmed-local:pubmed-ilegivel", revision: 0, criadoEm: AGORA, diagnostics: [],
        payload: { kind: "PUBMED_REFERENCIAS_RASCUNHO", consultaHash: "ab".repeat(32) } });
      gravarBibliografica(a.db, "pubmed-url-estranha", "2026-10-05T12:00:03Z",
        [{ ...referencia("44444444"), url: "https://example.com/44444444/" }]);
      for (let i = 0; i < LIMITE_LISTA_RASCUNHOS_PUBMED; i++) {
        gravarBibliografica(a.db, `pubmed-${i.toString(16).padStart(32, "0")}`,
          `2026-10-05T11:${String(i).padStart(2, "0")}:00Z`, [referencia(String(20000000 + i))]);
      }
      const r = await a.request("/consulta/leitura/rascunhos", "POST", "{}", a.token, "application/json");
      expect(r.status).toBe(200);
      const corpo = JSON.parse(r.body);
      expect(corpo.codigo).toBe("RASCUNHOS_PUBMED_LISTADOS");
      expect(corpo.criaEventoClinico).toBe(false);
      expect(corpo.consultaClinica).toBe(false);
      expect(corpo.truncado).toBe(true);
      expect(corpo.omitidos).toBe(2);
      expect(corpo.itens).toHaveLength(LIMITE_LISTA_RASCUNHOS_PUBMED);
      expect(corpo.itens[0].draftId).toBe("pubmed-recente");
      expect(corpo.itens[0].referencias[0]).toMatchObject({ pmid: "22222222", fatoClinico: false });
      expect(corpo.itens[1].draftId).toBe("pubmed-antigo");
      const texto = JSON.stringify(corpo);
      expect(texto).not.toContain(contexto.patientId);
      expect(texto).not.toContain("Paciente sintético");
      expect(texto).not.toContain("33333333");
      expect(texto).not.toContain("44444444");
      expect(texto).not.toContain("ab".repeat(32));
      expect(texto).not.toContain("example.com");
      expect(eventos(a.db)).toBe(antes);
      expect(listarDrafts(a.db, contexto.patientId).map((item) => item.draftId).sort())
        .toEqual([...prontuarioAntes, "pubmed-vinculado"].sort());
      expect(JSON.stringify(a.logs)).not.toContain("Pembrolizumab");
    } finally { await a.close(); }
  });

  it("aceita o pedido montado na consulta, lista o rascunho e repete sem nova rede", async () => {
    const recebidos: unknown[] = [];
    const transporte: ReadTransport = async (pedido) => {
      recebidos.push(pedido);
      return { referencias: [referencia()] };
    };
    const { a, contexto } = await plantar(transporte);
    try {
      const antes = eventos(a.db);
      const corpo = JSON.stringify(montarPedidoPubMed(`  ${CONSULTA}  `));
      expect(corpo).not.toMatch(/paciente|medico-teste|CRM-TESTE|https?:/i);
      const primeiro = await a.request("/consulta/leitura", "POST", corpo, a.token, "application/json");
      expect(primeiro.status).toBe(201);
      const salvo = JSON.parse(primeiro.body);
      expect(salvo.codigo).toBe("REFERENCIAS_SALVAS");
      expect(lerDraft(a.db, salvo.draftId)?.patientId).toBeNull();
      expect(recebidos).toHaveLength(1);
      expect(recebidos[0]).toMatchObject({ query: CONSULTA });
      expect(JSON.stringify(recebidos[0])).not.toMatch(/paciente/i);
      const listaResp = await a.request("/consulta/leitura/rascunhos", "POST", "{}", a.token, "application/json");
      expect(listaResp.status).toBe(200);
      const json = JSON.parse(listaResp.body);
      expect(json.itens.some((item: { referencias: { titulo: string }[] }) =>
        item.referencias.some((ref) => ref.titulo === "Pembrolizumab in metastatic NSCLC"))).toBe(true);
      const texto = JSON.stringify(json);
      expect(texto).not.toContain(contexto.patientId);
      expect(texto).not.toContain("Paciente sintético");
      expect(texto).not.toContain("consultaHash");
      expect(texto).not.toContain("CRM-TESTE");
      expect(eventos(a.db)).toBe(antes);
      const replay = await a.request("/consulta/leitura", "POST", corpo, a.token, "application/json");
      expect(replay.status).toBe(200);
      expect(JSON.parse(replay.body).codigo).toBe("REPLAY");
      expect(recebidos).toHaveLength(1);
    } finally { await a.close(); }
  });
});

describe("pedido bibliográfico da consulta", () => {
  it("repete o mesmo requestId para a mesma consulta aparada e não leva paciente nem URL", () => {
    const aparado = montarPedidoPubMed("  pembrolizumab metastatic nsclc  ");
    const igual = montarPedidoPubMed("pembrolizumab metastatic nsclc");
    const outro = montarPedidoPubMed("osimertinib egfr nsclc");
    expect(aparado.requestId).toBe(igual.requestId);
    expect(outro.requestId).not.toBe(aparado.requestId);
    expect(aparado.requestId).toMatch(/^[A-Za-z0-9._:-]{8,160}$/);
    expect(aparado.payload).toEqual({ query: "pembrolizumab metastatic nsclc" });
    expect(aparado).not.toHaveProperty("patientId");
    expect(JSON.stringify(aparado)).not.toMatch(/paciente|sessao|https?:/i);
    expect(() => montarPedidoPubMed("   ")).toThrow();
  });
});
