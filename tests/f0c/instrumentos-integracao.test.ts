import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { ClinicalEvent } from "../../src/contracts/operacao.js";
import type { RegraInstrumento } from "../../src/contracts/f0c/instrumentos.js";
import { AvaliacaoInstrumentoRequest, avaliarInstrumentoEstruturado, projetarInstrumentosClinicos } from "../../src/server/f0c/instrumentosClinicos.js";
import { fonteSintetica } from "../fixtures/triagem.js";

const regras = (JSON.parse(readFileSync("corpus/f0c/instrumentos.v1.json", "utf8")) as { instrumentos: RegraInstrumento[] }).instrumentos;
const agora = "2026-10-10T12:00:00-03:00";
const base = { patientId: "paciente-sintetico", tumorLotId: "lote-a", encounterId: "consulta-a", agora, regras };
const kps = { aplicavel: true, fonteDados: "avaliação médica sintética", kpsDocumentado: 80 };
function evento(id: string, instrumento: string, valor: unknown, extra: Partial<ClinicalEvent> = {}): ClinicalEvent {
  return { eventId: id, operationId: `op-${id}`, eventIndex: 0, patientId: base.patientId, tumorLotId: base.tumorLotId,
    encounterId: base.encounterId, tipo: "FATO", payload: { data: { campo: `instrumento.${instrumento}`, valor } },
    fontes: [fonteSintetica(id)], revisao: "CONFIRMADO", criadoEm: agora, criadoPor: { tipo: "SESSAO", id: "medico-sintetico" },
    supersedesEventId: null, ...extra };
}
const projetar = (eventos: ClinicalEvent[]) => projetarInstrumentosClinicos({ ...base, eventos });

describe("F15: integração de instrumentos estruturados com o ledger", () => {
  it("sem fatos não pede G8/Khorana ou inventa escore", () => {
    expect(projetar([])).toEqual({ avaliacoes: [], pendencias: [] });
    expect(projetar([evento("texto", "KPS", "Paciente ativo ECOG 1")]).avaliacoes[0]?.avaliacao)
      .toMatchObject({ estado: "PENDENTE", escore: null, pendencias: ["DADOS_ESTRUTURADOS_INVALIDOS"] });
  });
  it("projeta apenas confirmado/assinado do paciente, lote e consulta corretos", () => {
    const r = projetar([
      evento("valido", "KPS", kps),
      evento("raw", "KPS", { ...kps, kpsDocumentado: 10 }, { revisao: "RAW" }),
      evento("outro-paciente", "KPS", { ...kps, kpsDocumentado: 20 }, { patientId: "outro" }),
      evento("outro-lote", "KPS", { ...kps, kpsDocumentado: 30 }, { tumorLotId: "lote-b" }),
      evento("antigo", "KPS", { ...kps, kpsDocumentado: 40 }, { encounterId: "consulta-antiga" }),
      evento("futuro", "KPS", { ...kps, kpsDocumentado: 50 }, { criadoEm: "2026-10-11T12:00:00-03:00" }),
    ]);
    expect(r.avaliacoes).toHaveLength(1);
    expect(r.avaliacoes[0]).toMatchObject({ instrumento: "KPS", aplicavel: true, eventIds: ["valido"], sourceIds: ["valido"],
      avaliacao: { estado: "CALCULADO", escore: 80, condutaAutomatica: false, consultaSegue: true } });
    expect(projetar([evento("assinado", "KPS", kps, { revisao: "ASSINADO" })]).avaliacoes[0]?.avaliacao.escore).toBe(80);
  });
  it("conflito mantém todas as fontes e não escolhe a última avaliação", () => {
    const r = projetar([evento("a", "KPS", kps), evento("b", "KPS", { ...kps, kpsDocumentado: 50 })]);
    expect(r.avaliacoes[0]).toMatchObject({ sourceIds: ["a", "b"], avaliacao: { estado: "PENDENTE", escore: null } });
    expect(r.pendencias).toContain("KPS:FATOS_DIVERGENTES");
  });
  it("correção explícita substitui somente dentro do horizonte temporal", () => {
    const a = evento("a", "KPS", kps);
    const b = evento("b", "KPS", { ...kps, kpsDocumentado: 50 }, { supersedesEventId: "a" });
    expect(projetar([a, b]).avaliacoes[0]).toMatchObject({ eventIds: ["b"], avaliacao: { escore: 50 } });
    expect(projetar([a, { ...b, criadoEm: "2026-10-11T12:00:00-03:00" }]).avaliacoes[0]?.avaliacao.escore).toBe(80);
  });
  it("não calcula com fonte ledger ausente, regra ambígua ou aplicabilidade desconhecida", () => {
    expect(projetar([evento("sem-fonte", "KPS", kps, { fontes: [] })]).pendencias).toContain("KPS:FONTE_EVENTO_AUSENTE");
    const e = evento("a", "KPS", { ...kps, aplicavel: null });
    expect(projetar([e]).avaliacoes[0]?.avaliacao).toMatchObject({ estado: "PENDENTE", escore: null });
    expect(projetarInstrumentosClinicos({ ...base, eventos: [evento("a", "KPS", kps)], regras: [...regras, regras[0]!] }).pendencias)
      .toContain("KPS:REGRA_AMBIGUA");
  });
  it("não aplica instrumento explicitamente não aplicável, nem trata null como zero", () => {
    expect(projetar([evento("a", "KPS", { ...kps, aplicavel: false, kpsDocumentado: null })]).avaliacoes[0]?.avaliacao)
      .toMatchObject({ estado: "NAO_APLICAVEL", escore: null });
    expect(projetar([evento("a", "KPS", { ...kps, kpsDocumentado: null })]).avaliacoes[0]?.avaliacao)
      .toMatchObject({ estado: "PENDENTE", escore: null });
  });
  it("agora inválido não mistura resultados, instrumento desconhecido não dispara cálculo", () => {
    expect(projetarInstrumentosClinicos({ ...base, eventos: [evento("a", "KPS", kps)], agora: "ontem" }))
      .toEqual({ avaliacoes: [], pendencias: ["ESCOPO_OU_AGORA_INVALIDO"] });
    expect(projetar([evento("a", "INVENTADO", kps)]).avaliacoes).toEqual([]);
  });
  it("Khorana com estrutura explícita calcula sem inferir respostas em falta", () => {
    const medida = (valor: number, unidade: string) => ({ valor, unidade, fonte: "laboratório sintético" });
    const dados = { aplicavel: true, fonteDados: "avaliação basal sintética", sitio: "PANCREAS", plaquetas: medida(350, "10^9/L"),
      hemoglobina: medida(10, "g/dL"), leucocitos: medida(11, "10^9/L"), imc: medida(35, "kg/m2"), usaEstimulanteEritropoiese: false };
    expect(projetar([evento("k", "KHORANA", dados)]).avaliacoes[0]?.avaliacao).toMatchObject({ estado: "CALCULADO", escore: 4 });
    expect(projetar([evento("k", "KHORANA", { ...dados, usaEstimulanteEritropoiese: null })]).avaliacoes[0]?.avaliacao.escore).toBeNull();
    const { usaEstimulanteEritropoiese: _ignorado, ...incompleto } = dados;
    expect(projetar([evento("k", "KHORANA", incompleto)]).pendencias).toContain("KHORANA:DADOS_ESTRUTURADOS_INVALIDOS");
  });
  it("schema dirigido é estrito e não faz coerção; função dirigida usa mesmo cálculo", () => {
    expect(AvaliacaoInstrumentoRequest.safeParse({ instrumento: "KPS", dados: { ...kps, kpsDocumentado: "80" } }).success).toBe(false);
    expect(AvaliacaoInstrumentoRequest.safeParse({ instrumento: "KPS", dados: { ...kps, liberarCiclo: true } }).success).toBe(false);
    const pedido = AvaliacaoInstrumentoRequest.parse({ instrumento: "KPS", dados: kps });
    expect(avaliarInstrumentoEstruturado(pedido, regras.find((r) => r.id === "KPS")!)).toMatchObject({ estado: "CALCULADO", escore: 80 });
  });
});
