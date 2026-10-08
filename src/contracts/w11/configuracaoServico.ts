// W11-H21 · configuração do SERVIÇO (não do perfil local do médico). Padrão seguro: sem receituário especial.
import { z } from "zod";

export const ConfiguracaoServicoSchema = z.object({
  servicoTemReceituarioEspecial: z.boolean(),
}).strict();

export type ConfiguracaoServico = z.infer<typeof ConfiguracaoServicoSchema>;

export const CONFIGURACAO_SERVICO_PADRAO: ConfiguracaoServico = { servicoTemReceituarioEspecial: false };
