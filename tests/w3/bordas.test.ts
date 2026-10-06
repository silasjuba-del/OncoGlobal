import { describe, it, expect } from "vitest";
import { avaliarLabAlerts } from "../../src/rules/labAlerts.js";
import { avaliarRadAlerts } from "../../src/rules/radAlerts.js";
import { avaliarRedFlagsCanal } from "../../src/rules/redFlagsCanal.js";
import { avaliarCumulativoAlerta } from "../../src/rules/cumulativoAlerta.js";
import { avaliarCtcaeGrau } from "../../src/rules/ctcaeGrau.js";
import { avaliarRecist } from "../../src/rules/recist.js";
import { avaliarEscore } from "../../src/rules/escores.js";
import { ultimaAdministracaoQtEfetiva } from "../../src/rules/intervaloQt.js";
import * as f from "./fixtures.js";

const lesao = (diametroMm: number, codigo = "L1") => ({ codigo, diametroMm, confirmadaPorMedico: true });
const recist = (atual: number, base = 100, nadir = 100) => ({ lesoesAtuais: [lesao(atual)], baseline: [lesao(base)], nadir: [lesao(nadir)] });
const rad = (texto: string) => avaliarRadAlerts({ texto, tipoFonte: "TRANSCRIPTION", data: "2026-10-05" }, f.radRuleset);
const canal = (texto: string) => avaliarRedFlagsCanal({ texto, contatoId: "c", patientId: "p", classificadorOk: true }, f.canalRuleset);
const cumulativo = (administracoes: ReturnType<typeof f.administracaoCompleta>[]) => ({ patientId: "paciente-teste-01", episodioId: "episodio-01", droga: "DOXO", administracoes });

describe("W3 bordas adicionais", () => {
  it.each([NaN, Infinity, -Infinity])("LAB nao emite verde para %s", (valor) => {
    expect(avaliarLabAlerts([{ codigo: "HB", valor, unidade: "g/dL" }], f.labRuleset).achados[0]?.estado).toBe("PENDENTE");
  });
  it("LAB inativo, vazio e conversao sem fonte ficam pendentes", () => {
    expect(avaliarLabAlerts([], f.labRuleset).achados[0]?.estado).toBe("PENDENTE");
    expect(avaliarLabAlerts([{ codigo: "ANC", valor: 1, unidade: "/uL" }], f.labRuleset).achados[0]?.estado).toBe("PENDENTE");
    const rs = structuredClone(f.labRuleset); rs.analitos[0]!.conversoes[0]!.fonte = "";
    expect(avaliarLabAlerts([{ codigo: "HB", valor: 80, unidade: "dg/dL" }], rs).achados[0]?.estado).toBe("PENDENTE");
  });
  it("RAD procura ocorrencias posteriores e nao confirma fato", () => {
    const r = rad("Sem TEP no exame anterior. Agora suspeita de TEP.");
    expect(r.alerts).toHaveLength(1);
    expect(r.alerts[0]).toMatchObject({ tipo: "REVISAO_URGENTE", confirmado: false });
    expect(rad("TEP central").alerts[0]?.confirmado).toBe(false);
  });
  it("RAD respeita limites de palavras e antecedente", () => {
    expect(rad("Estepe").alerts).toHaveLength(0);
    expect(rad("Antecedente de TEP.").alerts).toHaveLength(0);
    expect(rad("Nao se pode excluir TEP.").alerts[0]?.tipo).toBe("REVISAO_URGENTE");
  });
  it("canal distingue mencoes atuais de outras negadas ou passadas", () => {
    expect(canal("Tive febre ontem. Agora estou com febre.").flags).toHaveLength(1);
    expect(canal("Sem febre ontem; mas estou com febre agora.").flags).toHaveLength(1);
    expect(canal("Nao estou com febre.").flags).toHaveLength(0);
    expect(canal("Minha mae esta com febre.").flags[0]?.alvo).toBe("contato");
  });
  it("canal preserva template null e pendencia de ruleset inativo", () => {
    const msg = { texto: "febre", contatoId: "c", classificadorOk: true };
    const rs = structuredClone(f.canalRuleset); rs.flags[0]!.templateId = null;
    expect(avaliarRedFlagsCanal(msg, rs).flags[0]).toMatchObject({ templateId: null, respostaFixa: true, alvo: "contato" });
    expect(avaliarRedFlagsCanal(msg, { ...rs, ativo: false }).achados[0]?.estado).toBe("PENDENTE");
  });
  it("cumulativo filtra paciente e episodio e detecta conflito por adminId", () => {
    const a = f.administracaoCompleta("a", 40);
    expect(avaliarCumulativoAlerta(cumulativo([a, { ...a, adminId: "b", patientId: "outro" }, f.administracaoCompleta("c", 99, "outro")]), f.limiteCumulativo).total).toBe(40);
    expect(avaliarCumulativoAlerta(cumulativo([a, { ...a, quantidadeEfetivaMg: 50 }]), f.limiteCumulativo).achado.estado).toBe("VERMELHO");
  });
  it("cumulativo rejeita unidade incompatível, ausencia e limite de outra droga", () => {
    const a = f.administracaoCompleta("a", 40);
    expect(avaliarCumulativoAlerta(cumulativo([{ ...a, unidadeEfetiva: "g" }]), f.limiteCumulativo).achado.estado).toBe("PENDENTE");
    expect(avaliarCumulativoAlerta(cumulativo([]), f.limiteCumulativo).achado.estado).toBe("PENDENTE");
    expect(avaliarCumulativoAlerta(cumulativo([a]), { ...f.limiteCumulativo, droga: "outra" }).achado.estado).toBe("PENDENTE");
  });
  it("CTCAE nao oculta basal faltante escolhendo grau inferior", () => {
    const r = avaliarCtcaeGrau({ termo: "toxicidade-fixture", ctcae_version: "v6", medidas: { valor: 3 } }, f.ctcaeRuleset);
    expect(r.candidate_grade).toBeNull(); expect(r.achado.inputs_missing).toContain("basal.valor");
  });
  it("CTCAE criterios vazios e strings numericas nao calculam grau", () => {
    const input = { termo: "toxicidade-fixture", ctcae_version: "v6", medidas: { valor: "3" }, basal: { valor: 1 } };
    expect(avaliarCtcaeGrau(input, f.ctcaeRuleset).candidate_grade).toBeNull();
    expect(avaliarCtcaeGrau(input, { ...f.ctcaeRuleset, termos: [{ termo: input.termo, criteriosPorGrau: { "3": [] } }] }).candidate_grade).toBeNull();
    expect(avaliarCtcaeGrau(input, null).achado.estado).toBe("PENDENTE");
  });
  it.each([[0, "CR"], [70, "PR"], [80, "SD"], [120, "PD"]] as const)("RECIST %s produz candidato %s", (atual, resposta) => {
    expect(avaliarRecist(recist(atual), f.recistRuleset).candidate_response).toBe(resposta);
  });
  it("RECIST nao arredonda um valor proximo para dentro do limiar", () => {
    expect(avaliarRecist(recist(70.00000001), f.recistRuleset).candidate_response).toBe("SD");
    expect(avaliarRecist(recist(119.99999999), f.recistRuleset).candidate_response).toBe("SD");
  });
  it("RECIST rejeita vazio, codigo divergente e duplicado", () => {
    const input = recist(80);
    expect(avaliarRecist({ ...input, lesoesAtuais: [] }, f.recistRuleset).candidate_response).toBeNull();
    expect(avaliarRecist({ ...input, lesoesAtuais: [lesao(80, "L2")] }, f.recistRuleset).candidate_response).toBeNull();
    expect(avaliarRecist({ ...input, lesoesAtuais: [lesao(40), lesao(40)] }, f.recistRuleset).candidate_response).toBeNull();
    expect(avaliarRecist(input, null).achado.estado).toBe("PENDENTE");
  });
  it("escore rejeita NaN, formula vazia e interpretacao sobreposta", () => {
    const input = { scoreId: "SCORE_FIXTURE", entradas: { a: 1, b: 2 } };
    expect(avaliarEscore({ ...input, entradas: { a: NaN, b: 2 } }, f.scoreRuleset).valor).toBeNull();
    expect(avaliarEscore(input, { ...f.scoreRuleset, formula: { tipo: "SOMA", campos: [] } }).valor).toBeNull();
    expect(avaliarEscore(input, { ...f.scoreRuleset, interpretacao: [{ min: 0, max: 5, rotulo: "a" }, { min: 3, max: 10, rotulo: "b" }] }).valor).toBeNull();
  });
  it("ancora QT ignora zero, RAW e eventos de outro tipo", () => {
    const e = f.eventoQt("a", "2026-10-01T10:00:00-03:00");
    expect(ultimaAdministracaoQtEfetiva([{ ...e, revisao: "RAW" }], "-03:00").data).toBeNull();
    expect(ultimaAdministracaoQtEfetiva([{ ...e, tipo: "PRESCRICAO" }], "-03:00").data).toBeNull();
    expect(ultimaAdministracaoQtEfetiva([{ ...f.administracaoCompleta("a", 0), modalidade: "QT" }], "-03:00").data).toBeNull();
  });
  it("ancora QT usa ordem dos instantes e exige escopo unico", () => {
    const a = f.eventoQt("a", "2026-10-01T23:00:00-03:00"), b = f.eventoQt("b", "2026-10-02T00:00:00Z");
    expect(ultimaAdministracaoQtEfetiva([a, b], "-03:00").adminId).toBe("a");
    expect(ultimaAdministracaoQtEfetiva([a, { ...b, patientId: "outro" }], "-03:00").data).toBeNull();
  });
  it("ancora QT usa correcao confirmada e rejeita dado incompleto", () => {
    const a = f.eventoQt("a", "2026-10-01T10:00:00-03:00"), b = f.eventoQt("b", "2026-09-01T10:00:00-03:00");
    expect(ultimaAdministracaoQtEfetiva([a, { ...b, supersedesEventId: a.eventId }], "-03:00").adminId).toBe("b");
    expect(ultimaAdministracaoQtEfetiva([a, { ...b, payload: { adminId: "b", modalidade: "QT" } }], "-03:00").data).toBeNull();
  });
});
