import { z } from "zod";
import { ClinicalFact } from "../../contracts/w10/extracao.js";

export const FonteRevisao = z.object({ draft: z.object({
  draftId: z.string(), patientId: z.string(), revision: z.number().int().nonnegative(),
  payload: z.object({ kind: z.literal("EXTRACAO_RASCUNHO"),
    input: z.object({ sourceId: z.string(), rawTranscript: z.string() }),
    state: z.object({ facts: z.array(ClinicalFact) }),
    patientLinkReview: z.object({ patientId: z.string(), encounterId: z.string(), tumorLotId: z.string().nullable() }),
  }),
}) });
export const ComprovanteRevisao = z.object({ documentId: z.string(), documentVersion: z.number().int().positive(),
  conteudoHash: z.string().regex(/^[a-f0-9]{64}$/) });
export const RevisaoPreparada = z.object({ codigo: z.literal("REVISAO_PREPARADA"), criaEventoClinico: z.literal(false),
  conteudo: z.object({ kind: z.literal("EVOLUCAO_RASCUNHO"), status: z.literal("RASCUNHO"), resumo: z.string(),
    contexto: z.object({ patientId: z.string(), encounterId: z.string(), tumorLotId: z.string().nullable() }),
    selectedFactIds: z.array(z.string()), facts: z.array(ClinicalFact),
  }).passthrough(), comprovanteExibicao: ComprovanteRevisao });
export type PedidoRevisaoExtracao = { draftId: string; expectedRevision: number; patientId: string;
  factIds: string[]; operationId: string; comprovanteExibicao?: z.infer<typeof ComprovanteRevisao> };
export type FonteRevisao = z.infer<typeof FonteRevisao>;
export type RevisaoPreparada = z.infer<typeof RevisaoPreparada>;
