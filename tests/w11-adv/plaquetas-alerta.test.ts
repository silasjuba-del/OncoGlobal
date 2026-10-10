// W11-H6 · alerta de plaquetas (decisão Dr. Silas 2026-10-08): MENOR que 50.000/µL alerta, independente do CTCAE.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { grauCtcae, lerSalaoCtcae, portaCiclo } from "../../src/rules/portaCiclo.js";
import { avaliarAlertaPlaquetas, lerLimiarAlertaPlaquetas, type ClassificadorPlaquetas, type LimiarAlertaPlaquetas } from "../../src/rules/plaquetasAlerta.js";

const ler = (rel: string): unknown => JSON.parse(readFileSync(fileURLToPath(new URL(rel, import.meta.url)), "utf8"));
const labs = ler("../../corpus/rulesets/lab-thresholds.v1.json");
const salaoJson = ler("../../corpus/rulesets/salao-ctcae.v1.json");
const limiar: LimiarAlertaPlaquetas = lerLimiarAlertaPlaquetas(labs);
const salao = lerSalaoCtcae(salaoJson);
const classificar: ClassificadorPlaquetas = (valor) => grauCtcae("plaquetas", valor, salao);
const data = "2026-10-08";

describe("alerta de plaquetas (independente do CTCAE)", () => {
  it("limiar vem do JSON do ruleset, não de constante: 50.000 estrito e CTCAE v6.0 declarado", () => {
    expect(limiar.limiarExclusivo).toBe(50000);
    expect(limiar.ativo).toBe(true);
    expect((salaoJson as { graus: { versaoCtcae: string } }).graus.versaoCtcae).toBe("6.0");
    const mudado = lerLimiarAlertaPlaquetas({
      ...(labs as object),
      analitos: (labs as { analitos: { codigo: string; alertaClinico?: object }[] }).analitos.map((a) =>
        a.codigo === "PLQ" ? { ...a, alertaClinico: { ...a.alertaClinico, limiarExclusivo: 60000 } } : a),
    });
    expect(avaliarAlertaPlaquetas({ valor: 55000, data }, mudado, classificar)[0].estado).toBe("ALERTA");
  });

  it("49.999 alerta", () => {
    const [alerta] = avaliarAlertaPlaquetas({ valor: 49999, data }, limiar, classificar);
    expect(alerta.estado).toBe("ALERTA");
    expect(alerta.valor).toBe(49999);
  });

  it("50.000 exato não alerta", () => {
    const [alerta] = avaliarAlertaPlaquetas({ valor: 50000, data }, limiar, classificar);
    expect(alerta.estado).toBe("SEM_ALERTA");
  });

  it("20.000 alerta e aparece antes da classificação CTCAE no painel", () => {
    const painel = avaliarAlertaPlaquetas({ valor: 20000, data }, limiar, classificar);
    expect(painel[0].tipo).toBe("ALERTA_PLAQUETAS");
    expect(painel[0].estado).toBe("ALERTA");
    expect(painel[1].grau).toBe(3);
    expect(painel[1].motivo).toContain("plaquetas");
    expect(painel.indexOf(painel[0])).toBe(0);
    expect(painel.indexOf(painel[1])).toBe(1);
  });

  it("plaquetas ausentes, sem data ou implausíveis ficam PENDENTE, nunca alerta nem silêncio", () => {
    const ausente = avaliarAlertaPlaquetas({ valor: null, data }, limiar, classificar);
    expect(ausente[0].estado).toBe("PENDENTE");
    expect(ausente[1].grau).toBeNull();
    expect(ausente[1].estado).toBe("PENDENTE");

    const semData = avaliarAlertaPlaquetas({ valor: 20000, data: null }, limiar, classificar);
    expect(semData[0].estado).toBe("PENDENTE");

    for (const valor of [-1, 20000.5, 3000000, Number.NaN]) {
      const r = avaliarAlertaPlaquetas({ valor, data }, limiar, classificar);
      expect(r[0].estado).toBe("PENDENTE");
      expect(r[1].grau).toBeNull();
    }
  });

  it("alerta não altera destino nem grau por si, e nunca bloqueia salvar", () => {
    const labsCiclo = { anc: 2000, plq: 20000, clearance: 90, feve: 60 };
    const protocolo = { protocoloId: "p", versao: "1", limiares: [{ codigo: "plq" as const, minimo: 100000 }] };
    const antes = portaCiclo(labsCiclo, protocolo, salao);
    const painel = avaliarAlertaPlaquetas({ valor: 20000, data }, limiar, classificar);
    expect(portaCiclo(labsCiclo, protocolo, salao)).toEqual(antes);
    expect(painel[1].grau).toBe(grauCtcae("plaquetas", 20000, salao).grau);
    expect(painel[0].bloqueiaSalvar).toBe(false);
    expect(painel[1].confirmadoPeloMedico).toBe(false);
  });

  it("determinismo: mesma entrada produz mesma saída", () => {
    const entrada = { valor: 49999, data };
    const a = avaliarAlertaPlaquetas(entrada, limiar, classificar);
    const b = avaliarAlertaPlaquetas({ ...entrada }, lerLimiarAlertaPlaquetas(labs), classificar);
    expect(b).toEqual(a);
    expect(JSON.stringify(b)).toBe(JSON.stringify(a));
  });
});
