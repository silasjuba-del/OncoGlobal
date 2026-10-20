import { expect, it } from "vitest";
import type { ClinicalEvent } from "../../../src/contracts/operacao.js";
import { projetarRetrato, hashCanonico } from "../../../src/kernel/projections/retrato/index.js";
import { montarFichaMinima } from "../../../src/modules/consulta/revisaoClinica.js";
import { triagemBase, fonteSintetica } from "../../fixtures/triagem.js";

const contexto = { patientId: "paciente-teste-01", encounterId: "encontro-teste-01", tumorLotId: "lote-sintetico",
  agora: "2026-10-05T15:00:00Z", regras: [], biblioteca: { id: "teste", versao: "1", hash: "fixture" } };
function triagem(tipo: string): ClinicalEvent {
  return { patientId: contexto.patientId, encounterId: contexto.encounterId, tumorLotId: contexto.tumorLotId,
    eventId: "triagem-sintetica", operationId: "op-triagem", eventIndex: 0, tipo,
    payload: { data: triagemBase() }, fontes: [fonteSintetica()], revisao: "CONFIRMADO",
    criadoEm: "2026-10-05T12:00:00Z", criadoPor: { tipo: "SESSAO", id: "medico-sintetico" }, supersedesEventId: null };
}

it.each(["Triagem", "Triagem@1"])("leva %s à ficha mínima conservando hash e tipo originais", tipo => {
  const e = triagem(tipo), r = projetarRetrato([e], contexto);
  expect(r.fatos).toHaveLength(1);
  expect(r.fatos[0]).toMatchObject({ tipo, ref: { eventId: e.eventId, revisao: hashCanonico(e) } });
  expect(montarFichaMinima(r).find(f => f.id === "ecog")).toMatchObject({ estado: "DOCUMENTADO", valor: 1 });
});
it("não incorpora versão desconhecida nem triagem de outro lote ou paciente", () => {
  for (const e of [triagem("Triagem@2"), { ...triagem("Triagem"), tumorLotId: "outro" },
    { ...triagem("Triagem"), patientId: "outro" }])
    expect(projetarRetrato([e], contexto).fatos).toEqual([]);
});
it("confirmação do contêiner não promove ECOG ainda pendente", () => {
  const e = triagem("Triagem");
  e.payload = { data: triagemBase({ ecog: { ...triagemBase().ecog, estado: "PENDENTE", revisao: "REVISAR" } }) };
  const r = projetarRetrato([e], contexto);
  expect(r.fatos).toHaveLength(1);
  expect(montarFichaMinima(r).find(f => f.id === "ecog")?.estado).toBe("PENDENTE");
});
