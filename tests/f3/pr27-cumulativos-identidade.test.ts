import { describe, expect, it } from "vitest";
import type { TreatmentAdministration } from "../../src/contracts/clinico.js";
import { calcularCumulativosEfetivosSalao as calcular } from "../../src/modules/salao/operacaoSalao.js";
import { fonteSintetica } from "../fixtures/triagem.js";

const base = (patch: Partial<TreatmentAdministration> = {}): TreatmentAdministration => ({
  adminId: "adm-sintetica", cicloId: "ciclo-1",
  prescricaoRef: { documentId: "rx-1", documentVersion: 1 }, item: 1,
  droga: "doxorrubicina", quantidadeEfetivaMg: 60, status: "PARCIAL",
  motivo: "Interrupção sintética", inicio: null, fim: null,
  fonte: fonteSintetica(), ...patch,
});

function conferirConflito(entradas: TreatmentAdministration[]) {
  const resultado = calcular(entradas);
  expect(resultado.map(r => r.droga).sort()).toEqual([...new Set(entradas.map(a => a.droga))].sort());
  for (const item of resultado) {
    expect(item.quantidadeEfetivaTotalMg).toBe(0);
    expect(item.adminIds).toEqual([]);
    expect(item.conflitoAdminIds).toEqual(["adm-sintetica"]);
  }
}

describe("PR27: identidade completa dos cumulativos efetivos", () => {
  const divergencias: Partial<TreatmentAdministration>[] = [
    { droga: "cisplatina" }, { status: "INTERROMPIDA" },
    { fonte: fonteSintetica("outra-fonte") }, { quantidadeEfetivaMg: 30 },
    { cicloId: "ciclo-2" }, { prescricaoRef: { documentId: "rx-2", documentVersion: 1 } },
    { prescricaoRef: { documentId: "rx-1", documentVersion: 2 } }, { item: 2 },
    { motivo: "Outro motivo" }, { inicio: "2026-10-19T10:00:00Z" },
    { fim: "2026-10-19T11:00:00Z" },
    { medidaInformada: { unidade: "mg", valor: 60 } },
    { superficieCorporalNoDia: { valorM2: 1.8, fonte: fonteSintetica() } },
  ];
  it.each(divergencias)("exclui todas as versões divergentes: %j", patch => {
    const a = base(); const b = base(patch);
    conferirConflito([a, b, a]);
    conferirConflito([b, a, b]);
  });

  it.each([false, true])("detecta OMITIDA antes/depois da efetiva: %s", inverter => {
    const entradas = [base(), base({ status: "OMITIDA", quantidadeEfetivaMg: 0 })];
    conferirConflito(inverter ? entradas.reverse() : entradas);
  });

  it("detecta divergência entre OMITIDAs e entre registros de quantidade zero", () => {
    conferirConflito([base({ status: "OMITIDA", quantidadeEfetivaMg: 0 }),
      base({ status: "OMITIDA", quantidadeEfetivaMg: 0, fonte: fonteSintetica("outra") })]);
    conferirConflito([base({ quantidadeEfetivaMg: 0 }), base({ quantidadeEfetivaMg: 0, status: "INTERROMPIDA" })]);
  });

  it("duplicatas exatas OMITIDAs somam zero sem conflito", () => {
    const omitida = base({ status: "OMITIDA", quantidadeEfetivaMg: 0 });
    expect(calcular([omitida, structuredClone(omitida)])).toEqual([]);
  });

  it("duplicatas exatas contam uma vez e PARCIAL/INTERROMPIDA usam apenas quantidade efetiva", () => {
    const parcial = base();
    const interrompida = base({ adminId: "adm-2", status: "INTERROMPIDA", quantidadeEfetivaMg: 15 });
    expect(calcular([parcial, structuredClone(parcial), interrompida])).toEqual([{
      droga: "doxorrubicina", quantidadeEfetivaTotalMg: 75,
      adminIds: ["adm-sintetica", "adm-2"], conflitoAdminIds: [], incluiApenasAdministracaoEfetiva: true,
    }]);
  });

  it("reordenação de chaves inclusive aninhadas não cria conflito", () => {
    const a = base({ medidaInformada: { unidade: "mL", valor: 3, concentracaoSolucaoMgMl: 20, fonteConcentracao: fonteSintetica() } });
    const reordenar = (v: unknown): unknown => Array.isArray(v) ? v.map(reordenar)
      : v && typeof v === "object" ? Object.fromEntries(Object.entries(v).reverse().map(([k, x]) => [k, reordenar(x)])) : v;
    expect(calcular([a, reordenar(a) as TreatmentAdministration])).toEqual(calcular([a]));
  });

  it("conflito não remove outras administrações válidas e entrada vazia permanece vazia", () => {
    const resultado = calcular([base(), base({ droga: "cisplatina" }), base({ adminId: "valida" })]);
    expect(resultado.find(r => r.droga === "doxorrubicina")).toMatchObject({
      quantidadeEfetivaTotalMg: 60, adminIds: ["valida"], conflitoAdminIds: ["adm-sintetica"],
    });
    expect(calcular([])).toEqual([]);
  });
});
