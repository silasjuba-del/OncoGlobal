import { afterEach, expect, it, vi } from "vitest";
import { criarPortaHttp } from "../../src/ui/api/http.js";
import { criarPortaFalsa, ID } from "../../src/ui/api/fake.js";
afterEach(() => vi.unstubAllGlobals());
it.each(["carregarConsulta", "agendaDoDia", "filaSalao", "caixaCanal", "lotesApac", "chatSetor"] as const)(
  "%s rejeita HTTP 200 com forma incompleta", async (metodo) => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ codigo: "OK" }), { status: 200 })));
    const porta = criarPortaHttp({ onSessaoExpirada: () => {} });
    const call = () => metodo === "carregarConsulta" ? porta.carregarConsulta(ID.verde)
      : metodo === "chatSetor" ? porta.chatSetor("MEDICO") : porta[metodo]();
    await expect(call()).rejects.toMatchObject({ codigo: "PAYLOAD_INVALIDO" });
  });
it("consulta completa é validada; semáforo desconhecido e nested payload inválido são recusados", async () => {
  const real = await criarPortaFalsa().carregarConsulta(ID.verde);
  let corpo: unknown = real;
  vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify(corpo), { status: 200 })));
  const porta = criarPortaHttp({ onSessaoExpirada: () => {} });
  expect((await porta.carregarConsulta(ID.verde)).patientId).toBe(ID.verde);
  corpo = { ...real, cabecalho: { ...real.cabecalho, semaforo: "AZUL" } };
  await expect(porta.carregarConsulta(ID.verde)).rejects.toMatchObject({ codigo: "PAYLOAD_INVALIDO" });
});
it("HTTP 200 vazio nunca vira confirmação nem execução fictícia", async () => {
  vi.stubGlobal("fetch", vi.fn(async () => new Response("{}", { status: 200 })));
  const porta = criarPortaHttp({ onSessaoExpirada: () => {} });
  await expect(porta.confirmar({ patientId: ID.verde, encounterId: "consulta", tumorLotId: null,
    bloco: "EVOLUCAO", registros: [{ id: "draft", expectedRevision: 0 }], documentosExibidos: [],
    reconhecerAlertas: [], idempotencyKey: "chave-sintetica" })).rejects.toMatchObject({ codigo: "PAYLOAD_INVALIDO" });
  await expect(porta.acao({ verbo: "IMPRIMIR", objeto: { tipo: "DOCUMENTO", id: "doc", versao: 1 },
    escopo: { patientId: ID.verde, encounterId: "consulta" }, destino: null,
    idempotencyKey: "acao-sintetica" })).rejects.toMatchObject({ codigo: "PAYLOAD_INVALIDO" });
});
