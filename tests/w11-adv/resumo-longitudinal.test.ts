// W11-H16 · Resumo oncológico longitudinal (TEMPLATE PADRÃO, PLN-031). Dados 100% sintéticos.
// Prova: ordem das seções, CD sempre vazia, ausente fica vazio, paraDocumento sem IA, tendência com ≥2 medidas,
// "Nenhum identificado" só quando avaliado, estudos com fonte (máx. 3) e determinismo.
import { describe, expect, it } from "vitest";
import {
  renderizarResumoLongitudinal,
  type EntradaResumoLongitudinal,
} from "../../src/modules/documentos/resumoLongitudinal.js";

const ORDEM_SECOES = [
  "### DADOS ANAGRÁFICOS / DEMOGRÁFICOS:",
  "### RESUMO OPERACIONAL:",
  "### DADOS CLÍNICOS:",
  "### DADOS ONCOLÓGICOS:",
  "### TIMELINE ONCOLÓGICA:",
  "### LABORATÓRIO / MARCADORES:",
  "### TRATAMENTO ATUAL:",
  "### CTCAE / TOXICIDADES:",
  "### ALERGIAS:",
  "### CONTRAINDICAÇÕES / INTERAÇÕES / RISCOS:",
  "### CONDUTA — CD:",
  "### HISTÓRICO ONCOLÓGICO PREGRESSO:",
  "### IA FALA — REVISÃO CLÍNICA:",
  "### TRIALS / EVIDÊNCIAS APLICÁVEIS:",
  "### SUS / CONITEC / APAC / SIGTAP:",
];

const CD_VAZIA = /^> \*\*\[\s*\]\*\*$/;

const completa: EntradaResumoLongitudinal = {
  identificacao: { nome: "PACIENTE SINTÉTICO A", dn: "01/02/1970", idade: "56", cidadeUf: "Cidade Fictícia/XX" },
  anagraficos: { sexo: "F", cidadeOrigem: "Cidade Fictícia/XX", acompanhante: "Acompanhante fictício", profissao: "Professora" },
  operacional: {
    tratamentoAtual: "FOLFOX - SEM PORT",
    resposta: "estabilidade",
    problemasAtivos: "neuropatia grau 1 em acompanhamento",
    proximoPasso: "reavaliação tomográfica",
  },
  clinicos: { ecog: "1", kps: "80", ap: "adenocarcinoma (sintético)", medicacoesContinuas: "losartana" },
  oncologicos: {
    diagnostico: "Adenocarcinoma de cólon (sintético)",
    sitioPrimario: "Cólon sigmoide",
    tnmClinico: { cT: "3", cN: "1", cM: "0" },
    tnmPatologico: { pT: "3", pN: "1" },
    estadio: "III",
    biomarcadores: "MSS",
    sitiosMetastaticos: [{ texto: "fígado", status: "SUSPEITO" }],
    intencaoAtual: "adjuvante",
    linhaAtual: "1ª",
    cid10: "C18",
  },
  timeline: [{ data: "10/03/26", exame: "TC", resumo: "lesão hepática 1,2 cm", status: "SUSPEITO" }],
  laboratorio: {
    linhas: [{ data: "10/03/26", hb: "12,1", anc: "3,2", plaq: "210.000", crClCr: "90", tgoTgp: "20/22", bt: "0,8", marcador: "CEA 4,1" }],
    series: [
      { nome: "CEA", medidas: [{ data: "10/01/26", valor: "4,1" }, { data: "10/03/26", valor: "6,3" }] },
      { nome: "CA 19-9", medidas: [{ data: "10/03/26", valor: "30" }] },
    ],
  },
  tratamento: { protocolo: "FOLFOX", status: "administrado", resposta: "" },
  ctcae: [{ toxicidade: "Neuropatia periférica", inicio: "02/03/26", status: "ativa", impactoConduta: "monitorar" }],
  alergias: [{ substancia: "Dipirona", reacao: "urticária" }],
  contraindicacoes: { avaliado: true },
  historico: [{ data: "01/01/26", dataFim: "10/03/26", titulo: "TRATAMENTO", texto: "FOLFOX, 4 ciclos (sintético)." }],
  iaFala: { sugestoes: ["revisar dose"], naoSei: ["resposta radiológica"] },
  estudos: [
    { texto: "Estudo A versus B (sintético).", fonte: "fonte sintética 1" },
    { texto: "sem fonte, descartado.", fonte: "" },
    { texto: "Estudo C (sintético).", fonte: "fonte sintética 2" },
    { texto: "Estudo D (sintético).", fonte: "fonte sintética 3" },
    { texto: "Estudo E (sintético).", fonte: "fonte sintética 4" },
  ],
  sus: { sigtap: "0000000000", prioridade: "PRIORITÁRIO", elegibilidade: "indeterminada", competenciaSigtap: "2026-10" },
};

describe("W11-H16 · resumo longitudinal · ordem das seções", () => {
  it("entrega as seções do template na ordem exata em paraTela", () => {
    const { paraTela } = renderizarResumoLongitudinal(completa);
    const posicoes = ORDEM_SECOES.map((s) => paraTela.indexOf(s));
    posicoes.forEach((p) => expect(p).toBeGreaterThanOrEqual(0));
    expect([...posicoes].sort((a, b) => a - b)).toEqual(posicoes);
  });

  it("cabeçalho tem exatamente as três linhas do template antes da primeira seção", () => {
    const { paraTela } = renderizarResumoLongitudinal(completa);
    const cabecalho = paraTela.slice(0, paraTela.indexOf("### DADOS ANAGRÁFICOS"));
    const linhas = cabecalho.trim().split("\n");
    expect(linhas).toHaveLength(3);
    expect(linhas[0]).toBe("# TEMPLATE PADRÃO — RESUMO ONCOLÓGICO LONGITUDINAL");
    expect(linhas[1]).toContain("DN: 01/02/1970 (56 ANOS)");
    expect(linhas[2]).toContain("Adenocarcinoma de cólon (sintético)");
  });
});

describe("W11-H16 · CONDUTA — CD", () => {
  it("é sempre três linhas vazias, mesmo com entrada completa", () => {
    const { paraTela, paraDocumento } = renderizarResumoLongitudinal(completa);
    for (const saida of [paraTela, paraDocumento]) {
      const corpo = saida.slice(saida.indexOf("### CONDUTA — CD:"), saida.indexOf("### HISTÓRICO ONCOLÓGICO PREGRESSO:"));
      const linhas = corpo.split("\n").filter((l) => l.startsWith(">"));
      expect(linhas).toHaveLength(3);
      linhas.forEach((l) => expect(l).toMatch(CD_VAZIA));
    }
  });
});

describe("W11-H16 · ausentes ficam vazios", () => {
  const minima: EntradaResumoLongitudinal = { identificacao: { nome: "PACIENTE SINTÉTICO B" } };

  it("nunca escreve 'não informado' ou 'não consta'", () => {
    const { paraTela, paraDocumento } = renderizarResumoLongitudinal(minima);
    for (const saida of [paraTela, paraDocumento]) {
      expect(saida).not.toMatch(/não informado/i);
      expect(saida).not.toMatch(/não consta/i);
    }
  });

  it("campo ausente sai como rótulo sem valor após os dois pontos", () => {
    const { paraDocumento } = renderizarResumoLongitudinal(minima);
    expect(paraDocumento).toContain("- **ECOG:**\n");
    expect(paraDocumento).toMatch(/^- \*\*Diagnóstico:\*\*$/m);
    expect(paraDocumento).toMatch(/^- \*\*Protocolo:\*\*$/m);
  });
});

describe("W11-H16 · paraDocumento sem IA", () => {
  it("não contém IA FALA, IA, OncoAssist nem algoritmo", () => {
    const { paraDocumento } = renderizarResumoLongitudinal(completa);
    expect(paraDocumento).not.toContain("IA FALA");
    expect(paraDocumento).not.toMatch(/\bIA\b/);
    expect(paraDocumento).not.toMatch(/OncoAssist/i);
    expect(paraDocumento).not.toMatch(/algoritmo/i);
  });

  it("paraTela contém IA FALA com os oito rótulos", () => {
    const { paraTela } = renderizarResumoLongitudinal(completa);
    expect(paraTela).toContain("### IA FALA — REVISÃO CLÍNICA:");
    for (const r of ["SUGESTÕES", "PENDÊNCIAS", "ERROS / CONFLITOS", "LACUNAS", "PEARLS", "PITFALLS", "CAUTION", "NÃO SEI"]) {
      expect(paraTela).toContain(`**${r}:**`);
    }
  });
});

describe("W11-H16 · tendência laboratorial", () => {
  it("mostra curva apenas com pelo menos duas medidas do mesmo marcador", () => {
    const { paraTela } = renderizarResumoLongitudinal(completa);
    expect(paraTela).toContain("- CEA: 4,1 (10/01/26) → 6,3 (10/03/26)");
    expect(paraTela).not.toMatch(/^- CA 19-9:/m);
  });
});

describe("W11-H16 · contraindicações", () => {
  it("'Nenhum identificado' só aparece quando avaliado é true", () => {
    const avaliado = renderizarResumoLongitudinal({ contraindicacoes: { avaliado: true } });
    expect(avaliado.paraTela).toContain("- **Contraindicações:** Nenhum identificado");

    const naoAvaliado = renderizarResumoLongitudinal({ contraindicacoes: { avaliado: false } });
    expect(naoAvaliado.paraTela).not.toContain("Nenhum identificado");

    const semInfo = renderizarResumoLongitudinal({});
    expect(semInfo.paraTela).not.toContain("Nenhum identificado");
    expect(semInfo.paraDocumento).not.toContain("Nenhum identificado");
  });

  it("lista itens informados em vez de 'Nenhum identificado'", () => {
    const { paraTela } = renderizarResumoLongitudinal({
      contraindicacoes: { avaliado: true, itens: ["insuficiência renal sintética"] },
    });
    expect(paraTela).toContain("- **Contraindicações:** insuficiência renal sintética");
    expect(paraTela).not.toContain("Nenhum identificado");
  });
});

describe("W11-H16 · demais regras", () => {
  it("CTCAE sem grau fornecido deixa a célula de grau vazia", () => {
    const { paraDocumento } = renderizarResumoLongitudinal({
      ctcae: [{ toxicidade: "Fadiga" }],
    });
    expect(paraDocumento).toContain("| Fadiga |  |  |  |  |");
  });

  it("alergias aparecem na seção e repetidas no bloco de segurança", () => {
    const { paraDocumento } = renderizarResumoLongitudinal(completa);
    expect(paraDocumento).toContain("- Dipirona — urticária");
    expect(paraDocumento).toContain("> **BLOCO DE SEGURANÇA — ALERGIAS:** Dipirona — urticária");
  });

  it("trials: no máximo 3, descartando os sem fonte", () => {
    const { paraTela } = renderizarResumoLongitudinal(completa);
    const trials = paraTela.slice(paraTela.indexOf("### TRIALS"), paraTela.indexOf("### SUS"));
    expect(trials.match(/\*\*ESTUDO \d\*\*/g)).toHaveLength(3);
    expect(trials).not.toContain("sem fonte, descartado");
    expect(trials).toContain("(Fonte: fonte sintética 1)");
  });

  it("suspeito permanece suspeito no texto de saída", () => {
    const { paraDocumento } = renderizarResumoLongitudinal(completa);
    expect(paraDocumento).toContain("fígado (suspeito)");
    expect(paraDocumento).toContain("lesão hepática 1,2 cm (suspeito)");
  });

  it("é determinístico: mesma entrada gera a mesma saída", () => {
    const a = renderizarResumoLongitudinal(completa);
    const b = renderizarResumoLongitudinal(completa);
    expect(a).toEqual(b);
  });
});
