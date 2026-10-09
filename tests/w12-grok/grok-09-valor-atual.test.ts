// W12-GROK-09 · D-W9-63. Valor mais recente dentro da validade. Paciente Teste 93.
// Datas diferentes são evolução. Mesma data e hora com valores diferentes é conflito.
import { describe, expect, it } from "vitest";
import { valorAtual as peloBarrel } from "../../src/rules/index.js";
import { valorAtual, type Leitura, type PedidoValorAtual } from "../../src/rules/valorAtual.js";

const PROIBIDO = /\b(liberado|aprovado|apto)\b/i;
const HOJE = "2026-08-04";
const JULHO = { valor: 180_000, data: "2026-07-21", hora: "08:00" } as const;
const AGOSTO = { valor: 20_000, data: "2026-08-04", hora: "08:00" } as const;

function pedido(validadeDias: number, leituras: readonly Leitura[], hoje = HOJE): PedidoValorAtual {
  return { hoje, validadeDias, leituras };
}

function congelar(entrada: PedidoValorAtual): void {
  Object.freeze(entrada);
  Object.freeze(entrada.leituras);
  for (const leitura of entrada.leituras) Object.freeze(leitura);
}

describe("W12-GROK-09 valor atual", () => {
  it("o barrel reexporta a mesma função", () => {
    expect(peloBarrel).toBe(valorAtual);
  });

  it("plaquetas 180.000 em 21/07 e 20.000 em 04/08 elegem 20.000 e conservam a série", () => {
    const leituras = [JULHO, AGOSTO];
    const r = valorAtual(pedido(7, leituras));
    expect(r.estado).toBe("ATUAL");
    expect(r.valorAtual).toBe(20_000);
    expect(r.serie).toEqual([JULHO, AGOSTO]);
    expect(r.serie).not.toBe(leituras);
    expect(r.dadoAntigo).toEqual(JULHO);
    expect(r.candidatos).toEqual([AGOSTO]);
    expect(r.bloqueiaSalvar).toBe(false);
    expect(JSON.stringify(r)).not.toMatch(PROIBIDO);
  });

  it("as duas datas dentro de 30 dias são evolução e o valor mais recente continua 20.000", () => {
    const r = valorAtual(pedido(30, [AGOSTO, JULHO]));
    expect(r.estado).toBe("ATUAL");
    expect(r.valorAtual).toBe(20_000);
    expect(r.dadoAntigo).toBeNull();
    expect(r.serie.map((item) => item.valor)).toEqual([20_000, 180_000]);
    expect(r.valorAtual).not.toBe(100_000);
  });

  it("a mesma data e hora com valores diferentes mostra os dois e não elege nem tira a média", () => {
    const a = { valor: 180_000, data: HOJE, hora: "08:00" };
    const b = { valor: 20_000, data: HOJE, hora: "08:00" };
    const r = valorAtual(pedido(7, [a, b]));
    expect(r.estado).toBe("CONFLITO");
    expect(r.valorAtual).toBeNull();
    expect(r.candidatos).toEqual([b, a]);
    expect(r.serie).toEqual([a, b]);
    expect(r.candidatos.map((item) => item.valor)).not.toContain(100_000);
    expect(r.bloqueiaSalvar).toBe(false);
  });

  it("horas diferentes no mesmo dia são evolução e a hora posterior vence", () => {
    const cedo = { valor: 180_000, data: HOJE, hora: "08:00" };
    const tarde = { valor: 20_000, data: HOJE, hora: "16:00" };
    const r = valorAtual(pedido(7, [tarde, cedo]));
    expect(r.estado).toBe("ATUAL");
    expect(r.valorAtual).toBe(20_000);
    expect(r.serie).toHaveLength(2);
  });

  it("valor fora da validade fica PENDENTE e o dado antigo continua visível", () => {
    const r = valorAtual(pedido(7, [JULHO]));
    expect(r.estado).toBe("PENDENTE");
    expect(r.valorAtual).toBeNull();
    expect(r.dadoAntigo).toEqual(JULHO);
    expect(r.candidatos).toEqual([JULHO]);
    expect(r.serie).toEqual([JULHO]);
    expect(r.bloqueiaSalvar).toBe(false);
  });

  it("igual ao limite da validade passa e um dia a mais não elege", () => {
    const noLimite = { valor: 150_000, data: "2026-07-28", hora: null };
    const alem = { valor: 140_000, data: "2026-07-27", hora: null };
    expect(valorAtual(pedido(7, [noLimite])).valorAtual).toBe(150_000);
    const vencido = valorAtual(pedido(7, [alem]));
    expect(vencido.estado).toBe("PENDENTE");
    expect(vencido.valorAtual).toBeNull();
    expect(vencido.dadoAntigo).toEqual(alem);
  });

  it("leitura futura não é eleita e série vazia ou hoje inválido ficam PENDENTES", () => {
    const futura = { valor: 20_000, data: "2026-08-05", hora: "08:00" };
    const futuro = valorAtual(pedido(7, [futura]));
    expect(futuro.estado).toBe("PENDENTE");
    expect(futuro.valorAtual).toBeNull();
    expect(futuro.serie).toEqual([futura]);
    expect(valorAtual(pedido(7, [])).estado).toBe("PENDENTE");
    expect(valorAtual({ hoje: "04/08/2026", validadeDias: 7, leituras: [AGOSTO] }).estado).toBe("PENDENTE");
  });

  it("a mesma entrada dá a mesma saída e a entrada congelada não muda", () => {
    const entrada = pedido(7, [JULHO, AGOSTO]);
    congelar(entrada);
    const antes = JSON.stringify(entrada);
    const a = valorAtual(entrada);
    const b = valorAtual(entrada);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    expect(JSON.stringify(entrada)).toBe(antes);
    expect(a.bloqueiaSalvar).toBe(false);
  });
});
