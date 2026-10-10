import { describe, expect, it } from "vitest";
import type { ClinicalEvent } from "../../src/contracts/operacao.js";
import type { EntradaExposicaoCumulativa, LimiteExposicaoCumulativa } from "../../src/rules/cumulativoAlerta.js";
import { ExposicaoCumulativaDados, projetarCumulativoClinico } from "../../src/server/f0c/cumulativoClinico.js";
import { fonteSintetica } from "../fixtures/triagem.js";

const agora = "2026-10-10T12:00:00-03:00";
const base = { patientId: "paciente-sintetico", tumorLotId: "lote-atual", encounterId: "consulta-atual", agora,
  programados: ["droga-sintetica"], limites: [] as LimiteExposicaoCumulativa[] };
const limite: LimiteExposicaoCumulativa = { ativo: true, regraId: "limite-sintetico", versao: "1", droga: "droga-sintetica",
  unidade: "mg/m2", maximo: 100, comparador: "GT", fonte: "somente teste" };
const dados = (): EntradaExposicaoCumulativa => ({ patientId: base.patientId, droga: "droga-sintetica", historicoCompleto: true, fonteCompletude: "histórico conferido",
  administracoes: [
    { adminId: "a", patientId: base.patientId, episodioId: "ep-antigo", droga: "droga-sintetica", status: "COMPLETA", quantidadeEfetivaMgM2: 60, unidade: "mg/m2", fonte: "admin-a", realizadaEm: "2026-09-01T12:00:00-03:00" },
    { adminId: "b", patientId: base.patientId, episodioId: "ep-atual", droga: "droga-sintetica", status: "PARCIAL", quantidadeEfetivaMgM2: 30, unidade: "mg/m2", fonte: "admin-b", realizadaEm: "2026-10-09T12:00:00-03:00" },
  ] });
function evento(id: string, valor: unknown = dados(), extra: Partial<ClinicalEvent> = {}): ClinicalEvent {
  return { eventId: id, operationId: `op-${id}`, eventIndex: 0, patientId: base.patientId, tumorLotId: base.tumorLotId,
    encounterId: base.encounterId, tipo: "FATO", payload: { data: { campo: "exposicaoCumulativa", valor } }, fontes: [fonteSintetica(id)],
    revisao: "CONFIRMADO", criadoEm: agora, criadoPor: { tipo: "SESSAO", id: "medico-sintetico" }, supersedesEventId: null, ...extra };
}
const projetar = (eventos: ClinicalEvent[]) => projetarCumulativoClinico({ ...base, eventos });

describe("F14: exposição cumulativa do ledger sem teto inventado", () => {
  it("sem limite retorna total conhecido e PENDENTE_LIMITE, inclusive vários episódios", () => {
    const r = projetar([evento("a")]);
    expect(r.avaliacoes[0]).toMatchObject({ modo: "COMPARAR_LIMITE", eventIds: ["a"], sourceIds: ["a"],
      avaliacao: { estado: "PENDENTE", totalConhecidoMgM2: 90, totalMgM2: 90, episodios: ["ep-antigo", "ep-atual"] } });
    expect(r.avaliacoes[0]?.avaliacao.pendencias).toContain("PENDENTE_LIMITE");
  });
  it("somenteTotal exige opt-in e não afirma segurança, mesmo se recebe um limite", () => {
    const r = projetarCumulativoClinico({ ...base, eventos: [evento("a")], somenteTotal: true, limites: [{ ...limite, maximo: 50 }] });
    expect(r.avaliacoes[0]).toMatchObject({ modo: "SOMENTE_TOTAL", avaliacao: { estado: "TOTAL_DOCUMENTADO", comparacao: "NAO_REALIZADA", totalMgM2: 90 } });
    expect(r.pendencias).toEqual([]);
    const parcial = projetarCumulativoClinico({ ...base, eventos: [evento("a", { ...dados(), historicoCompleto: false })], somenteTotal: true });
    expect(parcial.avaliacoes[0]?.avaliacao).toMatchObject({ estado: "PENDENTE", totalConhecidoMgM2: 90, totalMgM2: null });
  });
  it("usa limite injetado, rejeita ambiguidade e não mistura pendências de outra droga", () => {
    expect(projetarCumulativoClinico({ ...base, eventos: [evento("a")], limites: [{ ...limite, maximo: 80 }] }).avaliacoes[0]?.avaliacao.estado).toBe("AVISO");
    const ambigua = projetarCumulativoClinico({ ...base, eventos: [evento("a")], limites: [limite, { ...limite, versao: "2" }] });
    expect(ambigua.avaliacoes[0]?.avaliacao.totalConhecidoMgM2).toBe(90);
    expect(ambigua.avaliacoes[0]?.avaliacao.pendencias).toContain("LIMITE_AMBIGUO");
    const separado = projetarCumulativoClinico({ ...base, eventos: [evento("a")], programados: ["droga-sem-historico", "droga-sintetica"], limites: [limite] });
    expect(separado.avaliacoes[1]?.avaliacao.estado).toBe("ALARANJADO");
  });
  it("exposição é longitudinal do paciente, mantém origem de lote e consulta anteriores", () => {
    const antigo = evento("antigo", dados(), { tumorLotId: "outro-lote-do-mesmo-paciente", encounterId: "consulta-antiga" });
    const r = projetar([antigo]);
    expect(r.avaliacoes[0]?.avaliacao.totalMgM2).toBe(90);
    expect(r.avaliacoes[0]?.origens).toEqual([{ eventId: "antigo", tumorLotId: "outro-lote-do-mesmo-paciente", encounterId: "consulta-antiga" }]);
    expect(antigo.tumorLotId).toBe("outro-lote-do-mesmo-paciente");
  });
  it("RAW, outro paciente e futuro não participam; assinado participa", () => {
    const r = projetar([evento("a", dados(), { revisao: "ASSINADO" }),
      evento("raw", dados(), { revisao: "RAW" }), evento("outro", dados(), { patientId: "outro" }),
      evento("futuro", dados(), { criadoEm: "2026-10-11T12:00:00-03:00" })]);
    expect(r.avaliacoes[0]?.eventIds).toEqual(["a"]);
    expect(r.avaliacoes[0]?.avaliacao.totalMgM2).toBe(90);
  });
  it("não herda paciente ou droga do wrapper e não converte mg em mg/m2", () => {
    for (const valor of [
      { ...dados(), patientId: "outro" },
      { ...dados(), administracoes: [{ ...dados().administracoes[0]!, patientId: "outro" }] },
      { ...dados(), administracoes: [{ ...dados().administracoes[0]!, droga: "equivalente-não-autorizada" }] },
      { ...dados(), administracoes: [{ ...dados().administracoes[0]!, unidade: "mg" }] },
    ]) {
      const r = projetar([evento("invalido", valor)]);
      expect(r.invalidEventIds).toEqual(["invalido"]);
      expect(r.avaliacoes[0]?.avaliacao.totalConhecidoMgM2).toBeNull();
    }
    expect(ExposicaoCumulativaDados.safeParse({ ...dados(), dosePrescrita: 100 }).success).toBe(false);
  });
  it("snapshots divergentes não somam nem elegem o último; correção explícita resolve", () => {
    const a = evento("a"), b = evento("b", { ...dados(), administracoes: [dados().administracoes[0]!] });
    const r = projetar([a, b]);
    expect(r.avaliacoes[0]?.avaliacao.totalConhecidoMgM2).toBeNull();
    expect(r.avaliacoes[0]?.avaliacao.pendencias).toContain("EXPOSICAO_DIVERGENTE");
    const corrigida = projetar([a, { ...b, supersedesEventId: "a" }]);
    expect(corrigida.avaliacoes[0]?.avaliacao.totalMgM2).toBe(60);
    expect(corrigida.avaliacoes[0]?.eventIds).toEqual(["b"]);
  });
  it("fonte ausente não produz total e duplicata conflitante não é absorvida", () => {
    expect(projetar([evento("a", dados(), { fontes: [] })]).avaliacoes[0]?.avaliacao.pendencias).toContain("FONTE_EVENTO_AUSENTE");
    const admin = dados().administracoes[0]!;
    const conflito = projetar([evento("a", { ...dados(), administracoes: [admin, { ...admin, quantidadeEfetivaMgM2: 20 }] })]);
    expect(conflito.avaliacoes[0]?.avaliacao.totalConhecidoMgM2).toBeNull();
    expect(conflito.avaliacoes[0]?.avaliacao.pendencias).toContain("CONFLITO_ADMINISTRACAO:a");
  });
  it("evento inválido substituído não contamina correção válida; futuro não substitui passado", () => {
    const a = evento("a", "inválido"), b = evento("b", dados(), { supersedesEventId: "a" });
    expect(projetar([a, b]).invalidEventIds).toEqual([]);
    expect(projetar([a, b]).avaliacoes[0]?.avaliacao.totalMgM2).toBe(90);
    const futuro = { ...b, criadoEm: "2026-10-11T12:00:00-03:00" };
    expect(projetar([a, futuro]).invalidEventIds).toEqual(["a"]);
  });
  it("administração futura ou sem instante não entra no total conhecido nem herda criadoEm", () => {
    const a = dados().administracoes[0]!, b = dados().administracoes[1]!;
    for (const realizadaEm of [null, "2026-10-09", "2026-10-09T12:00:00", "2026-10-11T12:00:00-03:00"]) {
      const r = projetar([evento("a", { ...dados(), administracoes: [a, { ...b, realizadaEm }] })]);
      expect(r.avaliacoes[0]?.avaliacao).toMatchObject({ estado: "PENDENTE", totalConhecidoMgM2: 60, totalMgM2: null });
    }
    const { realizadaEm: _instante, ...semData } = b;
    expect(projetar([evento("a", { ...dados(), administracoes: [semData] })]).avaliacoes[0]?.avaliacao.totalConhecidoMgM2).toBeNull();
  });
  it("dose conhecida acima do limite mantém aviso, com pendência por parte do histórico excluída", () => {
    const a = { ...dados().administracoes[0]!, quantidadeEfetivaMgM2: 120 }, b = { ...dados().administracoes[1]!, realizadaEm: null };
    const r = projetarCumulativoClinico({ ...base, limites: [limite], eventos: [evento("a", { ...dados(), administracoes: [a, b] })] });
    expect(r.avaliacoes[0]?.avaliacao).toMatchObject({ estado: "AVISO", totalConhecidoMgM2: 120, totalMgM2: null });
    expect(r.avaliacoes[0]?.avaliacao.pendencias).toContain("ADMINISTRACAO_SEM_INSTANTE_EFETIVO:b");
  });
  it("datas divergentes da mesma administração não permitem contar só a versão passada", () => {
    const a = dados().administracoes[0]!;
    const r = projetar([evento("a", { ...dados(), administracoes: [a, { ...a, realizadaEm: "2026-10-11T12:00:00Z" }] })]);
    expect(r.avaliacoes[0]?.avaliacao.totalConhecidoMgM2).toBeNull();
    expect(r.avaliacoes[0]?.avaliacao.pendencias).toContain("CONFLITO_ADMINISTRACAO:a");
  });
});
