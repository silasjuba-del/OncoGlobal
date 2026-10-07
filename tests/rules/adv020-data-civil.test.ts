import { describe, expect, it } from "vitest";
import { dataCivilNoOffset, ultimaAdministracaoQtEfetiva } from "../../src/rules/intervaloQt.js";
import { diferencaDiasCivis } from "../../src/rules/datas.js";
import { avisoIntervaloPosQt } from "../../src/rules/index.js";
import { eventoQt } from "../w3/fixtures.js";
import { prazosRuleset } from "../fixtures/rulesets.js";

const offsetServico = "-03:00";
const ultima = (instante: string, offset = offsetServico) =>
  ultimaAdministracaoQtEfetiva([eventoQt("admin-sintetica", instante)], offset);

describe("ADV-020 · instante e offset obrigatorio antes da data civil", () => {
  it.each([
    "2026-10-06T02:30:00Z",
    "2026-10-05T23:30:00-03:00",
    "2026-10-05T20:30:00-06:00",
    "2026-10-06T04:30:00+02:00",
  ])("o mesmo instante %s tem data 05 no servico", (instante) => {
    expect(dataCivilNoOffset(instante, offsetServico)).toBe("2026-10-05");
    const r = ultima(instante);
    expect(r.data).toBe("2026-10-05");
    expect(r.inputs_used).toContain("offset_servico");
    expect(avisoIntervaloPosQt(r.data, "2026-11-04", "CIRURGIA", prazosRuleset))
      .toMatchObject({ dias: 30, estado: "VERDE" });
    expect(avisoIntervaloPosQt(r.data, "2026-11-03", "RT_SEQUENCIAL", prazosRuleset))
      .toMatchObject({ dias: 29, estado: "VERMELHO" });
  });

  it("offset injetado altera a data do servico, sem fixar -03 no helper", () => {
    const instante = "2026-10-05T23:30:00Z";
    expect(ultima(instante, "-03:00").data).toBe("2026-10-05");
    expect(ultima(instante, "+02:00").data).toBe("2026-10-06");
    expect(ultima(instante, "+00:00").data).toBe("2026-10-05");
  });

  it.each([
    ["2026-01-01T02:59:59Z", "2025-12-31"],
    ["2026-01-01T03:00:00Z", "2026-01-01"],
    ["2024-03-01T02:59:59Z", "2024-02-29"],
  ])("borda de dia/ano/bissexto %s converte para %s", (instante, esperado) => {
    expect(dataCivilNoOffset(instante, offsetServico)).toBe(esperado);
  });

  it.each(["", "UTC", "Z", "-3:00", "-03:60", "+24:00"])
    ("offset invalido %s fica indisponivel e consumer PENDENTE", (offset) => {
      expect(dataCivilNoOffset("2026-10-06T02:30:00Z", offset)).toBeNull();
      const r = ultima("2026-10-06T02:30:00Z", offset);
      expect(r).toMatchObject({ data: null, adminId: null, inputs_missing: ["offset_servico"] });
      expect(avisoIntervaloPosQt(r.data, "2026-11-04", "CIRURGIA", prazosRuleset).estado).toBe("PENDENTE");
    });

  it("omissao ou antiga API com mapa no segundo argumento nao usa UTC silencioso", () => {
    const eventos = [eventoQt("admin-sintetica", "2026-10-06T02:30:00Z")];
    // @ts-expect-error offset e obrigatorio inclusive para callers TS.
    expect(ultimaAdministracaoQtEfetiva(eventos)).toMatchObject({ data: null, inputs_missing: ["offset_servico"] });
    // @ts-expect-error o antigo mapa nao substitui o offset do servico.
    expect(ultimaAdministracaoQtEfetiva(eventos, { "ciclo-01": "QT" })).toMatchObject({ data: null, inputs_missing: ["offset_servico"] });
  });

  it.each(["2026-02-30T02:30:00Z", "invalido", "2026-10-05", "2026-10-05T23:30:00"])
    ("instante invalido ou sem offset %s nao inventa data civil", (instante) => {
      expect(dataCivilNoOffset(instante, offsetServico)).toBeNull();
      const r = ultima(instante);
      expect(r.data).toBeNull();
      expect(r.inputs_missing.length).toBeGreaterThan(0);
      expect(avisoIntervaloPosQt(r.data, "2026-11-04", "CIRURGIA", prazosRuleset).estado).toBe("PENDENTE");
    });

  it("ordena por instante e nenhuma string UTC futura mascara a ultima QT efetiva", () => {
    const efetiva = eventoQt("efetiva", "2026-10-05T23:30:00-03:00");
    const anterior = eventoQt("anterior", "2026-10-06T02:00:00Z");
    const futuraRaw = { ...eventoQt("raw", "2026-12-01T02:30:00Z"), revisao: "RAW" as const };
    for (const eventos of [[efetiva, anterior, futuraRaw], [futuraRaw, anterior, efetiva]]) {
      expect(ultimaAdministracaoQtEfetiva(eventos, offsetServico))
        .toMatchObject({ adminId: "efetiva", data: "2026-10-05" });
    }
  });

  it("datas civis puras permanecem sem conversao de offset", () => {
    expect(diferencaDiasCivis("2026-10-05", "2026-11-04")).toBe(30);
    expect(diferencaDiasCivis("2026-10-06", "2026-11-04")).toBe(29);
    expect(diferencaDiasCivis("2024-02-29", "2024-03-01")).toBe(1);
  });
});
