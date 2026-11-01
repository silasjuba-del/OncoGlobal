import { z } from "zod";
import { Id, Instante } from "./base.js";
import { FonteJornada } from "./jornadaClinica.js";
import { ContextoSkill } from "./skillsClinicas.js";

const Texto = z.string().trim().min(1).max(20000);
export const PoloDivergencia = z.object({
  id: Id, rotulo: Texto, fonteId: Id, localizador: Texto, afirmacao: Texto,
  edicao: Texto, natureza: z.enum(["PARAFRASE", "TRANSCRICAO"]),
  regulatorioBR: z.enum(["APROVADO", "NAO_APROVADO", "NAO_VERIFICADO"]).optional(),
}).strict().superRefine((p, ctx) => {
  if (/^NCCN(?:\b|-)/i.test(p.fonteId) && p.natureza !== "PARAFRASE")
    ctx.addIssue({ code: "custom", message: "NCCN_SOMENTE_PARAFRASE" });
});
export const DecisaoDivergencia = z.object({
  poloEscolhido: Id, decididoPor: Texto, crm: Texto, data: Instante, motivo: Texto,
  contexto: ContextoSkill,
  // Reference to the physician-signed record, not a boolean supplied by an LLM.
  assinatura: z.object({ documentId: Id, documentVersion: z.number().int().positive(),
    eventId: Id, revisao: z.literal("ASSINADO") }).strict(),
}).strict();
export const Divergencia = z.object({
  id: Id, tema: Texto, tipo: z.enum(["INTERNA", "EXTERNA", "REGULATORIA", "LACUNA"]),
  polos: z.array(PoloDivergencia).min(2), cartaoIds: z.array(Id).min(1),
  itensAfetados: z.array(Id).default([]),
  estado: z.enum(["ABERTA", "DECIDIDA", "SUPERADA"]), decisao: DecisaoDivergencia.nullable(),
  efeitoNoMotor: z.enum(["INDETERMINADO", "EXIBIR_AMBOS", "BLOQUEIA_DOCUMENTO_COM_DOSE"]),
  superadaPor: z.object({ fonteId: Id, localizador: Texto, edicao: Texto }).strict().nullable().default(null),
}).strict().superRefine((d, ctx) => {
  if (d.estado === "ABERTA" && d.decisao !== null) ctx.addIssue({ code: "custom", message: "ABERTA_SEM_DECISAO" });
  if (d.estado === "DECIDIDA" && d.decisao === null) ctx.addIssue({ code: "custom", message: "DECIDIDA_EXIGE_DECISAO" });
  if (d.decisao && !d.polos.some(p => p.id === d.decisao!.poloEscolhido))
    ctx.addIssue({ code: "custom", message: "POLO_ESCOLHIDO_INEXISTENTE" });
  if (d.estado === "SUPERADA" && !d.superadaPor) ctx.addIssue({ code: "custom", message: "SUPERADA_EXIGE_FONTE" });
  if (new Set(d.polos.map(p => p.id)).size !== d.polos.length) ctx.addIssue({ code: "custom", message: "POLO_DUPLICADO" });
});
export type Divergencia = z.infer<typeof Divergencia>;
export const FonteDivergencia = FonteJornada.extend({
  tipo: z.enum(["SBOC", "NCCN", "AULA_SECUNDARIA", "REGULATORIA", "ENSAIO", "INSTITUCIONAL", "HISTORICA", "COMPENDIO_DERIVADO", "AUSENTE"]),
  conferenciaDeclaradaEm: z.string().nullable().default(null),
}).strict();
export const CorpusDivergencias = z.object({
  versao: Texto, fontes: z.array(FonteDivergencia), divergencias: z.array(Divergencia),
  cartoes: z.array(z.object({ id: Id, estado: z.literal("RASCUNHO"), fontes: z.array(Id).min(1),
    conteudo: z.record(z.string(), z.json()), limites: z.array(Texto), dosesRtAprovadas: z.literal(false).default(false),
  }).strict()).default([]),
}).strict().superRefine((c, ctx) => {
  for (const grupo of [c.fontes, c.divergencias, c.cartoes])
    if (new Set(grupo.map(x => x.id)).size !== grupo.length) ctx.addIssue({ code: "custom", message: "ID_DUPLICADO" });
  const fontes = new Map(c.fontes.map(f => [f.id, f]));
  for (const d of c.divergencias) {
    for (const p of d.polos) {
      if (!fontes.has(p.fonteId)) ctx.addIssue({ code: "custom", message: `FONTE_AUSENTE:${p.fonteId}` });
      if (fontes.get(p.fonteId)?.tipo === "NCCN" && p.natureza !== "PARAFRASE")
        ctx.addIssue({ code: "custom", message: "NCCN_SOMENTE_PARAFRASE" });
    }
    if (d.superadaPor && !fontes.has(d.superadaPor.fonteId)) ctx.addIssue({ code: "custom", message: "FONTE_SUPERACAO_AUSENTE" });
  }
  if (c.cartoes.some(card => card.fontes.some(id => !fontes.has(id)))) ctx.addIssue({ code: "custom", message: "FONTE_CARTAO_AUSENTE" });
});
export type CorpusDivergencias = z.infer<typeof CorpusDivergencias>;

/** Creation accepts only open data; parsing signed historical records is a separate operation. */
export function criarDivergencia(raw: unknown): Divergencia {
  const d = Divergencia.parse(raw);
  if (d.estado !== "ABERTA" || d.decisao !== null) throw Error("CRIACAO_SOMENTE_ABERTA");
  return d;
}
