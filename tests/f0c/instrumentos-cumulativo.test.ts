import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { avaliarExposicaoCumulativa, type AdministracaoExposicao, type EntradaExposicaoCumulativa, type LimiteExposicaoCumulativa } from "../../src/rules/cumulativoAlerta.js";
import { calcularAlbi, calcularChildPugh, calcularG8, calcularKhorana, registrarKps } from "../../src/rules/f0c/instrumentos.js";
import type { EntradaG8, EntradaKhorana, InstrumentoId, RegraInstrumento } from "../../src/contracts/f0c/instrumentos.js";

const corpus = JSON.parse(readFileSync("corpus/f0c/instrumentos.v1.json", "utf8")) as { instrumentos: RegraInstrumento[] };
const regra = (id: InstrumentoId): RegraInstrumento => corpus.instrumentos.find((r) => r.id === id)!;
const contexto = { aplicavel: true, fonteDados: "caso sintético documentado" };
const m = (valor: number | null, unidade: string) => ({ valor, unidade, fonte: "fonte sintética" });
const child = () => ({ ...contexto, bilirrubina: m(1, "mg/dL"), albumina: m(4, "g/dL"), inr: m(1, "INR"),
  ascite: "AUSENTE" as const, encefalopatia: "AUSENTE" as const });
const khorana = (): EntradaKhorana => ({ ...contexto, sitio: "OUTRO", plaquetas: m(349, "10^9/L"), hemoglobina: m(10, "g/dL"),
  leucocitos: m(11, "10^9/L"), imc: m(34, "kg/m2"), usaEstimulanteEritropoiese: false });
const g8 = (): EntradaG8 => ({ ...contexto, ingestao3Meses: "SEM_REDUCAO", perdaPeso3Meses: "SEM_PERDA", mobilidade: "SAI_CASA",
  neuropsicologico: "AUSENTE", imc: m(23, "kg/m2"), medicamentosPorDia: 3, autoavaliacaoSaude: "MELHOR", idadeAnos: 79 });

describe("F15: instrumentos puros com fonte e aplicabilidade", () => {
  it("KPS somente registrado; 0 é válido, 85 não é uma categoria", () => {
    expect(registrarKps({ ...contexto, kpsDocumentado: 0 }, regra("KPS"))).toMatchObject({ estado: "CALCULADO", escore: 0 });
    expect(registrarKps({ ...contexto, kpsDocumentado: 85 }, regra("KPS")).estado).toBe("PENDENTE");
    expect(registrarKps({ ...contexto, kpsDocumentado: null }, regra("KPS")).escore).toBeNull();
  });
  it("regra inativa/ausente, fonte e aplicabilidade desconhecidas não geram escore", () => {
    expect(registrarKps({ ...contexto, kpsDocumentado: 80 }, null).estado).toBe("PENDENTE");
    expect(registrarKps({ ...contexto, kpsDocumentado: 80 }, { ...regra("KPS"), ativo: false }).estado).toBe("PENDENTE");
    expect(registrarKps({ ...contexto, fonteDados: null, kpsDocumentado: 80 }, regra("KPS")).estado).toBe("PENDENTE");
    expect(registrarKps({ ...contexto, aplicavel: null, kpsDocumentado: 80 }, regra("KPS")).estado).toBe("PENDENTE");
    expect(registrarKps({ ...contexto, aplicavel: false, kpsDocumentado: null }, regra("KPS")).estado).toBe("NAO_APLICAVEL");
    expect(registrarKps({ ...contexto, kpsDocumentado: 80 }, regra("ALBI")).estado).toBe("PENDENTE");
  });
  it("Child-Pugh calcula classes e mantém fronteiras inclusivas", () => {
    expect(calcularChildPugh(child(), regra("CHILD_PUGH"))).toMatchObject({ escore: 5, classificacao: "A" });
    expect(calcularChildPugh({ ...child(), bilirrubina: m(2, "mg/dL"), albumina: m(3.5, "g/dL"), inr: m(1.7, "INR") }, regra("CHILD_PUGH")))
      .toMatchObject({ escore: 8, classificacao: "B" });
    expect(calcularChildPugh({ ...child(), bilirrubina: m(3, "mg/dL"), albumina: m(2.8, "g/dL"), inr: m(2.3, "INR") }, regra("CHILD_PUGH")))
      .toMatchObject({ escore: 8, classificacao: "B" });
    expect(calcularChildPugh({ ...child(), bilirrubina: m(4, "mg/dL"), albumina: m(2, "g/dL"), inr: m(3, "INR"), ascite: "REFRATARIA", encefalopatia: "GRAU_3_4" }, regra("CHILD_PUGH")))
      .toMatchObject({ escore: 15, classificacao: "C", condutaAutomatica: false });
  });
  it("Child-Pugh não trata ascite ausente de documentação como negação", () => {
    expect(calcularChildPugh({ ...child(), ascite: null }, regra("CHILD_PUGH")).escore).toBeNull();
    expect(calcularChildPugh({ ...child(), albumina: m(40, "g/L") }, regra("CHILD_PUGH")).estado).toBe("PENDENTE");
  });
  it("ALBI calcula log10 nas unidades originais e rejeita zero/mg/dL sem conversão", () => {
    expect(calcularAlbi({ ...contexto, bilirrubina: m(10, "umol/L"), albumina: m(40, "g/L") }, regra("ALBI")))
      .toMatchObject({ escore: expect.closeTo(-2.74, 10), classificacao: "1" });
    expect(calcularAlbi({ ...contexto, bilirrubina: m(10, "umol/L"), albumina: m(30, "g/L") }, regra("ALBI")).classificacao).toBe("2");
    expect(calcularAlbi({ ...contexto, bilirrubina: m(10, "umol/L"), albumina: m(20, "g/L") }, regra("ALBI")).classificacao).toBe("3");
    for (const b of [m(0, "umol/L"), m(1, "mg/dL"), m(NaN, "umol/L")]) {
      expect(calcularAlbi({ ...contexto, bilirrubina: b, albumina: m(40, "g/L") }, regra("ALBI")).estado).toBe("PENDENTE");
    }
  });
  it("Khorana respeita cortes e não duplica ponto Hb + estimulante", () => {
    expect(calcularKhorana(khorana(), regra("KHORANA"))).toMatchObject({ escore: 0, classificacao: "BAIXO" });
    expect(calcularKhorana({ ...khorana(), sitio: "PANCREAS", plaquetas: m(350, "10^9/L"), hemoglobina: m(9, "g/dL"),
      leucocitos: m(11.1, "10^9/L"), imc: m(35, "kg/m2"), usaEstimulanteEritropoiese: true }, regra("KHORANA")))
      .toMatchObject({ escore: 6, classificacao: "ALTO", parcelas: { hemoglobinaOuEstimulante: 1 } });
    expect(calcularKhorana({ ...khorana(), sitio: "PULMAO" }, regra("KHORANA")).classificacao).toBe("INTERMEDIARIO");
    expect(calcularKhorana({ ...khorana(), sitio: null }, regra("KHORANA")).estado).toBe("PENDENTE");
  });
  it("G8 soma oito itens até17, preserva meio ponto e identifica <=14", () => {
    expect(calcularG8(g8(), regra("G8"))).toMatchObject({ escore: 17, classificacao: "RASTREAMENTO_NAO_ALTERADO" });
    expect(calcularG8({ ...g8(), idadeAnos: 85, medicamentosPorDia: 4, autoavaliacaoSaude: "IGUAL" }, regra("G8")))
      .toMatchObject({ escore: 14, classificacao: "RASTREAMENTO_ALTERADO" });
    expect(calcularG8({ ...g8(), autoavaliacaoSaude: "NAO_SABE" }, regra("G8")).escore).toBe(15.5);
    expect(calcularG8({ ...g8(), ingestao3Meses: null }, regra("G8")).escore).toBeNull();
    expect(calcularG8({ ...g8(), idadeAnos: 86 }, regra("G8")).parcelas.idade).toBe(0);
  });
});

const admin = (adminId: string, dose: number, episodioId = "ep1"): AdministracaoExposicao => ({ adminId, patientId: "p1", episodioId,
  droga: "droga-sintetica", status: "COMPLETA", quantidadeEfetivaMgM2: dose, unidade: "mg/m2", fonte: `fonte-${adminId}` });
const entrada = (administracoes: AdministracaoExposicao[]): EntradaExposicaoCumulativa => ({ patientId: "p1", droga: "droga-sintetica", administracoes,
  historicoCompleto: true, fonteCompletude: "histórico longitudinal conferido" });
const limite: LimiteExposicaoCumulativa = { ativo: true, regraId: "sintetico", versao: "1", droga: "droga-sintetica", unidade: "mg/m2",
  maximo: 100, comparador: "GT", fonte: "limite exclusivamente sintético" };

describe("F14: exposição longitudinal normalizada mg/m2", () => {
  it("atravessa episódios da mesma droga/paciente, inclui dose parcial e não dose prescrita", () => {
    const r = avaliarExposicaoCumulativa(entrada([admin("a", 60), { ...admin("b", 30, "ep2"), status: "PARCIAL" },
      { ...admin("c", 500), patientId: "outro" }, { ...admin("d", 500), droga: "outra" }]), limite);
    expect(r).toMatchObject({ estado: "ALARANJADO", totalMgM2: 90, episodios: ["ep1", "ep2"], adminIds: ["a", "b"] });
  });
  it("replay idêntico não duplica; conflito de dose/episódio fica pendente", () => {
    const a = admin("a", 60);
    expect(avaliarExposicaoCumulativa(entrada([a, a]), limite).totalMgM2).toBe(60);
    for (const conflito of [{ ...a, quantidadeEfetivaMgM2: 30 }, { ...a, episodioId: "ep2" }]) {
      expect(avaliarExposicaoCumulativa(entrada([a, conflito]), limite)).toMatchObject({ estado: "PENDENTE", totalMgM2: null, totalConhecidoMgM2: null });
    }
  });
  it("histórico incompleto não declara segurança e pode avisar excesso já demonstrado", () => {
    expect(avaliarExposicaoCumulativa({ ...entrada([admin("a", 60)]), historicoCompleto: false }, limite))
      .toMatchObject({ estado: "ALARANJADO", totalMgM2: null, totalConhecidoMgM2: 60 });
    expect(avaliarExposicaoCumulativa({ ...entrada([admin("a", 120)]), historicoCompleto: false }, limite))
      .toMatchObject({ estado: "AVISO", totalMgM2: null, totalConhecidoMgM2: 120, pendencias: ["HISTORICO_LONGITUDINAL_INCOMPLETO"] });
  });
  it("não reinterpreta mg como mg/m2, não usa limite sem fonte ou de outra droga", () => {
    expect(avaliarExposicaoCumulativa(entrada([{ ...admin("a", 60), unidade: "mg" }]), limite).totalConhecidoMgM2).toBeNull();
    for (const l of [null, { ...limite, unidade: "mg" }, { ...limite, fonte: null }, { ...limite, droga: "outra" }, { ...limite, ativo: false }]) {
      expect(avaliarExposicaoCumulativa(entrada([admin("a", 60)]), l).estado).toBe("PENDENTE");
    }
  });
  it("omitida só aceita dose zero, e vazio não vira exposição zero", () => {
    expect(avaliarExposicaoCumulativa(entrada([{ ...admin("a", 0), status: "OMITIDA" }]), limite).totalMgM2).toBe(0);
    expect(avaliarExposicaoCumulativa(entrada([{ ...admin("a", 60), status: "OMITIDA" }]), limite).estado).toBe("PENDENTE");
    expect(avaliarExposicaoCumulativa(entrada([]), limite).totalMgM2).toBeNull();
  });
  it("comparador vem do limite e soma decimal não cria falso excesso", () => {
    expect(avaliarExposicaoCumulativa(entrada([admin("a", 100)]), limite).estado).toBe("SEM_AVISO");
    expect(avaliarExposicaoCumulativa(entrada([admin("a", 100)]), { ...limite, comparador: "GTE" }).estado).toBe("AVISO");
    expect(avaliarExposicaoCumulativa(entrada([admin("a", 0.1), admin("b", 0.2)]), { ...limite, maximo: 0.3 }))
      .toMatchObject({ estado: "SEM_AVISO", totalMgM2: 0.3 });
  });
});
