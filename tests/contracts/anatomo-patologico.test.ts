import { describe, expect, it } from "vitest";
import { validarRetratoTransversal } from "../../src/contracts/index.js";

const NI = { estado: "NAO_INFORMADO", valor: null, origem: null };
const laudo = { tipo: "LAUDO", documentoId: "doc-1", dataDocumento: "2026-05-01", trecho: "Gleason 3+4" };
const nucleo = Object.fromEntries([
  "histologia", "lateralidade", "topografia", "grauHistologico", "cTNM", "pTNM", "ypTNM", "estadio", "tamanhoMm", "profundidade", "linfonodos",
  "metastase", "invasaoAngiolinfatica", "invasaoPerineural", "margem", "necrose", "indiceMitotico", "ki67Pct",
  "neoadjuvancia", "respostaNeoadjuvancia", "progressaoNaVigencia",
].map((k) => [k, NI]));
const prostata = { tumor: "PROSTATA", gleason: NI, isup: NI, psaNgMl: NI, fragmentosPositivos: NI };

describe("W12-F2 contrato anatomopatológico (tech lead)", () => {
  it("aceita retrato todo 'não informado' sem inventar valor", () => {
    const r = validarRetratoTransversal({ pacienteRef: "pt-91", tumorIndice: true, nucleo, extensao: prostata });
    expect(r.ok).toBe(true);
  });
  it("VALOR exige origem; NAO_INFORMADO não aceita valor", () => {
    const semOrigem = { ...prostata, isup: { estado: "VALOR", valor: 2, origem: null } };
    expect(validarRetratoTransversal({ pacienteRef: "p", tumorIndice: true, nucleo, extensao: semOrigem }).ok).toBe(false);
    const comValor = { ...prostata, isup: { estado: "NAO_INFORMADO", valor: 2, origem: null } };
    expect(validarRetratoTransversal({ pacienteRef: "p", tumorIndice: true, nucleo, extensao: comValor }).ok).toBe(false);
  });
  it("rejeita valor fora do domínio e campo ausente", () => {
    const fora = { ...prostata, isup: { estado: "VALOR", valor: 7, origem: laudo } };
    expect(validarRetratoTransversal({ pacienteRef: "p", tumorIndice: true, nucleo, extensao: fora }).ok).toBe(false);
    const { necrose: _n, ...semCampo } = nucleo;
    expect(validarRetratoTransversal({ pacienteRef: "p", tumorIndice: true, nucleo: semCampo, extensao: prostata }).ok).toBe(false);
  });
  it("conflito exige ≥2 candidatos e nenhum valor eleito; origem do encaminhador é aceita", () => {
    const enc = { tipo: "ENCAMINHADOR", documentoId: "doc-2", dataDocumento: null, trecho: "cT2N1M0" };
    const conflito = { estado: "CONFLITO", valor: null, origem: null, candidatos: [
      { valor: "cT2N1M0", origem: enc }, { valor: "cT2N0M0", origem: laudo }] };
    const ok = validarRetratoTransversal({ pacienteRef: "p", tumorIndice: true, nucleo: { ...nucleo, cTNM: conflito }, extensao: prostata });
    expect(ok.ok).toBe(true);
    const eleito = { ...conflito, valor: "cT2N1M0" };
    expect(validarRetratoTransversal({ pacienteRef: "p", tumorIndice: true, nucleo: { ...nucleo, cTNM: eleito }, extensao: prostata }).ok).toBe(false);
  });
});

describe("W12-F2 ajustes da revisão (PLN-037)", () => {
  const base = { pacienteRef: "p", tumorIndice: true, extensao: prostata };
  it("CONFLITO com origem preenchida é rejeitado", () => {
    const c = { estado: "CONFLITO", valor: null, origem: laudo, candidatos: [{ valor: "DIREITA", origem: laudo }, { valor: "ESQUERDA", origem: laudo }] };
    expect(validarRetratoTransversal({ ...base, nucleo: { ...nucleo, lateralidade: c } }).ok).toBe(false);
  });
  it("confiança BAIXA em NAO_INFORMADO é rejeitada", () => {
    expect(validarRetratoTransversal({ ...base, nucleo: { ...nucleo, topografia: { ...NI, confianca: "BAIXA" } } }).ok).toBe(false);
  });
});
