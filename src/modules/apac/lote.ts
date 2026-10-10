// GRK-08 · ApacBatch operacional. Item BLOQUEADO sai com motivo. Cirurgia é AIH. O lote segue.

export interface CriterioApacBatch {
  competencia: string | null;
  cid: string | null;
  esquema: string | null;
  estado: string | null;
}

export interface ItemApacLote {
  apacId: string;
  competencia: string | null;
  cid: string | null;
  esquema: string | null;
  estado: "RASCUNHO" | "EMITIDA" | "AUTORIZADA" | "NEGADA" | "VENCIDA";
  artefato: "PRONTO" | "EM_REVISAO" | "BLOQUEADO";
  modalidade: "APAC" | "CIRURGIA";
  motivoBloqueio: string | null;
}

export interface ResultadoItemLote {
  apacId: string;
  incluido: boolean;
  motivo: string;
}

export interface ExclusaoLote {
  apacId: string;
  motivo: string;
}

export interface ApacBatch {
  batchId: string;
  criterio: CriterioApacBatch;
  itens: string[];
  excluidos: ExclusaoLote[];
  resultados: ResultadoItemLote[];
  geradoEm: string;
  trava: false;
}

export function montarApacBatch(
  batchId: string,
  criterio: CriterioApacBatch,
  itens: readonly ItemApacLote[],
  geradoEm: string,
): ApacBatch {
  const repetidos = idsRepetidos(itens);
  const resultados: ResultadoItemLote[] = [];
  const incluidos: string[] = [];
  const excluidos: ExclusaoLote[] = [];

  // D-W5-10: lote diário pode ter vários pacientes, mas UMA competência. Sem critério explícito,
  // a competência do lote é a do primeiro item elegível; os demais meses vão para o lote deles.
  let competenciaLote = criterio.competencia;
  // Só um item plenamente elegível (com competência) elege a competência do lote;
  // item sem competência é excluído depois e não interrompe a eleição.
  for (const item of itens) {
    const motivo = motivoExclusao(item, criterio, repetidos);
    if (motivo !== null || !item.competencia) continue;
    if (competenciaLote === null) competenciaLote = item.competencia;
    break;
  }
  for (const item of itens) {
    let motivo = motivoExclusao(item, criterio, repetidos);
    if (motivo === null && !item.competencia) motivo = "competência ausente";
    else if (motivo === null && item.competencia !== competenciaLote)
      motivo = `outra competência (${item.competencia}): vai para o lote dela`;
    const resultado = { apacId: item.apacId, incluido: motivo === null, motivo: motivo ?? "incluído" };
    resultados.push(resultado);
    if (motivo === null) incluidos.push(item.apacId);
    else excluidos.push({ apacId: item.apacId, motivo });
  }

  return {
    batchId,
    criterio: {
      competencia: competenciaLote,
      cid: criterio.cid,
      esquema: criterio.esquema,
      estado: criterio.estado,
    },
    itens: incluidos,
    excluidos,
    resultados,
    geradoEm,
    trava: false,
  };
}

function idsRepetidos(itens: readonly ItemApacLote[]): Set<string> {
  const contagem = new Map<string, number>();
  for (const item of itens) contagem.set(item.apacId, (contagem.get(item.apacId) ?? 0) + 1);
  const repetidos = new Set<string>();
  for (const [id, vezes] of contagem) if (vezes > 1) repetidos.add(id);
  return repetidos;
}

function motivoExclusao(
  item: ItemApacLote,
  criterio: CriterioApacBatch,
  repetidos: ReadonlySet<string>,
): string | null {
  if (item.apacId.trim().length === 0) return "identificador ausente";
  if (repetidos.has(item.apacId)) return "identificador repetido no lote; nada eleito";
  if (item.modalidade === "CIRURGIA") return "cirurgia segue por AIH, fora da APAC";
  // Q35/FN-12: nem criterio aberto nem filtro explicito tornam VENCIDA faturavel.
  if (item.estado === "VENCIDA") return "APAC vencida: faturamento nao emite; consulta segue";
  if (item.artefato === "BLOQUEADO") {
    return item.motivoBloqueio !== null && item.motivoBloqueio.trim().length > 0
      ? item.motivoBloqueio
      : "[VERIFICAR] bloqueio sem motivo";
  }
  if (!casa(criterio.competencia, item.competencia)) return "fora do critério: competência";
  if (!casa(criterio.cid, item.cid)) return "fora do critério: cid";
  if (!casa(criterio.esquema, item.esquema)) return "fora do critério: esquema";
  if (!casa(criterio.estado, item.estado)) return "fora do critério: estado";
  return null;
}

function casa(esperado: string | null, valor: string | null): boolean {
  if (esperado === null) return true;
  return valor === esperado;
}
