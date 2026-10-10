// W11-H8 · Gates de coerência da APAC (antiglosa). Dados 100% sintéticos.
// Um caso positivo (VERMELHO ou PENDENTE) e um negativo por gate, mais um laudo coerente sem nenhum alerta.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { antiglosa, type ContextoAntiglosa, type RegraCidSexo } from "../../src/apac/antiglosa.js";
import { montarTabelaSigtap } from "../../src/apac/sigtap.js";
import { apac, CAIXAS, COD_QT, COD_ZERO, proc } from "../apac-w10/helpers.js";

const regrasCidSexo = (JSON.parse(
  readFileSync(resolve(process.cwd(), "corpus/rulesets/apac-cid-sexo.v1.json"), "utf8"),
) as { regras: RegraCidSexo[] }).regras;

const sigtap = { "2026-09": montarTabelaSigtap("2026-09", [proc(), proc({ codigo: COD_ZERO, nome: "CONSULTA SINTETICA" })]) };
const ctx = (o: Partial<ContextoAntiglosa> = {}): ContextoAntiglosa => ({
  hoje: "2026-09-11", sigtap, caixas: CAIXAS, cnesConfigurado: "2605473", ...o,
});
const ctxGates = (o: Partial<ContextoAntiglosa> = {}): ContextoAntiglosa =>
  ctx({ regrasCidSexo, codigosSigtapLocal: new Set([COD_QT]), esquemaVigente: "Carboplatina + paclitaxel AUC 2", ...o });
const achadosDe = (v: ReturnType<typeof antiglosa>, regraId: string) => v.achados.filter((a) => a.regraId === regraId);

const TRAT_DISTINTOS = [
  { esquema: "Carboplatina + paclitaxel ciclo 1", dataInicio: "2026-01-10" },
  { esquema: "Carboplatina + paclitaxel ciclo 2", dataInicio: "2026-01-24" },
];

describe("W11-H8 · gate 1 · CID principal x sexo", () => {
  it("CID de mama em paciente masculino com tumor de próstata é VERMELHO", () => {
    const v = antiglosa(apac("g1a", { cidPrincipal: "C50.4", pacienteSexo: "M", localizacaoTumorPrimario: "Próstata" }), ctxGates());
    const a = achadosDe(v, "AG-13");
    expect(a).toHaveLength(1);
    expect(a[0]).toMatchObject({ severidade: "BLOQUEIA_EXPORTACAO", caixaNumero: 100 + 1 });
    expect(a[0]!.motivo).toMatch(/^VERMELHO: /);
    expect(a[0]!.motivo).toContain("próstata");
    expect(v.exportavel).toBe(false);
  });
  it("CID de próstata em paciente masculino não gera AG-13", () => {
    const v = antiglosa(apac("g1b", { cidPrincipal: "C61", pacienteSexo: "M" }), ctxGates());
    expect(achadosDe(v, "AG-13")).toEqual([]);
  });
  it("CID de próstata (C61) em paciente feminina é VERMELHO", () => {
    const v = antiglosa(apac("g1c", { cidPrincipal: "C61", pacienteSexo: "F" }), ctxGates());
    expect(achadosDe(v, "AG-13")[0]?.severidade).toBe("BLOQUEIA_EXPORTACAO");
  });
  it("sem tabela CID x sexo injetada o gate fica desligado", () => {
    const v = antiglosa(apac("g1d", { cidPrincipal: "C50.4", pacienteSexo: "M" }), ctx({ regrasCidSexo: null }));
    expect(achadosDe(v, "AG-13")).toEqual([]);
  });
});

describe("W11-H8 · gate 2 · CID principal (37) x CID da topografia (57)", () => {
  it("CIDs diferentes são VERMELHO", () => {
    const v = antiglosa(apac("g2a", { cidTopografia: "C50.4" }), ctxGates());
    const a = achadosDe(v, "AG-14");
    expect(a).toHaveLength(1);
    expect(a[0]).toMatchObject({ severidade: "BLOQUEIA_EXPORTACAO", caixaNumero: 101 });
  });
  it("CIDs iguais ignorando ponto não geram AG-14", () => {
    const v = antiglosa(apac("g2b", { cidTopografia: "C161" }), ctxGates());
    expect(achadosDe(v, "AG-14")).toEqual([]);
  });
});

describe("W11-H8 · gate 3 · RT preenchida sem RT solicitada", () => {
  it("bloco de RT com campo preenchido e sem RT solicitada é VERMELHO", () => {
    const v = antiglosa(apac("g3a", { rtFinalidade: "Paliativa", rtCidTopografico: "C50.4" }), ctxGates());
    const a = achadosDe(v, "AG-15");
    expect(a).toHaveLength(1);
    expect(a[0]!.motivo).toContain("RT preenchida sem RT solicitada");
    expect(a[0]!.severidade).toBe("BLOQUEIA_EXPORTACAO");
  });
  it("bloco vazio ou RT solicitada não geram AG-15", () => {
    expect(achadosDe(antiglosa(apac("g3b", {}), ctxGates()), "AG-15")).toEqual([]);
    const solicitada = apac("g3c", { rtFinalidade: "Paliativa", rtCidTopografico: "C50.4", radioterapiaSolicitada: true });
    expect(achadosDe(antiglosa(solicitada, ctxGates()), "AG-15")).toEqual([]);
  });
});

describe("W11-H8 · gate 4 · ciclos lançados como tratamentos", () => {
  it("três ciclos do mesmo esquema com a mesma data é VERMELHO", () => {
    const iguais = ["ciclo 1", "ciclo 2", "ciclo 3"].map((c) => ({ esquema: `Carboplatina + paclitaxel ${c}`, dataInicio: "2026-01-10" }));
    const v = antiglosa(apac("g4a", { historicoQuimioterapia: iguais }), ctxGates());
    const a = achadosDe(v, "AG-16");
    expect(a).toHaveLength(1);
    expect(a[0]!.motivo).toContain("ciclos lançados como tratamentos");
    expect(a[0]!.severidade).toBe("BLOQUEIA_EXPORTACAO");
  });
  it("tratamentos anteriores com datas distintas não geram AG-16", () => {
    const v = antiglosa(apac("g4b", { historicoQuimioterapia: TRAT_DISTINTOS }), ctxGates());
    expect(achadosDe(v, "AG-16")).toEqual([]);
  });
});

describe("W11-H8 · gate 5 · SIGTAP do principal fora da tabela local (PENDENTE)", () => {
  it("código ausente da tabela local gera PENDENTE (alerta, não bloqueia)", () => {
    const v = antiglosa(apac("g5a", { procedimentoPrincipal: COD_ZERO }), ctxGates());
    const a = achadosDe(v, "AG-17");
    expect(a).toHaveLength(1);
    expect(a[0]).toMatchObject({ severidade: "ALERTA" });
    expect(a[0]!.motivo).toMatch(/^PENDENTE: .*conferir código na tabela vigente/);
    expect(v.exportavel).toBe(true);
  });
  it("código presente na tabela local não gera AG-17", () => {
    const v = antiglosa(apac("g5b", { procedimentoPrincipal: COD_QT }), ctxGates({ codigosSigtapLocal: new Set([COD_QT, COD_ZERO]) }));
    expect(achadosDe(v, "AG-17")).toEqual([]);
  });
});

describe("W11-H8 · gate 6 · esquema da APAC x ficha vigente", () => {
  it("esquema diferente da ficha vigente é VERMELHO", () => {
    const v = antiglosa(apac("g6a", { qtEsquema: "Carboplatina + paclitaxel AUC 1,5" }), ctxGates());
    const a = achadosDe(v, "AG-18");
    expect(a).toHaveLength(1);
    expect(a[0]!.severidade).toBe("BLOQUEIA_EXPORTACAO");
    expect(a[0]!.motivo).toContain("AUC 1,5");
  });
  it("esquema igual à ficha (sem diferença de caixa e acento) não gera AG-18", () => {
    const v = antiglosa(apac("g6b", { qtEsquema: "carboplatina + PACLITAXEL  AUC 2" }), ctxGates());
    expect(achadosDe(v, "AG-18")).toEqual([]);
  });
});

describe("W11-H8 · laudo coerente", () => {
  it("laudo coerente com todos os gates ativos não tem nenhum alerta", () => {
    const coerente = apac("h8-ok", {
      pacienteSexo: "M", cidPrincipal: "C16.1", cidTopografia: "C16.1", localizacaoTumorPrimario: "Estômago",
      radioterapiaSolicitada: false,
      historicoQuimioterapia: TRAT_DISTINTOS, qtEsquema: "Carboplatina + paclitaxel AUC 2",
      procedimentoPrincipal: COD_QT,
    });
    const v = antiglosa(coerente, ctxGates());
    expect(v.achados).toEqual([]);
    expect(v.exportavel).toBe(true);
  });
});
