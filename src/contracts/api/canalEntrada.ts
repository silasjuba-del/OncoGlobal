import { z } from "zod";
import { EstadoConversa } from "../estados.js";
import { CanalFonte, EstadoAvaliacaoCanal, EstadoReciboEntradaCanal, EstadoVinculoContatoEntrada, VinculoContatoEntrada } from "../f2/canalEntrada.js";

const Id = z.string().min(1).max(250).refine((value) => value.trim().length > 0, "identificador vazio");
const Instante = z.iso.datetime({ offset: true });
const HashSha256 = z.string().regex(/^[a-f0-9]{64}$/);
const TextoMensagem = z.string().min(1).max(250_000)
  .refine((texto) => new TextEncoder().encode(texto).byteLength <= 250_000, "texto excede 250 kB UTF-8");

/** Resumo de contato não confirmado: sem patientId, diagnóstico, red flag ou decisão clínica. */
export const ContactSummary = z.object({
  contatoId: Id.nullable(), canal: CanalFonte, quantidadeMensagens: z.number().int().nonnegative().max(1_000_000),
  ultimaMensagemEm: Instante.nullable(), estadoVinculo: EstadoVinculoContatoEntrada,
  avaliacao: EstadoAvaliacaoCanal,
}).strict();
export type ContactSummary = z.infer<typeof ContactSummary>;

const ConteudoInbox = z.discriminatedUnion("tipo", [
  z.object({ tipo: z.literal("TEXT"), texto: TextoMensagem, contentSha256: HashSha256 }).strict(),
  z.object({ tipo: z.literal("MEDIA_UNPROCESSED"), processamento: z.literal("NAO_PROCESSADA"),
    providerMediaId: Id, mimeType: z.string().min(1).max(120).nullable(), sizeBytes: z.number().int().nonnegative().max(25_000_000).nullable(),
    contentSha256: HashSha256.nullable() }).strict(),
]);

/** Projeção operacional local. Não é fato clínico confirmado nem autorização de resposta/egress. */
export const CanalInboxItem = z.object({
  mensagemId: Id, accountId: Id, canal: CanalFonte, providerMessageId: Id, senderRef: Id,
  providerSentAt: Instante.nullable(), ingestedAt: Instante, payloadSha256: HashSha256,
  reciboTransporte: EstadoReciboEntradaCanal, estadoConversa: EstadoConversa,
  vinculoContato: VinculoContatoEntrada,
  avaliacao: EstadoAvaliacaoCanal,
  conteudo: ConteudoInbox,
}).strict();
export type CanalInboxItem = z.infer<typeof CanalInboxItem>;

export const CanalInbox = z.object({
  estado: z.enum(["DISPONIVEL", "PENDENTE", "SEM_MENSAGENS"]),
  mensagens: z.array(CanalInboxItem).max(500),
  contatos: z.array(ContactSummary).max(500),
}).strict();
export type CanalInbox = z.infer<typeof CanalInbox>;
