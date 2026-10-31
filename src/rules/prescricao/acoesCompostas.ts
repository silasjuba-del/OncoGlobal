import { mgAposReducao } from "../../contracts/doseReducao.js";
import {
  BaseAcaoComposta,
  PedidoAcaoComposta,
  ResultadoAcaoComposta,
  TipoAcaoComposta,
  type BaseAcaoComposta as Base,
  type PedidoAcaoComposta as Pedido,
  type ResultadoAcaoComposta as Resultado,
  type SnapshotAcaoComposta,
  type TipoAcaoComposta as Tipo,
} from "../../contracts/api/acoesCompostas.js";

const dataComDias = (data: string, dias: number): string | null => {
  const instante = new Date(`${data}T00:00:00.000Z`);
  if (!Number.isFinite(instante.getTime())) return null;
  instante.setUTCDate(instante.getUTCDate() + dias);
  const resultante = instante.toISOString().slice(0, 10);
  return resultante > data && /^\d{4}-\d{2}-\d{2}$/u.test(resultante) ? resultante : null;
};

function snapshot(base: Base): SnapshotAcaoComposta {
  return {
    contexto: { ...base.contexto },
    cicloId: base.cicloId,
    episodioId: base.episodioId,
    protocoloId: base.protocoloId,
    previstoEm: base.previstoEm,
    itens: base.itens.map(item => ({ ...item })),
  };
}

function pending(input: {
  base: Base | null;
  tipo: Tipo | null;
  motivo: string;
  pendencias: readonly string[];
}): Resultado {
  const antes = input.base ? snapshot(input.base) : null;
  return ResultadoAcaoComposta.parse({
    estado: "PENDENTE",
    baseRevisao: input.base?.revisao ?? null,
    baseHash: input.base?.baseHash ?? null,
    tipo: input.tipo,
    motivo: input.motivo,
    antes,
    depois: null,
    diff: [],
    pendencias: [...input.pendencias],
  });
}

function motivoDoPedido(value: unknown): string {
  if (typeof value !== "object" || value === null || !("motivo" in value) || typeof value.motivo !== "string") return "";
  return value.motivo.trim();
}

function tipoDoPedido(value: unknown): Tipo | null {
  if (typeof value !== "object" || value === null || !("tipo" in value)) return null;
  const parsed = TipoAcaoComposta.safeParse(value.tipo);
  return parsed.success ? parsed.data : null;
}

/** Pure preview only. It never persists, signs, dispatches, or changes the caller's base. */
export function prepararAcaoComposta(baseEntrada: unknown | null, pedidoEntrada: unknown): Resultado {
  const baseValidada = baseEntrada === null ? null : BaseAcaoComposta.safeParse(baseEntrada);
  const base = baseValidada && baseValidada.success ? baseValidada.data : null;
  const pedidoValidado = PedidoAcaoComposta.safeParse(pedidoEntrada);
  const tipo = pedidoValidado.success ? pedidoValidado.data.tipo : tipoDoPedido(pedidoEntrada);
  const motivo = pedidoValidado.success ? pedidoValidado.data.motivo : motivoDoPedido(pedidoEntrada);

  if (!base) return pending({ base: null, tipo, motivo, pendencias: ["Base do ciclo ausente ou inválida; recarregue dados estruturados e revisão."] });
  if (!pedidoValidado.success) return pending({ base, tipo, motivo, pendencias: ["Ação inválida; confira tipo, motivo, percentual, dias e seleção de itens."] });

  const antes = snapshot(base);
  const pedido = pedidoValidado.data;
  if (pedido.tipo === "MANTER_CICLO") {
    return ResultadoAcaoComposta.parse({ estado: "PREPARADA", baseRevisao: base.revisao,
      baseHash: base.baseHash, tipo: pedido.tipo, motivo: pedido.motivo,
      antes, depois: snapshot(base), diff: [], pendencias: [] });
  }

  if (pedido.tipo === "REDUZIR_DOSE") {
    const selecionados = new Set(pedido.itensSelecionados);
    const itensBase = new Map(base.itens.map(item => [item.item, item]));
    const ausentes = pedido.itensSelecionados.filter(item => !itensBase.has(item));
    if (ausentes.length) return pending({ base, tipo: pedido.tipo, motivo: pedido.motivo,
      pendencias: [`Itens selecionados fora da base: ${ausentes.join(", ")}.`] });

    const faltantes = pedido.itensSelecionados.flatMap(item => {
      const dose = itensBase.get(item)?.doseMg;
      return dose === null || dose === undefined || dose <= 0 ? [item] : [];
    });
    if (faltantes.length) return pending({ base, tipo: pedido.tipo, motivo: pedido.motivo,
      pendencias: [`Dose-base ausente ou não positiva nos itens: ${faltantes.join(", ")}.`] });

    const reduzidos = new Map<number, number>();
    for (const itemId of pedido.itensSelecionados) {
      const doseBase = itensBase.get(itemId)!.doseMg!;
      // D-F1-52: redução única; preserva meio mg e resultados positivos pequenos.
      const calculada = mgAposReducao(doseBase, pedido.reducaoPct);
      if (!Number.isFinite(calculada) || calculada > Number.MAX_SAFE_INTEGER || calculada <= 0)
        return pending({ base, tipo: pedido.tipo, motivo: pedido.motivo,
          pendencias: [`Dose após redução não é uma quantidade positiva representável para o item ${itemId}.`] });
      reduzidos.set(itemId, calculada);
    }

    const depois = snapshot(base);
    const diff: Array<{ campo: "doseMg"; item: number; antes: number; depois: number }> = [];
    depois.itens = depois.itens.map(item => {
      if (!selecionados.has(item.item)) return item;
      const doseAnterior = itensBase.get(item.item)!.doseMg!;
      const dosePosterior = reduzidos.get(item.item)!;
      diff.push({ campo: "doseMg", item: item.item, antes: doseAnterior, depois: dosePosterior });
      return { ...item, doseMg: dosePosterior };
    });
    return ResultadoAcaoComposta.parse({ estado: "PREPARADA", baseRevisao: base.revisao,
      baseHash: base.baseHash, tipo: pedido.tipo, motivo: pedido.motivo, antes, depois, diff, pendencias: [] });
  }

  if (pedido.tipo === "ADIAR_CICLO") {
    const previstoEm = dataComDias(base.previstoEm, pedido.dias);
    if (!previstoEm) return pending({ base, tipo: pedido.tipo, motivo: pedido.motivo,
      pendencias: ["Nova data civil não pôde ser representada; mantenha a base para revisão."] });
    const depois = { ...snapshot(base), previstoEm };
    return ResultadoAcaoComposta.parse({ estado: "PREPARADA", baseRevisao: base.revisao,
      baseHash: base.baseHash, tipo: pedido.tipo, motivo: pedido.motivo, antes, depois,
      diff: [{ campo: "previstoEm", item: null, antes: base.previstoEm, depois: previstoEm }], pendencias: [] });
  }

  if (pedido.novoProtocoloId === base.protocoloId)
    return pending({ base, tipo: pedido.tipo, motivo: pedido.motivo,
      pendencias: ["O protocolo selecionado já é a base vigente."] });
  const depois = { ...snapshot(base), protocoloId: pedido.novoProtocoloId, itens: [] };
  const diff = [
    { campo: "protocoloId" as const, item: null, antes: base.protocoloId, depois: pedido.novoProtocoloId },
    ...base.itens.map(item => ({ campo: "item" as const, item: item.item,
      antes: `${item.droga} · ${item.doseMg === null ? "dose pendente" : `${item.doseMg} mg`}`, depois: null })),
  ];
  return ResultadoAcaoComposta.parse({ estado: "PREPARADA", baseRevisao: base.revisao,
    baseHash: base.baseHash, tipo: pedido.tipo, motivo: pedido.motivo, antes, depois, diff,
    pendencias: ["Nova prescrição pendente de preparação pelo protocolo selecionado; doses anteriores não foram copiadas."] });
}
