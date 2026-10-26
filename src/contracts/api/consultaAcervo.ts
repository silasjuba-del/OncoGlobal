import { z } from "zod";
import { ItemBibliotecaConteudo } from "./biblioteca.js";

const Hash = z.string().regex(/^[a-f0-9]{64}$/);
const Id = z.string().min(1).max(400);
const Versao = z.string().regex(/^\d+\.\d+\.\d+$/);
export const LocalizadorAcervo = z.object({
  campo: z.enum(["TEXTO", "TITULO", "TRECHO_FONTE"]),
  inicio: z.number().int().nonnegative(), fim: z.number().int().positive(),
  unidade: z.literal("UTF16"),
}).strict().refine(v => v.fim > v.inicio, "Intervalo vazio ou invertido");
export const PedidoBuscaAcervo = z.object({ consulta: z.string().min(1).max(200).refine(v => v.trim().length > 0), limite: z.number().int().min(1).max(50).default(20) }).strict();
export const PedidoLeituraAcervo = z.object({ docId: Id, versao: Versao, hashSha256: Hash, revisaoAcervo: Hash,
  localizador: LocalizadorAcervo.optional(),
}).strict();
export const ReferenciaBibliotecaAcervo = z.object({ id: Id, versao: Versao, hash: Hash }).strict();
export const DocumentRef = z.object({
  schema: z.literal("DocumentRef@1"), docId: Id, pacoteId: Id, itemId: Id, versao: Versao,
  hashSha256: Hash, revisaoAcervo: Hash, titulo: z.string(),
  natureza: z.literal("ITEM_TEXTUAL_CURADO"), classificacao: z.literal("NAO_DECLARADA"),
  originalBinarioDisponivel: z.literal(false),
  localizador: LocalizadorAcervo, trecho: z.string().min(1),
  proveniencia: ItemBibliotecaConteudo.shape.proveniencia,
}).strict();
export type DocumentRef = z.infer<typeof DocumentRef>;
export const CoberturaAcervo = z.object({
  escopo: z.literal("ITENS_CONSULTAVEIS_DO_PACOTE_ATIVO"), metodo: z.literal("LITERAL_SENSIVEL_A_CAIXA"),
  completudeFontesExternas: z.literal("NAO_GARANTIDA"),
  itensConsultaveis: z.number().int().nonnegative(), encontrados: z.number().int().nonnegative(),
  retornados: z.number().int().nonnegative(), truncado: z.boolean(),
}).strict();
export const BuscaAcervoResposta = z.object({
  codigo: z.enum(["ACERVO_RESULTADOS", "ACERVO_SEM_RESULTADOS", "ACERVO_VAZIO"]),
  referenciaBiblioteca: ReferenciaBibliotecaAcervo.nullable(), revisaoAcervo: Hash.nullable(),
  cobertura: CoberturaAcervo, resultados: z.array(DocumentRef).max(50),
}).strict();
export const LeituraAcervoResposta = z.object({ codigo: z.literal("ACERVO_DOCUMENTO"),
  referenciaBiblioteca: ReferenciaBibliotecaAcervo, revisaoAcervo: Hash,
  documento: DocumentRef, conteudo: ItemBibliotecaConteudo,
}).strict();
export const SaidasConsultaAcervo = {
  "/acervo/buscar": BuscaAcervoResposta,
  "/acervo/ler": LeituraAcervoResposta,
} as const;
