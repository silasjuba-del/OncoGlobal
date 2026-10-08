import { expect, it } from "vitest";
import { ClinicalEvent, type ClinicalEvent as Event } from "../../src/contracts/operacao.js";
import { Contato } from "../../src/contracts/clinico.js";
import { projetarVinculosContato } from "../../src/kernel/projections/vinculosContato.js";
const contact = Contato.parse({ contatoId: "contato-sintetico", canal: "TELEFONE", endereco: "telefone-invalido-sintetico",
  patientId: null, relacao: "DESCONHECIDO", vinculadoEm: null, revogadoEm: null });
const make = (id: string, patientId: string, tipo: string, data: unknown, patch: Partial<Event> = {}): Event => ClinicalEvent.parse({
  eventId: id, operationId: `op-${id}`, eventIndex: 0, patientId, encounterId: "consulta", tumorLotId: null,
  tipo, payload: { reviewDecisionId: `review-${id}`, data }, fontes: [], revisao: "CONFIRMADO",
  criadoEm: "2026-10-08T12:00:00Z", criadoPor: { tipo: "SESSAO", id: "medico-sintetico" }, supersedesEventId: null, ...patch });
const source = { event: make("origem", "Paciente Teste 01", "Contato", contact), value: contact };
const decision = (id: string, patientId: string, patch: Partial<Event> = {}) => make(id, patientId, "ReviewDecision",
  { kind: "VinculoContato", contatoId: contact.contatoId, sourceEventId: source.event.eventId,
    patientId, encounterId: "consulta", tumorLotId: null }, patch);
it("vínculo explícito projeta destino sem alterar origem ou exigir supersedes cross-patient", () => {
  const result = projetarVinculosContato([source], [decision("escolha", "Paciente Teste 02")])[0]!;
  expect(result).toMatchObject({ patientIdResolvido: "Paciente Teste 02", estadoVinculo: "VINCULADO", reviewEventIds: ["escolha"] });
  expect(result.event).toBe(source.event);
  expect(result.event.patientId).toBe("Paciente Teste 01");
  expect(result.value.patientId).toBe("Paciente Teste 02");
  expect(source.value.patientId).toBeNull();
});
it("decisões para destinos divergentes preservam candidatos, sem last-write-wins", () => {
  const result = projetarVinculosContato([source], [decision("a", "Paciente Teste 02"), decision("b", "Paciente Teste 03")])[0]!;
  expect(result.estadoVinculo).toBe("CONFLITO");
  expect(result.patientIdResolvido).toBeNull();
  expect(result.candidatosVinculo).toEqual(["Paciente Teste 02", "Paciente Teste 03"]);
});
it.each(["RAW", "INFERIDO"] as const)("%s não concede autoridade de vínculo", (revisao) => {
  expect(projetarVinculosContato([source], [decision("a", "Paciente Teste 02", { revisao })])[0]?.patientIdResolvido).toBeNull();
});
it("decisão não pode reutilizar referência de outro contato ou escopo forjado", () => {
  const wrong = decision("a", "Paciente Teste 02");
  expect(projetarVinculosContato([source], [{ ...wrong, patientId: "Paciente Teste 03" }])[0]?.patientIdResolvido).toBeNull();
  expect(projetarVinculosContato([source], [{ ...wrong, encounterId: "outra-consulta" }])[0]?.patientIdResolvido).toBeNull();
});
it("contato revogado e origem duplicada não ganham destino silencioso", () => {
  const revoked = { ...source, value: { ...contact, revogadoEm: "2026-10-08T13:00:00Z" } };
  expect(projetarVinculosContato([revoked], [decision("a", "Paciente Teste 02")])[0]?.patientIdResolvido).toBeNull();
  expect(projetarVinculosContato([source, source], [decision("a", "Paciente Teste 02")])[0]?.estadoVinculo).toBe("CONFLITO");
});
