import { describe, expect, it } from "vitest";
import { carregarConfigMotor } from "../../../src/kernel/corpus/configMotor.js";
import { avaliarTratamento, avaliarInteracoes } from "../../../src/modules/setores/index.js";
import type { Retrato, FatoRetrato } from "../../../src/contracts/f1/retrato.js";
import type { Correlacao } from "../../../src/contracts/f1/correlacao.js";
import type { ContextoInteracoesCondicionadas } from "../../../src/contracts/f0c/interacoesCondicionadas.js";
import type { PrescricaoProposta } from "../../../src/contracts/f1/prescricaoProposta.js";

const em = "2026-10-12T12:00:00-03:00", ctx = { patientId: "p-aplicabilidade-software", encounterId: "e-aplicabilidade-software", tumorLotId: "t-software" };
const config = carregarConfigMotor();
const fonte = { sourceId: "fonte-aplicabilidade-software", classe: "DOCUMENT" as const, localizador: "fixture-software", dataClinica: "2026-10-12", dataCaptura: em, versao: "1", contentHash: "hash-software" };
const fato = (campo: string, valor: unknown): FatoRetrato => ({ ref: { eventId: campo, revisao: "1" }, ...ctx, tipo: "FATO", campo,
  escopo: "TUMOR", tempoClinico: "2026-10-12", tempoRegistro: em, fontes: [fonte], dados: { campo, valor } });
const tratamento = fato("tratamento", { camada: "REFERIDO", descricao: "tratamento mencionado pelo cenário; sem decisão de dose" });
const clearance = () => ({ valorMlMin: 30, unidade: "mL/min", metodo: "COCKCROFT_GAULT", coleta: "2026-10-12T11:00:00-03:00", fonte: fonte.sourceId, validoParaDose: true });
function avaliar(f: FatoRetrato) {
  const r: Retrato = { schema: "Retrato@1", ...ctx, revisao: "r-software", versaoProjecao: "1", geradoEm: em,
    regras: config.regras, biblioteca: config.biblioteca, fatos: [tratamento, f], integridade: [], resumo: [], delta: { encounterAnteriorId: null, novos: [], substituidos: [] } };
  const c: Correlacao = { ...ctx, operationId: "op-software", revisaoFatos: r.revisao, regras: r.regras, biblioteca: r.biblioteca, proposta: null };
  const antes = JSON.stringify(r), saida = avaliarTratamento(r, c, { ...config.opcoes, agora: em });
  expect(JSON.stringify(r)).toBe(antes);
  expect(saida.achados.some(a => a.estado === "VERDE" || a.estado === "VERMELHO")).toBe(false);
  return saida;
}
describe("S12 A13: risco FN e clearance têm porta explícita sem regra clínica inventada", () => {
  it.each([0, 0.1, 0.2, 0.3])("risco informado %s produz a mesma lacuna de regra, sem limiar ou indicação", valor => {
    const f = fato("riscoFN", { valor, unidade: "FRACAO" }), s = avaliar(f), l = s.lacunas.find(l => l.codigo === "RISCO_FN_SEM_REGRA");
    expect(l?.fatos).toEqual([f.ref, tratamento.ref]); expect(s.entradas).toContainEqual(f.ref);
    expect(l?.texto).not.toMatch(/G-CSF|20%|prescrever/i);
  });
  it.each([0, 0.2])("risco numérico direto %s preserva a lacuna de regra", valor => {
    expect(avaliar(fato("riscoFN", valor)).lacunas.some(l => l.codigo === "RISCO_FN_SEM_REGRA")).toBe(true);
  });
  it.each([
    { nome: "nulo direto", valor: null },
    { nome: "ausente direto", valor: undefined },
    { nome: "nulo na fração", valor: { valor: null, unidade: "FRACAO" } },
    { nome: "ausente na fração", valor: { unidade: "FRACAO" } },
    { nome: "NaN na fração", valor: { valor: NaN, unidade: "FRACAO" } },
    { nome: "infinito na fração", valor: { valor: Infinity, unidade: "FRACAO" } },
    { nome: "infinito negativo direto", valor: -Infinity },
    { nome: "texto numérico na fração", valor: { valor: "0.2", unidade: "FRACAO" } },
    { nome: "texto desconhecido direto", valor: "desconhecido" },
    { nome: "booleano na fração", valor: { valor: false, unidade: "FRACAO" } },
    { nome: "objeto na fração", valor: { valor: {}, unidade: "FRACAO" } },
    { nome: "lista direta", valor: [0.2] },
  ])("risco $nome mantém lacuna de dado sem alegar risco documentado", ({ valor }) => {
    const f = fato("riscoFN", valor), s = avaliar(f);
    expect(s.lacunas.find(l => l.codigo === "RISCO_FN_DADO_AUSENTE")?.fatos).toEqual([f.ref, tratamento.ref]);
    expect(s.lacunas.some(l => l.codigo === "RISCO_FN_SEM_REGRA")).toBe(false);
    expect(s.entradas).toContainEqual(f.ref);
  });
  it("clearance explícito vigente referencia dado e tratamento, mas não ajusta dose nem substitui droga", () => {
    const f = fato("clearance", clearance()), s = avaliar(f), l = s.lacunas.find(l => l.codigo === "RENAL_TRATAMENTO_SEM_REGRA");
    expect(l?.fatos).toEqual([f.ref, tratamento.ref]); expect(s.entradas).toContainEqual(f.ref);
    expect(l?.texto).toContain("sem substituir fármaco ou ajustar dose");
  });
  it.each([
    { nome: "unidade incompatível", patch: { unidade: "mg/dL" }, codigo: "CLEARANCE_DADO_INVALIDO" },
    { nome: "unidade explicitamente ausente", patch: { unidade: null }, codigo: "CLEARANCE_DADO_INVALIDO" },
    { nome: "método ausente", patch: { metodo: null }, codigo: "CLEARANCE_DADO_INVALIDO" },
    { nome: "fonte divergente", patch: { fonte: "fonte-nao-confirmada" }, codigo: "CLEARANCE_FONTE_DIVERGENTE" },
    { nome: "data civil sem horário", patch: { coleta: "2026-10-12" }, codigo: "CLEARANCE_VALIDADE" },
    { nome: "data futura", patch: { coleta: "2026-10-13T12:00:00-03:00" }, codigo: "CLEARANCE_VALIDADE" },
    { nome: "data vencida", patch: { coleta: "2026-01-01T12:00:00-03:00" }, codigo: "CLEARANCE_VALIDADE" },
    { nome: "aplicabilidade não confirmada", patch: { validoParaDose: false }, codigo: "CLEARANCE_APLICABILIDADE_NAO_CONFIRMADA" },
  ])("$nome permanece lacuna de dado, sem aplicar regra renal", ({ patch, codigo }) => {
    const s = avaliar(fato("clearance", { ...clearance(), ...patch }));
    expect(s.lacunas.some(l => l.codigo === codigo)).toBe(true);
    expect(s.lacunas.some(l => l.codigo === "RENAL_TRATAMENTO_SEM_REGRA")).toBe(false);
  });
  it.each(["patientId", "tumorLotId"] as const)("recusa dado de outro %s antes do consumo", campo => {
    expect(() => avaliar({ ...fato("clearance", clearance()), [campo]: "outro" })).toThrow("FATO_FORA_ESCOPO");
  });
  it("outro encontro, fonte ausente e registro futuro não viram medida vigente", () => {
    const f = fato("clearance", clearance());
    for (const extra of [{ encounterId: "anterior" }, { tempoRegistro: "2026-10-13T12:00:00-03:00" }])
      expect(avaliar({ ...f, ...extra }).lacunas.some(l => l.codigo === "CLEARANCE_CONTEXTO_NAO_ATUAL")).toBe(true);
    expect(avaliar({ ...f, fontes: [] }).lacunas.some(l => l.codigo === "CLEARANCE_FONTE_AUSENTE")).toBe(true);
  });
});

function historicoCondicionado(medicamentosAtuais: string[]): ContextoInteracoesCondicionadas {
  return { versao: 1, referencia: em, offsetServico: "-03:00", medicamentosAtuais,
    reconciliacao: { confirmada: true, em, fonte: fonte.sourceId }, historicoConferido: true, exposicoesCompletas: true,
    exposicoes: [], coadministracoes: [], clearance: null, vacinas: [], quimioterapia: null, recuperacaoImune: null };
}
function interacoesHistoricas(historico: ContextoInteracoesCondicionadas, proporCapecitabina = false) {
  const r: Retrato = { schema: "Retrato@1", ...ctx, revisao: "r-historico-software", versaoProjecao: "1", geradoEm: em,
    regras: config.regras, biblioteca: config.biblioteca, fatos: [fato("medicamentos", historico.medicamentosAtuais), fato("interacoesContexto", historico)],
    integridade: [], resumo: [], delta: { encounterAnteriorId: null, novos: [], substituidos: [] } };
  const c: Correlacao = { ...ctx, operationId: "op-historico-software", revisaoFatos: r.revisao, regras: r.regras, biblioteca: r.biblioteca,
    proposta: proporCapecitabina ? { id: "proposta-capecitabina-software", revisao: "1" } : null };
  const proposta: PrescricaoProposta | undefined = proporCapecitabina ? { schema: "PrescricaoProposta@1", id: c.proposta!.id,
    revisao: "1", correlacao: c, templateId: null, templateVersao: null, estado: "DRAFT", itens: [{ drug: "capecitabina", classe: "QT", sequence: 1,
      standardDose: null, doseBasis: "FIXED", calculatedDose: null, prescribedDose: null, unit: "mg", adjustmentPercent: null,
      adjustmentReason: null, route: "SOFTWARE", diluent: null, finalVolumeMl: null, infusionTime: null, days: [],
      observacao: "Fixture de software sem dose", source: "MANUAL", overrideMotivo: "Fixture de software sem uso assistencial" }] } : undefined;
  const antes = JSON.stringify({ r, proposta });
  const saida = avaliarInteracoes(r, c, { ...config.opcoes, agora: em, ...(proposta ? { proposta } : {}) });
  expect(JSON.stringify({ r, proposta })).toBe(antes);
  expect(saida.achados.some(a => a.estado === "VERDE" || a.estado === "VERMELHO")).toBe(false);
  expect(saida.lacunas.some(l => l.codigo === "INTERACAO_PARES_AUSENTES")).toBe(false);
  return saida;
}
function exposicoesBrivudina(medicamentos: string[] = []) {
  const h = historicoCondicionado(medicamentos);
  h.exposicoes = [
    { droga: "brivudina", formulacao: "SISTEMICA_CONVENCIONAL", ultimaDose: "2026-09-20T12:00:00-03:00",
      termino: "2026-09-20T12:00:00-03:00", proximaDose: null, fonte: fonte.sourceId },
    { droga: "capecitabina", formulacao: "SISTEMICA_CONVENCIONAL", ultimaDose: null, termino: null, proximaDose: em, fonte: fonte.sourceId },
  ];
  return h;
}
describe("S12 P1: ausência de par atual não apaga interação temporal do histórico", () => {
  it.each([[], ["capecitabina"]].map(medicamentos => ({ medicamentos })))("lista atual $medicamentos preserva brivudina encerrada com capecitabina proposta", ({ medicamentos }) => {
    const s = interacoesHistoricas(exposicoesBrivudina(medicamentos), true);
    const a = s.achados.find(a => a.id === "INTERACOES:CONDICIONADA:BRIVUDINA_FLUOROPIRIMIDINA");
    expect(a?.texto).toContain("Aviso condicionado:"); expect(a?.texto).toContain("4 semanas");
    expect(a?.fatos).toContainEqual({ eventId: "interacoesContexto", revisao: "1" });
    expect(a?.regras).toContainEqual(config.opcoes!.interacoes!.referencia);
  });
  it("vacina viva após QT encerrada é avaliada mesmo com lista atual vazia e sem proposta", () => {
    const h = historicoCondicionado([]);
    h.quimioterapia = { citotoxica: true, emCurso: false, inicio: "2026-06-01T12:00:00-03:00", termino: "2026-09-20T12:00:00-03:00", fonte: fonte.sourceId };
    h.vacinas = [{ nome: "vacina-sintetica", tipo: "VIVA", data: em, fonte: fonte.sourceId }];
    expect(interacoesHistoricas(h).achados.find(a => a.id === "INTERACOES:CONDICIONADA:VACINA_VIVA_QT")?.texto).toContain("Aviso condicionado:");
  });
  it.each(["fonte", "reconciliacao", "cronologia"] as const)("histórico com %s inválida conserva pendência e não cria aviso", falha => {
    const h = exposicoesBrivudina();
    if (falha === "fonte") h.exposicoes[0]!.fonte = "fonte-nao-referenciada";
    if (falha === "reconciliacao") h.reconciliacao!.em = "2026-10-11T12:00:00-03:00";
    if (falha === "cronologia") h.exposicoes[0]!.termino = "2026-10-13T12:00:00-03:00";
    const s = interacoesHistoricas(h, true);
    expect(s.achados.some(a => a.texto.startsWith("Aviso condicionado:"))).toBe(false);
    expect(s.lacunas.some(l => l.codigo.startsWith("INTERACOES_") || l.codigo === "CONDICIONADA:BRIVUDINA_FLUOROPIRIMIDINA")).toBe(true);
  });
  it("histórico documentado fora da janela usa regra existente sem declarar elegibilidade geral", () => {
    const h = exposicoesBrivudina(); h.exposicoes[0]!.ultimaDose = "2026-09-01T12:00:00-03:00"; h.exposicoes[0]!.termino = h.exposicoes[0]!.ultimaDose;
    const s = interacoesHistoricas(h, true), a = s.achados.find(a => a.id === "INTERACOES:CONDICIONADA:BRIVUDINA_FLUOROPIRIMIDINA");
    expect(a?.texto).toContain("Condição individual não aplicável:"); expect(a?.estado).toBe("PENDENTE");
  });
});

it.each([false, true])("listas vigentes alternativas não são unidas ou eleitas pelo contexto explícito=%s", comContexto => {
  const a = { ...fato("medicamentos", ["capecitabina"]), ref: { eventId: "lista-a", revisao: "1" } };
  const b = { ...fato("medicamentos", ["varfarina"]), ref: { eventId: "lista-b", revisao: "1" } };
  const r: Retrato = { schema: "Retrato@1", ...ctx, revisao: "r-listas-conflitantes", versaoProjecao: "1", geradoEm: em,
    regras: config.regras, biblioteca: config.biblioteca, fatos: [a, b, ...(comContexto ? [fato("interacoesContexto", historicoCondicionado(["capecitabina"]))] : [])],
    integridade: [], resumo: [], delta: { encounterAnteriorId: null, novos: [], substituidos: [] } };
  const c: Correlacao = { ...ctx, operationId: "op-listas-conflitantes", revisaoFatos: r.revisao, regras: r.regras, biblioteca: r.biblioteca, proposta: null };
  const antes = JSON.stringify(r), s = avaliarInteracoes(r, c, config.opcoes);
  expect(s.achados).toEqual([]);
  expect(s.lacunas.find(l => l.codigo === "MEDS_RECONCILIACAO_CONFLITANTE")?.fatos).toEqual([a.ref, b.ref]);
  expect(JSON.stringify(r)).toBe(antes);
});

it("listas equivalentes em ordem diferente mantêm o par confirmado, sem falso conflito", () => {
  const a = { ...fato("medicamentos", ["capecitabina", "varfarina"]), ref: { eventId: "lista-a", revisao: "1" } };
  const b = { ...fato("medicamentos", ["VARFARINA", "CAPECITABINA"]), ref: { eventId: "lista-b", revisao: "1" } };
  const r: Retrato = { schema: "Retrato@1", ...ctx, revisao: "r-listas-equivalentes", versaoProjecao: "1", geradoEm: em,
    regras: config.regras, biblioteca: config.biblioteca, fatos: [a, b], integridade: [], resumo: [], delta: { encounterAnteriorId: null, novos: [], substituidos: [] } };
  const c: Correlacao = { ...ctx, operationId: "op-listas-equivalentes", revisaoFatos: r.revisao, regras: r.regras, biblioteca: r.biblioteca, proposta: null };
  const s = avaliarInteracoes(r, c, config.opcoes);
  expect(s.lacunas.some(l => l.codigo === "MEDS_RECONCILIACAO_CONFLITANTE")).toBe(false);
  expect(s.achados.filter(a => a.id === "INTERACOES:capecitabina+varfarina")).toHaveLength(1);
});
