import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { carregarConfigMotor } from "../../../src/kernel/corpus/configMotor.js";
import { avaliarSetores, avaliarInteracoes } from "../../../src/modules/setores/index.js";
import { avaliarCondicionais } from "../../../src/rules/f0c/condicionais.js";
import { alertarFeve, lerAlertaFeve } from "../../../src/rules/alertaFeve.js";
import type { RegraCondicional } from "../../../src/contracts/f0c/condicionais.js";
import type { Retrato, FatoRetrato } from "../../../src/contracts/f1/retrato.js";
import type { Correlacao } from "../../../src/contracts/f1/correlacao.js";
import type { ContextoInteracoesCondicionadas } from "../../../src/contracts/f0c/interacoesCondicionadas.js";
import type { PrescricaoProposta } from "../../../src/contracts/f1/prescricaoProposta.js";

// A13: valores são cenários de SOFTWARE. A tabela não aprova conduta nem ativa corpus privado.
export const FORMULAS_A13 = [
  { id: "A13-01", entradas: ["medicamentos:capecitabina,varfarina"], saidaEsperada: "pedido INR e agenda", porta: "INTERACOES", cobertura: "AVISO_REFERENCIADO_EXISTENTE" },
  { id: "A13-02", entradas: ["proposta:doxorrubicina", "FEVE:ausente"], saidaEsperada: "pedido eco", porta: "FEVE", cobertura: "PENDENCIA_FEVE_IMPLEMENTADA" },
  { id: "A13-03", entradas: ["proposta:capecitabina", "DPYD:desconhecido"], saidaEsperada: "pendência", porta: "DPYD", cobertura: "PENDENCIA_IMPLEMENTADA" },
  { id: "A13-04", entradas: ["medicamentos:tamoxifeno,paroxetina"], saidaEsperada: "aviso e proposta de troca", porta: "INTERACOES", cobertura: "REGRA_INATIVA_OU_SEM_COBERTURA" },
  { id: "A13-05", entradas: ["tratamento:mielotoxico", "riscoFN:0.20"], saidaEsperada: "proposta G-CSF", porta: "TRATAMENTO", cobertura: "PENDENCIA_REFERENCIADA_SEM_REGRA_FN" },
  { id: "A13-06", entradas: ["tumor:mama", "HER2:positivo", "proposta:doxorrubicina", "FEVE:ausente"], saidaEsperada: "FEVE antes da fase", porta: "FEVE", cobertura: "PENDENCIA_FEVE_REGRA_CRUZADA_POR_FASE_NAO_DISPONIVEL" },
  { id: "A13-07", entradas: ["tratamento:pemetrexede", "clearance:30 mL/min documentado"], saidaEsperada: "aviso renal com unidade", porta: "TRATAMENTO", cobertura: "PENDENCIA_REFERENCIADA_SEM_REGRA_RENAL_POR_ESQUEMA" },
  { id: "A13-08", entradas: ["medicamentos:erlotinibe,omeprazol"], saidaEsperada: "aviso absorção", porta: "INTERACOES", cobertura: "REGRA_INATIVA_OU_SEM_COBERTURA" },
  { id: "A13-09", entradas: ["tratamento:imunoterapia", "medicamento:corticoide", "toxicidade:sintoma"], saidaEsperada: "fluxo toxicidade", porta: "TOXICIDADES", cobertura: "CAMPOS_CONSUMIDOS_REGRA_CRUZADA_IO_NAO_DISPONIVEL" },
] as const;
const em = "2026-10-12T10:00:00-03:00";
const config = carregarConfigMotor();
const ctx = { patientId: "paciente-software-a13", encounterId: "encontro-software-a13", tumorLotId: null };
const fonte = { sourceId: "fonte-software-a13", classe: "MANUAL" as const, localizador: "fixture de software",
  dataClinica: "2026-10-12", dataCaptura: em, versao: "1", contentHash: "hash-software-a13" };
const fato = (campo: string, valor: unknown): FatoRetrato => ({ ref: { eventId: campo, revisao: "1" }, tipo: "FATO", campo,
  ...ctx, escopo: "PACIENTE", tempoClinico: "2026-10-12", tempoRegistro: em, fontes: [fonte], dados: { campo, valor } });
const retrato = (fatos: FatoRetrato[]): Retrato => ({ schema: "Retrato@1", ...ctx, revisao: "revisao-software-a13",
  versaoProjecao: "1", geradoEm: em, regras: config.regras, biblioteca: config.biblioteca, fatos,
  integridade: [], delta: { encounterAnteriorId: null, novos: [], substituidos: [] }, resumo: [] });
const correlacao = (r: Retrato): Correlacao => ({ ...ctx, operationId: "operacao-software-a13", revisaoFatos: r.revisao,
  regras: r.regras, biblioteca: r.biblioteca, proposta: null });

describe("S12 A13: cobertura real das nove fórmulas, sem aprovação clínica implícita", () => {
  it("publica entradas, porta e limitação de cada fórmula sem confundir segurança negativa com entrega da conduta", () => {
    expect(FORMULAS_A13).toHaveLength(9);
    expect(new Set(FORMULAS_A13.map(c => c.id)).size).toBe(9);
    console.info(JSON.stringify({ prova: "S12-A13-COBERTURA", aprovacaoClinica: false,
      acaoMedica: "Revisar evidência e decidir pedidos, mudanças ou suporte; o teste não autoriza execução clínica.", cenarios: FORMULAS_A13 }));
  });
  it.each(FORMULAS_A13)("$id preserva saída real e não executa $saidaEsperada", c => {
    if (c.porta === "DPYD") {
      const corpus = JSON.parse(readFileSync("corpus/f0c/condicionais.v1.json", "utf8")) as { regras: RegraCondicional[] };
      const regra = corpus.regras.find(r => r.id === "DPYD"); expect(regra).toBeDefined();
      expect(avaliarCondicionais({ programados: ["capecitabina"], hoje: "2026-10-12", agora: em }, [regra!])[0])
        .toMatchObject({ estado: "PENDENTE", autorizaCiclo: false, ajustaDose: false });
      console.info(JSON.stringify({ prova: "S12-A13-SAIDA", id: c.id, regra: { id: regra!.id, ativo: regra!.ativo, fonte: regra!.fonte.referencia }, saida: "PENDENTE_DPYD", geraAto: false }));
      return;
    }
    if (c.porta === "FEVE") {
      const rs = lerAlertaFeve(JSON.parse(readFileSync("corpus/rulesets/salao-feve.v1.json", "utf8")));
      const saida = alertarFeve({ hoje: "2026-10-12", feve: { percentual: null, metodo: null, data: null },
        programados: [{ nome: "doxorrubicina", classe: null }] }, rs);
      expect(saida.estado).toBe("PENDENTE"); expect(saida.pendentes.length).toBeGreaterThan(0);
      if (c.id === "A13-06") {
        const r = retrato([fato("patologia", { specimenRole: "BIOPSIA", marker: "HER2", resultado: "positivo" }),
          fato("tratamento", { camada: "PROPOSTO", droga: "doxorrubicina", fase: "adjuvante" }), fato("extracao.diagnosis", "mama")]);
        const setores = avaliarSetores(r, correlacao(r), config.opcoes);
        expect(setores.find(s => s.setor === "PATOLOGIA")?.entradas).toContainEqual({ eventId: "patologia", revisao: "1" });
        expect(setores.find(s => s.setor === "TRATAMENTO")?.entradas).toContainEqual({ eventId: "tratamento", revisao: "1" });
      }
      console.info(JSON.stringify({ prova: "S12-A13-SAIDA", id: c.id, regra: "corpus/rulesets/salao-feve.v1.json", saida,
        entradasConsumidas: ["programados", "FEVE.percentual", "FEVE.metodo", "FEVE.data", "hoje"], geraAto: false })); return;
    }
    const meds = c.id === "A13-01" ? ["capecitabina", "varfarina"] : c.id === "A13-04" ? ["tamoxifeno", "paroxetina"]
      : c.id === "A13-08" ? ["erlotinibe", "omeprazol"] : c.id === "A13-07" ? ["pemetrexede"]
        : c.id === "A13-05" ? ["mielotoxico-software"] : ["imunoterapia-software", "corticoide"];
    const adicionais = c.id === "A13-05" ? [fato("tratamento", { descricao: "mielotóxico do cenário" }), fato("riscoFN", { valor: 0.20, unidade: "FRACAO" })]
      : c.id === "A13-07" ? [fato("tratamento", { descricao: "pemetrexede referido no cenário" }), fato("clearance", { valorMlMin: 30, unidade: "mL/min", metodo: "COCKCROFT_GAULT", coleta: em, fonte: fonte.sourceId, validoParaDose: true })]
        : c.id === "A13-09" ? [fato("toxicidades", { termo: "sintoma", ctcae_version: null, medidas: {} })] : [];
    const r = retrato([fato("medicamentos", meds), ...adicionais]);
    const antes = JSON.stringify(r), setores = avaliarSetores(r, correlacao(r), { ...config.opcoes, agora: em, hoje: "2026-10-12" });
    const setor = setores.find(s => s.setor === c.porta)!; expect(setor).toBeDefined();
    expect(setor.lacunas.length + setor.achados.filter(a => a.estado === "PENDENTE").length).toBeGreaterThan(0);
    expect(setor.achados.some(a => a.estado === "VERDE" || a.estado === "VERMELHO")).toBe(false);
    expect(JSON.stringify(r)).toBe(antes);
    console.info(JSON.stringify({ prova: "S12-A13-SAIDA", id: c.id, campos: r.fatos.map(f => f.campo),
      saida: { achados: setor.achados, lacunas: setor.lacunas, cobertura: setor.cobertura }, geraAto: false }));
    if (c.id === "A13-01") expect(setor.achados.some(a => a.id === "INTERACOES:capecitabina+varfarina")).toBe(true);
    if (c.id === "A13-07") {
      expect(r.fatos.find(f => f.campo === "clearance")?.dados.valor).toMatchObject({ valorMlMin: 30, unidade: "mL/min" });
      expect(setor.lacunas.find(l => l.codigo === "RENAL_TRATAMENTO_SEM_REGRA")?.fatos).toContainEqual({ eventId: "clearance", revisao: "1" });
    }
    if (c.id === "A13-05") expect(setor.lacunas.find(l => l.codigo === "RISCO_FN_SEM_REGRA")?.fatos).toContainEqual({ eventId: "riscoFN", revisao: "1" });
    if (c.id === "A13-09") {
      expect(setor.lacunas.some(l => l.codigo === "CTCAE_V6_COBERTURA")).toBe(true);
      expect(setor.entradas).toContainEqual({ eventId: "toxicidades", revisao: "1" });
      expect(setores.find(s => s.setor === "INTERACOES")?.entradas).toContainEqual({ eventId: "medicamentos", revisao: "1" });
    }
  });
});

function contextoCondicionado(): ContextoInteracoesCondicionadas {
  return { versao: 1, referencia: em, offsetServico: "-03:00", medicamentosAtuais: ["pemetrexede", "ibuprofeno"],
    reconciliacao: { confirmada: true, em, fonte: fonte.sourceId }, historicoConferido: true, exposicoesCompletas: true,
    exposicoes: ["pemetrexede", "ibuprofeno"].map(droga => ({ droga, formulacao: "SISTEMICA_CONVENCIONAL", ultimaDose: em,
      proximaDose: em, termino: null, fonte: fonte.sourceId })), coadministracoes: [], clearance: null,
    vacinas: [], quimioterapia: null, recuperacaoImune: null };
}
describe("S12 A18/A19: metadado condicionado inválido não desaparece nem retorna ao lexical", () => {
  it.each([{}, { ativo: true }, { tipo: "" }, { tipo: "   " }, "incorreto", [], false].map(metadado => ({ metadado })))("expõe lacuna para $metadado", ({ metadado: avaliacaoCondicionada }) => {
    expect(config.opcoes?.interacoes).toBeDefined();
    const r = retrato([fato("medicamentos", ["pemetrexede", "ibuprofeno"]), fato("interacoesContexto", contextoCondicionado())]);
    const op = { ...config.opcoes, interacoes: { ...config.opcoes!.interacoes!, conteudo: { interacoes: [{
      drogaA: "pemetrexede", drogaBouClasse: "ibuprofeno", ativo: true, severidade: "GRAVE",
      fonte: { tipo: "LITERATURA", referencia: "https://example.org/software", trecho: "Fixture exclusivamente de software" }, avaliacaoCondicionada,
    }] } } };
    const s = avaliarInteracoes(r, correlacao(r), op);
    expect(s.achados).toEqual([]);
    expect(s.lacunas.some(l => l.codigo === "INTERACOES_REGRA_CONDICIONADA_INVALIDA")).toBe(true);
    expect(s.cobertura.semRegraAprovada).toBeGreaterThan(0);
  });
  it.each([[], ["ibuprofeno"], ["ibuprofeno", "IBUPROFENO", " ibuprofeno "]].map(medicamentos => ({ medicamentos })))("lista completa $medicamentos sem par não fabrica lacuna nem verde", ({ medicamentos }) => {
    const r = retrato([fato("medicamentos", medicamentos)]);
    const s = avaliarInteracoes(r, correlacao(r), config.opcoes);
    expect(s.achados).toEqual([]);
    expect(s.lacunas.some(l => l.codigo === "INTERACAO_PARES_AUSENTES" || l.codigo.startsWith("INTERACOES_CONTEXTO"))).toBe(false);
    expect(s.cobertura.semRegraAprovada).toBe(0);
  });
  it("lista ausente conserva necessidade de reconciliação", () => {
    const r = retrato([]), s = avaliarInteracoes(r, correlacao(r), config.opcoes);
    expect(s.lacunas.some(l => l.codigo === "MEDS_RECONCILIAR")).toBe(true); expect(s.achados).toEqual([]);
  });
  it.each(["ibuprofeno", "substancia-software-nova"])("lista única com proposta %s só dispensa avaliação quando não há par distinto", drug => {
    const r = retrato([fato("medicamentos", ["ibuprofeno"])]), c = { ...correlacao(r), proposta: { id: "proposta-software-pares", revisao: "1" } };
    const proposta: PrescricaoProposta = { schema: "PrescricaoProposta@1", id: c.proposta.id, revisao: "1", correlacao: c,
      templateId: null, templateVersao: null, estado: "DRAFT", itens: [{ drug, classe: "NAO_ONCOLOGICA", sequence: 1,
        standardDose: null, doseBasis: "FIXED", calculatedDose: null, prescribedDose: null, unit: "mg", adjustmentPercent: null,
        adjustmentReason: null, route: "SOFTWARE", diluent: null, finalVolumeMl: null, infusionTime: null, days: [],
        observacao: "Fixture exclusivamente de software", source: "MANUAL", overrideMotivo: null }] };
    const s = avaliarInteracoes(r, c, { ...config.opcoes, proposta });
    expect(s.achados.some(a => a.estado === "VERDE")).toBe(false);
    expect(s.lacunas.some(l => l.codigo === "INTERACAO_PARES_AUSENTES")).toBe(false);
    if (drug === "ibuprofeno") expect(s.lacunas).toEqual([]);
    else expect(s.cobertura.semRegraAprovada).toBeGreaterThan(0);
  });
  it("listas confirmadas divergentes ou sem fonte não são lista vazia conhecida", () => {
    const a = fato("medicamentos", []), b = { ...fato("medicamentos", ["ibuprofeno"]), ref: { eventId: "meds-divergentes", revisao: "1" } };
    for (const fatos of [[a, b], [{ ...a, fontes: [] }]]) {
      const r = retrato(fatos), s = avaliarInteracoes(r, correlacao(r), config.opcoes);
      expect(s.lacunas.length).toBeGreaterThan(0); expect(s.achados).toEqual([]);
    }
  });
});
