import { describe, expect, it } from "vitest";
import {
  CapacidadeOncoboardDesabilitada,
  criarOncoboard,
  obterPromptPersona,
  PERSONAS_ONCOBOARD,
  SaidaOncoboardInvalida,
  type LlmAdapter,
} from "../../../src/app/oncoboard/index.js";

const input = {
  patientRef: "opaque-patient-ref",
  persona: "oncologista_clinico" as const,
  pergunta: "Resuma as lacunas.",
  fontes: [{
    id: "source-1", versao: "v1", conteudo: "Paciente Teste relata tratamento prévio.",
    dicionario: { nomes: ["Paciente Teste"], identificadores: ["00000000000"] },
  }],
  contexto: {
    administracoes: ["Administração documentada"],
    prescricoes: ["Prescrição documentada"],
    cirurgia: { descricao: "Avaliação cirúrgica", intencao: "curativa (registrada na fonte)" },
    radioterapiaPrevia: { dose: "dado da fonte", volume: "dado da fonte", orgaosDeRisco: ["dado da fonte"] },
  },
};

describe("Oncoboard", () => {
  it("expõe somente as três personas clínicas estabelecidas", () => {
    expect(PERSONAS_ONCOBOARD).toEqual([
      "oncologista_clinico", "cirurgiao_oncologico", "radioterapeuta",
    ]);
  });

  it("expõe prompts específicos e detalhados para a interface", () => {
    const clinico = obterPromptPersona("oncologista_clinico");
    const cirurgia = obterPromptPersona("cirurgiao_oncologico");
    const rt = obterPromptPersona("radioterapeuta");
    expect(clinico.split("\n")).toHaveLength(25);
    expect(clinico.toLowerCase()).toContain("estudos clínicos");
    expect(clinico).toContain("administração efetiva e prescrição");
    expect(cirurgia.split("\n")).toHaveLength(25);
    expect(cirurgia).toContain("Ressecabilidade");
    expect(cirurgia.toLowerCase()).toContain("intenção cirúrgica");
    expect(cirurgia).toContain("operabilidade");
    expect(rt.split("\n")).toHaveLength(25);
    expect(rt).toContain("Fracionamento");
    expect(rt.toLowerCase()).toContain("dose prévia");
    expect(rt).toContain("Órgãos de risco");
  });

  it("fica desabilitado por padrão", async () => {
    const board = criarOncoboard();
    expect(board.capacidade).toBe("DESABILITADA");
    await expect(board.responder(input)).rejects.toBeInstanceOf(CapacidadeOncoboardDesabilitada);
  });

  it("só entrega dados desidentificados ao adapter e retorna rascunho estruturado", async () => {
    let received = "";
    const adapter: LlmAdapter = {
      async gerar(prompt) {
        received = prompt;
        return {
          resposta: "Resumo documental.", perguntas: [], lacunas: ["Fonte não informa data."],
          divergencias: [], citacoes: [{ fonteId: "SOURCE_1", versao: "VERSION_1", trecho: "relata tratamento prévio" }],
        };
      },
    };
    const draft = await criarOncoboard({ adapter }).responder(input);
    expect(received).not.toContain("Paciente Teste");
    expect(received).toContain("⟨NOME_");
    expect(received).toContain("Administração documentada");
    expect(received).toContain("Prescrição documentada");
    expect(draft).toMatchObject({ tipo: "RASCUNHO", pacienteRef: input.patientRef });
    expect(draft.citacoes).toEqual([{ fonteId: "source-1", versao: "v1", trecho: "relata tratamento prévio" }]);
    expect(draft).not.toHaveProperty("assinatura");
    expect(draft).not.toHaveProperty("gravar");
  });

  it.each([
    { fonteId: "SOURCE_9", versao: "VERSION_9", trecho: "texto inventado" },
    { fonteId: "SOURCE_1", versao: "VERSION_1", trecho: "texto inventado" },
    { fonteId: "SOURCE_1", versao: "VERSION_1", trecho: "Paciente Teste relata tratamento prévio." },
  ])("rejeita citação sem fonte real e trecho literal desidentificado", async (citation) => {
    const adapter: LlmAdapter = {
      async gerar() {
        return {
          resposta: "Resumo documental.", perguntas: [], lacunas: [], divergencias: [],
          citacoes: [citation],
        };
      },
    };
    await expect(criarOncoboard({ adapter }).responder(input)).rejects.toBeInstanceOf(SaidaOncoboardInvalida);
  });

  it("bloqueia PHI residual na saída", async () => {
    const adapter: LlmAdapter = {
      async gerar() {
        return {
          resposta: "Paciente Teste precisa de revisão.", perguntas: [], lacunas: [], divergencias: [], citacoes: [],
        };
      },
    };
    await expect(criarOncoboard({ adapter }).responder(input)).rejects.toThrow("RASCUNHO_BLOQUEADO_PHI_RESIDUAL");
  });
});
