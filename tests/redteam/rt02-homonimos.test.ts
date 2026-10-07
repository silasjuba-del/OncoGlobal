// RT-02 · Nomes e homônimos (S0) — provas de DEFESA que existem hoje.
// Prova que o Segmenter separa gravações com dois pacientes e o PatientResolver só ordena
// (nunca liga): acento, abreviação, nome invertido, "Dona", rótulo errado de identificador.
import { describe, expect, it } from "vitest";
import { segmentarTranscricao } from "../../src/kernel/extracao/segmenter.js";
import { rankearPacientes, type RegistryPatient } from "../../src/kernel/extracao/patient-resolver.js";
import { classificarIdentificador } from "../../src/rules/w8/identificadores.js";
import { resolverIdentidade } from "../../src/rules/identidade.js";
import { executarPipelineExtracao } from "../../src/orchestration/pipeline-extracao.js";
import {
  CPF_INVALIDO,
  CNS_INVALIDO_PT07,
  cadastroHomônimos,
  pacientePt07Registry,
  pacientePt09Registry,
  pacientesRegistro,
} from "../fixtures/redteam/pacientes.js";

const turnos = (...textos: readonly string[]) =>
  textos.map((text, i) => ({ text, startMs: i * 30_000, endMs: i * 30_000 + 25_000, speaker: "medico" }));

describe("RT-02 · o Segmenter separa; o PatientResolver só ordena", () => {
  it("dois pacientes na mesma gravação (chamada explícita) ⇒ dois segmentos", () => {
    const segmentos = segmentarTranscricao({
      recordingId: "grav-rt02", sourceId: "plaud-1", sourceType: "plaud",
      turns: turnos(
        "Bom dia. Chamo: Maria Souza, 54 anos, tumor de mama. Como está a dor?",
        "Vamos ajustar o exame. Boa tarde. Chamo: Maria Oliveira, 54 anos, tumor de mama.",
      ),
    });
    expect(segmentos).toHaveLength(2);
    expect(segmentos[0]?.candidateNames).toEqual(["Maria Souza"]);
    expect(segmentos[1]?.candidateNames).toEqual(["Maria Oliveira"]);
    for (const s of segmentos) expect(s.patientId).toBeNull(); // nunca liga automaticamente
  });

  it("menção incidental de médico/acompanhante NÃO abre fronteira (sem 'chamo')", () => {
    const segmentos = segmentarTranscricao({
      recordingId: "grav-rt02b", sourceId: "plaud-2", sourceType: "plaud",
      turns: turnos(
        "Bom dia. Chamo: Maria Souza, 54 anos, tumor de mama.",
        "A Dra. Maria Silva vai ver o exame depois; acompanhante: Maria, anota aí.",
      ),
    });
    expect(segmentos).toHaveLength(1); // não separa por nome solto (é a consulta aberta)
    expect(segmentos[0]?.candidateNames).toEqual(["Maria Souza"]);
  });

  it("homônimos completos com mães diferentes: divergência forte desempata e continua em revisão", () => {
    const candidatos = rankearPacientes("seg-rt02",
      { name: "Maria Alves de Souza", age: 54, tumor: "mama", mother: "Joana Oliveira" },
      [pacientePt07Registry, pacientePt09Registry], { desidentified: false });
    const [primeiro, segundo] = candidatos;
    // A mãe (dado forte) vence o nome: PT09 ordena primeiro apesar do score menor.
    expect(primeiro?.patientId).toBe("Paciente Teste 09");
    expect(primeiro?.reasons.mother).toBe("coincide no cadastro");
    expect(segundo?.patientId).toBe("Paciente Teste 07");
    expect(segundo?.reasons.mother).toBe("diverge no cadastro");
    for (const c of candidatos) expect(c.requiresReview).toBe(true);
  });

  it.each([
    ["José Ferreira", "jose ferreira"], // acento/caixa normalizados
    ["jose  ferreira", "José Ferreira"], // espaços múltiplos
  ])("nome com/sem acento coincide (%s × %s) mas NÃO liga", (a, b) => {
    const pacientes: readonly RegistryPatient[] = [
      { patientId: "Paciente Teste 10", name: a, age: 60, tumor: "mama" },
    ];
    const [c] = rankearPacientes("seg-acc", { name: b, age: 60, tumor: "mama" }, pacientes,
      { desidentified: false });
    expect(c?.reasons.name).toBe("coincide");
    expect(c?.requiresReview).toBe(true);
  });

  it.each([
    ["M. I. R.", "Maria Isabel Ribeiro", "abreviação não é igualdade"],
    ["Ribeiro Maria Isabel", "Maria Isabel Ribeiro", "nome invertido não é igualdade"],
    ["Dona Maria Isabel Ribeiro", "Maria Isabel Ribeiro", "tratamento 'Dona' não é igualdade"],
    ["Sr. João Carlos", "João Carlos", "tratamento 'Sr.' não é igualdade"],
  ])("'%s' não coincide com '%s' no cadastro (nome nunca liga)", (dito, cadastrado) => {
    const pacientes: readonly RegistryPatient[] = [
      { patientId: "Paciente Teste 11", name: cadastrado, age: 60, tumor: "mama" },
    ];
    const [c] = rankearPacientes("seg-nome", { name: dito, age: 60, tumor: "mama" }, pacientes,
      { desidentified: false });
    expect(c?.reasons.name).toBe("diverge");
    expect(c?.requiresReview).toBe(true);
  });

  it("transcrição Plaud desidentificada: nome pesa zero e não renormaliza (score baixo, revisão)", () => {
    const [c] = rankearPacientes("seg-plaud", { name: "Maria Alves de Souza", age: 54, tumor: "mama" },
      [pacientePt07Registry], { desidentified: true });
    expect(c?.reasons.name).toBe("desidentificado: peso zero");
    expect(c?.score).toBeLessThan(0.4); // age+tumor sem nome: nunca chega perto de AUTO_MERGE
    expect(c?.requiresReview).toBe(true);
  });

  it("CPF rotulado 'Cartão SUS': tipo por VALOR (CPF), rótulo divergente sinalizado, DV inválido não liga", () => {
    const saida = classificarIdentificador({ rotulo: "Cartão SUS", valor: CPF_INVALIDO });
    expect(saida.tipoPorValor).toBe("CPF");
    expect(saida.conflitoRotulo).toBe(true);
    expect(saida.valido).toBe(false); // DV inválido de propósito (sintético)
  });

  it("demográfico exato com DOIS homônimos completos não escolhe (null); com identificador, liga pelo valor", () => {
    const gêmeas: Parameters<typeof resolverIdentidade>[1] = [
      {
        patientId: "Paciente Teste 12",
        identificadores: [{ tipo: "CNS", valor: "700000000000011" }],
        nome: "Maria Igual de Gêmea", nascimento: "1976-03-04", sexoCadastral: "F", divergencia: false,
      },
      {
        patientId: "Paciente Teste 13",
        identificadores: [{ tipo: "CNS", valor: "700000000000012" }],
        nome: "Maria Igual de Gêmea", nascimento: "1976-03-04", sexoCadastral: "F", divergencia: false,
      },
    ];
    const ambíguo = resolverIdentidade(
      { identificadores: [], nome: "Maria Igual de Gêmea", nascimento: "1976-03-04" }, gêmeas);
    expect(ambíguo).toBeNull(); // dois homônimos completos ⇒ revisão, nunca escolha
    const comIdentificadorDivergente = resolverIdentidade({
      identificadores: [{ tipo: "CNS", valor: CNS_INVALIDO_PT07 }],
      nome: "Outra Pessoa", nascimento: "2000-01-01",
    }, cadastroHomônimos);
    // Identificador presente vence: nome divergente não corrige nem cria candidato
    expect(comIdentificadorDivergente).toEqual({ patientId: "Paciente Teste 07" });
  });

  it("pipeline: dois pacientes numa gravação geram 2 exceções UNLINKED_PATIENT independentes", () => {
    const estado = executarPipelineExtracao({
      recordingId: "grav-rt02", sourceId: "plaud-1", sourceType: "plaud",
      rawTranscript: "Bom dia. Chamo: Maria Souza, 54 anos, tumor de mama.\n" +
        "Boa tarde. Chamo: Maria Oliveira, 54 anos, tumor de mama.",
      registeredPatients: [pacientePt07Registry, pacientePt09Registry],
    });
    expect(estado.segments).toHaveLength(2);
    const semVinculo = estado.exceptions.filter((e) => e.kind === "UNLINKED_PATIENT");
    expect(semVinculo).toHaveLength(2);
    expect(estado.segments.every((s) => s.patientId === null)).toBe(true);
  });
});
