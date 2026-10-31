import { afterEach, expect, it, vi } from "vitest";
import { abrirIntegracao, AGORA } from "../fixtures/integracao-operacional.js";
import { lerAgenda, lerSalao } from "../../src/server/leituras.js";
import { salaoRuleset } from "../fixtures/rulesets.js";
let a: Awaited<ReturnType<typeof abrirIntegracao>> | undefined;
afterEach(async () => { vi.restoreAllMocks(); await a?.finalizar(); a = undefined; });
it("agenda/salão leem o ledger uma vez, preservam E1 com o mesmo conjunto íntegro de eventos", async () => {
  a = await abrirIntegracao();
  for (let i = 0; i < 10; i++) a.seed("AgendaEntry", { patientId: a.contexto.patientId, encounterId: a.contexto.encounterId,
    data: AGORA.slice(0, 10), horario: `10:${String(i).padStart(2, "0")}` });
  a.seed("Alerta", { alertaId: "urgencia-sintetica", alvo: { patientId: a.contexto.patientId }, natureza: "AMEACA_IMEDIATA", classeRisco: null,
    texto: "Alerta sintético", origemRegra: "regra-sintetica", evidencias: [], presentationOverride: true, authorityOverride: false, reconhecidoEm: null, destino: "CHAT" }, { tumorLotId: null });
  const spy = vi.spyOn(a.db, "prepare");
  const contar = () => spy.mock.calls.filter(([sql]) => /\bFROM\s+clinical_event\b/i.test(sql)).length;
  const agenda = lerAgenda(a.db, AGORA, "-03:00", salaoRuleset);
  expect(agenda.itens).toHaveLength(10); expect(agenda.itens.every(i => i.temE1 && i.patientId === a!.contexto.patientId)).toBe(true);
  expect(contar()).toBe(1);
  spy.mockClear(); lerSalao(a.db, AGORA, salaoRuleset); expect(contar()).toBe(1);
});
