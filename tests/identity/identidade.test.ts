import { expect, it } from "vitest";
import { resolverIdentidade } from "../../src/rules/identidade.js";
import { rotearContato, revogarVinculo, vincularContato } from "../../src/kernel/identity/filaVinculo.js";
import type { Contato, Paciente } from "../../src/contracts/clinico.js";

const pacientes: Paciente[] = [
  { patientId: "p1", nome: "Paciente Teste 01", nascimento: "2000-01-01",
    sexoCadastral: "F", divergencia: false,
    identificadores: [{ tipo: "CNS", valor: "CNS-SINTETICO-01" }, { tipo: "CPF", valor: "CPF-SINTETICO-01" }] },
  { patientId: "p2", nome: "Paciente Teste 02", nascimento: "2000-02-02",
    sexoCadastral: "M", divergencia: false,
    identificadores: [{ tipo: "CPF", valor: "CPF-SINTETICO-02" }] },
];
const entrada = (identificadores: { tipo: "CNS" | "CPF" | "PRONTUARIO"; valor: string }[] = []) =>
  ({ identificadores });
const contato = (id: string, patientId: string | null): Contato => ({
  contatoId: id, canal: "TELEFONE", endereco: "+55-00-0000-0000",
  patientId, relacao: patientId ? "FAMILIAR" : "DESCONHECIDO",
  vinculadoEm: patientId ? "2026-10-05T12:00:00.000Z" : null, revogadoEm: null,
});

it("T-41 CNS exato liga; nome sozinho jamais; nome+nascimento só candidato", () => {
  expect(resolverIdentidade(entrada([{ tipo: "CNS", valor: "CNS-SINTETICO-01" }]), pacientes))
    .toEqual({ patientId: "p1" });
  expect(resolverIdentidade({ ...entrada(), nome: "Paciente Teste 01" }, pacientes)).toBeNull();
  expect(resolverIdentidade({ ...entrada(), nome: "Paciente Teste 01", nascimento: "2000-01-01" }, pacientes))
    .toEqual({ candidato: { patientId: "p1", motivo: "DEMOGRAFICO_EXATO" } });
  expect(resolverIdentidade({ ...entrada([{ tipo: "CPF", valor: "desconhecido" }]),
    nome: "Paciente Teste 01", nascimento: "2000-01-01" }, pacientes)).toBeNull();
});

it("CNS e CPF divergentes geram VERMELHO sem escolher prontuário", () => {
  expect(resolverIdentidade(entrada([{ tipo: "CNS", valor: "CNS-SINTETICO-01" },
    { tipo: "CPF", valor: "CPF-SINTETICO-02" }]), pacientes))
    .toEqual({ conflito: { patientIds: ["p1", "p2"], estado: "VERMELHO" } });
});

it("telefone compartilhado vai à fila; A14 nome em número desconhecido não vincula", () => {
  const ids = { ...entrada(), nome: "Paciente Teste 01", nascimento: "2000-01-01" };
  expect(rotearContato("+55-00-0000-0000", "unknown-1", [contato("c1", "p1"), contato("c2", "p2")],
    ids, pacientes)).toMatchObject({ fila: { estado: "VERMELHO", candidatos: ["p1", "p2"] } });
  expect(rotearContato("+55-00-0000-0000", "unknown-2", [], ids, pacientes))
    .toEqual({ fila: { contatoNaoVinculadoId: "unknown-2", endereco: "+55-00-0000-0000",
      candidatos: [], estado: "PENDENTE" } });
  expect(rotearContato("+55-00-0000-0000", "unknown-3", [contato("c1", "p1")], ids, pacientes))
    .toMatchObject({ vinculo: { relacao: "FAMILIAR" }, identidadePacienteConfirmada: false });
});

it("vínculo de contato é explícito, datado e revogável", () => {
  const linked = vincularContato(contato("c1", null), "p1", "2026-10-05T12:00:00.000Z", "CUIDADOR");
  expect(linked).toMatchObject({ patientId: "p1", relacao: "CUIDADOR" });
  const revoked = revogarVinculo(linked, "2026-10-06T12:00:00.000Z");
  expect(revoked.patientId).toBe("p1");
  expect(rotearContato(revoked.endereco, "unknown-4", [revoked], entrada(), pacientes))
    .toMatchObject({ fila: { estado: "PENDENTE" } });
});
