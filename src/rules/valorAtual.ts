import type { ResultadoValorAtual } from "../contracts/w12/regrasClinicas.js";
export type { ResultadoValorAtual } from "../contracts/w12/regrasClinicas.js";
// W12-GROK-09 · valor atual de uma série datada. A validade e o "hoje" entram por parâmetro.
// Datas diferentes são evolução. Mesma data e hora com valores diferentes é conflito.
// Nada é apagado e nada vira média. Fora da validade fica PENDENTE, com o dado antigo visível.

import { diferencaDiasCivis } from "./datas.js";

export interface Leitura {
  valor: number;
  data: string;
  hora: string | null;
}

export interface PedidoValorAtual {
  hoje: string;
  validadeDias: number;
  leituras: readonly Leitura[];
}

const CIVIL = /^\d{4}-\d{2}-\d{2}$/;
const HORA = /^\d{2}:\d{2}$/;

function copia(leitura: Leitura): Leitura {
  return { valor: leitura.valor, data: leitura.data, hora: leitura.hora };
}

function ordem(a: Leitura, b: Leitura): number {
  if (a.data !== b.data) return a.data < b.data ? -1 : 1;
  const ha = a.hora ?? "";
  const hb = b.hora ?? "";
  if (ha !== hb) return ha < hb ? -1 : 1;
  return a.valor < b.valor ? -1 : a.valor > b.valor ? 1 : 0;
}

function selo(leitura: Leitura): string {
  return `${leitura.data}T${leitura.hora ?? ""}`;
}

function valida(leitura: Leitura): boolean {
  return CIVIL.test(leitura.data) && (leitura.hora === null || HORA.test(leitura.hora)) && Number.isFinite(leitura.valor);
}

function dentro(leitura: Leitura, hoje: string, validadeDias: number): boolean {
  const dias = diferencaDiasCivis(leitura.data, hoje);
  return dias >= 0 && dias <= validadeDias;
}

/**
 * Elege o valor mais recente dentro da validade. Conflito no selo mais recente não elege nenhum.
 * A série devolvida é cópia: a entrada não muda.
 */
export function valorAtual(pedido: PedidoValorAtual): ResultadoValorAtual {
  const serie = pedido.leituras.map(copia);
  const base = {
    serie,
    bloqueiaSalvar: false as const,
  };
  if (!CIVIL.test(pedido.hoje) || !Number.isInteger(pedido.validadeDias) || pedido.validadeDias < 0) {
    return { ...base, estado: "PENDENTE", valorAtual: null, candidatos: [], dadoAntigo: null };
  }

  const boas = serie.filter(valida);
  const grupos = new Map<string, Leitura[]>();
  for (const leitura of boas) {
    const lista = grupos.get(selo(leitura)) ?? [];
    lista.push(leitura);
    grupos.set(selo(leitura), lista);
  }

  const conflitos: Leitura[][] = [];
  const unicos: Leitura[] = [];
  for (const grupo of grupos.values()) {
    const valores = new Set(grupo.map((item) => item.valor));
    if (valores.size > 1) conflitos.push(grupo);
    else {
      const eleito = grupo[0];
      if (eleito !== undefined) unicos.push(eleito);
    }
  }

  const vigentes = unicos.filter((item) => dentro(item, pedido.hoje, pedido.validadeDias));
  const vencidos = unicos
    .filter((item) => diferencaDiasCivis(item.data, pedido.hoje) > pedido.validadeDias)
    .sort(ordem);
  const dadoAntigo = vencidos.length === 0 ? null : vencidos[vencidos.length - 1] ?? null;

  const conflitosVigentes = conflitos.filter((grupo) => grupo.some((item) => dentro(item, pedido.hoje, pedido.validadeDias)));
  const maisRecenteUnico = vigentes.sort(ordem).at(-1) ?? null;
  const conflitoMaisRecente = conflitosVigentes
    .map((grupo) => grupo.slice().sort(ordem)[0])
    .filter((item): item is Leitura => item !== undefined)
    .sort(ordem)
    .at(-1) ?? null;

  const conflitoGanha = conflitoMaisRecente !== null && (maisRecenteUnico === null || ordem(maisRecenteUnico, conflitoMaisRecente) < 0);
  if (conflitoGanha) {
    const seloConflito = selo(conflitoMaisRecente);
    const candidatos = (conflitosVigentes.find((grupo) => grupo[0] !== undefined && selo(grupo[0]) === seloConflito) ?? [])
      .slice()
      .sort(ordem);
    return { ...base, estado: "CONFLITO", valorAtual: null, candidatos, dadoAntigo };
  }

  if (maisRecenteUnico === null) {
    return { ...base, estado: "PENDENTE", valorAtual: null, candidatos: dadoAntigo === null ? [] : [dadoAntigo], dadoAntigo };
  }

  return { ...base, estado: "ATUAL", valorAtual: maisRecenteUnico.valor, candidatos: [maisRecenteUnico], dadoAntigo };
}
