import { createHash } from "node:crypto";
import { afterEach, expect, it, vi } from "vitest";
import { ContextoAcaoComposta } from "../../src/contracts/api/acoesCompostas.js";
import { hashCanonico } from "../../src/modules/hash.js";
import { FichaProtocoloCatalogoSchema, InstanciacaoFichaRespostaSchema,
  type FichaProtocoloCatalogo, type InstanciacaoFichaResposta,
  type InstanciarFichaPedido, type RevisarFichaPedido } from "../../src/contracts/api/fichasPrescricao.js";
import { ErroPorta } from "../../src/ui/api/porta.js";
import { criarPortaHttp } from "../../src/ui/api/http.js";

afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

const sha = (value: string) => createHash("sha256").update(value).digest("hex");
const hash = hashCanonico(template());
const reviewHash = sha("revisão local sintética v1");
const revisaoFatos = sha("retrato sintético v1");
const contexto = ContextoAcaoComposta.parse({ patientId: "paciente-sintetico-ficha-1",
  encounterId: "encontro-sintetico-ficha-1", tumorLotId: "lote-sintetico-ficha-1" });

function template(overrides: Record<string, unknown> = {}) {
  return {
    templateId: "template-sintetico-1", tumor: "Tumor sintético", nome: "Esquema sintético",
    cenario: "Cenário de teste", versao: "1.0.0", hash: "rotulo-legado-sintetico",
    codigoInstitucional: null, intervaloDias: 21, ciclos: 4,
    itens: [{ drug: "Fármaco sintético", classe: "QT", sequence: 1, standardDose: 10,
      doseBasis: "FIXED", calculatedDose: null, prescribedDose: null, unit: "mg",
      adjustmentPercent: null, adjustmentReason: null, route: "EV", diluent: null,
      finalVolumeMl: null, infusionTime: null, days: ["d1"], observacao: null,
      source: "PROTOCOL", overrideMotivo: null }],
    limiaresBula: null, fonte: "Fonte sintética sem uso clínico", status: "RASCUNHO",
    ...overrides,
  };
}

function ficha(options: { template?: Record<string, unknown>; contentHash?: string; revision?: number;
  decisao?: "CONFERIR" | "INATIVAR" } = {}): FichaProtocoloCatalogo {
  const t = options.template ?? template();
  const contentHash = options.contentHash ?? hash;
  const revision = options.revision ?? 5;
  const decisao = options.decisao ?? "CONFERIR";
  return FichaProtocoloCatalogoSchema.parse({ template: t, contentHash, revision,
    revisao: { templateId: t.templateId, versao: t.versao, revision, decisao,
      medicoId: "medico-servidor-sintetico", em: "2026-10-20T12:00:00Z",
      motivo: "Revisão sintética solicitada pelo médico", contentHash, reviewHash },
    estado: decisao === "CONFERIR" ? "CONFERIDA" : "INATIVA", bloqueios: [] });
}

function catalogoResponse(override: Partial<{ fichas: FichaProtocoloCatalogo[] }> = {}) {
  return { fichas: [ficha()], ...override };
}

function pedidoRevisao(overrides: Partial<RevisarFichaPedido> = {}): RevisarFichaPedido {
  return { templateId: "template-sintetico-1", versao: "1.0.0", expectedContentHash: hash,
    expectedRevision: 4, decisao: "CONFERIR", motivo: "Revisão sintética solicitada pelo médico",
    idempotencyKey: "review-ficha-sintetica-1", ...overrides };
}

function pedidoInstanciar(overrides: Partial<InstanciarFichaPedido> = {}): InstanciarFichaPedido {
  return { contexto, templateId: "template-sintetico-1", versao: "1.0.0",
    expectedContentHash: hash, expectedRevision: 5,
    idempotencyKey: "instanciar-ficha-sintetica-1", ...overrides };
}

function respostaInstanciacao(overrides: Partial<InstanciacaoFichaResposta> = {}): InstanciacaoFichaResposta {
  const base: InstanciacaoFichaResposta = {
    contexto,
    origemProposta: { draftId: "proposta-sintetica-1", revision: 0, hash: sha("proposta sintética") },
    template: template() as InstanciacaoFichaResposta["template"],
    contentHash: hash,
    revisionFicha: 5,
    revisaoFatos,
    itens: [{ itemId: "item-sintetico-1", item: {
      drug: "Fármaco sintético", classe: "QT", sequence: 1, standardDose: 10,
      doseBasis: "FIXED", calculatedDose: 10, prescribedDose: 10, unit: "mg",
      adjustmentPercent: null, adjustmentReason: null, route: "EV", diluent: null,
      finalVolumeMl: null, infusionTime: null, days: ["d1"], observacao: null,
      source: "PROTOCOL", overrideMotivo: null,
    } }],
    pendencias: [], avisos: [],
    dadosCorporais: { pesoKg: null, alturaCm: null, bsaM2: null, clcr: null, medidoEm: null },
  };
  return InstanciacaoFichaRespostaSchema.parse({ ...base, ...overrides });
}

function clienteComResposta(initial: { status: number; json: unknown }) {
  let response = initial;
  const chamadas: Array<{ url: string; init: RequestInit | undefined }> = [];
  const fetchMock = vi.fn<typeof fetch>(async (input, init) => {
    const url = String(input);
    chamadas.push({ url, init });
    if (url === "/login") return new Response(JSON.stringify({ token: "token-sintetico", expiraEm: null }), { status: 200 });
    return new Response(JSON.stringify(response.json), { status: response.status });
  });
  vi.stubGlobal("fetch", fetchMock);
  return {
    porta: criarPortaHttp({ onSessaoExpirada: vi.fn() }), fetchMock, chamadas,
    responder(next: { status: number; json: unknown }) { response = next; },
  };
}

it("lista fichas validando o retorno 200 e envia somente pedido vazio autenticado", async () => {
  const resposta = catalogoResponse();
  const cliente = clienteComResposta({ status: 200, json: resposta });
  await cliente.porta.login("senha-sintetica");

  await expect(cliente.porta.listarFichasPrescricao!()).resolves.toEqual(resposta);
  const chamada = cliente.chamadas.find(item => item.url === "/consulta/prescricao/fichas/listar")!;
  expect(JSON.parse(String(chamada.init?.body))).toEqual({});
  expect(new Headers(chamada.init?.headers).get("Authorization")).toBe("Bearer token-sintetico");
  expect(chamada.init?.credentials).toBe("omit");

  cliente.responder({ status: 200, json: { fichas: [{ template: "malformado" }] } });
  await expect(cliente.porta.listarFichasPrescricao!()).rejects.toMatchObject({ codigo: "PAYLOAD_INVALIDO" });
});

it("revisão envia apenas pedido tipado sem ator e valida identidade, hash, revisão e decisão", async () => {
  const pedido = pedidoRevisao();
  const resposta = ficha({ revision: 5 });
  const cliente = clienteComResposta({ status: 200, json: resposta });
  await cliente.porta.login("senha-sintetica");

  await expect(cliente.porta.revisarFichaPrescricao!(pedido)).resolves.toEqual(resposta);
  const chamada = cliente.chamadas.find(item => item.url === "/consulta/prescricao/fichas/revisar")!;
  const body = JSON.parse(String(chamada.init?.body)) as Record<string, unknown>;
  expect(body).toEqual(pedido);
  expect(body).not.toHaveProperty("medicoId");
  expect(body).not.toHaveProperty("atorId");

  const variant = (changes: { templateId?: string; versao?: string; contentHash?: string;
    revision?: number; decisao?: "CONFERIR" | "INATIVAR" }) => {
    const t = template({ ...(changes.templateId ? { templateId: changes.templateId } : {}),
      ...(changes.versao ? { versao: changes.versao } : {}) });
    const contentHash = changes.contentHash ?? hash;
    const revision = changes.revision ?? 5;
    const decisao = changes.decisao ?? "CONFERIR";
    return FichaProtocoloCatalogoSchema.parse({ template: t, contentHash, revision,
      revisao: { templateId: t.templateId, versao: t.versao, revision, decisao,
        medicoId: "medico-servidor-sintetico", em: "2026-10-20T12:00:00Z",
        motivo: pedido.motivo, contentHash, reviewHash },
      estado: decisao === "CONFERIR" ? "CONFERIDA" : "INATIVA", bloqueios: [] });
  };

  for (const [name, response] of [
    ["templateId", variant({ templateId: "outro-template-sintetico" })],
    ["versao", variant({ versao: "9.9.9" })],
    ["hash", variant({ contentHash: sha("hash diferente") })],
    ["revision", variant({ revision: 6 })],
    ["decision", variant({ decisao: "INATIVAR" })],
  ] as const) {
    cliente.responder({ status: 200, json: response });
    await expect(cliente.porta.revisarFichaPrescricao!(pedido), name)
      .rejects.toMatchObject({ codigo: "PAYLOAD_INVALIDO" });
  }
  cliente.responder({ status: 200, json: { codigo: "OK", ficha: null } });
  await expect(cliente.porta.revisarFichaPrescricao!(pedido)).rejects.toMatchObject({ codigo: "PAYLOAD_INVALIDO" });
});

it("preserva o código HTTP 409 devolvido pelo servidor na revisão", async () => {
  const cliente = clienteComResposta({ status: 409, json: { codigo: "REVISAO_FICHA_ALTERADA" } });
  await cliente.porta.login("senha-sintetica");
  await expect(cliente.porta.revisarFichaPrescricao!(pedidoRevisao())).rejects.toBeInstanceOf(ErroPorta);
  await expect(cliente.porta.revisarFichaPrescricao!(pedidoRevisao())).rejects.toMatchObject({ codigo: "REVISAO_FICHA_ALTERADA" });
});

it("instancia com pedido tipado apenas, sem enviar ator ou dados clínicos corporais", async () => {
  const pedido = pedidoInstanciar();
  const resposta = respostaInstanciacao();
  const cliente = clienteComResposta({ status: 200, json: resposta });
  await cliente.porta.login("senha-sintetica");

  await expect(cliente.porta.instanciarFichaPrescricao!(pedido)).resolves.toEqual(resposta);
  const chamada = cliente.chamadas.find(item => item.url === "/consulta/prescricao/fichas/instanciar")!;
  const body = JSON.parse(String(chamada.init?.body)) as Record<string, unknown>;
  expect(body).toEqual(pedido);
  for (const campo of ["medicoId", "atorId", "fatos", "dadosCorporais", "pesoKg", "alturaCm", "clcr", "patientFacts"])
    expect(body).not.toHaveProperty(campo);
  expect(new Headers(chamada.init?.headers).get("Authorization")).toBe("Bearer token-sintetico");
});

it("instanciação rejeita retorno com contexto, versão ou origem de template divergentes", async () => {
  const pedido = pedidoInstanciar();
  const cliente = clienteComResposta({ status: 200, json: respostaInstanciacao() });
  await cliente.porta.login("senha-sintetica");

  const divergenteContexto = respostaInstanciacao({ contexto: { ...contexto, tumorLotId: "outro-lote-sintetico" } });
  cliente.responder({ status: 200, json: divergenteContexto });
  await expect(cliente.porta.instanciarFichaPrescricao!(pedido)).rejects.toMatchObject({ codigo: "PAYLOAD_INVALIDO" });

  const divergenteId = respostaInstanciacao({ template: template({ templateId: "outro-template-sintetico" }) as InstanciacaoFichaResposta["template"] });
  cliente.responder({ status: 200, json: divergenteId });
  await expect(cliente.porta.instanciarFichaPrescricao!(pedido)).rejects.toMatchObject({ codigo: "PAYLOAD_INVALIDO" });

  const divergenteVersao = respostaInstanciacao({ template: template({ versao: "2.0.0" }) as InstanciacaoFichaResposta["template"] });
  cliente.responder({ status: 200, json: divergenteVersao });
  await expect(cliente.porta.instanciarFichaPrescricao!(pedido)).rejects.toMatchObject({ codigo: "PAYLOAD_INVALIDO" });

  const divergenteHash = respostaInstanciacao({ contentHash: sha("outra fonte de template") });
  cliente.responder({ status: 200, json: divergenteHash });
  await expect(cliente.porta.instanciarFichaPrescricao!(pedido)).rejects.toMatchObject({ codigo: "PAYLOAD_INVALIDO" });

  const divergenteRevisao = respostaInstanciacao({ revisionFicha: pedido.expectedRevision - 1 });
  cliente.responder({ status: 200, json: divergenteRevisao });
  await expect(cliente.porta.instanciarFichaPrescricao!(pedido)).rejects.toMatchObject({ codigo: "PAYLOAD_INVALIDO" });

  cliente.responder({ status: 200, json: { codigo: "OK", contexto: {}, template: null } });
  await expect(cliente.porta.instanciarFichaPrescricao!(pedido)).rejects.toMatchObject({ codigo: "PAYLOAD_INVALIDO" });
});

it("preserva o código HTTP 409 devolvido pelo servidor na instanciação", async () => {
  const cliente = clienteComResposta({ status: 409, json: { codigo: "FICHA_NAO_INSTANCIAVEL" } });
  await cliente.porta.login("senha-sintetica");
  await expect(cliente.porta.instanciarFichaPrescricao!(pedidoInstanciar())).rejects.toMatchObject({
    codigo: "FICHA_NAO_INSTANCIAVEL",
  });
});
