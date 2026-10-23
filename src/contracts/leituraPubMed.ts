import { z } from "zod";
import { Id, Instante } from "./base.js";

/** Metadado bibliográfico. Não é fato, prescrição nem conduta. */
export const ReferenciaPubMed = z.object({
  pmid: z.string().regex(/^\d{1,9}$/),
  titulo: z.string().trim().min(1).max(500),
  periodico: z.string().trim().min(1).max(240),
  publicadoEm: z.string().trim().min(1).max(40),
  url: z.string().url(),
  recuperadoEm: Instante,
  fatoClinico: z.literal(false),
}).strict();
export type ReferenciaPubMed = z.infer<typeof ReferenciaPubMed>;

export const LeituraPubMedResposta = z.object({
  codigo: z.enum(["REFERENCIAS_SALVAS", "REPLAY"]),
  draftId: Id,
  revision: z.number().int().nonnegative(),
  referencias: z.array(ReferenciaPubMed).max(8),
  criaEventoClinico: z.literal(false),
  consultaClinica: z.literal(false),
}).strict();
export type LeituraPubMedResposta = z.infer<typeof LeituraPubMedResposta>;

export const LIMITE_LISTA_RASCUNHOS_PUBMED = 40;

export const RascunhoPubMedLista = z.object({
  draftId: Id,
  revision: z.number().int().nonnegative(),
  criadoEm: Instante,
  referencias: z.array(ReferenciaPubMed).max(8),
  criaEventoClinico: z.literal(false),
  consultaClinica: z.literal(false),
}).strict();
export type RascunhoPubMedLista = z.infer<typeof RascunhoPubMedLista>;

export const ListaRascunhosPubMedResposta = z.object({
  codigo: z.literal("RASCUNHOS_PUBMED_LISTADOS"),
  itens: z.array(RascunhoPubMedLista).max(LIMITE_LISTA_RASCUNHOS_PUBMED),
  omitidos: z.number().int().nonnegative(),
  truncado: z.boolean(),
  criaEventoClinico: z.literal(false),
  consultaClinica: z.literal(false),
}).strict();
export type ListaRascunhosPubMedResposta = z.infer<typeof ListaRascunhosPubMedResposta>;

export const ORIGEM_EUTILS = "https://eutils.ncbi.nlm.nih.gov";
export const LIMITE_REFERENCIAS_PUBMED = 8;
export const LIMITE_BYTES_PUBMED = 262_144;
