import { describe, expect, it } from "vitest";
import { reconciliar, type ResultadoPasso, type RegraCruzamento } from "../../../src/modules/reconciliador/index.js";
import type { Correlacao } from "../../../src/contracts/f1/correlacao.js";
import type { Retrato } from "../../../src/contracts/f1/retrato.js";
import type { AchadosSetor, SetorClinico } from "../../../src/contracts/f1/achadosSetor.js";

const regra = { id: "regra", versao: "1", hash: "hash" };
const c: Correlacao = { patientId: "p", encounterId: "e", tumorLotId: "t", operationId: "op", revisaoFatos: "r",
  regras: [regra], biblioteca: { id: "bib", versao: "1", hash: "hash-bib" }, proposta: { id: "prop", revisao: "1" } };
const ref = { eventId: "f", revisao: "1" };
const ref2 = { eventId: "f2", revisao: "1" };
const retrato: Retrato = { schema: "Retrato@1", patientId: "p", encounterId: "e", tumorLotId: "t", revisao: "r",
  versaoProjecao: "1", geradoEm: "2026-10-12T12:00:00.000Z", regras: [regra], biblioteca: c.biblioteca,
  fatos: [ref, ref2].map(r => ({ ref: r, tipo: "teste", campo: null, patientId: "p", encounterId: "e", tumorLotId: "t",
    escopo: "TUMOR", tempoClinico: null, tempoRegistro: "2026-10-12T12:00:00.000Z", fontes: [], dados: {} })),
  integridade: [], delta: { encounterAnteriorId: null, novos: [], substituidos: [] }, resumo: [] };
function saida(setor: SetorClinico = "LABORATORIO"): AchadosSetor {
  return { schema: "AchadosSetor@1", setor, correlacao: structuredClone(c), entradas: [ref],
    cobertura: { avaliados: 1, semRegraAprovada: 0 }, lacunas: [], achados: [{ id: "risco", estado: "VERMELHO",
      texto: "Risco registrado", fatos: [ref], regras: [regra], setores: [setor] }] };
}
const ok = (s = saida()): ResultadoPasso => ({ id: s.setor, resultado: "ok", saida: s, tentativas: 1 });
const run = (rs: ResultadoPasso[]) => reconciliar(rs, retrato, c, ["LABORATORIO", "INTERACOES"]);

describe("S5 reconciliação com evidência atual", () => {
  it.each([
    ["patientId", (x: Correlacao) => { x.patientId = "outro"; }],
    ["encounterId", (x: Correlacao) => { x.encounterId = "outro"; }],
    ["tumorLotId", (x: Correlacao) => { x.tumorLotId = null; }],
    ["operationId", (x: Correlacao) => { x.operationId = "outro"; }],
    ["revisaoFatos", (x: Correlacao) => { x.revisaoFatos = "N-1"; }],
    ["regra id", (x: Correlacao) => { x.regras[0]!.id = "outro"; }],
    ["regra versão", (x: Correlacao) => { x.regras[0]!.versao = "0"; }],
    ["regra hash", (x: Correlacao) => { x.regras[0]!.hash = "outro"; }],
    ["biblioteca id", (x: Correlacao) => { x.biblioteca.id = "outro"; }],
    ["biblioteca versão", (x: Correlacao) => { x.biblioteca.versao = "0"; }],
    ["biblioteca hash", (x: Correlacao) => { x.biblioteca.hash = "outro"; }],
    ["proposta id", (x: Correlacao) => { x.proposta!.id = "outro"; }],
    ["proposta revisão", (x: Correlacao) => { x.proposta!.revisao = "0"; }],
    ["proposta ausente", (x: Correlacao) => { x.proposta = null; }],
  ] as const)("exclui divergência %s", (_nome, mutar) => {
    const s = saida(); mutar(s.correlacao);
    const v = run([ok(s)]);
    expect(v.achados).toEqual([]); expect(v.cobertura.setoresAvaliados).toEqual([]);
    expect(v.lacunas.some(l => l.codigo === "DESATUALIZADO")).toBe(true);
  });
  it.each(["missing", "error", "unattempted", "timeout"] as const)("preserva risco parcial com falha %s", resultado => {
    const v = run([ok(), { id: "INTERACOES", resultado, motivo: "falha", tentativas: 1 }]);
    expect(v.achados).toHaveLength(1);
    expect(v.lacunas.some(l => l.codigo === `EXECUCAO_${resultado.toUpperCase()}`)).toBe(true);
    expect(v.cobertura.semRegraAprovada).toBeGreaterThan(0);
  });
  it("setor ausente nunca ganha avaliação ou verde", () => {
    const v = run([]); expect(v.achados).toEqual([]);
    expect(v.lacunas.filter(l => l.codigo === "SETOR_AUSENTE")).toHaveLength(2);
  });
  it("agrupa achado comum com as duas evidências sem esconder estado diferente", () => {
    const inter = saida("INTERACOES"); inter.achados[0]!.fatos = [ref2];
    const v = run([ok(), ok(inter), ok()]);
    expect(v.achados).toHaveLength(1); expect(v.achados[0]!.fatos).toHaveLength(2);
    expect(v.achados[0]!.setores).toEqual(["LABORATORIO", "INTERACOES"]);
    expect(v.cobertura.avaliados).toBe(2);
    inter.achados[0]!.estado = "PENDENTE";
    expect(run([ok(), ok(inter)]).achados).toHaveLength(2);
  });
  it("rejeita fatos inexistentes e revisão de fato antiga", () => {
    for (const r of [{ eventId: "inventado", revisao: "1" }, { eventId: "f", revisao: "0" }]) {
      const s = saida(); s.achados[0]!.fatos = [r];
      const v = run([ok(s)]); expect(v.achados).toEqual([]);
      expect(v.lacunas.some(l => l.codigo === "EVIDENCIA_INVALIDA")).toBe(true);
    }
  });
  it("rejeita regra fora da versão pinada", () => {
    const s = saida(); s.achados[0]!.regras = [{ ...regra, hash: "alterado" }];
    expect(run([ok(s)]).achados).toEqual([]);
  });
  it("não inventa combinação quando não foi injetada regra aprovada", () => {
    const v = run([ok(), ok(saida("INTERACOES"))]);
    expect(v.achados).toHaveLength(1);
  });
  it("cruza somente com cadeia de fatos e regra aprovada e preserva o retrato", () => {
    const cruzamento: RegraCruzamento = { aprovada: true, referencia: regra, setores: ["LABORATORIO", "INTERACOES"],
      avaliar: r => { r.fatos.length = 0; return [{ id: "cadeia", estado: "VERMELHO", texto: "Cadeia aprovada",
        fatos: [ref, ref2], regras: [regra], setores: ["LABORATORIO", "INTERACOES"] }]; } };
    const v = reconciliar([ok(), ok(saida("INTERACOES"))], retrato, c, ["LABORATORIO", "INTERACOES"], [cruzamento]);
    expect(v.achados.some(a => a.id === "cadeia")).toBe(true); expect(retrato.fatos).toHaveLength(2);
  });
  it("falha de cruzamento permanece lacuna", () => {
    const cruzamento: RegraCruzamento = { aprovada: true, referencia: regra, setores: ["LABORATORIO"], avaliar: () => { throw Error(); } };
    const v = reconciliar([ok()], retrato, c, ["LABORATORIO"], [cruzamento]);
    expect(v.achados).toHaveLength(1); expect(v.lacunas.some(l => l.codigo === "CRUZAMENTO_FALHOU")).toBe(true);
  });
  it("cruzamento não pode fabricar fato ou retirar a regra causal", () => {
    for (const falso of [true, false]) {
      const cruzamento: RegraCruzamento = { aprovada: true, referencia: regra, setores: ["LABORATORIO"],
        avaliar: () => [{ ...saida().achados[0]!, id: "fabricado",
          fatos: falso ? [{ eventId: "nao-existe", revisao: "1" }] : [ref], regras: falso ? [regra] : [] }] };
      const v = reconciliar([ok()], retrato, c, ["LABORATORIO"], [cruzamento]);
      expect(v.achados.some(a => a.id === "fabricado")).toBe(false);
      expect(v.lacunas.some(l => l.codigo === "EVIDENCIA_INVALIDA")).toBe(true);
    }
  });
  it("não usa evidência de outro paciente ou tumor", () => {
    for (const patch of [{ patientId: "outro" }, { tumorLotId: "outro" }]) {
      const r = structuredClone(retrato); Object.assign(r.fatos[0]!, patch);
      expect(reconciliar([ok()], r, c, ["LABORATORIO"]).achados).toEqual([]);
    }
  });
  it("regra de biblioteca antiga não é executada", () => {
    let executada = false;
    const cruzamento: RegraCruzamento = { aprovada: true, referencia: { ...regra, versao: "0" }, setores: ["LABORATORIO"],
      avaliar: () => { executada = true; return []; } };
    const v = reconciliar([ok()], retrato, c, ["LABORATORIO"], [cruzamento]);
    expect(executada).toBe(false); expect(v.lacunas.some(l => l.codigo === "SEM_REGRA_APROVADA")).toBe(true);
  });
  it("retrato N-1 invalida toda a visão", () => {
    const v = reconciliar([ok()], { ...retrato, revisao: "N-1" }, c, ["LABORATORIO"]);
    expect(v.achados).toEqual([]); expect(v.lacunas[0]!.codigo).toBe("DESATUALIZADO");
  });
  it("expõe cobertura declarada sem regra e saída inválida", () => {
    const s = saida(); s.cobertura.semRegraAprovada = 2;
    const v = run([ok(s), { id: "INTERACOES", resultado: "ok", saida: {}, tentativas: 1 }]);
    expect(v.lacunas.some(l => l.codigo === "SEM_REGRA_APROVADA")).toBe(true);
    expect(v.lacunas.some(l => l.codigo === "SAIDA_INVALIDA")).toBe(true);
  });
});
