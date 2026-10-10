import { createHash } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { criarOncoassistJev, type TransporteJev } from "../../src/app/oncoassist.js";
import { criarTransporteJev } from "../../src/kernel/llm/jev/sdk.js";
import { TIMEOUT_JEV_MS } from "../../src/kernel/llm/jev/contrato.js";

const contexto = { dicionario: { nomes: ["Paciente Sintético"], identificadores: ["REG-TESTE-19"] } };
const entrada = { fonte: { id: "fonte-local-Paciente Sintético", texto: "Hemograma de Paciente Sintético. REG-TESTE-19. contato@exemplo.test" } };
const env = { ONCOASSIST_JEV_ENABLED: "true", TYPESAFE_API_KEY: "chave-sintetica-nao-real" };
const resposta = () => ({
  model: "jev-1.13.0", usage: { input_tokens: 30, output_tokens: 10 },
  answers: { categoria: {
    type: "choice", choice: "LAB", confidence: 0.9,
    probabilities: { LAB: 0.9, RADS: 0.02, PATH: 0.02, NOTA: 0.02, OUTRO: 0.02, INDETERMINADO: 0.02 },
  } },
});
function servicoCom(resultado: unknown = resposta()) {
  const avaliar = vi.fn<TransporteJev["avaliar"]>().mockResolvedValue(resultado);
  return { avaliar, servico: criarOncoassistJev({ env, transporte: { avaliar } }) };
}

afterEach(() => { vi.useRealTimers(); vi.unstubAllEnvs(); vi.restoreAllMocks(); });

describe("OncoAssist Jev — organização documental proposta", () => {
  it.each([
    [{}, "DESABILITADO"],
    [{ ONCOASSIST_JEV_ENABLED: "false", TYPESAFE_API_KEY: "x" }, "DESABILITADO"],
    [{ ONCOASSIST_JEV_ENABLED: "true" }, "CHAVE_AUSENTE"],
  ])("não chama transporte quando indisponível %j", async (config, motivo) => {
    const avaliar = vi.fn();
    const servico = criarOncoassistJev({ env: config, transporte: { avaliar } });
    expect(servico.status()).toEqual({ status: "PENDENTE", motivo });
    expect(await servico.avaliar(entrada, contexto)).toEqual({ status: "PENDENTE", codigo: motivo });
    expect(avaliar).not.toHaveBeenCalled();
  });

  it("exige dicionário local não vazio e rejeita dicionário no payload", async () => {
    const { servico, avaliar } = servicoCom();
    expect(await servico.avaliar(entrada, { dicionario: { nomes: [], identificadores: [] } }))
      .toEqual({ status: "PENDENTE", codigo: "DICIONARIO_AUSENTE" });
    expect(await servico.avaliar({ ...entrada, dicionario: contexto.dicionario }, contexto))
      .toEqual({ status: "ERRO", codigo: "ENTRADA_INVALIDA" });
    expect(avaliar).not.toHaveBeenCalled();
  });

  it.each([null, {}, { fonte: { id: "", texto: "abc" } }, { fonte: { id: "x", texto: " " } },
    { fonte: { id: "x", texto: "x".repeat(32001) } }, { fonte: { id: "x", texto: "abc", sha256: "inventado" } },
  ])("rejeita entrada inválida %j", async (valor) => {
    const { servico, avaliar } = servicoCom();
    expect(await servico.avaliar(valor, contexto)).toEqual({ status: "ERRO", codigo: "ENTRADA_INVALIDA" });
    expect(avaliar).not.toHaveBeenCalled();
  });

  it("envia só texto desidentificado e devolve proposta com hash do original", async () => {
    const { servico, avaliar } = servicoCom();
    const resultado = await servico.avaliar(entrada, contexto);
    expect(resultado).toMatchObject({ status: "PROPOSTA", revisaoObrigatoria: true, categoria: "LAB",
      fonte: { id: entrada.fonte.id, sha256: createHash("sha256").update(entrada.fonte.texto).digest("hex") } });
    const enviado = avaliar.mock.calls[0]![0];
    expect(enviado).toContain("Hemograma");
    for (const phi of ["Paciente", "Sintético", "REG-TESTE-19", "contato@exemplo.test", entrada.fonte.id])
      expect(enviado).not.toContain(phi);
    expect(JSON.stringify(resultado)).not.toContain(entrada.fonte.texto);
    expect(JSON.stringify(resultado)).not.toContain("mapa");
  });

  it("barra PHI conhecido que permanece após a primeira desidentificação", async () => {
    // Compact-name detector replaces one occurrence per whitespace-separated token.
    const dic = { dicionario: { nomes: ["Ana Clara"], identificadores: [] } };
    const { servico, avaliar } = servicoCom();
    const resultado = await servico.avaliar({ fonte: { id: "s", texto: "/AnaClara/AnaClara" } }, dic);
    expect(resultado).toEqual({ status: "ERRO", codigo: "PHI_RESIDUAL" });
    expect(avaliar).not.toHaveBeenCalled();
  });

  it("preserva snapshot da fonte enquanto a chamada está pendente", async () => {
    let concluir!: (r: unknown) => void;
    const transporte = { avaliar: vi.fn<TransporteJev["avaliar"]>().mockImplementation(() => new Promise((r) => { concluir = r; })) };
    const fonte = { id: "  ID literal  ", texto: "Hemograma de Paciente Sintético" };
    const shaOriginal = createHash("sha256").update(fonte.texto).digest("hex");
    const dic = { dicionario: { nomes: ["Paciente Sintético"], identificadores: [] as string[] } };
    const pendente = criarOncoassistJev({ env, transporte }).avaliar({ fonte }, dic);
    fonte.id = "OUTRO"; fonte.texto = "Outro documento"; dic.dicionario.nomes.length = 0;
    concluir(resposta());
    expect(await pendente).toMatchObject({ fonte: { id: "  ID literal  ", sha256: shaOriginal } });
    expect(transporte.avaliar.mock.calls[0]![0]).not.toContain("Paciente Sintético");
  });

  it.each([
    ["categoria fora do conjunto", (r: ReturnType<typeof resposta>) => { r.answers.categoria.choice = "PRESCREVER"; }],
    ["probabilidade NaN", (r: ReturnType<typeof resposta>) => { r.answers.categoria.probabilities.LAB = NaN; }],
    ["probabilidade negativa", (r: ReturnType<typeof resposta>) => { r.answers.categoria.probabilities.LAB = -0.1; }],
    ["soma incoerente", (r: ReturnType<typeof resposta>) => { r.answers.categoria.probabilities.LAB = 0.1; }],
    ["escolha não máxima", (r: ReturnType<typeof resposta>) => { r.answers.categoria.choice = "PATH"; }],
    ["confiança infinita", (r: ReturnType<typeof resposta>) => { r.answers.categoria.confidence = Infinity; }],
    ["modelo com texto livre", (r: ReturnType<typeof resposta>) => { r.model = "Paciente Sintético"; }],
    ["token count inválido", (r: ReturnType<typeof resposta>) => { r.usage.input_tokens = -1; }],
  ])("rejeita resposta adulterada: %s", async (_, alterar) => {
    const r = resposta(); alterar(r);
    const { servico } = servicoCom(r);
    expect(await servico.avaliar(entrada, contexto)).toEqual({ status: "ERRO", codigo: "RESPOSTA_INVALIDA" });
  });

  it("rejeita campos inesperados e distribuições incompletas", async () => {
    for (const r of [null, { ...resposta(), texto: "vazamento" },
      { ...resposta(), answers: { categoria: { ...resposta().answers.categoria, probabilities: { LAB: 1 } } } },
    ]) {
      expect(await servicoCom(r).servico.avaliar(entrada, contexto))
        .toEqual({ status: "ERRO", codigo: "RESPOSTA_INVALIDA" });
    }
  });

  it("não propaga mensagem de erro do provedor", async () => {
    const transporte = { avaliar: vi.fn().mockRejectedValue(new Error("API KEY e Paciente Sintético")) };
    const servico = criarOncoassistJev({ env, transporte });
    expect(await servico.avaliar(entrada, contexto)).toEqual({ status: "ERRO", codigo: "PROVEDOR_INDISPONIVEL" });
  });

  it("interrompe até transporte que ignora timeout", async () => {
    vi.useFakeTimers();
    let sinal: AbortSignal | undefined;
    const transporte: TransporteJev = { avaliar: (_, s) => { sinal = s; return new Promise(() => {}); } };
    const pendente = criarOncoassistJev({ env, transporte }).avaliar(entrada, contexto);
    await vi.advanceTimersByTimeAsync(TIMEOUT_JEV_MS);
    expect(await pendente).toEqual({ status: "ERRO", codigo: "TIMEOUT" });
    expect(sinal?.aborted).toBe(true);
  });

  it("cancela antes ou durante a requisição", async () => {
    const { servico, avaliar } = servicoCom();
    const antes = new AbortController(); antes.abort();
    expect(await servico.avaliar(entrada, contexto, antes.signal)).toEqual({ status: "ERRO", codigo: "CANCELADO" });
    expect(avaliar).not.toHaveBeenCalled();
    const durante = new AbortController();
    const pendente = criarOncoassistJev({ env, transporte: { avaliar: () => new Promise(() => {}) } })
      .avaliar(entrada, contexto, durante.signal);
    durante.abort();
    expect(await pendente).toEqual({ status: "ERRO", codigo: "CANCELADO" });
  });

  it("mantém INDETERMINADO e baixa confiança como proposta sem execução", async () => {
    const r = resposta();
    r.answers.categoria.choice = "INDETERMINADO";
    r.answers.categoria.confidence = 0;
    r.answers.categoria.probabilities = { LAB: 0.16, RADS: 0.16, PATH: 0.16, NOTA: 0.16, OUTRO: 0.16, INDETERMINADO: 0.2 };
    expect(await servicoCom(r).servico.avaliar(entrada, contexto)).toMatchObject({
      status: "PROPOSTA", revisaoObrigatoria: true, categoria: "INDETERMINADO", confianca: 0,
    });
  });

  it("SDK real usa URL fixa, não herda log/debug ou modelo e não faz retry", async () => {
    vi.stubEnv("TYPESAFE_BASE_URL", "https://outro.invalid");
    vi.stubEnv("TYPESAFE_LOG_LEVEL", "debug");
    vi.stubEnv("TYPESAFE_DEFAULT_MODEL", "modelo-injetado");
    const http = vi.fn().mockResolvedValue(new Response(JSON.stringify(resposta()), { status: 200 }));
    const adapter = criarTransporteJev("chave-falsa", http);
    await adapter.avaliar("Hemograma sintético", new AbortController().signal);
    expect(http).toHaveBeenCalledTimes(1);
    const [url, init] = http.mock.calls[0]!;
    expect(url).toBe("https://api.typesafe.ai/v1/systemone");
    const payload = JSON.parse(init.body);
    expect(payload.model).toBe("jev-latest");
    expect(payload.state).toEqual({ documento: "Hemograma sintético" });
    expect(Object.keys(payload.questions.categoria.criteria)).toEqual(["LAB", "RADS", "PATH", "NOTA", "OUTRO", "INDETERMINADO"]);
    const falhaHttp = vi.fn().mockResolvedValue(new Response("texto sigiloso", { status: 500 }));
    await expect(criarTransporteJev("chave-falsa", falhaHttp).avaliar("x", new AbortController().signal))
      .rejects.toThrow("PROVEDOR_INDISPONIVEL");
    expect(falhaHttp).toHaveBeenCalledTimes(1);
  });
});
