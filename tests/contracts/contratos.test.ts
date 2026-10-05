// W0 · testes de contrato (positivo + negativo por regra — INV-19)
import { readFileSync, readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import {
  ActionIntent, Alerta, Apac, ConfirmarBloco, RulesetHeader, Semaforo,
  TreatmentAdministration, VisualSuggestion, dado,
} from "../../src/contracts/index.js";

const fonte = {
  sourceId: "src-1", classe: "MANUAL", localizador: null, dataClinica: "2026-10-01",
  dataCaptura: "2026-10-05T10:00:00-03:00", versao: "1", contentHash: "h1",
} as const;
const DadoNum = dado(z.number().int());

describe("C-03 Dado<T>", () => {
  it("ausente com PENDENTE é válido; ausente VERDE é rejeitado (INV-02)", () => {
    const base = { valor: null, campo: "AUSENTE", motivo: "sem hemograma", fontes: [], revisao: "RAW" };
    expect(DadoNum.safeParse({ ...base, estado: "PENDENTE" }).success).toBe(true);
    expect(DadoNum.safeParse({ ...base, estado: "VERDE" }).success).toBe(false);
  });
  it("PRESENTE exige fonte", () => {
    const base = { valor: 80, campo: "PRESENTE", estado: "VERDE", motivo: "ok", revisao: "CONFIRMADO" };
    expect(DadoNum.safeParse({ ...base, fontes: [fonte] }).success).toBe(true);
    expect(DadoNum.safeParse({ ...base, fontes: [] }).success).toBe(false);
  });
  it("CONFLITO guarda candidatos sem eleger valor (K-02 / N01)", () => {
    const conflito = {
      valor: null, campo: "CONFLITO", estado: "VERMELHO", motivo: "laudos divergem", fontes: [fonte], revisao: "REVISAR",
      candidatos: [{ valor: 80, fontes: [fonte] }, { valor: 95, fontes: [{ ...fonte, sourceId: "src-2" }] }],
    };
    expect(DadoNum.safeParse(conflito).success).toBe(true);
    expect(DadoNum.safeParse({ ...conflito, valor: 80 }).success).toBe(false);
    expect(DadoNum.safeParse({ ...conflito, candidatos: [conflito.candidatos[0]] }).success).toBe(false);
  });
  it("NAO_SE_APLICA exige fonte que justifique (N02)", () => {
    const na = { valor: null, campo: "NAO_SE_APLICA", estado: "PENDENTE", motivo: "biópsia incisional", revisao: "CONFIRMADO" };
    expect(DadoNum.safeParse({ ...na, fontes: [fonte] }).success).toBe(true);
    expect(DadoNum.safeParse({ ...na, fontes: [] }).success).toBe(false);
  });
  it("VERDE não nasce de RAW", () => {
    expect(DadoNum.safeParse({ valor: 80, campo: "PRESENTE", estado: "VERDE", motivo: "x", fontes: [fonte], revisao: "RAW" }).success).toBe(false);
  });
  it("semáforo só tem 3 cores (Q10)", () => {
    expect(Semaforo.options).toEqual(["VERDE", "VERMELHO", "PENDENTE"]);
    expect(Semaforo.safeParse("AMARELO").success).toBe(false);
  });
});

describe("C-16 ConfirmarBloco (INV-04, A1, K-04)", () => {
  const ok = {
    patientId: "p1", tumorLotId: null, encounterId: "e1", bloco: "TUDO",
    registros: [{ id: "r1", expectedRevision: 3 }],
    documentosExibidos: [{ documentId: "d1", documentVersion: 1 }],
    reconhecerAlertas: [], idempotencyKey: "op-000001",
  };
  it("payload válido passa", () => expect(ConfirmarBloco.safeParse(ok).success).toBe(true));
  it("rejeita medicoId / assinado / liberado vindos do cliente", () => {
    for (const k of ["medicoId", "assinado", "liberado"])
      expect(ConfirmarBloco.safeParse({ ...ok, [k]: true }).success).toBe(false);
  });
  it("exige expectedRevision (concorrência entre abas — N04)", () => {
    expect(ConfirmarBloco.safeParse({ ...ok, registros: [{ id: "r1" }] }).success).toBe(false);
  });
});

describe("C-10 APAC (K-03)", () => {
  const apac = {
    apacId: "a1", tumorLotId: "t1", prescricaoAssinadaRef: { documentId: "rx1", documentVersion: 1 },
    dataGeracaoApp: "2026-10-05", competencia: "2026-10", campos: {}, estado: "RASCUNHO",
    resultadoExterno: null, versao: 1, substituiApacId: null,
  };
  it("RASCUNHO com campos vazios é salvável (completude só na emissão)", () =>
    expect(Apac.safeParse(apac).success).toBe(true));
  it("AUTORIZADA sem comprovante externo é rejeitada (não nasce no app)", () =>
    expect(Apac.safeParse({ ...apac, estado: "AUTORIZADA" }).success).toBe(false));
  it("NEGADA com comprovante é preservada (N03)", () =>
    expect(Apac.safeParse({
      ...apac, estado: "NEGADA",
      resultadoExterno: { valor: "NEGADA", comprovanteRef: "c1", motivo: "estádio ausente", recebidoEm: "2026-12-30T09:00:00-03:00" },
    }).success).toBe(true));
});

describe("K-06 Administração efetiva", () => {
  const adm = {
    adminId: "ad1", cicloId: "c1", prescricaoRef: { documentId: "rx1", documentVersion: 1 }, item: 1, droga: "oxaliplatina",
    quantidadeEfetivaMg: 0, status: "OMITIDA", motivo: "reação", inicio: null, fim: null, fonte,
  };
  it("OMITIDA com motivo e quantidade 0 é válida", () => expect(TreatmentAdministration.safeParse(adm).success).toBe(true));
  it("OMITIDA com quantidade > 0 é rejeitada (N14)", () =>
    expect(TreatmentAdministration.safeParse({ ...adm, quantidadeEfetivaMg: 120 }).success).toBe(false));
  it("PARCIAL sem motivo é rejeitada", () =>
    expect(TreatmentAdministration.safeParse({ ...adm, status: "PARCIAL", quantidadeEfetivaMg: 60, motivo: null }).success).toBe(false));
});

describe("C-12 Alerta (INV-09, INV-17, K-08)", () => {
  const al = {
    alertaId: "al1", alvo: { contatoNaoVinculadoId: "ct9" }, natureza: "AMEACA_IMEDIATA", classeRisco: null,
    texto: "relato de sangramento", origemRegra: "canal-redflags@1", evidencias: [], presentationOverride: true,
    authorityOverride: false, reconhecidoEm: null, destino: "CHAT",
  };
  it("alerta pode existir antes do vínculo do contato", () => expect(Alerta.safeParse(al).success).toBe(true));
  it("authorityOverride nunca é true; destino só CHAT", () => {
    expect(Alerta.safeParse({ ...al, authorityOverride: true }).success).toBe(false);
    expect(Alerta.safeParse({ ...al, destino: "PRONTUARIO" }).success).toBe(false);
  });
});

describe("C-17 ActionIntent (ROE-0) e C-22 visão", () => {
  it("sem objeto = inválido (NO_ACTION)", () =>
    expect(ActionIntent.safeParse({ verbo: "IMPRIMIR", escopo: { patientId: "p1", encounterId: "e1" }, destino: null, idempotencyKey: "op-000002" }).success).toBe(false));
  it("sugestão visual exige rótulo 'sem laudo' e limitações", () => {
    const v = {
      imagemRef: "img1", serie: null, corte: null, regiao: { x: 0, y: 0, w: 10, h: 10 }, descricao: "d", interpretacaoSugerida: "i",
      limitacoes: ["corte único"], cobertura: "1 corte", modelo: "m", versao: "1", evidenceLayer: "IMAGE_OBSERVATION",
      rotulo: "Sugestão da IA — sem laudo", decisaoMedica: null,
    };
    expect(VisualSuggestion.safeParse(v).success).toBe(true);
    expect(VisualSuggestion.safeParse({ ...v, rotulo: "Laudo" }).success).toBe(false);
    expect(VisualSuggestion.safeParse({ ...v, evidenceLayer: "DOCUMENT_TEXT" }).success).toBe(false);
  });
});

describe("G-17 corpus: todo ruleset tem fonte, versão e curador", () => {
  const dir = new URL("../../corpus/rulesets/", import.meta.url);
  for (const f of readdirSync(dir)) {
    it(f, () => {
      const json = JSON.parse(readFileSync(new URL(f, dir), "utf8"));
      expect(RulesetHeader.safeParse(json.header).success).toBe(true);
    });
  }
  it("fonte externa sem trecho é rejeitada (K-27)", () => {
    expect(RulesetHeader.safeParse({
      id: "x", versao: "1.0.0", vigenteDesde: "2026-10-05",
      fonte: { tipo: "DIRETRIZ", referencia: "SBOC", trecho: null, edicao: "2025" },
      curador: "Dr. Silas", aprovadoEm: "2026-10-05",
    }).success).toBe(false);
  });
});
