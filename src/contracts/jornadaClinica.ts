import { z } from "zod";
const Texto = z.string().trim().min(1);
export const FonteJornada = z.object({ id: Texto, titulo: Texto, arquivo: Texto.nullable(), url: z.url().nullable(),
  sha256: z.string().regex(/^[a-f0-9]{64}$/).nullable(), estado: Texto }).strict();
export const ReferenciaJornada = z.object({ fonte: Texto, paginas_pdf: z.array(z.number().int().positive()).min(1).optional(), secao: Texto.nullable().optional() }).strict();
const Linha = z.object({ opcoes: z.array(Texto), fontes: z.array(ReferenciaJornada), condicao: z.string(),
  estado: z.enum(["EXTRAIDO_PARA_REVISAO", "SEM_FONTE_ESTRUTURADA", "NAO_APLICAVEL"]) }).strict();
export const CartaoJornada = z.object({ id: Texto, grupo: Texto, estadiamento: Texto, subtipo: Texto,
  modalidades: z.array(Texto).min(1), papeis: z.array(Texto).min(1), trilha: Texto,
  fontes: z.array(ReferenciaJornada).min(1), linhas: z.object({ "1": Linha, "2": Linha, "3": Linha, "4": Linha, "5": Linha }).strict(),
  condicoes_e_limites: z.array(Texto), divergencias: z.array(Texto), estado: z.literal("RASCUNHO_DOCUMENTAL_NAO_EXECUTAVEL") }).strict();
export const AcaoCorpusJornada = z.object({ id: Texto, contexto: Texto, rascunho: Texto, condicao: Texto,
  fontes: z.array(ReferenciaJornada).min(1), pendencia: z.string(), estado: z.literal("PROPOSTA_PARA_MEDICO"), executado: z.literal(false) }).strict();
export const CorpusJornada = z.object({ schema: z.literal("CorpusJornada@1"), versao: Texto,
  estado: z.literal("RASCUNHO"), fontes: z.array(FonteJornada).min(1), cartoes: z.array(CartaoJornada).min(1),
  acoes_consulta: z.array(AcaoCorpusJornada), divergencias: z.array(z.object({ id: Texto, posicao_a: Texto, posicao_b: Texto,
    tratamento: Texto, fontes: z.array(ReferenciaJornada).min(1) }).strict()), limites: z.array(Texto),
}).strict().superRefine((c, ctx) => {
  for (const itens of [c.fontes, c.cartoes, c.acoes_consulta, c.divergencias])
    if (new Set(itens.map(i => i.id)).size !== itens.length) ctx.addIssue({ code: "custom", message: "IDs duplicados no corpus" });
  const fontes = new Set(c.fontes.map(f => f.id)), divs = new Set(c.divergencias.map(d => d.id));
  const refs = [...c.cartoes.flatMap(c => [...c.fontes, ...Object.values(c.linhas).flatMap(l => l.fontes)]),
    ...c.acoes_consulta.flatMap(a => a.fontes), ...c.divergencias.flatMap(d => d.fontes)];
  if (refs.some(r => !fontes.has(r.fonte))) ctx.addIssue({ code: "custom", message: "Referência órfã" });
  for (const card of c.cartoes) {
    if (card.divergencias.some(d => !divs.has(d))) ctx.addIssue({ code: "custom", message: "Divergência órfã" });
    for (const l of Object.values(card.linhas)) if (l.opcoes.length && (!l.fontes.length || l.estado !== "EXTRAIDO_PARA_REVISAO"))
      ctx.addIssue({ code: "custom", message: "Opção sem fonte ou indevidamente marcada como lacuna" });
  }
});
export type CorpusJornada = z.infer<typeof CorpusJornada>;
export const ConfiguracaoJornada = z.object({
  cartoesIds: z.array(Texto).max(12).default([]), acoesIds: z.array(Texto).max(20).default([]),
  discutirTratamento: z.boolean().default(false),
}).strict().refine(c => new Set(c.cartoesIds).size === c.cartoesIds.length && new Set(c.acoesIds).size === c.acoesIds.length, "Seleção duplicada");
export const ResultadoJornada = z.object({
  versao: z.literal("1.0.0"), tipo: z.enum(["PRIMEIRA_CONSULTA", "RETORNO", "FOLLOW_UP"]),
  estado: z.enum(["PARCIAL", "URGENTE"]), corpusHash: Texto.nullable(), ledgerHash: Texto, avaliacaoHash: Texto,
  etapas: z.array(z.object({ id: Texto, titulo: Texto, estado: z.enum(["EXECUTADA", "PENDENTE", "INTERROMPIDA"]), motivo: Texto }).strict()),
  alertas: z.array(z.object({ texto: Texto, sourceId: Texto.nullable(), trecho: z.string().nullable() }).strict()),
  seguranca: z.array(Texto), mudancas: z.array(Texto), cartoes: z.array(CartaoJornada),
  criterios: z.array(z.object({ id: Texto, tipo: z.enum(["ELEGIBILIDADE", "SEGURANCA"]),
    estado: z.enum(["ATENDE", "NAO_ATENDE", "INDETERMINADO"]), texto: Texto }).strict()),
  acoes: z.array(AcaoCorpusJornada), fontes: z.array(FonteJornada), divergencias: CorpusJornada.shape.divergencias,
  pendencias: z.array(Texto), autorizaTratamento: z.literal(false),
}).strict();
export type ResultadoJornada = z.infer<typeof ResultadoJornada>;
