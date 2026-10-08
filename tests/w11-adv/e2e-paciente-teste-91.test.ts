// W11-H29 · Caso ponta a ponta "Paciente Teste 91" (próstata), dados 100% sintéticos (DIARIO PLN-001).
// Prova o trajeto do texto colado: extração -> normalização -> reconciliação (série temporal x conflito)
// -> alerta de plaquetas -> datas fixas -> gate de APAC. A revisão exibida e o ledger já são provados em
// tests/w10-eixo-servidor/revisao-exibida.test.ts. A ponte rascunho -> ledger -> evolução ainda NÃO existe
// (PLN-001); por isso os eventos de datas fixas são montados no formato do ledger, e isso é declarado aqui.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { ClinicalEvent } from "../../src/contracts/operacao.js";
import { FactSourceType } from "../../src/contracts/w10/extracao.js";
import { extratorDeterministico } from "../../src/kernel/extracao/extrator.js";
import { normalizarFatos } from "../../src/kernel/extracao/normalizacao.js";
import { reconciliarCampos } from "../../src/kernel/extracao/reconciliacao.js";
import { segmentarTranscricao } from "../../src/kernel/extracao/segmenter.js";
import type { ClinicalFact, FactSourceType as FonteTipo } from "../../src/kernel/extracao/tipos.js";
import { antiglosa, type ContextoAntiglosa, type RegraCidSexo } from "../../src/apac/antiglosa.js";
import { montarTabelaSigtap } from "../../src/apac/sigtap.js";
import { avaliarAlertaPlaquetas, lerLimiarAlertaPlaquetas, type ClassificadorPlaquetas } from "../../src/rules/plaquetasAlerta.js";
import { grauCtcae, lerSalaoCtcae } from "../../src/rules/portaCiclo.js";
import { projetarDatasFixas } from "../../src/kernel/projections/datasFixas.js";
import { apac, CAIXAS, COD_QT, COD_ZERO, proc } from "../apac-w10/helpers.js";

const ler = (rel: string): unknown => JSON.parse(readFileSync(fileURLToPath(new URL(rel, import.meta.url)), "utf8"));
const TEXTO_PACIENTE_91 = [
  "Histologia: adenocarcinoma de próstata, Gleason 4+3, ISUP 3",
  "PSA 12,4 ng/mL",
  "15/09/2026 plaquetas 45.000/mm³",
  "01/10/2026 plaquetas 62.000/mm³",
  "nega dor; relata dormência em membros inferiores",
  "Hb 11,2 g/dL",
].join("\n");

/** Texto colado (fonte medical_note) -> fatos normalizados, pelo mesmo trajeto do extrator real. */
function extrairTexto(texto: string, sourceType: FonteTipo = "medical_note", sourceId = "laudo-91"): readonly ClinicalFact[] {
  // recordingId derivado da fonte: ids de fato distintos entre documentos (evita colisão silenciosa).
  const segmentos = segmentarTranscricao({ recordingId: `rec-${sourceId}`, sourceId, sourceType,
    turns: [{ text: texto, startMs: null, endMs: null }] });
  return normalizarFatos(segmentos.flatMap((s) => [...extratorDeterministico.extrair(s)]));
}
const doDominio = (fatos: readonly ClinicalFact[], domain: ClinicalFact["domain"]) => fatos.filter((f) => f.domain === domain);
const marcadorDe = (fato: ClinicalFact) => (fato.value as { marker: string }).marker;
const labDe = (fato: ClinicalFact) => fato.value as { marker: string; value: number | null; unit: string | null; normalizado: boolean };

describe("W11-H29 · Paciente Teste 91 · 1. texto colado gera fatos", () => {
  it("cada linha do texto colado vira fato rastreável à fonte (nenhum fato sem trecho)", () => {
    const fatos = extrairTexto(TEXTO_PACIENTE_91);
    expect(fatos.length).toBeGreaterThanOrEqual(7);
    expect(new Set(fatos.map((f) => f.domain))).toEqual(new Set(["diagnosis", "biomarker", "lab", "symptom"]));
    expect(fatos.every((f) => f.sourceId === "laudo-91" && !!f.rawEvidence)).toBe(true);
  });

  it("extração é determinística: mesma entrada, mesma saída", () => {
    expect(JSON.stringify(extrairTexto(TEXTO_PACIENTE_91))).toBe(JSON.stringify(extrairTexto(TEXTO_PACIENTE_91)));
  });

  it("'nega dor' não apaga a linha inteira: o sintoma afirmado na mesma linha permanece", () => {
    const sintomas = doDominio(extrairTexto(TEXTO_PACIENTE_91), "symptom");
    expect(sintomas).toHaveLength(1);
    expect(sintomas[0]!.value).toBe("relata dormência em membros inferiores");
    expect(sintomas.some((f) => String(f.value).includes("nega"))).toBe(false);
  });
});

describe("W11-H29 · Paciente Teste 91 · 2. marcadores de próstata e laboratório", () => {
  it("Gleason 4+3 e ISUP 3 saem como biomarcador literal da fonte, sem inferência", () => {
    const bm = doDominio(extrairTexto(TEXTO_PACIENTE_91), "biomarker");
    expect(bm.find((f) => marcadorDe(f) === "Gleason"))
      .toMatchObject({ value: { marker: "Gleason", value: "4+3" }, evidence: "EXPLICIT", requiresConfirmation: false });
    expect(bm.find((f) => marcadorDe(f) === "ISUP"))
      .toMatchObject({ value: { marker: "ISUP", value: "3" }, evidence: "EXPLICIT" });
  });

  it("PSA 12,4 ng/mL é normalizado (unidade canônica ng/mL, valor decimal), não fica PENDENTE", () => {
    const psa = doDominio(extrairTexto(TEXTO_PACIENTE_91), "lab").find((f) => labDe(f).marker === "PSA");
    expect(psa).toBeDefined();
    expect(labDe(psa!)).toMatchObject({ marker: "PSA", value: 12.4, unit: "ng/mL", normalizado: true });
  });

  it("Hb 11,2 g/dL preservada (regressão do trajeto)", () => {
    const hb = doDominio(extrairTexto(TEXTO_PACIENTE_91), "lab").find((f) => labDe(f).marker === "Hb");
    expect(labDe(hb!)).toMatchObject({ value: 11.2, unit: "g/dL", normalizado: true });
  });

  it("plaquetas em datas diferentes viram série temporal: campos separados, nenhum conflito", () => {
    const campos = reconciliarCampos(extrairTexto(TEXTO_PACIENTE_91));
    const chaves = Object.keys(campos).filter((k) => k.startsWith("lab:PLAQUETAS"));
    expect(chaves).toHaveLength(2);
    expect(chaves.every((k) => campos[k]!.conflict === false)).toBe(true);
    expect(chaves.map((k) => labDe(campos[k]!.candidates[0]!).value).sort((a, b) => a! - b!)).toEqual([45000, 62000]);
  });

  it("plaquetas na MESMA data com valores diferentes continuam visíveis como conflito (nunca some)", () => {
    const campos = reconciliarCampos(extrairTexto("15/09/2026 plaquetas 45.000/mm³\n15/09/2026 plaquetas 62.000/mm³"));
    const chave = Object.keys(campos).find((k) => k.startsWith("lab:PLAQUETAS:data:2026-09-15"))!;
    expect(campos[chave]).toMatchObject({ conflict: true, resolvedFactId: null });
    expect(campos[chave]!.candidates).toHaveLength(2);
  });
});

describe("W11-H29 · Paciente Teste 91 · 3. fonte LAB_FEED", () => {
  it("contrato aceita lab_feed (antes recusado: FactSourceType não tinha LAB_FEED)", () => {
    expect(FactSourceType.safeParse("lab_feed").success).toBe(true);
  });

  it("resultado de laboratório (lab_feed) tem precedência sobre a evolução na mesma data; divergência fica visível", () => {
    const evolucao = extrairTexto("15/09/2026 plaquetas 45.000/mm³", "medical_note", "evolucao-91");
    const feed = extrairTexto("15/09/2026 plaquetas 48.000/mm³", "lab_feed", "lab-feed-91");
    const campo = reconciliarCampos([...evolucao, ...feed])["lab:PLAQUETAS:data:2026-09-15"]!;
    expect(campo.conflict).toBe(true);
    expect(campo.resolvedFactId).toBe(feed[0]!.id);
    expect(campo.candidates).toHaveLength(2);
  });
});

describe("W11-H29 · Paciente Teste 91 · 4. alerta, datas fixas e APAC", () => {
  const limiar = lerLimiarAlertaPlaquetas(ler("../../corpus/rulesets/lab-thresholds.v1.json"));
  const salao = lerSalaoCtcae(ler("../../corpus/rulesets/salao-ctcae.v1.json"));
  const classificar: ClassificadorPlaquetas = (valor) => grauCtcae("plaquetas", valor, salao);

  it("plaquetas 45.000 (menor que 50.000) geram ALERTA; 62.000 não; alerta independe do grau CTCAE", () => {
    const [alerta45] = avaliarAlertaPlaquetas({ valor: 45000, data: "2026-09-15" }, limiar, classificar);
    const [alerta62] = avaliarAlertaPlaquetas({ valor: 62000, data: "2026-10-01" }, limiar, classificar);
    expect(alerta45.estado).toBe("ALERTA");
    expect(alerta62.estado).toBe("SEM_ALERTA");
  });

  it("datas fixas: biópsia não está no texto colado, então fica PENDENTE (vazio no papel), nunca inventada", () => {
    const eventos = [ev("s1", "Staging", { tipo: "STAGING", dataClinica: "2026-09-20", valor: "cT2c cN0 cM0" })];
    const r = projetarDatasFixas(eventos, "2026-10-08");
    expect(r.biopsyDate).toMatchObject({ data: null, estado: "PENDENTE", motivo: "AUSENTE", fonte: null });
    expect(r.lastStagingDate).toMatchObject({ data: "2026-09-20", estado: "PREENCHIDO", tipo: "STAGING" });
    expect(r.diasDesde.c1d1).toBeNull();
  });

  it("gate de coerência: CID de próstata em paciente masculino não gera AG-13 (positivo)", () => {
    const sigtap = { "2026-09": montarTabelaSigtap("2026-09", [proc(), proc({ codigo: COD_ZERO, nome: "CONSULTA SINTETICA" })]) };
    const regrasCidSexo = (ler("../../corpus/rulesets/apac-cid-sexo.v1.json") as { regras: RegraCidSexo[] }).regras;
    const ctx: ContextoAntiglosa = { hoje: "2026-09-11", sigtap, caixas: CAIXAS, cnesConfigurado: "2605473",
      regrasCidSexo, codigosSigtapLocal: new Set([COD_QT]), esquemaVigente: "Carboplatina + paclitaxel AUC 2" };
    const v = antiglosa(apac("ap-91", { cidPrincipal: "C61", pacienteSexo: "M", localizacaoTumorPrimario: "Próstata" }), ctx);
    expect(v.achados.filter((a) => a.regraId === "AG-13")).toEqual([]);
  });
});

// Evento no formato do ledger (ClinicalEvent), dados sintéticos.
function ev(eventId: string, tipo: string, data: Record<string, unknown>): ClinicalEvent {
  return ClinicalEvent.parse({
    eventId, operationId: `op-${eventId}`, eventIndex: 0, patientId: "paciente-teste-91",
    tumorLotId: "lote-91", encounterId: "consulta-91", tipo,
    payload: { reviewDecisionId: "revisao-91", data }, fontes: [], revisao: "CONFIRMADO",
    criadoEm: "2026-10-07T12:00:00Z", criadoPor: { tipo: "SESSAO", id: "medico-sintetico" },
    supersedesEventId: null,
  });
}
