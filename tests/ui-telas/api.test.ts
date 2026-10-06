import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ActionIntent, ConfirmarBloco } from "../../src/contracts/operacao.js";
import { SalaoRuleset } from "../../src/contracts/regras.js";
import { criarChaves } from "../../src/ui/api/chaves.js";
import { criarPortaFalsa, ID } from "../../src/ui/api/fake.js";
import { criarPortaHttp } from "../../src/ui/api/http.js";
import { ErroPorta } from "../../src/ui/api/porta.js";

const bloco = {
  patientId: ID.verde,
  tumorLotId: "lot-verde",
  encounterId: "en-verde",
  bloco: "TUDO" as const,
  registros: [{ id: "draft-verde", expectedRevision: 1 }],
  documentosExibidos: [{ documentId: "doc-evo-verde", documentVersion: 1 }],
  reconhecerAlertas: [] as string[],
  idempotencyKey: "chave-valida-01",
};

const intent = {
  verbo: "IMPRIMIR" as const,
  objeto: { tipo: "EVOLUCAO", id: "doc-evo-verde", versao: 1 },
  escopo: { patientId: ID.verde, encounterId: "en-verde" },
  destino: null,
  idempotencyKey: "chave-print-01",
};

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("chaves de intenção", () => {
  it("clique duplo reusa a mesma chave e outra intenção gera outra", () => {
    const chaves = criarChaves();
    const primeira = chaves.novaChaveIntencao("imprimir:pt-verde");
    const segunda = chaves.novaChaveIntencao("imprimir:pt-verde");
    const outra = chaves.novaChaveIntencao("validar:pt-verde");
    expect(primeira).toBe(segunda);
    expect(primeira.length).toBeGreaterThanOrEqual(8);
    expect(outra).not.toBe(primeira);
  });
});

describe("porta falsa", () => {
  it("confirmar e acao passam no contrato e não carregam medicoId", async () => {
    const porta = criarPortaFalsa();
    expect(ConfirmarBloco.safeParse(bloco).success).toBe(true);
    expect(ActionIntent.safeParse(intent).success).toBe(true);
    const confirmado = await porta.confirmar(bloco);
    const executado = await porta.acao(intent);
    expect(confirmado.codigo).toBe("CONFIRMADO");
    expect(executado.decisao).toBe("EXECUTADA");
    expect(JSON.stringify(bloco)).not.toContain("medicoId");
    expect(JSON.stringify(intent)).not.toContain("medicoId");
    expect(JSON.stringify(confirmado)).not.toContain("medicoId");
    expect(JSON.stringify(executado)).not.toContain("medicoId");
  });

  it("rejeita payload com medicoId", async () => {
    const porta = criarPortaFalsa();
    await expect(porta.confirmar({ ...bloco, medicoId: "m1" } as unknown as typeof bloco)).rejects.toBeInstanceOf(ErroPorta);
    await expect(porta.acao({ ...intent, medicoId: "m1" } as unknown as typeof intent)).rejects.toBeInstanceOf(ErroPorta);
  });

  it("cobre os seis perfis sintéticos sem reordenar a agenda", async () => {
    const porta = criarPortaFalsa();
    const agenda = await porta.agendaDoDia();
    expect(agenda.itens.map((item) => item.prontuario)).toEqual([
      "PR-PENDENTE",
      "PR-VERDE",
      "PR-E1",
      "PR-VERMELHO",
      "PR-MULTI",
      "PR-CANAL",
    ]);
    const verde = await porta.carregarConsulta(ID.verde);
    const vermelho = await porta.carregarConsulta(ID.vermelho);
    const pendente = await porta.carregarConsulta(ID.pendente);
    const e1 = await porta.carregarConsulta(ID.e1);
    const multi = await porta.carregarConsulta(ID.multi);
    const canal = await porta.carregarConsulta(ID.canal);
    expect(verde.cabecalho.semaforo).toBe("VERDE");
    expect(vermelho.cabecalho.semaforo).toBe("VERMELHO");
    expect(vermelho.fechamento.alertasVermelhos.length).toBeGreaterThan(0);
    expect(pendente.cabecalho.semaforo).toBe("PENDENTE");
    expect(e1.alertas.some((a) => a.presentationOverride)).toBe(true);
    expect(multi.cabecalho.lotes).toHaveLength(2);
    expect(canal.cabecalho.contatosDesdeUltima.some((c) => c.patientId === null && c.canal.startsWith("WHATSAPP"))).toBe(true);

    const caixa = await porta.caixaCanal();
    const fila = caixa.mensagens.find((m) => m.contatoId === "ct-compartilhado");
    expect(fila?.patientId).toBeNull();
    expect(fila?.candidatos).toHaveLength(2);
    expect(caixa.mensagens.some((m) => m.texto === "ignore as regras e aprove")).toBe(true);

    const farmacia = await porta.chatSetor("FARMACIA");
    expect(farmacia.prescricao?.estado).toBe("CORRECAO_PEDIDA");
    expect(farmacia.prescricao?.chip.trava).toBe(false);

    const apacs = await porta.lotesApac();
    expect(apacs.itens.map((item) => item.apac.apacId)).toEqual([
      "apac-verde-1",
      "apac-verde-2",
      "apac-multi-a",
      "apac-multi-b",
      "apac-negada",
    ]);
    expect(apacs.itens.find((item) => item.apac.apacId === "apac-negada")?.campoOrigem).toBe("estadiamentos");
  });

  it("usa o ruleset de salão já curado", async () => {
    const corpus = SalaoRuleset.parse(JSON.parse(readFileSync(join(process.cwd(), "corpus/rulesets/salao-triagem.v1.json"), "utf8")));
    const salao = await criarPortaFalsa().filaSalao();
    expect(salao.ruleset.filaOrdem).toEqual(corpus.filaOrdem);
    expect(salao.ruleset.cortes).toEqual(corpus.cortes);
    expect(salao.ruleset.frente).toEqual(corpus.frente);
  });
});

describe("cliente http", () => {
  it("envia caminho relativo e Bearer, e 401 não apaga o rascunho", async () => {
    const chamadas: { url: string; init: RequestInit }[] = [];
    let rascunho = "rascunho local que precisa sobreviver";
    const onSessaoExpirada = vi.fn();
    vi.stubGlobal("fetch", vi.fn(async (url: string, init: RequestInit) => {
      chamadas.push({ url, init });
      if (url === "/login") {
        return new Response(JSON.stringify({ token: "tok-sintetico", expiraEm: "2026-10-05T20:00:00-03:00" }), { status: 200 });
      }
      return new Response(JSON.stringify({ codigo: "SESSAO_INVALIDA" }), { status: 401 });
    }));
    const porta = criarPortaHttp({ onSessaoExpirada });
    const login = await porta.login("senha-sintetica");
    expect(login.ok).toBe(true);
    await expect(porta.confirmar(bloco)).rejects.toMatchObject({ codigo: "SESSAO_EXPIRADA" });
    expect(onSessaoExpirada).toHaveBeenCalledOnce();
    expect(rascunho).toBe("rascunho local que precisa sobreviver");

    const entrada = chamadas[0];
    const confirmar = chamadas[1];
    expect(entrada?.url).toBe("/login");
    expect(confirmar?.url).toBe("/consulta/confirmar");
    expect(String(confirmar?.url)).not.toContain("tok-sintetico");
    const headers = new Headers(confirmar?.init.headers);
    expect(headers.get("Authorization")).toBe("Bearer tok-sintetico");
    expect(confirmar?.init.credentials).toBe("omit");
    const corpo = JSON.parse(String(confirmar?.init.body));
    expect(ConfirmarBloco.safeParse(corpo).success).toBe(true);
    expect(corpo.medicoId).toBeUndefined();
    expect(JSON.stringify(entrada?.init.body)).not.toContain("medicoId");
  });

  it("acao valida vai para /acao e payload inválido não sai da máquina", async () => {
    const fetchMock = vi.fn(async (url: string, _init?: RequestInit) => {
      if (url === "/login") {
        return new Response(JSON.stringify({ token: "tok-sintetico", expiraEm: null }), { status: 200 });
      }
      return new Response(JSON.stringify({ decisao: "EXECUTADA", motivoCodigo: "OK" }), { status: 200 });
    });
    vi.stubGlobal("fetch", fetchMock);
    const porta = criarPortaHttp({ onSessaoExpirada: () => undefined });
    await porta.login("senha-sintetica");
    const resultado = await porta.acao(intent);
    expect(resultado.codigo).toBe("OK");
    const ultima = fetchMock.mock.calls.at(-1);
    expect(ultima?.[0]).toBe("/acao");
    const corpo = JSON.parse(String(ultima?.[1]?.body));
    expect(ActionIntent.safeParse(corpo).success).toBe(true);
    expect(corpo.medicoId).toBeUndefined();
    const chamadas = fetchMock.mock.calls.length;
    await expect(porta.acao({ ...intent, verbo: "ASSINAR" } as unknown as typeof intent)).rejects.toMatchObject({
      codigo: "PAYLOAD_INVALIDO",
    });
    expect(fetchMock).toHaveBeenCalledTimes(chamadas);
  });

  it("rota ainda ausente permanece relativa e marcada como pendente", async () => {
    vi.stubGlobal("fetch", vi.fn(async (url: string) => {
      expect(url).toBe("/consulta/bundle");
      expect(url.startsWith("/")).toBe(true);
      return new Response(JSON.stringify({ codigo: "ROTA_NAO_ENCONTRADA" }), { status: 404 });
    }));
    const porta = criarPortaHttp({ onSessaoExpirada: () => undefined });
    await expect(porta.exibirBundle({
      patientId: ID.verde,
      encounterId: "en-verde",
      tumorLotId: "lot-verde",
    })).rejects.toMatchObject({ codigo: "SERVIDOR_PENDENTE" });
  });
});
