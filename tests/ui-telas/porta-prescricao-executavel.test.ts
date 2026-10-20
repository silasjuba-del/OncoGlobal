import { afterEach, describe, expect, it, vi } from "vitest";
import type { BasePrescricaoExecutavelResposta, ConfirmarPrescricaoExecutavelPedido,
  PrepararPrescricaoExecutavelPedido, PrescricaoExecutavelConfirmada, PrescricaoExecutavelPreparada } from "../../src/contracts/api/operacaoPrescricaoExecutavel.js";
import { EstatisticaServicoResposta, type VisaoEstatisticaServico } from "../../src/contracts/api/estatisticaServico.js";
import type { ContextoAcaoComposta } from "../../src/contracts/api/acoesCompostas.js";
import { criarPortaHttp } from "../../src/ui/api/http.js";
import { ESTATISTICA_VERSAO } from "../../src/contracts/api/estatisticaVersao.js";

afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

const contexto: ContextoAcaoComposta = {
  patientId: "paciente-sintetico", encounterId: "encontro-sintetico", tumorLotId: "lote-sintetico",
};
const period = { inicio: "2026-01-01", fim: "2026-12-31" };
const base: BasePrescricaoExecutavelResposta = {
  contexto, revisao: "a".repeat(64), pacienteNome: "Paciente sintético",
  episodio: null, ciclo: null, vigente: null, pendencias: [],
};
const item = {
  itemId: "item-sintetico-1",
  item: {
    drug: "Fármaco sintético alfa", classe: "QT" as const, sequence: 1, standardDose: 2,
    doseBasis: "FIXED" as const, calculatedDose: 1.5, prescribedDose: 1.5, unit: "mg",
    adjustmentPercent: null, adjustmentReason: null, route: "EV", diluent: null,
    finalVolumeMl: null, infusionTime: null, days: ["d1"], observacao: null,
    source: "MANUAL" as const, overrideMotivo: "Motivo médico sintético",
  },
};
const prepared: PrescricaoExecutavelPreparada = {
  draftId: "rascunho-prescricao-sintetico", revision: 1, conteudoHash: "b".repeat(64), baseHash: base.revisao,
  conteudo: {
    schema: "PrescricaoExecutavel@1",
    contexto: { ...contexto, episodioId: "episodio-sintetico", cicloId: "ciclo-sintetico" },
    documentId: "documento-prescricao-sintetico", documentVersion: 1, protocoloId: "protocolo-sintetico",
    dataPrevista: "2026-12-01", motivo: "Motivo médico sintético", itens: [item], origemProposta: null,
  },
  texto: "Prescrição sintética", avisos: ["Aviso sintético"], efeitos: ["Efeito sintético datado"],
};
const preparationRequest: PrepararPrescricaoExecutavelPedido = {
  contexto, expectedBaseHash: base.revisao, idempotencyKey: "idempotencia-sintetica",
  edicao: {
    protocoloId: "protocolo-sintetico", dataPrevista: "2026-12-01", motivo: "Motivo médico sintético",
    planejamento: { modo: "NOVO_CICLO", linha: 1, intencao: "ADJUVANTE", numeroCiclo: 1 },
    itens: [item], origemProposta: null, encaminharFarmacia: true,
  },
};
const confirmationRequest: ConfirmarPrescricaoExecutavelPedido = {
  contexto, draftId: prepared.draftId, expectedRevision: prepared.revision,
  conteudoHash: prepared.conteudoHash, idempotencyKey: "confirmacao-sintetica",
};
const confirmed: PrescricaoExecutavelConfirmada = {
  codigo: "GRAVADA", documentId: "documento-prescricao-sintetico", documentVersion: 1,
  eventoId: "evento-prescricao-sintetico", cicloId: "ciclo-sintetico", episodioId: "episodio-sintetico",
};

const estatistica = (periodo: typeof period | null): VisaoEstatisticaServico => ({
  versao: ESTATISTICA_VERSAO, escopo: periodo ? "PERIODO_CLINICO" : "LEDGER_COMPLETO", periodoClinico: periodo,
  denominadorPacientes: 0,
  exclusoes: { eventosNaoConfirmados: 0, eventosSupersedidos: 0, linhasDuplicadas: 0,
    administracoesInvalidas: 0, administracoesConflito: 0, eventosSemDataClinica: 0,
    eventosDataClinicaInvalida: 0, eventosForaPeriodo: 0 },
  totalPacientes: 0,
  eventosPorCategoria: { FATO: 0, DOCUMENTO: 0, ADMINISTRACAO: 0, OUTRO: 0 },
  pacientesPorCategoria: { FATO: 0, DOCUMENTO: 0, ADMINISTRACAO: 0, OUTRO: 0 },
  documentosAssinados: 0, pacientesComDocumentoAssinado: 0,
  administracoesPorStatus: { COMPLETA: 0, PARCIAL: 0, OMITIDA: 0, INTERROMPIDA: 0 },
  pacientesPorStatusDeAdministracao: { COMPLETA: 0, PARCIAL: 0, OMITIDA: 0, INTERROMPIDA: 0 },
  administracoesPendentes: 0, administracoesConflito: 0,
});

function cliente(fetchMock: ReturnType<typeof vi.fn>) {
  vi.stubGlobal("fetch", fetchMock);
  return criarPortaHttp({ onSessaoExpirada: vi.fn() });
}

describe("porta HTTP para prescrição executável", () => {
  it("carrega base vinculada ao contexto, com rota relativa, Bearer e AbortSignal", async () => {
    const chamadas: { url: string; init: RequestInit }[] = [];
    const fetchMock = vi.fn(async (url: string, init: RequestInit) => {
      chamadas.push({ url, init });
      if (url === "/login") return new Response(JSON.stringify({ token: "token-sintetico", expiraEm: null }), { status: 200 });
      return new Response(JSON.stringify(base), { status: 200 });
    });
    const porta = cliente(fetchMock);
    await porta.login("senha-sintetica");
    const controller = new AbortController();

    await expect(porta.lerBasePrescricaoExecutavel!(contexto, controller.signal)).resolves.toEqual(base);
    const request = chamadas.at(-1)!;
    expect(request.url).toBe("/consulta/prescricao-executavel/base");
    expect(JSON.parse(String(request.init.body))).toEqual(contexto);
    expect(new Headers(request.init.headers).get("Authorization")).toBe("Bearer token-sintetico");
    expect(request.init.credentials).toBe("omit");
    expect(request.init.signal).toBe(controller.signal);
  });

  it("prepara e confirma nos endpoints próprios e preserva respostas tipadas", async () => {
    const chamadas: { url: string; init: RequestInit }[] = [];
    const fetchMock = vi.fn(async (url: string, init: RequestInit) => {
      chamadas.push({ url, init });
      if (url === "/login") return new Response(JSON.stringify({ token: "token-sintetico", expiraEm: null }), { status: 200 });
      if (url.endsWith("/preparar")) return new Response(JSON.stringify(prepared), { status: 200 });
      return new Response(JSON.stringify(confirmed), { status: 200 });
    });
    const porta = cliente(fetchMock);
    await porta.login("senha-sintetica");
    const controller = new AbortController();

    await expect(porta.prepararPrescricaoExecutavel!(preparationRequest, controller.signal)).resolves.toEqual(prepared);
    await expect(porta.confirmarPrescricaoExecutavel!(confirmationRequest, controller.signal)).resolves.toEqual(confirmed);
    expect(chamadas.slice(-2).map(call => call.url)).toEqual([
      "/consulta/prescricao-executavel/preparar", "/consulta/prescricao-executavel/confirmar",
    ]);
    expect(JSON.parse(String(chamadas.at(-2)?.init.body))).toEqual(preparationRequest);
    expect(JSON.parse(String(chamadas.at(-1)?.init.body))).toEqual(confirmationRequest);
    expect(chamadas.slice(-2).every(call => call.init.signal === controller.signal)).toBe(true);
  });

  it("rejeita 200 com schema inválido ou contexto/base divergente como PAYLOAD_INVALIDO", async () => {
    const fetchMock = vi.fn();
    const porta = cliente(fetchMock);
    fetchMock.mockImplementation(async (url: string) => url === "/login"
      ? new Response(JSON.stringify({ token: "token-sintetico", expiraEm: null }), { status: 200 })
      : new Response(JSON.stringify({ codigo: "ESTATISTICA_DERIVADA" }), { status: 200 }));
    await porta.login("senha-sintetica");
    await expect(porta.lerBasePrescricaoExecutavel!(contexto)).rejects.toMatchObject({ codigo: "PAYLOAD_INVALIDO" });
    await expect(porta.prepararPrescricaoExecutavel!(preparationRequest)).rejects.toMatchObject({ codigo: "PAYLOAD_INVALIDO" });
    await expect(porta.confirmarPrescricaoExecutavel!(confirmationRequest)).rejects.toMatchObject({ codigo: "PAYLOAD_INVALIDO" });
  });

  it("recusa base fora do contexto e preparo com baseHash/contexto divergentes", async () => {
    const fetchMock = vi.fn();
    const porta = cliente(fetchMock);
    let response: unknown = base;
    fetchMock.mockImplementation(async (url: string) => url === "/login"
      ? new Response(JSON.stringify({ token: "token-sintetico", expiraEm: null }), { status: 200 })
      : new Response(JSON.stringify(response), { status: 200 }));
    await porta.login("senha-sintetica");

    response = { ...base, contexto: { ...contexto, encounterId: "encontro-divergente" } };
    await expect(porta.lerBasePrescricaoExecutavel!(contexto)).rejects.toMatchObject({ codigo: "PAYLOAD_INVALIDO" });
    response = { ...prepared, baseHash: "c".repeat(64) };
    await expect(porta.prepararPrescricaoExecutavel!(preparationRequest)).rejects.toMatchObject({ codigo: "PAYLOAD_INVALIDO" });
    response = { ...prepared, conteudo: { ...prepared.conteudo,
      contexto: { ...prepared.conteudo.contexto, patientId: "paciente-divergente" } } };
    await expect(porta.prepararPrescricaoExecutavel!(preparationRequest)).rejects.toMatchObject({ codigo: "PAYLOAD_INVALIDO" });
  });

  it("preserva código HTTP de preparação, confirmação e estatística", async () => {
    const fetchMock = vi.fn();
    const porta = cliente(fetchMock);
    fetchMock.mockImplementation(async (url: string) => url === "/login"
      ? new Response(JSON.stringify({ token: "token-sintetico", expiraEm: null }), { status: 200 })
      : new Response(JSON.stringify({ codigo: "OPERACAO_PENDENTE_SINTETICA" }), { status: 409 }));
    await porta.login("senha-sintetica");
    await expect(porta.prepararPrescricaoExecutavel!(preparationRequest)).rejects.toMatchObject({ codigo: "OPERACAO_PENDENTE_SINTETICA" });
    await expect(porta.confirmarPrescricaoExecutavel!(confirmationRequest)).rejects.toMatchObject({ codigo: "OPERACAO_PENDENTE_SINTETICA" });
    await expect(porta.lerEstatisticaServico!(null)).rejects.toMatchObject({ codigo: "OPERACAO_PENDENTE_SINTETICA" });
  });

  it("serializa período clínico opcional, valida projeção e repassa cancelamento", async () => {
    const chamadas: { url: string; init: RequestInit }[] = [];
    const fetchMock = vi.fn(async (url: string, init: RequestInit) => {
      chamadas.push({ url, init });
      if (url === "/login") return new Response(JSON.stringify({ token: "token-sintetico", expiraEm: null }), { status: 200 });
      const body = JSON.parse(String(init.body));
      return new Response(JSON.stringify(EstatisticaServicoResposta.parse(estatistica(body.periodoClinico ?? null))), { status: 200 });
    });
    const porta = cliente(fetchMock);
    await porta.login("senha-sintetica");
    const controller = new AbortController();

    await expect(porta.lerEstatisticaServico!(null, controller.signal)).resolves.toEqual(estatistica(null));
    await expect(porta.lerEstatisticaServico!(period, controller.signal)).resolves.toEqual(estatistica(period));
    expect(JSON.parse(String(chamadas.at(-2)?.init.body))).toEqual({});
    expect(JSON.parse(String(chamadas.at(-1)?.init.body))).toEqual({ periodoClinico: period });
    expect(chamadas.slice(-2).map(call => call.url)).toEqual(["/consulta/estatistica", "/consulta/estatistica"]);
    expect(chamadas.slice(-2).every(call => call.init.signal === controller.signal)).toBe(true);
  });

  it("rejeita projeção estatística malformada em HTTP 200", async () => {
    const fetchMock = vi.fn();
    const porta = cliente(fetchMock);
    fetchMock.mockImplementation(async (url: string) => url === "/login"
      ? new Response(JSON.stringify({ token: "token-sintetico", expiraEm: null }), { status: 200 })
      : new Response(JSON.stringify({ codigo: "ESTATISTICA_DERIVADA" }), { status: 200 }));
    await porta.login("senha-sintetica");
    await expect(porta.lerEstatisticaServico!(null)).rejects.toMatchObject({ codigo: "PAYLOAD_INVALIDO" });
  });
});
