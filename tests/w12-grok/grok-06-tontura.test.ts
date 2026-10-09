// W12-GROK-06 · D-W9-76: tontura não corta nem pesa no ECOG.
// Exceção: vertigem de início novo, sem histórico, alerta SNC e não bloqueia.
// Histórico ausente fica PENDENTE e não vira "novo". Campo ausente nunca fica VERDE.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { avaliarTriagem } from "../../src/rules/triagem.js";
import { alertarVertigemNova, lerAlertaVertigem } from "../../src/rules/tontura.js";
import { ausente, ctxBase, triagemBase } from "../fixtures/triagem.js";
import { salaoRuleset } from "../fixtures/rulesets.js";

const json = JSON.parse(readFileSync("corpus/rulesets/salao-triagem.v1.json", "utf8")) as {
  cortes: { ecog2ComTonturaCorta: boolean };
  vertigem: { alertaSnc: string; bloqueiaSalvar: boolean };
};
const frase = lerAlertaVertigem(json);
const PROIBIDO = /\b(liberado|aprovado|apto)\b/i;

const CAMPOS = [
  "pas", "fc", "spo2", "tempDecimos", "hbDgDl", "anc", "plq", "coletaHemograma", "ecog", "grauCtcae",
] as const;

describe("W12-GROK-06 tontura fora do corte", () => {
  it("a chave ecog2ComTonturaCorta permanece no JSON e o código não emite naoCorte.ecog.tontura", () => {
    expect(json.cortes.ecog2ComTonturaCorta).toBe(false);
    const r = avaliarTriagem(triagemBase({ ecog: { ...triagemBase().ecog, valor: 2 }, tontura: true }), ctxBase(), salaoRuleset);
    expect(r.cortes.map((m) => m.codigo)).not.toContain("corte.ecog.tontura");
    expect(r.naoCortes.map((m) => m.codigo)).not.toContain("naoCorte.ecog.tontura");
    expect(r.emergencia).toBe(false);
    expect(JSON.stringify(r)).not.toMatch(PROIBIDO);
  });

  it("tontura null → PENDENTE na fila, nunca ausência", () => {
    const r = avaliarTriagem(triagemBase({ tontura: null }), ctxBase(), salaoRuleset);
    expect(r.destino).toBe("FILA_MEDICO");
    expect(r.pendentes.map((m) => m.codigo)).toContain("pendente.tontura");
    expect(r.cortes).toEqual([]);
    expect(JSON.stringify(r)).not.toMatch(/\bVERDE\b/);
    expect(JSON.stringify(r)).not.toMatch(PROIBIDO);
  });

  it.each(CAMPOS)("%s ausente → PENDENTE, nunca VERDE", (campo) => {
    const base = triagemBase();
    const campoAusente = ausente<never>();
    const r = avaliarTriagem(triagemBase({ [campo]: campoAusente }), ctxBase(), salaoRuleset);
    expect(campoAusente.estado).toBe("PENDENTE");
    expect(campoAusente.estado).not.toBe(base[campo].estado);
    expect(r.pendentes.map((m) => m.codigo)).toContain(`pendente.${campo}`);
    expect(r.destino).toBe("FILA_MEDICO");
    expect(JSON.stringify(r)).not.toMatch(/\bVERDE\b/);
    expect(JSON.stringify(r)).not.toMatch(PROIBIDO);
  });

  it("idade ausente → PENDENTE, nunca zero nem VERDE", () => {
    const r = avaliarTriagem(triagemBase({ idadeAnos: null }), ctxBase(), salaoRuleset);
    expect(r.destino).toBe("FILA_MEDICO");
    expect(r.pendentes.map((m) => m.codigo)).toContain("pendente.idadeAnos");
    expect(JSON.stringify(r)).not.toMatch(/\bVERDE\b/);
  });
});

describe("W12-GROK-06 vertigem nova", () => {
  it("início novo sem histórico anterior alerta SNC e não bloqueia", () => {
    expect(frase).toBe("investigar SNC (metástase cerebral/cerebelar)");
    expect(json.vertigem.bloqueiaSalvar).toBe(false);
    const r = alertarVertigemNova({ tontura: true, historicoAnterior: false, inicioNovo: true }, frase);
    expect(r.estado).toBe("ALERTA");
    expect(r.classificacao).toBe("NOVO");
    expect(r.alertas.map((a) => a.texto)).toEqual([frase]);
    expect(r.bloqueiaSalvar).toBe(false);
    expect(r.alertas.every((a) => a.bloqueiaSalvar === false)).toBe(true);
    expect(JSON.stringify(r)).not.toMatch(PROIBIDO);
  });

  it("histórico ausente fica PENDENTE e a classificação não vira NOVO", () => {
    const semHistorico = alertarVertigemNova({ tontura: true, historicoAnterior: null, inicioNovo: true }, frase);
    expect(semHistorico.estado).toBe("PENDENTE");
    expect(semHistorico.classificacao).toBe("PENDENTE");
    expect(semHistorico.alertas).toEqual([]);
    expect(semHistorico.pendencias.map((p) => p.codigo)).toContain("pendente.historico");

    const semInicio = alertarVertigemNova({ tontura: true, historicoAnterior: false, inicioNovo: null }, frase);
    expect(semInicio.classificacao).not.toBe("NOVO");
    expect(semInicio.alertas).toEqual([]);
    expect(semInicio.pendencias.map((p) => p.codigo)).toContain("pendente.inicio");
  });

  it("tontura isolada ou com histórico não alerta", () => {
    const isolada = alertarVertigemNova({ tontura: true, historicoAnterior: true, inicioNovo: true }, frase);
    expect(isolada.estado).toBe("SEM_ALERTA");
    expect(isolada.classificacao).toBe("REGISTRO");
    expect(isolada.alertas).toEqual([]);

    const ausenteTontura = alertarVertigemNova({ tontura: false, historicoAnterior: null, inicioNovo: null }, frase);
    expect(ausenteTontura.estado).toBe("SEM_ALERTA");
    expect(ausenteTontura.classificacao).toBe("REGISTRO");
    expect(JSON.stringify(ausenteTontura)).not.toMatch(PROIBIDO);
  });

  it("tontura desconhecida não vira ausência nem NOVO", () => {
    const r = alertarVertigemNova({ tontura: null, historicoAnterior: false, inicioNovo: true }, frase);
    expect(r.estado).toBe("PENDENTE");
    expect(r.classificacao).toBe("PENDENTE");
    expect(r.alertas).toEqual([]);
    expect(r.pendencias.map((p) => p.codigo)).toEqual(["pendente.tontura"]);
  });
});
