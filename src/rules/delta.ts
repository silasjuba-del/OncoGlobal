import type { DeltaDirecao, DeltaKind, Semaforo } from "../contracts/estados.js";

export interface CampoDelta {
  valor: unknown;
  estado: Semaforo;
  /** Resolution must be an explicit reviewed event, never an absent field. */
  resolvidoExplicitamente?: true;
}
export interface SnapshotConfirmado {
  kind: "CONFIRMED";
  campos: Record<string, CampoDelta>;
}
export interface SnapshotAtual {
  kind: "CURRENT";
  campos: Record<string, CampoDelta>;
}
export type RegrasDirecao = Readonly<Record<string, "MAIOR_MELHOR" | "MENOR_MELHOR">>;
export interface DeltaItem {
  campo: string;
  classe: DeltaKind;
  estado: Semaforo;
  diferencaNumerica?: number;
  direcao?: DeltaDirecao;
}
export interface DeltaReport {
  linhaDeBase: boolean;
  itens: DeltaItem[];
}

/** FN-14. Caller supplies the *last confirmed* N-1; rules never infer clinical benefit. */
export function delta(anterior: SnapshotConfirmado | null, atual: SnapshotAtual, regrasDirecao: RegrasDirecao): DeltaReport {
  if (atual.kind !== "CURRENT" || (anterior && anterior.kind !== "CONFIRMED"))
    throw new Error("DELTA_REQUER_CURRENT_E_ULTIMO_CONFIRMED");
  if (!anterior) return { linhaDeBase: true, itens: [] };
  const campos = new Set([...Object.keys(anterior.campos), ...Object.keys(atual.campos)]);
  const itens: DeltaItem[] = [];
  for (const campo of [...campos].sort()) {
    const prev = anterior.campos[campo];
    const now = atual.campos[campo];
    if (!now || now.estado === "PENDENTE" || now.valor === null && !now.resolvidoExplicitamente) {
      // Ausencia/proposta nao resolve um conflito confirmado nem apaga um conflito CURRENT.
      const conflito = prev?.estado === "VERMELHO" || now?.estado === "VERMELHO";
      itens.push({ campo, classe: "PERSISTE", estado: conflito ? "VERMELHO" : "PENDENTE" });
      continue;
    }
    if (now.estado === "VERMELHO" || prev?.estado === "VERMELHO") {
      itens.push({ campo, classe: "MUDOU", estado: "VERMELHO" });
      continue;
    }
    if (now.resolvidoExplicitamente) {
      itens.push({ campo, classe: "RESOLVEU", estado: "VERDE" });
      continue;
    }
    if (!prev || prev.estado === "PENDENTE" || prev.valor === null) {
      itens.push({ campo, classe: "NOVO", estado: now.estado });
      continue;
    }
    const igual = JSON.stringify(prev.valor) === JSON.stringify(now.valor);
    const item: DeltaItem = { campo, classe: igual ? "PERSISTE" : "MUDOU", estado: now.estado };
    if (typeof prev.valor === "number" && typeof now.valor === "number"
      && Number.isFinite(prev.valor) && Number.isFinite(now.valor)) {
      item.diferencaNumerica = now.valor - prev.valor;
      const rule = regrasDirecao[campo];
      if (rule && item.diferencaNumerica !== 0)
        item.direcao = (item.diferencaNumerica > 0) === (rule === "MAIOR_MELHOR") ? "MELHOR" : "PIOR";
    }
    itens.push(item);
  }
  return { linhaDeBase: false, itens };
}
