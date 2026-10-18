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
  score: number | null;
  kitIncompleto: boolean;
  bloqueiaApac: boolean;
  limiar: number | null;
}

/** IDs ativos do baseline (labs + imagem) do pack. */
export function idsObrigatoriosKit(pack: PackKitLike): string[] {
  const labs = (pack.labsBaseline ?? []).filter((i) => i.ativo === true).map((i) => i.id);
  const imgs = (pack.imagem?.baseline ?? []).filter((i) => i.ativo === true).map((i) => i.id);
  return [...new Set([...labs, ...imgs].filter(id=>id.trim()))];
}

/**
 * Completude do kit do lote. Ausente = PENDENTE (não vira zero clínico).
 * score = presentes / obrigatórios; null se não há obrigatório ativo.
 */
export function completudeKitTumorLot(
  pack: PackKitLike,
  documentados: ReadonlySet<string> | readonly string[],
): ResultadoCompletudeKit {
  const obrigatorios = idsObrigatoriosKit(pack);
  const docs = documentados instanceof Set ? documentados : new Set(documentados);
  const presentes = obrigatorios.filter((id) => docs.has(id));
  const ausentes = obrigatorios.filter((id) => !docs.has(id));
  const informado = pack.completudeKit?.limiarIncompleto ?? 0.6;
  const limiar = Number.isFinite(informado)&&informado>=0&&informado<=1?informado:null;
  const score = obrigatorios.length === 0 ? null : presentes.length / obrigatorios.length;
  const kitIncompleto = score === null || limiar === null || score < limiar;
  const bloqueiaApac = kitIncompleto && pack.completudeKit?.bloqueiaApacSeIncompleto === true;
  return { obrigatorios, presentes, ausentes, score, kitIncompleto, bloqueiaApac, limiar };
}
