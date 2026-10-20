import { afterEach, describe, expect, it, vi } from "vitest";
import { createHash } from "node:crypto";
import type {
  ApacRascunhoConfirmado,
  ApacRascunhoPreparado,
  BaseApacRascunhoResposta,
  ConfirmarApacRascunhoPedido,
  PrepararApacRascunhoPedido,
} from "../../src/contracts/api/apacRascunho.js";
import type { ContextoAcaoComposta } from "../../src/contracts/api/acoesCompostas.js";
import { ErroPorta } from "../../src/ui/api/porta.js";
import { criarPortaHttp } from "../../src/ui/api/http.js";

afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

const sha = (value: string) => createHash("sha256").update(value).digest("hex");
const contexto: ContextoAcaoComposta = {
  patientId: "paciente-sintetico-apac-07", encounterId: "encontro-sintetico-apac-07", tumorLotId: "lote-sintetico-apac-07",
};
const base: BaseApacRascunhoResposta = {
  contexto,
  revisao: sha("base apac sintetica 07"),
  prescricao: { documentId: "documento-sintetico-07", documentVersion: 2,
    protocoloId: "esquema-sintetico-07", dataPrevista: "2026-10-22" },
  sugestao: { competencia: "2026-10", campos: {
    procedimentoPrincipal: "PROC-SINTETICO-07", pacienteCns: null, nomeMae: null,
    nomeEstabelecimento: "Estabelecimento sintético", cnesSolicitante: null,
    solicitanteNome: null, solicitanteCns: null, justificativa: null,
    descricaoDiagnostico: null, quantidadePrincipal: 1, pacienteNascimento: null, pacienteSexo: null,
  } },
  camposClinicos: [{ chave: "cid", rotulo: "CID do lote", valor: "C50.9" }],
  existentes: [], pendencias: [],
};
const pedido: PrepararApacRascunhoPedido = {
  contexto, expectedBaseHash: base.revisao, idempotencyKey: "preparar-apac-sintetica-07",
  edicao: { competencia: "2026-10", campos: { ...base.sugestao.campos } },
};
const prepared: ApacRascunhoPreparado = {
  contexto, draftId: "draft-apac-sintetico-07", revision: 0,
  conteudoHash: sha("rascunho apac sintetico"), baseHash: base.revisao,
  apac: { apacId: "apac-sintetica-07", tumorLotId: contexto.tumorLotId!,
    prescricaoAssinadaRef: { documentId: "documento-sintetico-07", documentVersion: 2 },
    dataGeracaoApp: "2026-10-20", competencia: "2026-10", campos: { procedimentoPrincipal: "PROC-SINTETICO-07" },
    estado: "RASCUNHO", resultadoExterno: null, versao: 1, substituiApacId: null },
  texto: "APAC em rascunho para revisão médica.", pendencias: [], avisos: [], permiteExportar: false,
};
const confirmationRequest: ConfirmarApacRascunhoPedido = {
  contexto, draftId: prepared.draftId, expectedRevision: prepared.revision,
  conteudoHash: prepared.conteudoHash, idempotencyKey: "confirmar-apac-sintetica-07",
};
const confirmed: ApacRascunhoConfirmado = {
  codigo: "GRAVADA", apacId: prepared.apac.apacId, versao: prepared.apac.versao,
  eventId: "evento-apac-sintetico-07", estado: "RASCUNHO", permiteExportar: false,
};

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

describe("porta HTTP de APAC em rascunho Onda07", () => {
  it("lê base vinculada ao contexto e encaminha AbortSignal na rota autenticada", async () => {
    const cliente = clienteComResposta({ status: 200, json: base });
    await cliente.porta.login("senha-sintetica");
    const controller = new AbortController();

    await expect(cliente.porta.lerBaseApacRascunho!(contexto, controller.signal)).resolves.toEqual(base);
    const chamada = cliente.chamadas.find(c => c.url === "/consulta/apac-rascunho/base")!;
    expect(JSON.parse(String(chamada.init?.body))).toEqual(contexto);
    expect(new Headers(chamada.init?.headers).get("Authorization")).toBe("Bearer token-sintetico");
    expect(chamada.init?.credentials).toBe("omit");
    expect(chamada.init?.signal).toBe(controller.signal);

    cliente.responder({ status: 200, json: { ...base, contexto: { ...contexto, encounterId: "outro-encontro-sintetico" } } });
    await expect(cliente.porta.lerBaseApacRascunho!(contexto)).rejects.toMatchObject({ codigo: "PAYLOAD_INVALIDO" });
  });

  it("prepara APAC só com a edição tipada, confere base/contexto/competência e confirma rascunho correlato", async () => {
    const cliente = clienteComResposta({ status: 200, json: base });
    await cliente.porta.login("senha-sintetica");
    await expect(cliente.porta.lerBaseApacRascunho!(contexto)).resolves.toEqual(base);
    const controller = new AbortController();

    cliente.responder({ status: 200, json: prepared });
    await expect(cliente.porta.prepararApacRascunho!(pedido, controller.signal)).resolves.toEqual(prepared);
    const chamada = cliente.chamadas.find(c => c.url === "/consulta/apac-rascunho/preparar")!;
    expect(JSON.parse(String(chamada.init?.body))).toEqual(pedido);
    expect(JSON.parse(String(chamada.init?.body))).not.toHaveProperty("atorId");
    expect(new Headers(chamada.init?.headers).get("Authorization")).toBe("Bearer token-sintetico");
    expect(chamada.init?.signal).toBe(controller.signal);

    cliente.responder({ status: 200, json: confirmed });
    await expect(cliente.porta.confirmarApacRascunho!(confirmationRequest, controller.signal)).resolves.toEqual(confirmed);
    const confirm = cliente.chamadas.find(c => c.url === "/consulta/apac-rascunho/confirmar")!;
    expect(JSON.parse(String(confirm.init?.body))).toEqual(confirmationRequest);
    expect(confirm.init?.signal).toBe(controller.signal);
  });

  it("recusa resposta preparada de outro contexto, base, lote ou competência", async () => {
    const cliente = clienteComResposta({ status: 200, json: base });
    await cliente.porta.login("senha-sintetica");
    await cliente.porta.lerBaseApacRascunho!(contexto);

    for (const resposta of [
      { ...prepared, contexto: { ...contexto, encounterId: "outro-encontro-sintetico" } },
      { ...prepared, baseHash: sha("base antiga") },
      { ...prepared, apac: { ...prepared.apac, tumorLotId: "outro-lote-sintetico" } },
      { ...prepared, apac: { ...prepared.apac, competencia: "2026-09" } },
      { ...prepared, apac: { ...prepared.apac,
        prescricaoAssinadaRef: { documentId: "documento-antigo-sintetico", documentVersion: 1 } } },
    ]) {
      cliente.responder({ status: 200, json: resposta });
      await expect(cliente.porta.prepararApacRascunho!(pedido)).rejects.toMatchObject({ codigo: "PAYLOAD_INVALIDO" });
    }
  });

  it("não aceita APAC preparada quando a base lida não contém prescrição assinada", async () => {
    const semFonte: BaseApacRascunhoResposta = { ...base, prescricao: null };
    const cliente = clienteComResposta({ status: 200, json: semFonte });
    await cliente.porta.login("senha-sintetica");
    await cliente.porta.lerBaseApacRascunho!(contexto);
    cliente.responder({ status: 200, json: prepared });
    await expect(cliente.porta.prepararApacRascunho!(pedido)).rejects.toMatchObject({ codigo: "PAYLOAD_INVALIDO" });
  });

  it("rejeita confirmação de APAC ou versão diferente da prévia mostrada", async () => {
    const cliente = clienteComResposta({ status: 200, json: base });
    await cliente.porta.login("senha-sintetica");
    await cliente.porta.lerBaseApacRascunho!(contexto);
    cliente.responder({ status: 200, json: prepared });
    await cliente.porta.prepararApacRascunho!(pedido);

    cliente.responder({ status: 200, json: { ...confirmed, apacId: "outra-apac-sintetica" } });
    await expect(cliente.porta.confirmarApacRascunho!(confirmationRequest)).rejects.toMatchObject({ codigo: "PAYLOAD_INVALIDO" });
    cliente.responder({ status: 200, json: { ...confirmed, versao: 2 } });
    await expect(cliente.porta.confirmarApacRascunho!(confirmationRequest)).rejects.toMatchObject({ codigo: "PAYLOAD_INVALIDO" });
  });

  it("preserva códigos negativos do servidor e recusa respostas 200 malformadas", async () => {
    const cliente = clienteComResposta({ status: 200, json: { codigo: "PAYLOAD_INVALIDO" } });
    await cliente.porta.login("senha-sintetica");
    await expect(cliente.porta.lerBaseApacRascunho!(contexto)).rejects.toMatchObject({ codigo: "PAYLOAD_INVALIDO" });
    await expect(cliente.porta.prepararApacRascunho!(pedido)).rejects.toMatchObject({ codigo: "PAYLOAD_INVALIDO" });
    await expect(cliente.porta.confirmarApacRascunho!(confirmationRequest)).rejects.toMatchObject({ codigo: "PAYLOAD_INVALIDO" });

    cliente.responder({ status: 409, json: { codigo: "BASE_APAC_ALTERADA" } });
    await expect(cliente.porta.lerBaseApacRascunho!(contexto)).rejects.toBeInstanceOf(ErroPorta);
    await expect(cliente.porta.prepararApacRascunho!(pedido)).rejects.toMatchObject({ codigo: "BASE_APAC_ALTERADA" });
    await expect(cliente.porta.confirmarApacRascunho!(confirmationRequest)).rejects.toMatchObject({ codigo: "BASE_APAC_ALTERADA" });
  });
});
