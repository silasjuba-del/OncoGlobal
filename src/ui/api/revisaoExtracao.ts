import { z } from "zod";
import { ClinicalFact, EncounterSegment, ReviewException } from "../../contracts/w10/extracao.js";

export const FonteRevisao = z.object({ draft: z.object({
  draftId: z.string(), patientId: z.string(), revision: z.number().int().nonnegative(),
  payload: z.object({ kind: z.literal("EXTRACAO_RASCUNHO"),
    input: z.object({ sourceId: z.string(), rawTranscript: z.string() }),
    state: z.object({ facts: z.array(ClinicalFact) }),
    alertasRads: z.array(z.object({ nome: z.string(), trecho: z.string(), sourceId: z.string(),
      confirmadoPeloMedico: z.literal(false), bloqueiaSalvar: z.literal(false) })).optional(),
    patientLinkReview: z.object({ patientId: z.string(), encounterId: z.string(), tumorLotId: z.string().nullable(),
      segmentId: z.string().optional() }),
  }),
}) });
export const ComprovanteRevisao = z.object({ documentId: z.string(), documentVersion: z.number().int().positive(),
  conteudoHash: z.string().regex(/^[a-f0-9]{64}$/) });
export const RevisaoPreparada = z.object({ codigo: z.literal("REVISAO_PREPARADA"), criaEventoClinico: z.literal(false),
  conteudo: z.object({ kind: z.literal("EVOLUCAO_RASCUNHO"), status: z.literal("RASCUNHO"), resumo: z.string(),
    contexto: z.object({ patientId: z.string(), encounterId: z.string(), tumorLotId: z.string().nullable() }),
    selectedFactIds: z.array(z.string()), facts: z.array(ClinicalFact),
  }).passthrough(), comprovanteExibicao: ComprovanteRevisao });
export const ReconciliacaoProposta = z.object({
  codigo: z.literal("RECONCILIACAO_PROPOSTA"), decisaoClinicaTomada: z.literal(false),
  contexto: z.object({ patientId: z.string(), encounterId: z.string(), tumorLotId: z.string().nullable(), dataClinica: z.string() }),
  fontes: z.array(z.object({ draftId: z.string(), sourceId: z.string(), recordingId: z.string(), segmentId: z.string(), dataClinica: z.string() })),
  segmentos: z.array(EncounterSegment), fatos: z.array(ClinicalFact), campos: z.record(z.string(), z.unknown()),
  conflitos: z.array(ReviewException), excecoes: z.array(ReviewException),
  deduplicacao: z.object({ repeticoes: z.array(z.object({ estado: z.literal("PENDENTE_REVISAO"),
    chaveExame: z.string(), fontes: z.array(z.object({ recordingId: z.string(), sourceId: z.string(),
      page: z.number().int().optional(), versao: z.string().nullable(), contexto: z.object({
        encounterId: z.string(), dataClinica: z.string() }).optional() })),
    fatoPrincipalIds: z.array(z.string()), fatoRepetidoIds: z.array(z.string()) })),
    versoesDiscordantes: z.array(z.object({ chaveExame: z.string(), factIds: z.array(z.string()), fontes: z.array(z.unknown()) })),
    fatoRepetidoIds: z.array(z.string()) }),
  timelines: z.array(z.unknown()),
});
export type PedidoRevisaoExtracao = { draftId: string; expectedRevision: number; patientId: string;
  factIds: string[]; operationId: string; comprovanteExibicao?: z.infer<typeof ComprovanteRevisao> };
export type FonteRevisao = z.infer<typeof FonteRevisao>;
export type RevisaoPreparada = z.infer<typeof RevisaoPreparada>;
export type ReconciliacaoProposta = z.infer<typeof ReconciliacaoProposta>;
