import { expect, it } from "vitest";
import { ambienteHttp } from "../adv/http-fixture.js";

const action = (verbo: string, tipo: string, id: string) => ({
  verbo, objeto: { tipo, id, versao: 1 },
  escopo: { patientId: "Paciente Teste 01", encounterId: "encontro-teste" },
  destino: null, idempotencyKey: `externo-${verbo}-${id}`,
});

for (const [verbo, tipo, id] of [
  ["IMPRIMIR", "PRESCRICAO", "rx-sem-assinatura"],
  ["ENVIAR_EMAIL", "DOCUMENTO", "minuta-nao-confirmada"],
  ["EXPORTAR_APAC", "APAC", "apac-nao-validada"],
]) {
  it(`ADV-006 · ${verbo} não executa referência ${id} sem registro assinado/validado`, async () => {
    const f = await ambienteHttp();
    try {
      // Nenhum documento, assinatura ou APAC existe no ledger sintético.
      const r = await f.request("/acao", "POST", JSON.stringify(action(verbo!, tipo!, id!)),
        f.token, "application/json");
      expect(r.status).toBe(409);
      expect(f.efeitos()).toBe(0);
    } finally { await f.close(); }
  });
}

it("ADV-006 · caminho HTTP envia identificador no destino sem consumer de G-02", async () => {
  const f = await ambienteHttp();
  try {
    // O executor é fake: nenhum e-mail real é enviado; prova só a passagem pelo gateway.
    const payload = { ...action("ENVIAR_EMAIL", "DOCUMENTO", "minuta-teste"),
      destino: "paciente.teste@example.invalid" };
    const r = await f.request("/acao", "POST", JSON.stringify(payload), f.token, "application/json");
    expect(r.status).toBe(409);
    expect(f.efeitos()).toBe(0);
  } finally { await f.close(); }
});
