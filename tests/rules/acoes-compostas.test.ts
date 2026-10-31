import { describe, expect, it } from "vitest";
import {
  BaseAcaoComposta,
  PedidoAcaoComposta,
  type BaseAcaoComposta as Base,
} from "../../src/contracts/api/acoesCompostas.js";
import { prepararAcaoComposta } from "../../src/rules/prescricao/acoesCompostas.js";

const contexto = { patientId: "paciente-sintetico-04a", encounterId: "encontro-sintetico-04a", tumorLotId: "lote-sintetico-04a" };
const base = (ajustes: Partial<Base> = {}): Base => ({
  contexto,
  revisao: "revisao-sintetica-04a-1",
  baseHash: "a".repeat(64),
  cicloId: "ciclo-sintetico-04a",
  episodioId: "episodio-sintetico-04a",
  protocoloId: "protocolo-sintetico-A",
  previstoEm: "2026-01-31",
  itens: [
    { item: 1, droga: "Fármaco alfa", doseMg: 100 },
    { item: 2, droga: "Fármaco beta", doseMg: 50 },
    { item: 3, droga: "Fármaco gama", doseMg: null },
  ],
  ...ajustes,
});

describe("motor puro de ações compostas INOV-04a", () => {
  it("mantém o ciclo com a mesma base e diff vazio", () => {
    const atual = base();
    const resultado = prepararAcaoComposta(atual, { tipo: "MANTER_CICLO", motivo: "Manter data e esquema." });

    expect(resultado).toMatchObject({ estado: "PREPARADA", tipo: "MANTER_CICLO", motivo: "Manter data e esquema.",
      baseRevisao: atual.revisao, baseHash: atual.baseHash,
      antes: { contexto: atual.contexto, cicloId: atual.cicloId, episodioId: atual.episodioId,
        protocoloId: atual.protocoloId, previstoEm: atual.previstoEm, itens: atual.itens }, diff: [], pendencias: [] });
    expect(resultado.depois).toEqual(resultado.antes);
  });

  it.each([20, 25, 37])("reduz somente itens selecionados em %i%% a partir da base imutável", reducaoPct => {
    const atual = base();
    const pedido = { tipo: "REDUZIR_DOSE", motivo: "Redução solicitada para revisão.", reducaoPct, itensSelecionados: [1] } as const;
    const primeiro = prepararAcaoComposta(atual, pedido);
    const segundo = prepararAcaoComposta(atual, pedido);

    expect(primeiro.estado).toBe("PREPARADA");
    expect(primeiro.antes?.itens).toEqual(atual.itens);
    expect(primeiro.depois?.itens).toEqual([
      { item: 1, droga: "Fármaco alfa", doseMg: reducaoPct === 20 ? 80 : reducaoPct === 25 ? 75 : 63 },
      { item: 2, droga: "Fármaco beta", doseMg: 50 },
      { item: 3, droga: "Fármaco gama", doseMg: null },
    ]);
    expect(primeiro.diff).toEqual([{ campo: "doseMg", item: 1, antes: 100, depois: primeiro.depois?.itens[0]?.doseMg }]);
    expect(segundo).toEqual(primeiro);
  });

  it.each([Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY, 0, 100, 20.5, -25])(
    "recusa percentual não finito ou fora de 1..99: %s", reducaoPct => {
      expect(PedidoAcaoComposta.safeParse({ tipo: "REDUZIR_DOSE", motivo: "Motivo sintético.", reducaoPct, itensSelecionados: [1] }).success)
        .toBe(false);
    },
  );

  it("recusa seleção repetida/desconhecida e motivo ausente sem produzir preview parcial", () => {
    const repetida = prepararAcaoComposta(base(), { tipo: "REDUZIR_DOSE", motivo: "Motivo sintético.", reducaoPct: 20, itensSelecionados: [1, 1] });
    const desconhecida = prepararAcaoComposta(base(), { tipo: "REDUZIR_DOSE", motivo: "Motivo sintético.", reducaoPct: 20, itensSelecionados: [99] });
    const semMotivo = prepararAcaoComposta(base(), { tipo: "ADIAR_CICLO", motivo: " ", dias: 7 });

    expect(repetida).toMatchObject({ estado: "PENDENTE", depois: null, diff: [] });
    expect(desconhecida).toMatchObject({ estado: "PENDENTE", depois: null, diff: [] });
    expect(semMotivo).toMatchObject({ estado: "PENDENTE", depois: null, diff: [] });
  });

  it("recusa base ausente/zero e preserva resultado pequeno pela D-F1-52", () => {
    const ausente = prepararAcaoComposta(null, { tipo: "MANTER_CICLO", motivo: "Sem base clínica." });
    const nula = prepararAcaoComposta(base({ itens: [{ item: 1, droga: "Fármaco alfa", doseMg: null }] }),
      { tipo: "REDUZIR_DOSE", motivo: "Motivo sintético.", reducaoPct: 20, itensSelecionados: [1] });
    const zero = prepararAcaoComposta(base({ itens: [{ item: 1, droga: "Fármaco alfa", doseMg: 0 }] }),
      { tipo: "REDUZIR_DOSE", motivo: "Motivo sintético.", reducaoPct: 20, itensSelecionados: [1] });
    const arredondadaZero = prepararAcaoComposta(base({ itens: [{ item: 1, droga: "Fármaco alfa", doseMg: 1 }] }),
      { tipo: "REDUZIR_DOSE", motivo: "Motivo sintético.", reducaoPct: 99, itensSelecionados: [1] });

    expect(arredondadaZero).toMatchObject({ estado: "PREPARADA", depois: { itens: [{ doseMg: 0.01 }] } });
    for (const resultado of [ausente, nula, zero])
      expect(resultado).toMatchObject({ estado: "PENDENTE", depois: null, diff: [] });
  });

  it("adia por dias civis UTC sem converter timezone nem deslocar dia", () => {
    const resultado = prepararAcaoComposta(base({ previstoEm: "2026-01-31" }),
      { tipo: "ADIAR_CICLO", motivo: "Reagendamento solicitado.", dias: 7 });
    expect(resultado.depois?.previstoEm).toBe("2026-02-07");
    expect(resultado.diff).toEqual([{ campo: "previstoEm", item: null, antes: "2026-01-31", depois: "2026-02-07" }]);
  });

  it("limita dias a inteiro positivo <=365 e rejeita data civil inválida na base", () => {
    for (const dias of [Number.NaN, Number.POSITIVE_INFINITY, 0, -1, 1.5, 366])
      expect(PedidoAcaoComposta.safeParse({ tipo: "ADIAR_CICLO", motivo: "Motivo sintético.", dias }).success).toBe(false);
    expect(BaseAcaoComposta.safeParse(base({ previstoEm: "2026-02-30" })).success).toBe(false);
  });

  it("propõe troca explícita de protocolo sem copiar dose ou itens anteriores", () => {
    const resultado = prepararAcaoComposta(base(), { tipo: "TROCAR_PROTOCOLO", motivo: "Troca solicitada para revisão.", novoProtocoloId: "protocolo-sintetico-B" });
    expect(resultado).toMatchObject({ estado: "PREPARADA", tipo: "TROCAR_PROTOCOLO",
      depois: { protocoloId: "protocolo-sintetico-B", itens: [] },
      pendencias: [expect.stringMatching(/nova prescrição/i)] });
    expect(resultado.depois?.itens).not.toEqual(base().itens);
  });
});
