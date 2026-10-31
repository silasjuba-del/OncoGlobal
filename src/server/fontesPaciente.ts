import { z } from "zod";
import type { DatabaseSync } from "node:sqlite";
import type { ClinicalEvent } from "../contracts/operacao.js";
import { ClinicalFact, EncounterSegment } from "../contracts/w10/extracao.js";
import { ContextoSkill } from "../contracts/skillsClinicas.js";
import { MetodoCapturaTranscricao } from "../contracts/capturaTranscricao.js";
import { listarDrafts } from "../kernel/comandos/portas.js";
import { dadosDoEvento, eventosVigentes } from "../kernel/projections/snapshot.js";
import { hashCanonico } from "../modules/hash.js";

export const FontePaciente = z.object({ kind: z.literal("EXTRACAO_RASCUNHO"),
  input: z.object({ recordingId: z.string(), sourceId: z.string(), sourceType: ClinicalFact.shape.sourceType,
    captureMethod: MetodoCapturaTranscricao.optional(), rawTranscript: z.string().min(1) }),
  state: z.object({ segments: z.array(EncounterSegment) }),
  patientLinkReview: ContextoSkill.extend({ segmentId: z.string(), sourceId: z.string(), sourceHash: z.string(),
    reviewDecisionId: z.string(), exceptionId: z.string(), medicoId: z.string() }).strip(),
});
export type ContextoFonte = z.infer<typeof ContextoSkill>;
export function encontroNoHistorico(eventos: readonly ClinicalEvent[], origem: ContextoFonte, atual: ContextoFonte): boolean {
  if (origem.patientId !== atual.patientId || origem.tumorLotId !== atual.tumorLotId) return false;
  if (origem.encounterId === atual.encounterId) return true;
  const data = (id: string) => {
    const ds = new Set(eventosVigentes(eventos).flatMap(e => {
      const d = dadosDoEvento(e);
      return e.tipo === "AgendaEntry" && e.patientId === atual.patientId && e.encounterId === id
        && d?.patientId === atual.patientId && d.encounterId === id && z.iso.date().safeParse(d.data).success ? [String(d.data)] : [];
    }));
    return ds.size === 1 ? [...ds][0]! : null;
  };
  const a = data(origem.encounterId), b = data(atual.encounterId);
  return a !== null && b !== null && a < b;
}
/** Só retorna fontes com vínculo comprovado; não confirma o conteúdo clínico do documento. */
export function fontesPaciente(db: DatabaseSync, eventos: readonly ClinicalEvent[], contexto: ContextoFonte, historico: boolean) {
  return listarDrafts(db, contexto.patientId).flatMap(draft => {
    const p = FontePaciente.safeParse(draft.payload); if (!p.success) return [];
    const f = p.data, l = f.patientLinkReview;
    if (!encontroNoHistorico(eventos, l, contexto) || (!historico && l.encounterId !== contexto.encounterId)
      || draft.sourceId !== l.sourceId || f.input.sourceId !== l.sourceId) return [];
    const original = { ...draft.payload as Record<string, unknown> }; delete original.patientLinkReview;
    if (hashCanonico(original) !== l.sourceHash) return [];
    const provas = eventos.filter(e => {
      const d = dadosDoEvento(e), s = d?.source as Record<string, unknown> | undefined;
      return e.patientId === contexto.patientId && e.encounterId === l.encounterId && e.tumorLotId === l.tumorLotId
        && e.tipo === "ReviewDecision" && e.revisao === "CONFIRMADO" && e.operationId === l.reviewDecisionId && e.criadoPor.tipo === "SESSAO" && e.criadoPor.id === l.medicoId
        && d?.acao === "LIGAR_PACIENTE" && d.patientId === contexto.patientId && d.segmentId === l.segmentId && d.exceptionId === l.exceptionId
        && s?.draftId === draft.draftId && s.sourceId === l.sourceId && s.contentHash === l.sourceHash && s.revision === draft.revision - 1;
    });
    const segmentos = f.state.segments.filter(s => s.id === l.segmentId && s.sourceId === l.sourceId);
    if (provas.length !== 1 || segmentos.length !== 1 || segmentos[0]!.sourceType !== f.input.sourceType
      || segmentos[0]!.recordingId !== f.input.recordingId) return [];
    return [{ draft, fonte: f, texto: segmentos[0]!.rawTranscript }];
  });
}
