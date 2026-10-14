import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { ambienteHttp } from "./http-fixture.js";
import { readFileSync } from "node:fs";
import { SaidasHttp, respostaHttpValida } from "../../src/contracts/api/saidasHttp.js";

const fonteRotas = readFileSync("src/server/rotas.ts", "utf8");
const tabelaRotas = fonteRotas.slice(fonteRotas.indexOf("const rota = req.url"), fonteRotas.indexOf("const reply ="));
const urls = [...new Set([...tabelaRotas.matchAll(/"(\/[a-z/-]+)"/g)].map(m => m[1]!))];

describe("todas as portas públicas preservam método, autenticação e JSON", () => {
  let ambiente: Awaited<ReturnType<typeof ambienteHttp>>;
  beforeAll(async () => { ambiente = await ambienteHttp(); });
  afterAll(async () => { await ambiente.close(); });
  it.each(urls)("%s recusa método/payload inválidos antes de qualquer efeito", async rota => {
    expect((await ambiente.request(rota, "GET", "", ambiente.token)).status).toBe(404);
    if (rota !== "/login") expect((await ambiente.request(rota, "POST", "{}")).status).toBe(401);
    const r = await ambiente.request(rota, "POST", "{", ambiente.token, "application/json");
    expect(r.status).toBe(400);
    expect(JSON.parse(r.body)).toEqual({ codigo: "JSON_INVALIDO" });
    expect(ambiente.efeitos()).toBe(0);
  });
});

it("toda rota pública possui contrato de saída; resposta vazia nunca é sucesso", () => {
  const fonte = readFileSync("src/server/rotas.ts", "utf8");
  const tabela = fonte.slice(fonte.indexOf("const rota = req.url"), fonte.indexOf("const reply ="));
  const rotas = new Set([...tabela.matchAll(/\?\s*"([A-Za-z]+)"/g)].map(m => m[1]!));
  for (const lista of tabela.matchAll(/(\[[^\]]+\])\.includes\(req\.url/g))
    for (const rota of JSON.parse(lista[1]!) as string[]) rotas.add(rota);
  expect(rotas.size).toBe(54);
  expect([...rotas].sort()).toEqual(Object.keys(SaidasHttp).sort());
  for (const rota of rotas) expect(respostaHttpValida(rota, 200, {}), rota).toBe(false);
  expect(respostaHttpValida("rota-inexistente", 200, {})).toBe(false);
});

it("servidor recusa saída inválida de login sem transmitir dados do resultado ou do erro", async () => {
  const a = await ambienteHttp();
  try {
    vi.spyOn(a.sessoes, "login").mockReturnValue({ token: 42, sessao: { expiraEm: "invalido", segredo: "sentinela-local" } } as never);
    const r = await a.request("/login", "POST", JSON.stringify({ senha: "senha-sintetica-comprida" }));
    expect(r.status).toBe(500);
    expect(JSON.parse(r.body)).toEqual({ codigo: "RESPOSTA_FORA_CONTRATO" });
    expect(JSON.stringify(a.logs)).not.toContain("sentinela-local");
  } finally { vi.restoreAllMocks(); await a.close(); }
});

it.each(["/consulta/investigacao", "/consulta/instrumento/avaliar", "/consulta/llm/documento-original"])("%s exige sessão, valida payload e mantém contexto explícito", async rota => {
  const a = await ambienteHttp();
  try {
    expect((await a.request(rota, "POST", "{}")).status).toBe(401);
    expect((await a.request(rota, "POST", "{}", a.token)).status).toBe(400);
    const contexto = { patientId: "paciente-sintetico", encounterId: "encontro-sintetico", tumorLotId: null };
    const pedido = rota.endsWith("avaliar") ? { ...contexto, pedido: { instrumento: "KPS", dados: { aplicavel: true, fonteDados: "fixture", kpsDocumentado: 80 } } }
      : rota.endsWith("documento-original") ? { ...contexto, draftId: "draft-sintetico", idempotencyKey: "operacao-sintetica" } : contexto;
    const divergente = await a.request(rota, "POST", JSON.stringify(pedido), a.token);
    expect(divergente.status).toBe(409);
    a.sessoes.selecionarConsulta(a.token, contexto);
    const r = await a.request(rota, "POST", JSON.stringify(pedido), a.token);
    expect(r.status).toBe(rota.endsWith("documento-original") ? 409 : 200);
    if (rota.endsWith("avaliar")) expect(JSON.parse(r.body)).toMatchObject({ gravado: false, assinado: false });
    if (rota.endsWith("investigacao")) expect(JSON.parse(r.body)).toMatchObject({ estado: "PENDENTE", resultado: null });
    expect(a.efeitos()).toBe(0);
  } finally { await a.close(); }
});
