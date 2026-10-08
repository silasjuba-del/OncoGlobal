// W11-H7 · Página 2 "Dados complementares" da APAC (caixas 56–85). Só dado sintético.
// Regras: PREENCHIDO ou PENDENTE por caixa; RT vazia sem solicitação; nefrologia vazia; autorização em branco;
// uma linha por esquema anterior (nunca por ciclo); render com RASCUNHO até assinatura e sem termos de IA.
import { describe, expect, it } from "vitest";
import { preencherLaudo, BLOCOS_COMPLEMENTARES, CAMPOS_COMPLEMENTARES, type LaudoApac } from "../../src/apac/laudo.js";
import { montarTabelaSigtap } from "../../src/apac/sigtap.js";
import { renderizarApacComplementar, type EntradaPagina2 } from "../../src/impressao/apacLaudo.js";
import { apac, COD_QT, proc } from "../apac-w10/helpers.js";

const SIGTAP = { "2026-09": montarTabelaSigtap("2026-09", [proc({ codigo: COD_QT })]) };

/** Caso sintético de próstata em quimioterapia: sem RT, sem nefrologia, meses autorizados em branco. */
const CASO_PROSTATA: Record<string, unknown> = {
  localizacaoTumorPrimario: "Próstata",
  cidTopografia: "C61",
  diagnosticoCitoHistopatologico: "Adenocarcinoma acinar (sintético)",
  dataDiagnosticoCitoHistopatologico: "2026-06-01",
  grauHistopatologico: "G2",
  qtTratamentoAnterior: "NAO",
  qtContinuidade: "SIM",
  qtDataInicio: "2026-10-15",
  qtEsquema: "Esquema sintético A",
  qtMesesPlanejados: 6,
};

function laudoDe(over: Record<string, unknown> = {}): LaudoApac {
  return preencherLaudo(apac("ap-1", { ...CASO_PROSTATA, ...over }), SIGTAP);
}

function entradaDe(laudo: LaudoApac, assinado = false): EntradaPagina2 {
  const campos = Object.fromEntries(Object.entries(laudo.complementares).map(([k, c]) => [k, c]));
  return {
    documentId: laudo.apacId, documentVersion: 1,
    blocos: BLOCOS_COMPLEMENTARES.map((b) => ({ titulo: b.titulo, campos: b.chaves.map((chave) => ({ chave, rotulo: CAMPOS_COMPLEMENTARES[chave]! })) })),
    campos, naoAplicavel: laudo.naoAplicavel, assinado,
  };
}

// Termos proibidos no documento impresso (sem acento, minúsculas). Mesmo critério de ia-nunca-no-documento.
const TERMOS = [/inteligencia artificial/, /\bia\b/, /algoritmo/, /gerado automaticamente/, /sugere-se/, /sistema recomenda/, /modelo de linguagem/, /\bllm\b/, /oncoassist/, /chatgpt/, /\bclaude\b/, /\bgpt\b/];
const textoVisivel = (html: string): string =>
  html.replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ").replace(/&[a-z#0-9]+;/gi, " ")
    .normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();

describe("APAC página 2 · modelo (laudo.ts)", () => {
  it("caso de próstata em QT: RT e nefrologia ficam vazias sem virar pendência", () => {
    const l = laudoDe();
    expect(Object.keys(l.complementares).some((k) => k.startsWith("rt"))).toBe(false);
    expect(l.naoAplicavel).toEqual(expect.arrayContaining(["rtTratamentoAnterior", "rtFinalidade", "rtDataTermino"]));
    expect(l.pendentes).not.toContain("FINALIDADE (ESCOLHA DO MÉDICO)");
    expect(l.complementares.localizacaoTumorPrimario).toEqual({ estado: "PREENCHIDO", valor: "Próstata" });
    expect(l.complementares.qtContinuidade).toEqual({ estado: "PREENCHIDO", valor: "SIM" });
    expect(l.complementares.qtEsquema).toEqual({ estado: "PREENCHIDO", valor: "Esquema sintético A" });
  });

  it("meses autorizados (caixa 72) não está no modelo do solicitante e fica em branco do autorizador", () => {
    const l = laudoDe();
    expect(l.complementares).not.toHaveProperty("qtMesesAutorizados");
    expect(l.autorizacao["Nº DE MESES AUTORIZADOS"]).toBe("EM_BRANCO");
  });

  it("três ciclos do mesmo esquema geram uma única linha de tratamento anterior", () => {
    const ciclo = { esquema: "Esquema sintético B", dataInicio: "2026-03-02" };
    const l = laudoDe({
      qtTratamentoAnterior: "SIM",
      historicoQuimioterapia: [{ ...ciclo, ciclo: 1 }, { ...ciclo, ciclo: 2 }, { ...ciclo, ciclo: 3 }],
    });
    expect(l.complementares.qtAnterior1Descricao).toEqual({ estado: "PREENCHIDO", valor: "Esquema sintético B" });
    expect(l.complementares.qtAnterior1DataInicio).toEqual({ estado: "PREENCHIDO", valor: "2026-03-02" });
    expect(l.naoAplicavel).toEqual(expect.arrayContaining(["qtAnterior2Descricao", "qtAnterior2DataInicio", "qtAnterior3Descricao"]));
    expect(l.complementares).not.toHaveProperty("qtAnterior2Descricao");
  });

  it("linhas anteriores: esquemas distintos viram linhas distintas, até 3", () => {
    const l = laudoDe({
      qtTratamentoAnterior: "SIM",
      historicoQuimioterapia: [
        { esquema: "E1", dataInicio: "2025-01-01" }, { esquema: "E2", dataInicio: "2025-06-01" },
        { esquema: "E3", dataInicio: "2025-09-01" }, { esquema: "E4", dataInicio: "2025-12-01" },
      ],
    });
    expect(l.complementares.qtAnterior3Descricao).toEqual({ estado: "PREENCHIDO", valor: "E3" });
    expect(l.complementares).not.toHaveProperty("qtAnterior4Descricao");
  });

  it("ausente vira PENDENTE com rótulo na lista de pendências", () => {
    const l = laudoDe({ cidTopografia: undefined, qtContinuidade: undefined });
    expect(l.complementares.cidTopografia).toEqual({ estado: "PENDENTE", motivo: "ausente" });
    expect(l.complementares.qtContinuidade?.estado).toBe("PENDENTE");
    expect(l.pendentes).toEqual(expect.arrayContaining(["CID-10 TOPOGRAFIA", "CONTINUIDADE DO TRATAMENTO (SIM/NÃO)"]));
  });

  it("resposta Sim/Não não reconhecida vira PENDENTE, sem trocar o vocabulário", () => {
    const l = laudoDe({ qtContinuidade: "Talvez" });
    expect(l.complementares.qtContinuidade).toEqual({ estado: "PENDENTE", motivo: "resposta Sim/Não não reconhecida" });
  });

  it("RT solicitada: campos confirmados entram como PREENCHIDO e a finalidade é a do médico, sem dedução", () => {
    const l = laudoDe({ radioterapiaSolicitada: "SIM", rtFinalidade: "Paliativa", rtCidTopografico: "C61", rtNumeroCampos: 2 });
    expect(l.complementares.rtFinalidade).toEqual({ estado: "PREENCHIDO", valor: "Paliativa" });
    expect(l.complementares.rtCidTopografico).toEqual({ estado: "PREENCHIDO", valor: "C61" });
    expect(l.naoAplicavel).not.toContain("rtFinalidade");
    expect(l.pendentes).not.toContain("FINALIDADE (ESCOLHA DO MÉDICO)");
  });

  it("RT solicitada sem finalidade informada fica PENDENTE, não é deduzida", () => {
    const l = laudoDe({ radioterapiaSolicitada: "SIM" });
    expect(l.complementares.rtFinalidade?.estado).toBe("PENDENTE");
  });
});

describe("APAC página 2 · impressão (apacLaudo.ts)", () => {
  it("renderiza RASCUNHO sem assinatura e sem termos de IA", () => {
    const r = renderizarApacComplementar(entradaDe(laudoDe(), false));
    expect(r.status).toBe("RASCUNHO");
    expect(r.html).toContain("RASCUNHO — NÃO VÁLIDO");
    expect(r.html).toContain("pg. 2/2");
    const visivel = textoVisivel(r.html);
    expect(TERMOS.filter((re) => re.test(visivel)).map(String)).toEqual([]);
  });

  it("sem RT solicitada o bloco de radioterapia sai sem valor e sem PENDENTE; nefrologia vazia", () => {
    const r = renderizarApacComplementar(entradaDe(laudoDe(), false));
    const blocoRt = r.html.slice(r.html.indexOf(">RADIOTERAPIA<"), r.html.indexOf(">NEFROLOGIA<"));
    expect(blocoRt).not.toContain("PENDENTE");
    expect(blocoRt).toContain("DESCRIÇÃO DA ÁREA IRRADIADA");
    const blocoNefro = r.html.slice(r.html.indexOf(">NEFROLOGIA<"));
    expect(blocoNefro).not.toContain("PENDENTE");
  });

  it("campos PENDENTE aparecem como PENDENTE no papel", () => {
    const r = renderizarApacComplementar(entradaDe(laudoDe({ cidTopografia: undefined }), false));
    expect(r.html).toMatch(/campo-cid-topografia"><strong>CID-10 TOPOGRAFIA<\/strong><br>PENDENTE/);
  });

  it("assinado remove a marca RASCUNHO", () => {
    const r = renderizarApacComplementar(entradaDe(laudoDe(), true));
    expect(r.status).toBe("ASSINADO");
    expect(r.html).not.toContain("RASCUNHO");
  });

  it("hash é determinístico para o mesmo conteúdo", () => {
    expect(renderizarApacComplementar(entradaDe(laudoDe(), false)).hash).toBe(renderizarApacComplementar(entradaDe(laudoDe(), false)).hash);
  });
});
