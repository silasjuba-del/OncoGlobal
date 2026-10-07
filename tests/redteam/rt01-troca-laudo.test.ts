// RT-01 · Troca de laudo entre pacientes (S0) — provas de DEFESA que existem hoje.
// Homônimos PT07/PT09 com mesmo primeiro nome, mesma idade, mesmo tumor.
// Prova: score alto não vincula (D-W9-34a); conflito CNS×cadastro ordena mas nunca liga;
// dedupe não junta laudos de pacientes diferentes (conflito VERMELHO, nunca merge silencioso).
import { describe, expect, it } from "vitest";
import { rankearPacientes } from "../../src/kernel/extracao/patient-resolver.js";
import { executarPipelineExtracao } from "../../src/orchestration/pipeline-extracao.js";
import { deduplicarExames, gerarChaveDedupe } from "../../src/rules/w8/dedupeExame.js";
import { resolverIdentidade } from "../../src/rules/identidade.js";
import {
  CNS_INVALIDO_PT07,
  CNS_INVALIDO_PT09,
  cadastroHomônimos,
  pacientePt07Registry,
  pacientePt09Registry,
} from "../fixtures/redteam/pacientes.js";
import { LAUDO_NOME_TROCADO, REIMPRESSAO_DATA_EXTRACAO } from "../fixtures/redteam/laudos.js";

const segmento = (id: string) => ({
  id, recordingId: "grav-rt01", sourceId: `fonte-${id}`, sourceType: "imaging_report" as const,
  startMs: null, endMs: null, speakers: [], candidateNames: [],
  rawTranscript: LAUDO_NOME_TROCADO, boundaryConfidence: null, boundaryReviewRequired: false,
  patientId: null,
});

describe("RT-01 · nenhum fato vira do paciente sem decisão humana", () => {
  it("score idêntico e alto para os dois homônimos; TODOS os candidatos exigem revisão", () => {
    const hints = {
      name: "Maria Alves de Souza", age: 54, sex: "feminino", tumor: "mama",
      laterality: "direita", protocol: "carbo-taxol", biomarker: "RE positivo",
      eventDate: "2030-01-10",
    };
    const candidatos = rankearPacientes("seg-1", hints, [pacientePt07Registry, pacientePt09Registry],
      { desidentified: false, openedPatientId: "Paciente Teste 07" });
    expect(candidatos).toHaveLength(2);
    for (const c of candidatos) expect(c.requiresReview).toBe(true);
    // O paciente aberto NÃO vence só por estar aberto: nome/lateralidade do PT09 divergem.
    const [primeiro, segundo] = candidatos;
    // Score MÁXIMO (casa com tudo no cadastro) — e mesmo assim NÃO vincula:
    expect(primeiro?.score).toBe(1);
    expect(segundo?.score).toBeLessThan(1); // homônimo diverge em nome/lateralidade
    expect(primeiro?.requiresReview).toBe(true);
    expect(segundo?.requiresReview).toBe(true);
  });

  it("laudo sem nome (desidentificado): peso do nome é zero e o score não é renormalizado", () => {
    const candidatos = rankearPacientes("seg-2", { age: 54, tumor: "mama" },
      [pacientePt07Registry, pacientePt09Registry], { desidentified: true });
    for (const c of candidatos) {
      expect(c.reasons.name).toBe("desidentificado: peso zero");
      expect(c.score).toBeLessThanOrEqual(0.5); // sem renormalização: nunca chega a 0,90
      expect(c.requiresReview).toBe(true);
    }
  });

  it("CNS de um com nome do outro: divergência forte vence o score e segue sem vínculo", () => {
    const candidatos = rankearPacientes("seg-3",
      { name: "Maria Alves de Oliveira", age: 54, tumor: "mama", cns: CNS_INVALIDO_PT07 },
      [pacientePt07Registry, pacientePt09Registry], { desidentified: false });
    const [primeiro] = candidatos;
    expect(primeiro?.patientId).toBe("Paciente Teste 07"); // CNS forte ordena primeiro
    expect(primeiro?.reasons.name).toBe("diverge");
    expect(primeiro?.requiresReview).toBe(true); // divergência nome×CNS fica em revisão
  });

  it("pipeline: nenhum segmento nem fato recebe patientId; exceção UNLINKED_PATIENT sempre", () => {
    const estado = executarPipelineExtracao({
      recordingId: "grav-rt01", sourceId: "laudo-trocado",
      sourceType: "imaging_report", rawTranscript: LAUDO_NOME_TROCADO,
      registeredPatients: [pacientePt07Registry, pacientePt09Registry],
      identityHintsBySegment: { "grav-rt01:0": { name: "PACIENTE TESTE 09", age: 77 } },
    });
    expect(estado.segments).toHaveLength(1);
    expect(estado.segments[0]?.patientId).toBeNull();
    for (const fato of estado.facts) expect(fato.patientCandidateId).toBeNull();
    expect(estado.exceptions.some((e) => e.kind === "UNLINKED_PATIENT")).toBe(true);
  });

  it("resolverIdentidade: CNS exato do cadastro liga; identificador divergente nunca casa por nome", () => {
    const cnsExato = resolverIdentidade(
      { identificadores: [{ tipo: "CNS", valor: CNS_INVALIDO_PT09 }] }, cadastroHomônimos);
    expect(cnsExato).toEqual({ patientId: "Paciente Teste 09" });
    // CNS de PT07 com nome de PT09: identificador vence; o nome divergente não corrige o vínculo
    const misto = resolverIdentidade({
      identificadores: [{ tipo: "CNS", valor: CNS_INVALIDO_PT07 }],
      nome: "Maria Alves de Oliveira", nascimento: "1976-03-04",
    }, cadastroHomônimos);
    expect(misto).toEqual({ patientId: "Paciente Teste 07" });
  });

  it("dedupe: mesma chave com conteúdos diferentes gera conflito VERMELHO, nunca merge", () => {
    const saida = deduplicarExames([
      { id: "L1", tipo: "IMAGEM", servico: "Casa de Imagem", registro: "REG-77", dataExame: "2030-01-01",
        conteudoHash: "hash-a", conclusao: "nódulos suspeitos" },
      { id: "L2", tipo: "IMAGEM", servico: "Casa de Imagem", registro: "REG-77", dataExame: "2030-01-01",
        conteudoHash: "hash-b", conclusao: "nódulos suspeitos" },
    ]);
    expect(saida.conflitos).toHaveLength(1);
    expect(saida.conflitos[0]?.estado).toBe("VERMELHO");
    expect(saida.totalExamesUnicos).toBe(1); // um exame, estado conflitante
    expect(saida.examesUnicos[0]?.estado).toBe("VERMELHO");
  });

  it("dedupe: reimpressão com data de EXTRAÇÃO diferente no cabeçalho não impede a dedupe (chave usa data do exame)", () => {
    expect(gerarChaveDedupe({
      id: "R1", tipo: "IMAGEM", servico: "Casa de Imagem", registro: "REG-77", dataExame: "2030-01-01",
    })).toBe(gerarChaveDedupe({
      id: "R2", tipo: "IMAGEM", servico: "casa_de_imagem", registro: "reg-77", dataExame: "2030-01-01",
    }));
    const saida = deduplicarExames([
      { id: "R1", tipo: "IMAGEM", servico: "Casa de Imagem", registro: "REG-77", dataExame: "2030-01-01",
        conteudoHash: "hash-x", conclusao: "secundarismo suspeito" },
      { id: "R2", tipo: "IMAGEM", servico: "Casa de Imagem", registro: "REG-77", dataExame: "2030-01-01",
        conteudoHash: "hash-x", conclusao: "secundarismo suspeito" },
    ]);
    expect(saida.duplicatasDetectadas).toHaveLength(1);
    expect(saida.totalExamesUnicos).toBe(1);
  });

  it("dedupe: exames de pacientes diferentes com chaves diferentes ficam DOIS exames (concordância, não merge)", () => {
    const saida = deduplicarExames([
      { id: "P7", tipo: "IMAGEM", servico: "Casa A", registro: "REG-7", dataExame: "2030-01-01",
        conclusao: "nódulo suspeito" },
      { id: "P9", tipo: "IMAGEM", servico: "Casa B", registro: "REG-9", dataExame: "2030-02-01",
        conclusao: "Nódulo Suspeito" },
    ]);
    expect(saida.totalExamesUnicos).toBe(2);
    expect(saida.conflitos).toHaveLength(0);
    expect(saida.concordancias).toHaveLength(1); // mesma conclusão, exames distintos
  });
});
