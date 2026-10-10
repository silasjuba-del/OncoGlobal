import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { ClinicalEvent } from "../../src/contracts/operacao.js";
import type { RegraCondicional, RegraTermoComplementar } from "../../src/contracts/f0c/condicionais.js";
import { CondicionaisCicloDados, projetarCondicionaisClinicas } from "../../src/server/f0c/condicionaisClinicas.js";
import { fonteSintetica } from "../fixtures/triagem.js";

const corpus = JSON.parse(readFileSync("corpus/f0c/condicionais.v1.json", "utf8")) as { regras: RegraCondicional[]; termos: RegraTermoComplementar[] };
const agora = "2026-10-10T12:00:00-03:00";
const base = { patientId: "paciente-sintetico", tumorLotId: "lote-a", encounterId: "consulta-a", agora,
  programados: ["capecitabina"], regras: corpus.regras, regrasTermos: corpus.termos };
const normal = { dpyd: { valor: "SEM_DEFICIENCIA_IDENTIFICADA", fonte: "laudo sintético" } };
function evento(id: string, valor: unknown, extra: Partial<ClinicalEvent> = {}): ClinicalEvent {
  return { eventId: id, operationId: `op-${id}`, eventIndex: 0, patientId: base.patientId, tumorLotId: base.tumorLotId,
    encounterId: base.encounterId, tipo: "FATO", payload: { data: { campo: "condicionaisCiclo", valor } }, fontes: [fonteSintetica(id)],
    revisao: "CONFIRMADO", criadoEm: agora, criadoPor: { tipo: "SESSAO", id: "medico-sintetico" }, supersedesEventId: null, ...extra };
}
const projetar = (eventos: ClinicalEvent[]) => projetarCondicionaisClinicas({ ...base, eventos });
const dpyd = (r: ReturnType<typeof projetar>) => r.avaliacoes.find((a) => a.regraId === "DPYD")!;

describe("N7: condições do ciclo alimentadas por fatos confirmados", () => {
  it("ausência fica pendente para medicamento aplicável, sem autorização/bloqueio", () => {
    const r = projetar([]);
    expect(r.pendencias).toContain("DADOS_CONDICIONAIS_AUSENTES");
    expect(dpyd(r)).toMatchObject({ estado: "PENDENTE", autorizaCiclo: false, ajustaDose: false, bloqueiaConsulta: false });
    expect(r.avaliacoes.find((a) => a.regraId === "BEVACIZUMABE_PA")?.estado).toBe("NAO_APLICAVEL");
  });
  it("filtra paciente, lote, consulta, RAW e futuro; preserva fonte do confirmado", () => {
    const deficiencia = { dpyd: { valor: "DEFICIENCIA_COMPLETA", fonte: "fonte" } };
    const r = projetar([evento("a", normal), evento("raw", deficiencia, { revisao: "RAW" }),
      evento("outro", deficiencia, { patientId: "outro" }), evento("lote", deficiencia, { tumorLotId: "outro" }),
      evento("consulta", deficiencia, { encounterId: "antiga" }), evento("futuro", deficiencia, { criadoEm: "2026-10-11T12:00:00-03:00" })]);
    expect(dpyd(r).estado).toBe("SEM_AVISO");
    expect(r.eventIds).toEqual(["a"]); expect(r.sourceIds).toEqual(["a"]);
    expect(dpyd(projetar([evento("a", deficiencia, { revisao: "ASSINADO" })])).estado).toBe("AVISO");
  });
  it("conflito não escolhe valor seguro; correção explícita resolve e mantém a origem", () => {
    const a = evento("a", normal), b = evento("b", { dpyd: { valor: "DEFICIENCIA_COMPLETA", fonte: "fonte" } });
    const conflito = projetar([a, b]);
    expect(conflito.pendencias).toContain("DADOS_CONDICIONAIS_DIVERGENTES");
    expect(dpyd(conflito).estado).toBe("PENDENTE");
    expect(conflito.sourceIds).toEqual(["a", "b"]);
    const corrigido = projetar([a, { ...b, supersedesEventId: "a" }]);
    expect(dpyd(corrigido).estado).toBe("AVISO"); expect(corrigido.eventIds).toEqual(["b"]);
  });
  it("fonte ausente, dados não estruturados e payload de elenco não são aceitos", () => {
    expect(dpyd(projetar([evento("a", normal, { fontes: [] })])).estado).toBe("PENDENTE");
    expect(projetar([evento("a", "DPYD normal")]).pendencias).toContain("DADOS_CONDICIONAIS_INVALIDOS");
    expect(CondicionaisCicloDados.safeParse({ ...normal, programados: [] }).success).toBe(false);
    expect(CondicionaisCicloDados.safeParse({ hipertensaoGraveNaoControlada: { valor: "false", fonte: "fonte" } }).success).toBe(false);
  });
  it("data local é respeitada na janela de cirurgia e agora inválido não valida dados", () => {
    const cirurgia = { historicoEAgendaConferidos: true, ultimaCirurgiaMaior: "2026-09-12", proximaCirurgiaEletiva: null,
      cicatrizacaoAdequada: true, fonte: "fonte" };
    const e = evento("a", { cirurgia }, { criadoEm: "2026-10-09T20:00:00-03:00" });
    const r = projetarCondicionaisClinicas({ ...base, agora: "2026-10-10T01:00:00Z", programados: ["bevacizumabe"], eventos: [e] });
    expect(r.avaliacoes.find((a) => a.regraId === "BEVACIZUMABE_CIRURGIA")?.estado).toBe("AVISO"); // 27 dias civis no serviço
    expect(projetarCondicionaisClinicas({ ...base, agora: "ontem", eventos: [evento("a", normal)] }).pendencias)
      .toContain("ESCOPO_OU_AGORA_INVALIDO");
  });
  it("relógio vem do servidor; fato atual não renova coleta antiga ou futura", () => {
    const dados = { proteinuria: { valor: 1, unidade: "g/24h", fonte: "lab", coletadoEm: "2026-10-09T12:00:00-03:00" },
      sindromeNefrotica: { valor: false, fonte: "médico" } };
    const avaliar = (valor: unknown) => projetarCondicionaisClinicas({ ...base, programados: ["bevacizumabe"], eventos: [evento("a", valor)] })
      .avaliacoes.find((a) => a.regraId === "BEVACIZUMABE_PROTEINURIA")!;
    expect(avaliar(dados).estado).toBe("SEM_AVISO");
    for (const coletadoEm of [null, "2026-10-09", "2026-01-01T12:00:00Z", "2026-10-11T12:00:00Z"]) {
      expect(avaliar({ ...dados, proteinuria: { ...dados.proteinuria, coletadoEm } }).estado).toBe("PENDENTE");
    }
    expect(CondicionaisCicloDados.safeParse({ ...dados, agora: "2026-01-01T12:00:00Z" }).success).toBe(false);
  });
});

describe("N6: fonte CTCAE6 conferida e grau somente documentado", () => {
  const termo = { termo: "MAO_PE", presente: true, evidencia: "Médico documentou síndrome mão-pé", fonte: "consulta", ctcaeVersao: "6.0" };
  it("corpus aponta PDF CTCAE6 oficial e páginas exatas dos termos", () => {
    expect(corpus.termos.every((t) => t.ctcaeVersao === "6.0" && t.fonte.referencia === "https://dctd.cancer.gov/research/ctep-trials/for-sites/adverse-events/ctcae-v6.pdf")).toBe(true);
    expect(corpus.termos.find((t) => t.id === "MAO_PE")?.grausDisponiveis).toEqual([1, 2, 3]);
    expect(corpus.termos.find((t) => t.id === "REACAO_INFUSIONAL")?.grausDisponiveis).toEqual([1, 2, 3, 4, 5]);
  });
  it("termo sem grau preserva null; grau documentado válido não gera ajuste", () => {
    expect(projetar([evento("a", { termos: [termo] })]).termos[0]).toMatchObject({ estado: "DOCUMENTADO", grau: null, ctcaeVersao: "6.0" });
    expect(projetar([evento("a", { termos: [{ ...termo, grauDocumentado: 2 }] })]).termos[0])
      .toMatchObject({ estado: "DOCUMENTADO", grau: 2, ajustaDose: false });
  });
  it("CTCAE5, grau4 para mão-pé ou grau positivo com negação ficam pendentes", () => {
    for (const alteracao of [{ ctcaeVersao: "5.0" }, { grauDocumentado: 4 }, { grauDocumentado: 1, presente: false }]) {
      expect(projetar([evento("a", { termos: [{ ...termo, ...alteracao }] })]).termos[0]).toMatchObject({ estado: "PENDENTE", grau: null });
    }
  });
});
