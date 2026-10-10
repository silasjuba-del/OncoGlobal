// D-W9-67 · completude do kit do TumorLot a partir do pack (sem inventar campo clínico).

export interface ItemKitPack {
  id: string;
  rotulo?: string;
  ativo?: boolean;
}

export interface PackKitLike {
  labsBaseline?: readonly ItemKitPack[];
  imagem?: { baseline?: readonly ItemKitPack[] };
  completudeKit?: { limiarIncompleto?: number; bloqueiaApacSeIncompleto?: boolean };
}

export interface ResultadoCompletudeKit {
  obrigatorios: readonly string[];
  presentes: readonly string[];
  ausentes: readonly string[];
  score: number;
  kitIncompleto: boolean;
  bloqueiaApac: boolean;
  limiar: number;
}

/** IDs ativos do baseline (labs + imagem) do pack. */
export function idsObrigatoriosKit(pack: PackKitLike): string[] {
  const labs = (pack.labsBaseline ?? []).filter((i) => i.ativo === true).map((i) => i.id);
  const imgs = (pack.imagem?.baseline ?? []).filter((i) => i.ativo === true).map((i) => i.id);
  return [...labs, ...imgs];
}

/**
 * Completude do kit do lote. Ausente = PENDENTE (não vira zero clínico).
 * score = presentes / obrigatórios; NaN se não há obrigatório ativo.
 */
export function completudeKitTumorLot(
  pack: PackKitLike,
  documentados: ReadonlySet<string> | readonly string[],
): ResultadoCompletudeKit {
  const obrigatorios = idsObrigatoriosKit(pack);
  const docs = documentados instanceof Set ? documentados : new Set(documentados);
  const presentes = obrigatorios.filter((id) => docs.has(id));
  const ausentes = obrigatorios.filter((id) => !docs.has(id));
  const limiar = pack.completudeKit?.limiarIncompleto ?? 0.6;
  const score = obrigatorios.length === 0 ? 1 : presentes.length / obrigatorios.length;
  const kitIncompleto = obrigatorios.length > 0 && score < limiar;
  const bloqueiaApac = kitIncompleto && pack.completudeKit?.bloqueiaApacSeIncompleto === true;
  return { obrigatorios, presentes, ausentes, score, kitIncompleto, bloqueiaApac, limiar };
}
