import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { verificarPropostaNoHarnessRuntime, type ItemPropostaSobTeste } from "../../src/kernel/harness/runtime.js";
import { produzirPropostaBrainOs } from "../../src/kernel/llm/brainOs.js";

const sha = (s: string) => createHash("sha256").update(s).digest("hex");
function verificar(texto: string, valor: string | number, unidade?: string, extra: Partial<ItemPropostaSobTeste> = {}) {
  return verificarPropostaNoHarnessRuntime({
    proposta: { propostaId: "proposta-sintetica", itensPropostos: [{
      itemId: "item", campo: "medida", valorProposto: valor, unidade: unidade ?? null, qualificador: "AFIRMADO",
      citacoes: [{ sourceId: "s", versao: "1", contentHash: sha(texto), trecho: texto }], ...extra,
    }] },
    fontesOriginais: [{ sourceId: "s", versao: "1", contentHash: sha(texto), conteudoOriginal: texto, modalidade: "AUDIO" }],
  });
}

describe("Integridade cognitiva adversarial", () => {
  it.each([
    ["Valor A 5 mcg; valor B 20 mg.", 5, "mg"],
    ["Medida 5 mg/dL.", 5, "mg"],
    ["Medida 5 cm.", 5, "m"],
    ["Contagem 1.000.000.", 1, undefined],
    ["Medida 1.000 mg.", 1, "mg"],
    ["Medida 1e3 mg.", 1, "mg"],
    ["Medida 5 mg.", 5, undefined],
  ] as const)("não confirma par numérico incompatível: %s", (texto, valor, unidade) => {
    const r = verificar(texto, valor, unidade);
    expect(r.status).toBe("BLOQUEADO_FALHA_CRITICA");
    expect(r.itensVerificados[0]?.verificacaoDeterministicaIndependenteOk).toBe(false);
  });

  it("não permite que criticoNumero=false suprima destaque de um número", () => {
    const r = verificar("Medida 3,4 cm.", 3.4, "cm", { criticoNumero: false });
    expect(r.itensVerificados[0]?.criticoNumero).toBe(true);
    expect(r.itensVerificados[0]?.destacadoParaEscutaRevisaoHumana).toBe(true);
  });

  it.each(["Nega dispneia.", "Sem evidência de dispneia.", "Paciente não apresenta dispneia.", "Nao ha dispneia."])(
    "não aceita recortar a negação do original: %s", texto => {
      const r = verificar(texto, "dispneia", undefined, {
        citacoes: [{ sourceId: "s", versao: "1", contentHash: sha(texto), trecho: "dispneia" }],
      });
      expect(r.status).toBe("BLOQUEADO_FALHA_CRITICA");
      expect(r.itensVerificados[0]?.qualificadorConfere).toBe(false);
    });

  it("não escolhe uma ocorrência afirmada quando o mesmo trecho também ocorre negado", () => {
    const texto = "Nega dispneia. Apresenta dispneia.";
    const r = verificar(texto, "dispneia", undefined, {
      citacoes: [{ sourceId: "s", versao: "1", contentHash: sha(texto), trecho: "dispneia" }],
    });
    expect(r.status).toBe("BLOQUEADO_FALHA_CRITICA");
    expect(r.itensVerificados[0]?.qualificadorConfere).toBe(false);
    expect(r.itensVerificados[0]?.qualificadorDeterministico).toBeNull();
  });

  it("não perde negação quando o sujeito é terceiro", () => {
    const r = verificar("Mae nega alergia.", "alergia", undefined, { qualificador: "TERCEIRO" });
    expect(r.status).toBe("BLOQUEADO_FALHA_CRITICA");
    expect(r.itensVerificados[0]?.qualificadorConfere).toBe(false);
  });

  it("não transporta a negação de outra oração para a alegação", () => {
    const texto = "Nega dor, metastase presente.";
    const r = verificar(texto, "metastase", undefined, { qualificador: "NEGADO",
      citacoes: [{ sourceId: "s", versao: "1", contentHash: sha(texto), trecho: "metastase presente" }] });
    expect(r.status).toBe("BLOQUEADO_FALHA_CRITICA");
    expect(r.itensVerificados[0]?.qualificadorConfere).toBe(false);
  });

  it("não verifica proposta de outro paciente usando identidade documental compatível", () => {
    const texto = "Paciente: Paciente Sintetico\nMarcador presente.";
    const r = verificarPropostaNoHarnessRuntime({ proposta: { propostaId: "p", patientId: "outro", itensPropostos: [] },
      fontesOriginais: [{ sourceId: "s", versao: "1", conteudoOriginal: texto, contentHash: sha(texto), modalidade: "TEXTO",
        identidadeEsperadaPaciente: { patientId: "correto", nome: "Paciente Sintetico", identificadores: [] } }] });
    expect(r.status).toBe("BLOQUEADO_FALHA_CRITICA");
    expect(r.manifestacoes.some(m => m.tipo === "FALHA_IDENTIDADE")).toBe(true);
  });

  it("nome isolado não comprova vínculo documental", () => {
    const texto = "Paciente: Paciente Sintetico\nMarcador presente.";
    const r = verificarPropostaNoHarnessRuntime({ proposta: { propostaId: "p", patientId: "correto", itensPropostos: [] },
      fontesOriginais: [{ sourceId: "s", versao: "1", conteudoOriginal: texto, contentHash: sha(texto), modalidade: "TEXTO",
        identidadeEsperadaPaciente: { patientId: "correto", nome: "Paciente Sintetico", identificadores: [] } }] });
    expect(r.status).toBe("REQUER_RESOLUCAO_MEDICA");
  });

  it.each(["pagina:1", "pagina:999"])("confere localizador contra a fonte: %s", localizador => {
    const texto = "Marcador presente.";
    const r = verificarPropostaNoHarnessRuntime({ proposta: { propostaId: "p", itensPropostos: [{ itemId: "i", campo: "marcador",
      valorProposto: "Marcador", qualificador: "AFIRMADO", citacoes: [{ sourceId: "s", versao: "1", contentHash: sha(texto), trecho: texto, localizador }],
    }] }, fontesOriginais: [{ sourceId: "s", versao: "1", conteudoOriginal: texto, contentHash: sha(texto), modalidade: "TEXTO",
      localizadores: [{ localizador: "pagina:1", trecho: texto }] }] });
    expect(r.status).toBe(localizador === "pagina:1" ? "APTO_PARA_REVISAO_HUMANA" : "BLOQUEADO_FALHA_CRITICA");
  });

  it.each([false, true])("não duplica referência nem escolhe variante conflitante (conflito=%s)", conflito => {
    const ref = { referenciaId: "r", versao: "1", status: "CONSULTAVEL", escopoCompativel: true, provenienciaCompleta: true,
      termosChave: ["marcador"], motivoInclusaoSeAplicavel: "Correspondência sintética" };
    const r = produzirPropostaBrainOs({ propostaId: "p", agora: "2026-10-21T12:00:00Z",
      fontes: [{ sourceId: "s", versao: "1", conteudo: "marcador presente" }],
      referenciasCandidatas: [ref, { ...ref, motivoInclusaoSeAplicavel: conflito ? "Outra descrição" : ref.motivoInclusaoSeAplicavel }],
    });
    expect(r.inclusoesMesa).toHaveLength(conflito ? 0 : 1);
    expect(r.referenciasExcluidas[0]?.motivoCodigo).toBe(conflito ? "CONFLITO_MESMA_VERSAO" : "DUPLICADA_MESMA_VERSAO");
  });

  it("cobertura parcial exige resolução médica mesmo sem item falso", () => {
    const r = verificarPropostaNoHarnessRuntime({ proposta: { propostaId: "p", itensPropostos: [] }, fontesOriginais: [
      { sourceId: "s1", versao: "1", modalidade: "TEXTO", conteudoOriginal: "Original", contentHash: sha("Original") },
      { sourceId: "s2", versao: "1", modalidade: "DOCUMENTO", conteudoOriginal: null, contentHash: null },
    ] });
    expect(r.cobertura).toBe("PARCIALMENTE_VERIFICADA");
    expect(r.status).toBe("REQUER_RESOLUCAO_MEDICA");
  });

  it("a referência apresenta o trecho que realmente motivou sua inclusão", () => {
    const original = `${"Texto inicial. ".repeat(40)}TERMO_SINTETICO presente.`;
    const r = produzirPropostaBrainOs({ propostaId: "p", agora: "2026-10-21T12:00:00Z",
      fontes: [{ sourceId: "s", versao: "1", conteudo: original }],
      referenciasCandidatas: [{ referenciaId: "r", versao: "1", status: "CONSULTAVEL", escopoCompativel: true,
        provenienciaCompleta: true, termosChave: ["TERMO_SINTETICO"], motivoInclusaoSeAplicavel: "Correspondência literal sintética" }],
    });
    expect(r.inclusoesMesa[0]?.trechoCitado).toContain("TERMO_SINTETICO");
    expect(original).toContain(r.inclusoesMesa[0]?.trechoCitado);
  });

  it("recusa colisão de sourceId no Brain em vez de sobrescrever a fonte", () => {
    expect(() => produzirPropostaBrainOs({ propostaId: "p", agora: "2026-10-21T12:00:00Z",
      fontes: [{ sourceId: "s", versao: "1", conteudo: "Original A" }, { sourceId: "s", versao: "2", conteudo: "Original B" }],
    })).toThrow("BRAIN_OS_SOURCE_ID_DUPLICADO");
  });

  it("bloqueia colisão de sourceId no harness independentemente da ordem", () => {
    const fontes = ["Medida 3 cm.", "Medida 4 cm."].map(conteudoOriginal => ({ sourceId: "s", versao: "1",
      conteudoOriginal, contentHash: sha(conteudoOriginal), modalidade: "TEXTO" as const }));
    for (const ordem of [fontes, [...fontes].reverse()]) {
      const ultima = ordem[1]!;
      const r = verificarPropostaNoHarnessRuntime({ proposta: { propostaId: "p", itensPropostos: [{ itemId: "i", campo: "medida",
        valorProposto: ultima.conteudoOriginal, qualificador: "AFIRMADO",
        citacoes: [{ sourceId: "s", versao: "1", contentHash: ultima.contentHash, trecho: ultima.conteudoOriginal }],
      }] }, fontesOriginais: ordem });
      expect(r.status).toBe("BLOQUEADO_FALHA_CRITICA");
      expect(r.cobertura).toBe("COBERTURA_NAO_VERIFICADA");
    }
  });

  it.each([["Medida 3,4 cm.", 3.4, "cm"], ["Medida 450 mg.", 450, "mg"], ["Medida 1,2 mg/dL.", "1,2", "mg/dL"]] as const)(
    "preserva correspondência literal válida: %s", (texto, valor, unidade) => {
      expect(verificar(texto, valor, unidade).itensVerificados[0]?.verificacaoDeterministicaIndependenteOk).toBe(true);
    });
});
