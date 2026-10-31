import { describe, expect, it } from "vitest";
import type { BasePrescricaoExecutavelResposta } from "../../src/contracts/api/operacaoPrescricaoExecutavel.js";
import { AcaoCompostaPreparada } from "../../src/contracts/api/execucaoAcaoComposta.js";
import { prepararAcaoComposta } from "../../src/rules/prescricao/acoesCompostas.js";
import { edicaoDaAcao } from "../../src/modules/prescricao/acaoParaPrescricao.js";

const contexto = { patientId: "paciente-sintetico-onda06", encounterId: "encontro-sintetico-onda06", tumorLotId: "lote-sintetico-onda06" };
const origem = { draftId: "ficha-sintetica-onda06", revision: 3, hash: "a".repeat(64) };
const acaoDraft = { draftId: "acao-sintetica-onda06", revision: 2, conteudoHash: "b".repeat(64) };
const episodioId = "episodio-sintetico-onda06";
const cicloId = "ciclo-sintetico-onda06";
const fonteSintetica = {
  sourceId: "fonte-sintetica-onda06",
  classe: "MANUAL" as const,
  localizador: "fixture sintética",
  dataClinica: "2026-10-20",
  dataCaptura: "2026-10-20T12:00:00.000Z",
  versao: "fixture@1",
  contentHash: "hash-sintetico-onda06",
};

function item(itemId: string, overrides: Record<string, unknown> = {}) {
  return {
    itemId,
    item: {
      drug: `Fármaco sintético ${itemId}`,
      classe: "QT" as const,
      sequence: Number(itemId.slice(-1)) || 1,
      standardDose: 100,
      doseBasis: "FIXED" as const,
      calculatedDose: 100,
      prescribedDose: 100,
      unit: "mg",
      adjustmentPercent: null,
      adjustmentReason: null,
      route: "EV",
      diluent: "SF sintético",
      finalVolumeMl: 100,
      infusionTime: "60 min",
      days: ["d1"],
      observacao: `Observação preservada ${itemId}`,
      source: "PROTOCOL" as const,
      overrideMotivo: null,
      ...overrides,
    },
  };
}

const itensVigentes = [
  item("item-mg-1", { sequence: 1, prescribedDose: 100 }),
  item("item-g-2", { sequence: 2, unit: "g", calculatedDose: 0.2, prescribedDose: 0.2 }),
  item("item-mcg-3", { sequence: 3, unit: "mcg", calculatedDose: 250000, prescribedDose: 250000 }),
  item("item-intacto-4", { sequence: 4, calculatedDose: 50, prescribedDose: 50 }),
];

function base(overrides: Record<string, unknown> = {}): BasePrescricaoExecutavelResposta {
  const vigente = {
    schema: "PrescricaoExecutavel@1" as const,
    contexto: { ...contexto, episodioId, cicloId },
    documentId: "documento-sintetico-vigente",
    documentVersion: 4,
    protocoloId: "protocolo-sintetico-onda06",
    dataPrevista: "2026-10-22",
    motivo: "Prescrição sintética vigente para teste de conversão.",
    itens: structuredClone(itensVigentes),
    origemProposta: origem,
  };
  return {
    contexto,
    revisao: "c".repeat(64),
    pacienteNome: "Paciente sintético Onda06",
    episodio: {
      episodioId,
      tumorLotId: contexto.tumorLotId!,
      modalidade: "QT",
      intencao: "PALIATIVA",
      intentModifier: null,
      linha: 1,
      esquemaId: "protocolo-sintetico-onda06",
      inicio: { valor: "2026-09-01", estado: "VERDE", campo: "PRESENTE", motivo: "Data sintética", fontes: [fonteSintetica], revisao: "CONFIRMADO" },
      fim: { valor: null, estado: "PENDENTE", campo: "AUSENTE", motivo: "Sem data de fim declarada", fontes: [], revisao: "RAW" },
    },
    ciclo: {
      cicloId,
      episodioId,
      numero: 2,
      previstoEm: "2026-10-22",
      pesoKg: { valor: 70, estado: "VERDE", campo: "PRESENTE", motivo: "Peso sintético", fontes: [fonteSintetica], revisao: "CONFIRMADO" },
      origemPeso: "MEDIDO",
      ciclosSemPesoConsecutivos: 0,
      prescricaoRef: { documentId: vigente.documentId, documentVersion: vigente.documentVersion },
      itens: [
        { item: 1, droga: "Fármaco sintético item-mg-1", doseMg: 100, reducaoPct: null },
        { item: 2, droga: "Fármaco sintético item-g-2", doseMg: 200, reducaoPct: null },
        { item: 3, droga: "Fármaco sintético item-mcg-3", doseMg: 250, reducaoPct: null },
        { item: 4, droga: "Fármaco sintético item-intacto-4", doseMg: 50, reducaoPct: null },
      ],
      comMedico: true,
    },
    vigente,
    pendencias: [],
    ...overrides,
  } as BasePrescricaoExecutavelResposta;
}

function acao(atual: BasePrescricaoExecutavelResposta, pedido: Record<string, unknown>) {
  const resultado = prepararAcaoComposta({
    contexto: atual.contexto,
    revisao: atual.revisao,
    baseHash: "d".repeat(64),
    cicloId,
    episodioId,
    protocoloId: "protocolo-sintetico-onda06",
    previstoEm: atual.ciclo!.previstoEm,
    itens: atual.ciclo!.itens.map(({ item: numero, droga, doseMg }) => ({ item: numero, droga, doseMg })),
  }, pedido);
  return AcaoCompostaPreparada.parse({
    ...acaoDraft,
    resultado,
    documentoPlano: { titulo: "Revisão sintética", texto: "Plano sintético de teste." },
    criaEventoClinico: false,
    liberaTratamento: false,
  });
}

describe("edicaoDaAcao: projeção segura para o editor executável", () => {
  it("MANTER preserva a ordem vigente inteira e vincula a origem da ficha", () => {
    const atual = base();
    const preparada = acao(atual, { tipo: "MANTER_CICLO", motivo: "Manutenção sintética revisada." });
    const original = structuredClone(atual);
    const resultado = edicaoDaAcao(atual, preparada);

    expect(resultado.pendencias, JSON.stringify(resultado)).toEqual([]);
    expect(resultado.edicao).toMatchObject({
      protocoloId: "protocolo-sintetico-onda06",
      dataPrevista: "2026-10-22",
      motivo: "Manutenção sintética revisada.",
      origemProposta: { draftId: acaoDraft.draftId, revision: acaoDraft.revision, hash: acaoDraft.conteudoHash },
      itens: itensVigentes,
    });
    expect(atual).toEqual(original);
  });

  it("ADIAR altera somente data prevista e mantém todos os campos dos itens", () => {
    const atual = base();
    const preparada = acao(atual, { tipo: "ADIAR_CICLO", motivo: "Adiamento sintético revisado.", dias: 9 });
    const resultado = edicaoDaAcao(atual, preparada);

    expect(resultado.pendencias, JSON.stringify(resultado)).toEqual([]);
    expect(resultado.edicao?.dataPrevista).toBe("2026-10-31");
    expect(resultado.edicao?.itens).toEqual(itensVigentes);
    expect(resultado.edicao?.origemProposta).toEqual({ draftId: acaoDraft.draftId, revision: acaoDraft.revision, hash: acaoDraft.conteudoHash });
  });

  it("REDUZIR converte mg/g/mcg por roundtrip em mg, marca selecionados MANUAL e não altera os demais parâmetros", () => {
    const atual = base();
    const preparada = acao(atual, { tipo: "REDUZIR_DOSE", motivo: "Redução médica sintética documentada.", reducaoPct: 20, itensSelecionados: [1, 2, 3] });
    const resultado = edicaoDaAcao(atual, preparada);
    const edicao = resultado.edicao!;

    expect(resultado.pendencias, JSON.stringify(resultado)).toEqual([]);
    expect(edicao.itens.map(({ item: i }) => ({ dose: i.prescribedDose, unit: i.unit }))).toEqual([
      { dose: 80, unit: "mg" },
      { dose: 0.16, unit: "g" },
      { dose: 200000, unit: "mcg" },
      { dose: 50, unit: "mg" },
    ]);
    for (const index of [0, 1, 2]) {
      const antes = itensVigentes[index]!.item;
      const depois = edicao.itens[index]!.item;
      expect(depois).toMatchObject({
        drug: antes.drug,
        classe: antes.classe,
        sequence: antes.sequence,
        standardDose: antes.standardDose,
        doseBasis: antes.doseBasis,
        calculatedDose: antes.calculatedDose,
        unit: antes.unit,
        route: antes.route,
        diluent: antes.diluent,
        finalVolumeMl: antes.finalVolumeMl,
        infusionTime: antes.infusionTime,
        days: antes.days,
        observacao: antes.observacao,
        source: "MANUAL",
        adjustmentPercent: null,
        adjustmentReason: expect.stringContaining("Redução médica sintética documentada."),
        overrideMotivo: expect.stringContaining("Redução médica sintética documentada."),
      });
    }
    expect(edicao.itens[3]).toEqual(itensVigentes[3]);
    expect(edicao.origemProposta).toEqual({ draftId: acaoDraft.draftId, revision: acaoDraft.revision, hash: acaoDraft.conteudoHash });
  });

  it.each([
    ["contexto", (atual: BasePrescricaoExecutavelResposta) => ({ ...atual, contexto: { ...atual.contexto, encounterId: "outro-encontro-sintetico" } })],
    ["revisão da base", (atual: BasePrescricaoExecutavelResposta) => ({ ...atual, revisao: "e".repeat(64) })],
    ["episódio", (atual: BasePrescricaoExecutavelResposta) => ({ ...atual, episodio: { ...atual.episodio!, episodioId: "outro-episodio-sintetico" } })],
    ["ciclo", (atual: BasePrescricaoExecutavelResposta) => ({ ...atual, ciclo: { ...atual.ciclo!, previstoEm: "2026-10-23" } })],
    ["protocolo/documento vigente", (atual: BasePrescricaoExecutavelResposta) => ({ ...atual, vigente: { ...atual.vigente!, protocoloId: "outro-protocolo-sintetico" } })],
  ] as const)("recusa base com %s discrepante em vez de projetar edição", (_nome, alterar) => {
    const atual = base();
    const preparada = acao(atual, { tipo: "MANTER_CICLO", motivo: "Manutenção sintética." });
    const resultado = edicaoDaAcao(alterar(atual), preparada);
    expect(resultado.edicao).toBeNull();
    expect(resultado.pendencias.length).toBeGreaterThan(0);
  });

  it("preserva troca de protocolo como pendência até existir ficha conferida; não copia itens", () => {
    const atual = base();
    const preparada = acao(atual, { tipo: "TROCAR_PROTOCOLO", motivo: "Troca sintética solicitada.", novoProtocoloId: "protocolo-sintetico-novo" });
    const resultado = edicaoDaAcao(atual, preparada);
    expect(resultado.edicao).toBeNull();
    expect(resultado.pendencias.length).toBeGreaterThan(0);
  });

  it.each([
    ["snapshot anterior/contexto divergente", (a: ReturnType<typeof acao>) => ({ ...a, resultado: { ...a.resultado, antes: { ...a.resultado.antes!, contexto: { ...contexto, encounterId: "outro-encontro" } } } })],
    ["diff de dose ausente", (a: ReturnType<typeof acao>) => ({ ...a, resultado: { ...a.resultado, diff: [] } })],
    ["diff seleciona item extra", (a: ReturnType<typeof acao>) => ({ ...a, resultado: { ...a.resultado, diff: [...a.resultado.diff, { campo: "doseMg" as const, item: 4, antes: 50, depois: 40 }] } })],
    ["percentual/resultados incompatíveis", (a: ReturnType<typeof acao>) => ({ ...a, resultado: { ...a.resultado, depois: { ...a.resultado.depois!, itens: a.resultado.depois!.itens.map((i, n) => n === 0 ? { ...i, doseMg: 79 } : i) } } })],
  ] as const)("recusa ação com %s e não projeta edição parcial", (_nome, corromper) => {
    const atual = base();
    const preparada = acao(atual, { tipo: "REDUZIR_DOSE", motivo: "Redução sintética.", reducaoPct: 20, itensSelecionados: [1] });
    const resultado = edicaoDaAcao(atual, AcaoCompostaPreparada.parse(corromper(preparada)));
    expect(resultado.edicao).toBeNull();
    expect(resultado.pendencias.length).toBeGreaterThan(0);
  });
});

it('ações em mg preservam quantidade de suporte em mL e recusam redução desse item',()=>{
 const b=base();b.vigente!.itens.push(item('suporte-5',{sequence:5,classe:'PRE_QT',unit:'mL',standardDose:10,calculatedDose:10,prescribedDose:10}));
 b.ciclo!.itens.push({item:5,droga:'Fármaco sintético suporte-5',doseMg:null,doseOriginal:{valor:10,unidade:'mL'},reducaoPct:null});
 for(const pedido of [{tipo:'MANTER_CICLO',motivo:'Conservar prescrição sintética'},{tipo:'REDUZIR_DOSE',motivo:'Ajuste sintético do item em mg',itensSelecionados:[1],reducaoPct:20}]){
  const r=edicaoDaAcao(b,acao(b,pedido));expect(r.pendencias).toEqual([]);expect(r.edicao?.itens[4]?.item).toMatchObject({prescribedDose:10,unit:'mL'});
 }
 expect(acao(b,{tipo:'REDUZIR_DOSE',motivo:'Tentativa indevida de reduzir volume como mg',itensSelecionados:[5],reducaoPct:20}).resultado.estado).toBe('PENDENTE');
 b.ciclo!.itens[4]!.doseOriginal!.valor=99;expect(edicaoDaAcao(b,acao(b,{tipo:'MANTER_CICLO',motivo:'Conferir divergência'})).edicao).toBeNull();
});
