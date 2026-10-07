// GROK-09 · alertas de suporte das não oncológicas (D-W9-28/38/47).
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  alertarSuporte,
  lerSuporte,
  type EntradaSuporte,
  type RulesetSuporte,
} from "../../src/rules/suporteNaoOncologico.js";

const rs = lerSuporte(JSON.parse(readFileSync("corpus/rulesets/salao-suporte.v1.json", "utf8")));

const base = (over: Partial<EntradaSuporte> = {}): EntradaSuporte => ({
  medicamentos: ["paracetamol"],
  horasDiarreia: null,
  vomito: false,
  dm2: false,
  tempDecimos: null,
  ...over,
});

const codigos = (r: { alertas: { codigo: string; texto: string }[] }): string[] => r.alertas.map((a) => a.codigo);

describe("GROK-09 alertarSuporte", () => {
  it("diarreia acima de 24 h só pede para suspender anti-hipertensivo se ele está na lista", () => {
    const com = alertarSuporte(base({ horasDiarreia: 25, medicamentos: ["losartana 50 mg"] }), rs);
    expect(com.estado).toBe("ALERTA");
    expect(com.bloqueiaSalvar).toBe(false);
    expect(codigos(com)).toEqual(["alerta.anti-hipertensivo"]);
    expect(com.alertas[0]?.texto).toBe("suspender anti-hipertensivo (D-W9-28)");
    const sem = alertarSuporte(base({ horasDiarreia: 25, medicamentos: ["paracetamol"] }), rs);
    expect(sem.estado).toBe("SEM_ALERTA");
    expect(codigos(sem)).not.toContain("alerta.anti-hipertensivo");
    const igual = alertarSuporte(base({ horasDiarreia: 24, medicamentos: ["enalapril"] }), rs);
    expect(codigos(igual)).not.toContain("alerta.anti-hipertensivo");
  });

  it("lista ausente com diarreia acima de 24 h fica PENDENTE e não inventa o anti-hipertensivo", () => {
    const r = alertarSuporte(base({ horasDiarreia: 25, medicamentos: null, vomito: false }), rs);
    expect(r.estado).toBe("PENDENTE");
    expect(codigos(r)).toEqual([]);
    expect(r.pendencias[0]?.codigo).toBe("pendente.lista");
    expect(r.bloqueiaSalvar).toBe(false);
  });

  it("vômito com diarreia orienta hidratação; vômito sozinho não", () => {
    const par = alertarSuporte(base({ horasDiarreia: 1, vomito: true }), rs);
    expect(codigos(par)).toEqual(["alerta.hidratacao"]);
    expect(par.alertas[0]?.texto).toBe("orientar PS para hidratação venosa (D-W9-28)");
    const soVomito = alertarSuporte(base({ horasDiarreia: 0, vomito: true }), rs);
    expect(codigos(soVomito)).not.toContain("alerta.hidratacao");
    const soDiarreia = alertarSuporte(base({ horasDiarreia: 30, vomito: false, medicamentos: ["losartana"] }), rs);
    expect(codigos(soDiarreia)).toEqual(["alerta.anti-hipertensivo"]);
    const semDuracao = alertarSuporte(base({ horasDiarreia: null, vomito: true }), rs);
    expect(codigos(semDuracao)).not.toContain("alerta.hidratacao");
    expect(semDuracao.estado).toBe("PENDENTE");
  });

  it("corticoide com DM-2 alerta hiperglicemia; um só não alerta", () => {
    const ambos = alertarSuporte(base({ medicamentos: ["dexametasona"], dm2: true }), rs);
    expect(codigos(ambos)).toEqual(["alerta.hiperglicemia"]);
    expect(ambos.alertas[0]?.texto).toBe("Corticoide + DM-2 → alerta de hiperglicemia (D-W9-28)");
    expect(ambos.alertas[0]?.texto).not.toContain("insulina");
    expect(codigos(alertarSuporte(base({ medicamentos: ["dexametasona"], dm2: false }), rs))).not.toContain("alerta.hiperglicemia");
    expect(codigos(alertarSuporte(base({ medicamentos: ["paracetamol"], dm2: true }), rs))).not.toContain("alerta.hiperglicemia");
    const semDm = alertarSuporte(base({ medicamentos: ["prednisona"], dm2: null }), rs);
    expect(semDm.estado).toBe("PENDENTE");
    expect(codigos(semDm)).not.toContain("alerta.hiperglicemia");
  });

  it("febre 37,8 não dispara; 37,9 dispara o texto da biblioteca", () => {
    const noLimite = alertarSuporte(base({ tempDecimos: 378 }), rs);
    expect(codigos(noLimite)).not.toContain("alerta.febre");
    expect(noLimite.tempDecimos).toBe(378);
    const acima = alertarSuporte(base({ tempDecimos: 379 }), rs);
    expect(acima.estado).toBe("ALERTA");
    expect(acima.alertas[0]?.texto).toBe("ir ao PS → hemograma → ATB se neutropênico (D-W9-38)");
    expect(acima.bloqueiaSalvar).toBe(false);
    const ausente = alertarSuporte(base({ tempDecimos: null }), rs);
    expect(ausente.tempDecimos).toBeNull();
    expect(codigos(ausente)).not.toContain("alerta.febre");
    expect(JSON.stringify(ausente)).not.toContain("0°C");
  });

  it("os limiares e a classe vêm do ruleset", () => {
    const longo: RulesetSuporte = { ...rs, horasDiarreiaExclusivo: 48 };
    expect(codigos(alertarSuporte(base({ horasDiarreia: 25, medicamentos: ["atenolol"] }), longo))).not.toContain("alerta.anti-hipertensivo");
    const febreAlta: RulesetSuporte = { ...rs, febreDecimosExclusivo: 400 };
    expect(codigos(alertarSuporte(base({ tempDecimos: 379 }), febreAlta))).not.toContain("alerta.febre");
    const pelaClasse = alertarSuporte(base({
      horasDiarreia: 30,
      medicamentos: [{ nome: "medicação da HAS", classe: "NAO_ONCOLOGICA" }],
    }), {
      ...rs,
      classes: [{ id: "anti-hipertensivo", sinonimos: ["medicação da HAS"] }],
    });
    expect(codigos(pelaClasse)).toContain("alerta.anti-hipertensivo");
  });
});
