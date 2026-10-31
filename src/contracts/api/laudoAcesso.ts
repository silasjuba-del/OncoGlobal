import { z } from "zod";
import { ContextoAcaoComposta } from "./acoesCompostas.js";
import { CitacaoEvidenciaLaudo, MinutaLaudoAcessoJudicial } from "../f4/acessoEJudicializacao.js";
const Hash = z.string().regex(/^[a-f0-9]{64}$/);
const contexto = ContextoAcaoComposta;
export const PedidoLaudoAcesso = z.discriminatedUnion("acao", [
  z.object({ acao: z.literal("ABRIR"), contexto, minutaId: z.string().min(1) }).strict(),
  z.object({ acao: z.literal("BASE"), contexto }).strict(),
  z.object({ acao: z.literal("PREPARAR"), contexto, baseHash: Hash, pedidoId: z.string().min(1).max(100),
    medicamento: MinutaLaudoAcessoJudicial.shape.medicamentoSolicitado,
    indicacao: z.string().trim().min(1).max(2000), citacoesIds: z.array(z.string().min(1)).min(1).max(50),
  }).strict(),
  z.object({ acao: z.literal("ASSINAR"), contexto, minutaId: z.string().min(1), conteudoHash: Hash }).strict(),
]);
export type PedidoLaudoAcesso = z.infer<typeof PedidoLaudoAcesso>;
export const RespostaLaudoAcesso = z.object({ codigo: z.literal("LAUDO_ACESSO"), contexto, baseHash: Hash,
  fontes: z.array(CitacaoEvidenciaLaudo), pendencias: z.array(z.string()),
  historico: z.array(MinutaLaudoAcessoJudicial), minuta: MinutaLaudoAcessoJudicial.nullable(), conteudoHash: Hash.nullable(),
}).strict();
export type RespostaLaudoAcesso = z.infer<typeof RespostaLaudoAcesso>;
