// FUGU-10 (interface) · Timeline do contrato W10 → seções para a tela, sem tocar em src/modules.
// Ausente = PENDENTE (nunca VERDE); conflito não resolvido = VERMELHO; semáforo de 3 estados.
import { secaoDe, secaoVazia, type Secao } from "../../modules/tipos.js";
import type {
  PatientTimeline, RecistAvaliacao, StageEntry, TreatmentEntry,
} from "../../contracts/w10/clinico-w10.js";

export interface SecoesTimeline {
  readonly estadiamento: Secao<StageEntry>;
  readonly tratamento: Secao<TreatmentEntry>;
  readonly recist: Secao<RecistAvaliacao>;
  readonly pendencias: Secao<string>;
  readonly conflitos: Secao<string>;
}

/**
 * Converte a projeção longitudinal em seções prontas para a tela (mesmos tipos de `src/modules`).
 * Não recalcula RECIST, não elege valor em conflito e não transforma ausência em VERDE.
 */
export function secoesDaTimeline(timeline: PatientTimeline): SecoesTimeline {
  const estadiamento = timeline.stageHistory.length
    ? secaoDe("VERDE", `${timeline.stageHistory.length} avaliação(ões) de estadiamento com fonte`, timeline.stageHistory)
    : secaoVazia<StageEntry>("sem estadiamento documentado: PENDENTE (ausência nunca é M0 nem Mx)");

  const tratamento = timeline.treatments.length
    ? secaoDe("VERDE", `${timeline.treatments.length} entrada(s) de tratamento (proposto→concluído)`, timeline.treatments)
    : secaoVazia<TreatmentEntry>("sem tratamento documentado: PENDENTE");

  const recist = timeline.recist.length
    ? secaoDe("VERDE", "avaliações RECIST calculadas por código (src/rules/recist)", timeline.recist)
    : secaoVazia<RecistAvaliacao>("RECIST não calculado aqui: cálculo é de src/rules/recist; categoria nasce PROPOSTA");

  const pendencias = timeline.missingRequiredData.length
    ? secaoDe("PENDENTE", `${timeline.missingRequiredData.length} campo(s) obrigatório(s) ausente(s) (NÃO SEI)`, timeline.missingRequiredData)
    : secaoDe("VERDE", "nenhum campo obrigatório ausente para o tumor identificado", [] as string[]);

  const conflitos = timeline.unresolvedConflicts.length
    ? secaoDe("VERMELHO", `${timeline.unresolvedConflicts.length} conflito(s) não resolvido(s)`, timeline.unresolvedConflicts)
    : secaoDe("VERDE", "nenhum conflito não resolvido entre os fatos reconciliados", [] as string[]);

  return { estadiamento, tratamento, recist, pendencias, conflitos };
}