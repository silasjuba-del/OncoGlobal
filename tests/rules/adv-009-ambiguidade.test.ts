// Promovido de f0/w5-red:tests/adv/f02-ambiguidade.adv.test.ts (ADV-009).
import { describe, expect, it } from "vitest";
import { resolverIdentidade } from "../../src/rules/identidade.js";
import { reconciliar } from "../../src/rules/reconciliar.js";
import type { Paciente } from "../../src/contracts/clinico.js";
import type { Fonte } from "../../src/contracts/base.js";

const fonte = (id: string): Fonte => ({ sourceId: id, classe: "MANUAL", localizador: "teste",
  dataClinica: "2026-10-05", dataCaptura: "2026-10-05T12:00:00-03:00",
  versao: "1", contentHash: `hash-${id}` });

describe("F2 · conflitos e identidade em dados sintéticos", () => {
  it("ADV-009 · RESISTIU: duas fontes discordantes retêm os dois candidatos", () => {
    const r = reconciliar([{ valor: "direita", fonte: fonte("a") }, { valor: "esquerda", fonte: fonte("b") }]);
    expect(r).toMatchObject({ classe: "CONFLITO", valor: null });
    expect(r.candidatos).toHaveLength(2);
  });
  it("ADV-009 · RESISTIU: nome idêntico sem outro identificador não vincula", () => {
    const pacientes = [
      { patientId: "p-a", nome: "Paciente Teste 01", nascimento: "2000-01-01", identificadores: [] },
      { patientId: "p-b", nome: "Paciente Teste 01", nascimento: "2000-01-01", identificadores: [] },
    ] as unknown as Paciente[];
    expect(resolverIdentidade({ identificadores: [], nome: "Paciente Teste 01",
      nascimento: "2000-01-01" }, pacientes)).toBeNull();
  });
  it("ADV-009 · RESISTIU: identificadores exatos apontando para pacientes distintos ficam em conflito", () => {
    const pacientes = [
      { patientId: "p-a", nome: "Paciente Teste 01", identificadores: [{ tipo: "PRONTUARIO", valor: "TESTE-A" }] },
      { patientId: "p-b", nome: "Paciente Teste 02", identificadores: [{ tipo: "PRONTUARIO", valor: "TESTE-B" }] },
    ] as unknown as Paciente[];
    expect(resolverIdentidade({ identificadores: [
      { tipo: "PRONTUARIO", valor: "TESTE-A" }, { tipo: "PRONTUARIO", valor: "TESTE-B" },
    ] }, pacientes)).toEqual({ conflito: { patientIds: ["p-a", "p-b"], estado: "VERMELHO" } });
  });
});
