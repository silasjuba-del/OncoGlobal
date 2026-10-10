// W11-H21 · leitor da configuração do serviço. Puro: recebe o valor cru, nunca lê arquivo.
// Valor ausente ou inválido cai no padrão seguro (sem receituário especial). Separado do perfil local de settings.ts.
import {
  CONFIGURACAO_SERVICO_PADRAO, ConfiguracaoServicoSchema, type ConfiguracaoServico,
} from "../contracts/w11/configuracaoServico.js";

export function lerConfiguracaoServico(valorCru: unknown): ConfiguracaoServico {
  const r = ConfiguracaoServicoSchema.safeParse(valorCru);
  return r.success ? r.data : { ...CONFIGURACAO_SERVICO_PADRAO };
}
/** Preferência do serviço persistida na caixa autenticada; não é escolha por paciente. */
export const CHAVE_CAIXA_RECEITUARIO_ESPECIAL = "config.servico.receituarioEspecial";
export const NUMERO_CAIXA_RECEITUARIO_ESPECIAL = 18;

