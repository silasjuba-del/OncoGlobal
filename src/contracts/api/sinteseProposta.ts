import { z } from "zod";
import { Correlacao } from "../f1/correlacao.js";
import { ReferenciaFato } from "../f1/achadosSetor.js";
export const SintesePropostaResposta = z.object({ codigo: z.enum(["PROPOSTA_SINTESE_SALVA", "PROPOSTA_SINTESE_REPLAY", "PENDENTE"]),
  contexto: z.object({ patientId: z.string().min(1), encounterId: z.string().min(1), tumorLotId: z.string().nullable() }).strict(),
  criaEventoClinico: z.literal(false), motivo: z.string().optional(), draftId: z.string().optional(),
  proposta: z.object({ status: z.literal("PROPOSTA_DE_SINTESE"), revisaoObrigatoria: z.literal(true), correlacao: Correlacao,
    citacoes: z.array(z.object({ texto: z.string().min(1), fatos: z.array(ReferenciaFato).min(1) }).strict()).min(1) }).strict().optional(),
  fatosRetrato: z.array(ReferenciaFato),
}).strict().superRefine((r, ctx) => {
  const p = r.proposta;
  if (r.codigo !== "PENDENTE" && !p) ctx.addIssue({ code: "custom", message: "PROPOSTA_AUSENTE" });
  if (p && (p.correlacao.patientId !== r.contexto.patientId || p.correlacao.encounterId !== r.contexto.encounterId || p.correlacao.tumorLotId !== r.contexto.tumorLotId))
    ctx.addIssue({ code: "custom", message: "PROPOSTA_FORA_CONTEXTO" });
  const existentes = new Set(r.fatosRetrato.map(f => JSON.stringify(f)));
  if (p?.citacoes.some(c => c.fatos.some(f => !existentes.has(JSON.stringify(f))))) ctx.addIssue({ code: "custom", message: "CITACAO_SEM_FATO_REAL" });
});
export type SintesePropostaResposta = z.infer<typeof SintesePropostaResposta>;
