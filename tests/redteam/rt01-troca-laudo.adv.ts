// RT-01 · troca de laudo: os contratos reais recusam evidência de identidade contraditória.
import { describe, expect, it } from "vitest";
import { ReviewAction } from "../../src/contracts/w10/extracao.js";
import { confrontarNomeIdentificador } from "../../src/rules/w8/vinculoDocumento.js";
import { executarPipelineExtracao } from "../../src/orchestration/pipeline-extracao.js";
import { CNS_INVALIDO_PT07, CNS_INVALIDO_PT09, pacientePt07Registry, pacientePt09Registry } from "../fixtures/redteam/pacientes.js";
import { LAUDO_NOME_TROCADO } from "../fixtures/redteam/laudos.js";

describe("RT-01 · troca de laudo e vínculo de paciente", () => {
  it("CNS que corresponde ao PT07 junto do nome PT09 é recusado com conflito nominal explícito", () => {
    const result = confrontarNomeIdentificador({
      nomeDocumento: pacientePt09Registry.name,
      identificador: { tipo: "CNS", valor: CNS_INVALIDO_PT07 },
      cadastroNome: pacientePt07Registry.name,
      cadastroIdentificadores: [{ tipo: "CNS", valor: CNS_INVALIDO_PT07 }],
    });
    expect(result.liga).toBe(false);
    expect(result.motivo).toMatch(/conflito entre nome documental e nome do cadastro/i);
  });

  it("nome coincidente não compensa CNS que pertence a outro cadastro", () => {
    const result = confrontarNomeIdentificador({
      nomeDocumento: pacientePt07Registry.name,
      identificador: { tipo: "CNS", valor: CNS_INVALIDO_PT09 },
      cadastroNome: pacientePt07Registry.name,
      cadastroIdentificadores: [{ tipo: "CNS", valor: CNS_INVALIDO_PT07 }],
    });
    expect(result.liga).toBe(false);
    expect(result.motivo).toMatch(/conflito entre identificador documental e cadastro/i);
  });

  it("ReviewAction LIGAR_PACIENTE exige alvo e rejeita campos forjados", () => {
    const semAlvo = ReviewAction.safeParse({ exceptionId: "exc:UNLINKED_PATIENT:grav-rt01:0",
      acao: "LIGAR_PACIENTE", medicoId: "medico-sintetico", em: "2030-01-01T12:00:00Z" });
    expect(semAlvo.success).toBe(false);
    const alvo = ReviewAction.safeParse({ exceptionId: "exc:UNLINKED_PATIENT:grav-rt01:0",
      acao: "LIGAR_PACIENTE", medicoId: "medico-sintetico", em: "2030-01-01T12:00:00Z",
      patientId: "Paciente Teste 07", role: "ADMIN" });
    expect(alvo.success).toBe(false);
    expect(ReviewAction.safeParse({ exceptionId: "exc:UNLINKED_PATIENT:grav-rt01:0",
      acao: "LIGAR_PACIENTE", medicoId: "medico-sintetico", em: "2030-01-01T12:00:00Z",
      patientId: "Paciente Teste 07" }).success).toBe(true);
  });

  it("laudo de nome trocado preserva fatos como não vinculados mesmo com cadastro disponível", () => {
    const state = executarPipelineExtracao({ recordingId: "grav-rt01-adv", sourceId: "fonte-rt01-trocada",
      sourceType: "imaging_report", rawTranscript: `${LAUDO_NOME_TROCADO}\nNódulo em L5 medindo 12 mm.`,
      registeredPatients: [pacientePt07Registry, pacientePt09Registry],
      identityHintsBySegment: { "grav-rt01-adv:0": { name: pacientePt09Registry.name, age: 54 } },
      openedPatientId: pacientePt07Registry.patientId });
    expect(state.segments).toHaveLength(1);
    expect(state.segments[0]?.patientId).toBeNull();
    expect(state.facts).toEqual(expect.arrayContaining([expect.objectContaining({ sourceId: "fonte-rt01-trocada" })]));
    expect(state.facts.every((fact) => fact.patientCandidateId === null)).toBe(true);
    expect(state.exceptions).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: "UNLINKED_PATIENT", sourceIds: ["fonte-rt01-trocada"] }),
    ]));
    expect(state.timeline).toBeNull();
  });
});
