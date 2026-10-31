import { z } from "zod";
import { ContextoAcaoComposta } from "./acoesCompostas.js";
import { RoteiroAnamneseTumor, ResumoEstruturadoAnamnese, RespostaPassoAnamnese } from "../f5/anamneseEOncoChief.js";
const contexto = ContextoAcaoComposta;
export const PedidoAnamneseGuiada = z.discriminatedUnion("acao", [
  z.object({ acao: z.literal("BASE"), contexto }).strict(),
  z.object({ acao: z.literal("CONFERIR_ROTEIRO"), contexto, tumorPackId: z.string().min(1),
    contextoClinico: RoteiroAnamneseTumor.shape.contextoClinico, perguntas: z.array(z.string().trim().min(1).max(1000)).min(1).max(30) }).strict(),
  z.object({ acao: z.literal("COMPILAR"), contexto, roteiroId: z.string().min(1), contatoId: z.string().min(1), pedidoId: z.string().min(1).max(100),
    respostas: z.array(z.object({ passoId: z.string().min(1), mensagemId: z.string().min(1), polaridade: RespostaPassoAnamnese.shape.polaridade }).strict()).max(30) }).strict(),
]);
export type PedidoAnamneseGuiada = z.infer<typeof PedidoAnamneseGuiada>;
export const RespostaAnamneseGuiada = z.object({ codigo: z.literal("ANAMNESE_GUIADA"), contexto,
  packs: z.array(z.object({ id: z.string(), titulo: z.string() }).strict()), roteiros: z.array(RoteiroAnamneseTumor),
  mensagens: z.array(z.object({ mensagemId: z.string(), texto: z.string(), em: z.string(), contatoId: z.string() }).strict()),
  historico: z.array(ResumoEstruturadoAnamnese), resumo: ResumoEstruturadoAnamnese.nullable(),
}).strict();
export type RespostaAnamneseGuiada = z.infer<typeof RespostaAnamneseGuiada>;
