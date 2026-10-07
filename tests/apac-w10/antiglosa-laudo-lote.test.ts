import { describe, expect, it } from "vitest";
import { antiglosa, type ContextoAntiglosa } from "../../src/apac/antiglosa.js";
import { preencherLaudo } from "../../src/apac/laudo.js";
import { exportadorSia, montarLotesDoDia } from "../../src/apac/lote.js";
import { montarTabelaSigtap } from "../../src/apac/sigtap.js";
import { apac, CAIXAS, CNS_OK, CNS_OK2, CNS_RUIM, COD_QT, proc } from "./helpers.js";

const sigtap = { "2026-09": montarTabelaSigtap("2026-09", [proc()]) };
const ctx = (o: Partial<ContextoAntiglosa> = {}): ContextoAntiglosa => ({
  hoje: "2026-09-11", sigtap, caixas: CAIXAS, cnesConfigurado: "2605473", ...o,
});
const regras = (v: ReturnType<typeof antiglosa>) => v.achados.map((a) => a.regraId);

describe("W10-INT-APAC-03 · antiglosa", () => {
  it("APAC limpa é exportável e sem achados", () => {
    const v = antiglosa(apac("a1"), ctx());
    expect(v.achados).toEqual([]);
    expect(v.exportavel).toBe(true);
  });
  it("procedimento inexistente e competência sem tabela bloqueiam", () => {
    expect(regras(antiglosa(apac("a", { procedimentoPrincipal: "0000000001" }), ctx()))).toContain("AG-01");
    const v = antiglosa(apac("a", {}, { competencia: "2026-10" }), ctx());
    expect(v.achados.find((a) => a.regraId === "AG-01")?.motivo).toContain("Sem tabela");
    expect(v.exportavel).toBe(false);
  });
  it("CID incompatível bloqueia com caixa e fonte; relacionamento ausente é só alerta", () => {
    const v = antiglosa(apac("a", { cidPrincipal: "C50.9" }), ctx());
    const a = v.achados.find((x) => x.regraId === "AG-02")!;
    expect(a).toMatchObject({ severidade: "BLOQUEIA_EXPORTACAO", caixaNumero: 101 });
    expect(a.fonte).toContain("SIGTAP");
    const t = { "2026-09": montarTabelaSigtap("2026-09", [proc({ cidsCompativeis: null })]) };
    const v2 = antiglosa(apac("a", { cidPrincipal: "C50.9" }), ctx({ sigtap: t }));
    expect(v2.achados.find((x) => x.regraId === "AG-02")?.severidade).toBe("ALERTA");
    expect(v2.exportavel).toBe(true);
  });
  it("idade e sexo do procedimento", () => {
    const t = { "2026-09": montarTabelaSigtap("2026-09", [proc({ sexo: "F" })]) };
    expect(regras(antiglosa(apac("a"), ctx({ sigtap: t })))).toContain("AG-04");
    expect(regras(antiglosa(apac("a", { pacienteNascimento: "2020-01-01" }), ctx()))).toContain("AG-03");
  });
  it("finalidade: escolha do médico, lista por modalidade, nunca deduzida", () => {
    expect(regras(antiglosa(apac("a", { finalidadeApac: "Radical" }), ctx()))).toContain("AG-05"); // RT em QT
    expect(antiglosa(apac("a", { finalidadeApac: "Para Controle Temporário" }), ctx()).achados.map((x) => x.regraId)).not.toContain("AG-05");
    const sem = antiglosa(apac("a", { finalidadeApac: undefined }), ctx());
    expect(sem.achados.find((x) => x.regraId === "AG-08" && x.motivo.includes("finalidadeApac"))).toBeTruthy();
    expect(regras(antiglosa(apac("a", { finalidadeApac: "Adjuvante" }), ctx()))).toEqual(["AG-12"]); // só alerta
  });
  it("finalidade com revisão pendente do médico conta como PENDENTE", () => {
    const f = { valor: "PALIATIVA", campo: "PRESENTE", revisao: "REVISAR" };
    expect(regras(antiglosa(apac("a", { finalidadeApac: f }), ctx()))).toContain("AG-08");
  });
  it("CNS inválido bloqueia (paciente e solicitante)", () => {
    const v = antiglosa(apac("a", { pacienteCns: CNS_RUIM, solicitanteCns: "123" }), ctx());
    expect(v.achados.filter((a) => a.regraId === "AG-06")).toHaveLength(2);
  });
  it("CNES: formato bloqueia, diferente do configurado alerta", () => {
    expect(antiglosa(apac("a", { cnesSolicitante: "123" }), ctx()).exportavel).toBe(false);
    const v = antiglosa(apac("a", { cnesSolicitante: "1234567" }), ctx());
    expect(v.achados.map((a) => a.severidade)).toEqual(["ALERTA"]);
    expect(v.exportavel).toBe(true);
  });
  it("campos obrigatórios ausentes = PENDENTE bloqueia exportação, não inventa", () => {
    const v = antiglosa(apac("a", { nomeMae: "", justificativa: undefined }), ctx());
    expect(v.achados.filter((a) => a.regraId === "AG-08")).toHaveLength(2);
    expect(v.exportavel).toBe(false);
  });
  it("competência diferente do lote bloqueia", () => {
    expect(regras(antiglosa(apac("a"), ctx({ competenciaLote: "2026-10" })))).toContain("AG-09");
  });
  it("duplicidade no lote é alerta", () => {
    const a = apac("a"), b = apac("b");
    expect(regras(antiglosa(a, ctx({ apacsDoLote: [a, b] })))).toContain("AG-10");
    expect(antiglosa(a, ctx({ apacsDoLote: [a, b] })).exportavel).toBe(true);
  });
  it("datas: D85 alerta (nunca atrasado), D90 vencida bloqueia, D84 silencioso", () => {
    const g = "2026-06-01";
    const em = (hoje: string) => antiglosa(apac("a", {}, { dataGeracaoApp: g }), ctx({ hoje }));
    expect(em("2026-08-24").achados).toEqual([]); // D84
    expect(em("2026-08-25").achados[0]).toMatchObject({ regraId: "AG-11", severidade: "ALERTA" }); // D85
    expect(em("2026-08-30").exportavel).toBe(false); // D90
    expect(regras(antiglosa(apac("a", { pacienteNascimento: "2027-01-01" }), ctx()))).toContain("AG-11");
  });
});

describe("W10-INT-APAC-04 · laudo", () => {
  it("preenche SOLICITAÇÃO, deixa AUTORIZAÇÃO em branco e marca PENDENTE", () => {
    const l = preencherLaudo(apac("a", { nomeMae: undefined, observacoes: undefined }), sigtap);
    expect(l.solicitacao["pacienteNome"]).toEqual({ estado: "PREENCHIDO", valor: "Paciente Teste 01" });
    expect(l.solicitacao["nomeMae"]?.estado).toBe("PENDENTE");
    expect(l.procedimentoPrincipalNome.estado).toBe("PREENCHIDO");
    expect(l.pendentes).toContain("NOME DA MÃE");
    expect(Object.values(l.autorizacao).every((v) => v === "EM_BRANCO")).toBe(true);
    expect(l.assinaturaSolicitante).toBe("EM_BRANCO");
  });
  it("não usa dado não confirmado e não deduz finalidade", () => {
    const l = preencherLaudo(apac("a", { pacienteNome: { valor: "X", campo: "PRESENTE", revisao: "REVISAR" }, finalidadeApac: undefined, intencao: "PALIATIVA" }), sigtap);
    expect(l.solicitacao["pacienteNome"]?.estado).toBe("PENDENTE");
    expect(l.finalidadeApac.estado).toBe("PENDENTE");
  });
  it("sem tabela da competência, nome do procedimento fica PENDENTE", () => {
    expect(preencherLaudo(apac("a", {}, { competencia: "2026-10" }), sigtap).procedimentoPrincipalNome.estado).toBe("PENDENTE");
  });
});

describe("W10-INT-APAC-05 · lote do dia", () => {
  it("agrupa por competência, valida cada APAC e só exporta se todas passam", () => {
    const sig = { ...sigtap, "2026-10": montarTabelaSigtap("2026-10", [proc()]) };
    const a = apac("a"), b = apac("b", { pacienteCns: CNS_OK2, pacienteNome: "Paciente Teste 02" });
    const c = apac("c", {}, { competencia: "2026-10" });
    const ruim = apac("r", { pacienteCns: CNS_RUIM });
    const { lotes, foraDoLote } = montarLotesDoDia([a, b, c, ruim], { hoje: "2026-09-11", sigtap: sig, caixas: CAIXAS, cnesConfigurado: "2605473" });
    expect(foraDoLote).toEqual([]);
    expect(lotes.map((l) => [l.competencia, l.itens.length, l.exportavel])).toEqual([["2026-09", 3, false], ["2026-10", 1, true]]);
    expect(lotes[0]!.itens.every((i) => i.veredito.competencia === "2026-09")).toBe(true);
    expect(CNS_OK).not.toBe(CNS_OK2);
    expect(COD_QT).toBe("0304020044");
  });
  it("exportação SIA está BLOQUEADO_DEPENDENCIA com motivo", () => {
    const r = exportadorSia.exportar({ competencia: "2026-09", itens: [], exportavel: true });
    expect(r.status).toBe("BLOQUEADO_DEPENDENCIA");
    expect(r.motivo).toContain("Layout_Exportacao_APAC.pdf");
  });
});
