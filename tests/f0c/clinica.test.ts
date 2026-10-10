import { describe, expect, it } from "vitest";
import { avaliarCriticos, avaliarToxicidadeG2, avaliarValidadeExame, cockcroftGault, lembrarHbvC1D1,
  type EntradaCockcroftGault, type MedidaClinica } from "../../src/rules/f0c/clinica.js";
import { calcularDosePorBase } from "../../src/rules/prescricao/index.js";

const medida = (valor: number | null, unidade: string | null): MedidaClinica => ({ valor, unidade, fonte: "caso-sintetico" });
const renal = (): EntradaCockcroftGault => ({ idadeAnos: 68, sexoFormula: "MASCULINO", peso: medida(120, "kg"), creatinina: medida(1, "mg/dL") });

describe("F0-COMPLEMENTO: peso real e SC sem piso/teto", () => {
  it("CG usa peso real de 120 kg, preserva valores/fonte e não aplica teto Calvert", () => {
    const entrada = renal();
    const r = cockcroftGault(entrada);
    expect(r).toMatchObject({ estado: "CALCULADO", clcrMlMin: 120, fatorSexo: 1, metodo: "COCKCROFT_GAULT_PESO_REAL", valoresUsados: entrada });
    expect(cockcroftGault({ ...entrada, peso: medida(150, "kg") }).clcrMlMin).toBe(150);
    expect(cockcroftGault({ ...entrada, sexoFormula: "FEMININO" }).clcrMlMin).toBe(102);
    entrada.peso.valor = 90;
    expect(r.valoresUsados.peso.valor).toBe(120);
  });
  it.each([0, -1, null, NaN, Infinity])("Cr %s não produz depuração", (valor) => {
    expect(cockcroftGault({ ...renal(), creatinina: medida(valor, "mg/dL") })).toMatchObject({ estado: "PENDENTE", clcrMlMin: null });
  });
  it("exige unidades, fonte, idade e sexo para cálculo", () => {
    for (const e of [
      { ...renal(), creatinina: medida(88, "umol/L") },
      { ...renal(), peso: medida(120, "lb") },
      { ...renal(), idadeAnos: null },
      { ...renal(), idadeAnos: 140 },
      { ...renal(), sexoFormula: null },
      { ...renal(), peso: { ...medida(120, "kg"), fonte: null } },
    ]) expect(cockcroftGault(e).estado).toBe("PENDENTE");
  });
  it("SC Mosteller no segundo caminho também não tem piso/teto; Calvert mantém 125", () => {
    expect(calcularDosePorBase({ basis: "MG_M2", mgM2: 100, pesoKg: 150, alturaCm: 200 })).toMatchObject({ doseMg: 289, aviso: null });
    expect(calcularDosePorBase({ basis: "MG_M2", mgM2: 100, pesoKg: 30, alturaCm: 120 })).toMatchObject({ doseMg: 100, aviso: null });
    expect(calcularDosePorBase({ basis: "AUC", auc: 5, clearance: 150 })).toMatchObject({ doseMg: 750, aviso: expect.stringContaining("125") });
  });
});

describe("F0-COMPLEMENTO: somente Na, K e cálcio total", () => {
  it.each([
    ["NA", "mmol/L", 124.9, "AVISO"], ["NA", "mmol/L", 125, "SEM_AVISO"],
    ["NA", "mmol/L", 145, "SEM_AVISO"], ["NA", "mmol/L", 145.1, "AVISO"],
    ["K", "mmol/L", 2.9, "AVISO"], ["K", "mmol/L", 3, "SEM_AVISO"],
    ["K", "mmol/L", 6, "SEM_AVISO"], ["K", "mmol/L", 6.1, "AVISO"],
    ["CA_TOTAL", "mg/dL", 7.9, "AVISO"], ["CA_TOTAL", "mg/dL", 8, "SEM_AVISO"],
    ["CA_TOTAL", "mg/dL", 12, "SEM_AVISO"], ["CA_TOTAL", "mg/dL", 12.1, "AVISO"],
  ] as const)("%s %s %s -> %s", (analito, unidade, valor, estado) => {
    expect(avaliarCriticos({ [analito]: medida(valor, unidade) }).find((r) => r.analito === analito)).toMatchObject({ estado, consultaSegue: true });
  });
  it("ausentes, unidade incompatível e fonte ausente ficam pendentes", () => {
    expect(avaliarCriticos({}).every((r) => r.estado === "PENDENTE")).toBe(true);
    expect(avaliarCriticos({ NA: medida(120, null), K: { ...medida(2, "mmol/L"), fonte: null }, CA_TOTAL: medida(2, "mmol/L") })
      .every((r) => r.estado === "PENDENTE")).toBe(true);
    expect(avaliarCriticos({}).map((r) => r.analito)).toEqual(["NA", "K", "CA_TOTAL"]);
  });
});

describe("F0-COMPLEMENTO: validade real sem converter dias em horas fictícias", () => {
  it("hemograma é válido em 72 h e vence logo após", () => {
    expect(avaliarValidadeExame("HEMOGRAMA", "2026-10-01T10:00:00-03:00", "2026-10-04T13:00:00Z")).toMatchObject({ estado: "VALIDO", idadeHoras: 72 });
    expect(avaliarValidadeExame("HEMOGRAMA", "2026-10-01T13:00:00Z", "2026-10-04T13:00:01Z").estado).toBe("VENCIDO");
  });
  it("bioquímica vale 168 h, ficha específica prevalece", () => {
    expect(avaliarValidadeExame("BIOQUIMICA", "2026-10-01T00:00:00Z", "2026-10-08T00:00:00Z")).toMatchObject({ estado: "VALIDO", validadeHoras: 168 });
    expect(avaliarValidadeExame("BIOQUIMICA", "2026-10-01T00:00:00Z", "2026-10-08T00:00:01Z").estado).toBe("VENCIDO");
    expect(avaliarValidadeExame("BIOQUIMICA", "2026-10-01T00:00:00Z", "2026-10-03T00:00:00Z", 24).estado).toBe("VENCIDO");
  });
  it("data sem hora/fuso não aprova; vencimento remoto é demonstrável", () => {
    expect(avaliarValidadeExame("HEMOGRAMA", "2026-10-01", "2026-10-04")).toMatchObject({ estado: "PENDENTE", idadeHoras: null });
    expect(avaliarValidadeExame("HEMOGRAMA", "2026-10-01", "2026-10-10")).toMatchObject({ estado: "VENCIDO", idadeHoras: null, motivo: "VENCIMENTO_CONFIRMADO_MESMO_SEM_HORARIO" });
  });
  it.each([null, "2026-02-30T10:00:00Z", "2026-10-01T24:00:00Z", "2026-10-01T10:00:00", "2026-10-01T10:00:00+14:01"])("não aceita coleta inválida %s", (coleta) => {
    expect(avaliarValidadeExame("HEMOGRAMA", coleta, "2026-10-02T10:00:00Z").estado).toBe("PENDENTE");
  });
  it("coleta futura não é válida", () => {
    expect(avaliarValidadeExame("HEMOGRAMA", "2026-10-03T10:00:00Z", "2026-10-02T10:00:00Z")).toMatchObject({ estado: "PENDENTE", motivo: "COLETA_FUTURA" });
  });
});

describe("F0-COMPLEMENTO: toxicidade e lembrete HBV sem decisão automática", () => {
  it("G2 persistente gera somente alerta; resolvido não entra", () => {
    expect(avaliarToxicidadeG2([
      { sintoma: "Diarreia", grau: 2, persistente: true },
      { sintoma: "Diarreia", grau: 2, persistente: true },
      { sintoma: "Vômito", grau: 2, persistente: false },
    ])).toEqual({ estado: "AVISO", sintomas: ["Diarreia"], condutaAutomatica: false, consultaSegue: true });
  });
  it("lembra apenas sorologias sem resultado/fonte em C1D1", () => {
    const registros = { HBsAg: { resultado: "reagente", fonte: "laboratório" }, "anti-HBc": { resultado: "não reagente", fonte: null } };
    expect(lembrarHbvC1D1(1, 1, registros)).toMatchObject({ estado: "LEMBRETE", faltantes: ["anti-HBc", "anti-HBs"], consultaSegue: true });
    expect(lembrarHbvC1D1(2, 1, {}).estado).toBe("SEM_LEMBRETE");
    expect(lembrarHbvC1D1(1, 8, {}).estado).toBe("SEM_LEMBRETE");
    expect(lembrarHbvC1D1(null, 1, {}).estado).toBe("PENDENTE");
    expect(lembrarHbvC1D1(1, null, {})).toMatchObject({ estado: "LEMBRETE", aplicavel: true, faltantes: ["HBsAg", "anti-HBc", "anti-HBs"] });
    expect(lembrarHbvC1D1(2, null, {}).estado).toBe("PENDENTE");
  });
});
