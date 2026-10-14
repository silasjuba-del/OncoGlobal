import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { avaliarTetosExposicao, type AdministracaoExposicao, type EntradaExposicaoCumulativa } from "../../src/rules/cumulativoAlerta.js";
import { lerTetosCumulativos } from "../../src/rules/f0c/tetosCumulativos.js";
import { projetarCumulativoClinico } from "../../src/server/f0c/cumulativoClinico.js";
import type { ClinicalEvent } from "../../src/contracts/operacao.js";
import { fonteSintetica } from "../fixtures/triagem.js";

const tetos = lerTetosCumulativos(JSON.parse(readFileSync("corpus/rulesets/cumulativo-tetos.v1.json", "utf8")));
const doxo = tetos.filter((t) => t.droga === "doxorrubicina");
const bleo = tetos.filter((t) => t.droga === "bleomicina");

const admin = (droga: string, dose: number, unidade: AdministracaoExposicao["unidade"], adminId = "a"): AdministracaoExposicao => ({
  adminId, patientId: "p1", episodioId: "ep1", droga, status: "COMPLETA", quantidadeEfetivaMgM2: dose, unidade, fonte: `fonte-${adminId}`,
});
const entrada = (droga: string, administracoes: AdministracaoExposicao[], historicoCompleto = true): EntradaExposicaoCumulativa => ({
  patientId: "p1", droga, administracoes, historicoCompleto, fonteCompletude: historicoCompleto ? "histórico conferido" : null,
});

describe("D-F0C-08 tetos locais", () => {
  it("guarda só os sete tetos confirmados, cada droga no próprio número", () => {
    expect(tetos.map((t) => [t.droga, t.unidade, t.maximo, t.comparador])).toEqual([
      ["doxorrubicina", "mg/m2", 550, "GTE"],
      ["epirrubicina", "mg/m2", 900, "GTE"],
      ["mitoxantrona", "mg/m2", 140, "GTE"],
      ["bleomicina", "U", 400, "GTE"],
      ["bleomicina", "U/m2", 200, "GTE"],
      ["cisplatina", "mg/m2", 300, "GTE"],
      ["oxaliplatina", "mg/m2", 850, "GTE"],
    ]);
    expect(tetos.some((t) => t.maximo === 100 || t.maximo === 400 && t.droga === "doxorrubicina")).toBe(false);
  });

  it("chegar no teto acende alarme; abaixo, com histórico completo, não", () => {
    expect(avaliarTetosExposicao(entrada("doxorrubicina", [admin("doxorrubicina", 550, "mg/m2")]), doxo).estado).toBe("AVISO");
    expect(avaliarTetosExposicao(entrada("doxorrubicina", [admin("doxorrubicina", 549, "mg/m2")]), doxo).estado).toBe("SEM_AVISO");
    expect(avaliarTetosExposicao(entrada("doxorrubicina", [admin("doxorrubicina", 549, "mg/m2")], false), doxo).estado).toBe("ALARANJADO");
  });

  it("não soma epirrubicina nem lipossomal na doxorrubicina", () => {
    const agora = "2026-10-10T12:00:00-03:00";
    const fato = (droga: string, dose: number): ClinicalEvent => ({
      eventId: droga, operationId: `op-${droga}`, eventIndex: 0, patientId: "p1", tumorLotId: "l1", encounterId: "e1",
      tipo: "FATO", revisao: "CONFIRMADO", criadoEm: agora, criadoPor: { tipo: "SESSAO", id: "m" }, supersedesEventId: null,
      fontes: [fonteSintetica(droga)],
      payload: { data: { campo: "exposicaoCumulativa", valor: {
        patientId: "p1", droga, historicoCompleto: true, fonteCompletude: "histórico conferido",
        administracoes: [{ adminId: droga, patientId: "p1", episodioId: "ep", droga, status: "COMPLETA", quantidadeEfetivaMgM2: dose, unidade: "mg/m2", fonte: droga, realizadaEm: "2026-10-01T12:00:00-03:00" }],
      } } },
    });
    const r = projetarCumulativoClinico({
      eventos: [fato("doxorrubicina", 500), fato("epirrubicina", 800), fato("doxorrubicina lipossomal", 600)],
      patientId: "p1", tumorLotId: "l1", encounterId: "e1", agora,
      programados: ["Doxorrubicina", "Epirrubicina", "doxorrubicina lipossomal"], limites: tetos,
    });
    const porDroga = Object.fromEntries(r.avaliacoes.map((a) => [a.droga, a.avaliacao.estado]));
    expect(porDroga).toMatchObject({ Doxorrubicina: "SEM_AVISO", Epirrubicina: "SEM_AVISO", "doxorrubicina lipossomal": "PENDENTE" });
    expect(r.avaliacoes.find((a) => a.droga === "Doxorrubicina")?.avaliacao.totalMgM2).toBe(500);
  });

  it("bleomicina alarma em 400 U ou em 200 U/m² e não cria corte de 100 U", () => {
    const completa = (u: number, um2: number) => entrada("bleomicina", [
      admin("bleomicina", u, "U", "u"), admin("bleomicina", um2, "U/m2", "um2"),
    ]);
    expect(avaliarTetosExposicao(completa(399, 199), bleo).estado).toBe("SEM_AVISO");
    expect(avaliarTetosExposicao(completa(400, 10), bleo).estado).toBe("AVISO");
    expect(avaliarTetosExposicao(completa(10, 200), bleo).estado).toBe("AVISO");
    expect(avaliarTetosExposicao(entrada("bleomicina", [admin("bleomicina", 100, "U")]), bleo).estado).toBe("PENDENTE");
  });
});
