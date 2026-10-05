// GRK-05 · TC→RM: um vigente, o resto é histórico. Ambiguidade não elege e não imprime.

export interface DraftPedido {
  draftId: string;
  rotulo: string;
  substituiDraftId: string | null;
}

export interface ResolucaoDrafts {
  vigente: DraftPedido | null;
  historico: DraftPedido[];
  emRevisao: DraftPedido[];
  imprimivelId: string | null;
  estado: "VERDE" | "VERMELHO" | "PENDENTE";
  motivo: string;
}

export function resolverSubstituicao(drafts: readonly DraftPedido[]): ResolucaoDrafts {
  if (drafts.length === 0) {
    return { vigente: null, historico: [], emRevisao: [], imprimivelId: null, estado: "PENDENTE", motivo: "sem drafts" };
  }

  const ids = drafts.map((draft) => draft.draftId);
  if (new Set(ids).size !== ids.length || ids.some((id) => id.trim().length === 0)) {
    return revisar(drafts, "identificador de draft ausente ou repetido");
  }

  const porId = new Map(drafts.map((draft) => [draft.draftId, draft]));
  const substituicoesPorAlvo = new Map<string, DraftPedido[]>();
  for (const draft of drafts) {
    if (draft.substituiDraftId === null) continue;
    if (draft.substituiDraftId === draft.draftId || !porId.has(draft.substituiDraftId)) {
      return revisar(drafts, "substituição aponta para draft inexistente ou para si");
    }
    const lista = substituicoesPorAlvo.get(draft.substituiDraftId) ?? [];
    lista.push(draft);
    substituicoesPorAlvo.set(draft.substituiDraftId, lista);
  }
  for (const lista of substituicoesPorAlvo.values()) {
    if (lista.length > 1) return revisar(drafts, "dois drafts substituem o mesmo pedido");
  }
  if (temCiclo(drafts, porId)) return revisar(drafts, "ciclo de substituição");

  const supersedidos = new Set(substituicoesPorAlvo.keys());
  const cabecas = drafts.filter((draft) => !supersedidos.has(draft.draftId));
  if (cabecas.length !== 1) return revisar(drafts, "mais de um draft vigente");

  const vigente = cabecas[0];
  if (vigente === undefined) return revisar(drafts, "mais de um draft vigente");
  const historico = cadeiaAteARaiz(vigente, porId);
  return {
    vigente,
    historico,
    emRevisao: [],
    imprimivelId: vigente.draftId,
    estado: "VERDE",
    motivo: "imprime só o draft vigente",
  };
}

function revisar(drafts: readonly DraftPedido[], motivo: string): ResolucaoDrafts {
  return {
    vigente: null,
    historico: [],
    emRevisao: [...drafts],
    imprimivelId: null,
    estado: "VERMELHO",
    motivo,
  };
}

function temCiclo(drafts: readonly DraftPedido[], porId: ReadonlyMap<string, DraftPedido>): boolean {
  const cor = new Map<string, "branco" | "cinza" | "preto">();
  const visitar = (id: string): boolean => {
    const estado = cor.get(id) ?? "branco";
    if (estado === "cinza") return true;
    if (estado === "preto") return false;
    cor.set(id, "cinza");
    const draft = porId.get(id);
    const proximo = draft?.substituiDraftId;
    if (proximo !== null && proximo !== undefined && visitar(proximo)) return true;
    cor.set(id, "preto");
    return false;
  };
  return drafts.some((draft) => visitar(draft.draftId));
}

function cadeiaAteARaiz(vigente: DraftPedido, porId: ReadonlyMap<string, DraftPedido>): DraftPedido[] {
  const historico: DraftPedido[] = [];
  const vistos = new Set<string>([vigente.draftId]);
  let cursor: DraftPedido | undefined = vigente;
  while (cursor?.substituiDraftId !== null && cursor?.substituiDraftId !== undefined) {
    const anterior = porId.get(cursor.substituiDraftId);
    if (anterior === undefined || vistos.has(anterior.draftId)) break;
    vistos.add(anterior.draftId);
    historico.push(anterior);
    cursor = anterior;
  }
  return historico.reverse();
}
