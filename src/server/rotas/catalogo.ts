/**
 * Política de pós-processamento depois de um POST 2xx (http.ts):
 * - PENDENCIAS_E_MOTOR: processa pendências clínicas do canal e o motor F1 (estímulos);
 * - NENHUM: nenhum processamento global.
 * Equivale ao antigo grava (true/false); a recuperação no início do servidor processa o que ficar pendente.
 */
export type PoliticaProcessamento = "NENHUM" | "PENDENCIAS_E_MOTOR";

/** Rotas HTTP locais. */
export const ROTAS_HTTP = [
  {"url":"/acao","nome":"acao","processamento":"PENDENCIAS_E_MOTOR","grupo":"CONSULTA"},
  {"url":"/apac/validar-emissao","nome":"/apac/validar-emissao","processamento":"PENDENCIAS_E_MOTOR","grupo":"DUTOS"},
  {"url":"/biblioteca/ativar","nome":"/biblioteca/ativar","processamento":"PENDENCIAS_E_MOTOR","grupo":"BIBLIOTECA"},
  {"url":"/biblioteca/consultar","nome":"/biblioteca/consultar","processamento":"NENHUM","grupo":"BIBLIOTECA"},
  {"url":"/biblioteca/curar","nome":"/biblioteca/curar","processamento":"PENDENCIAS_E_MOTOR","grupo":"BIBLIOTECA"},
  {"url":"/biblioteca/estado","nome":"/biblioteca/estado","processamento":"NENHUM","grupo":"BIBLIOTECA"},
  {"url":"/biblioteca/importar","nome":"/biblioteca/importar","processamento":"PENDENCIAS_E_MOTOR","grupo":"BIBLIOTECA"},
  {"url":"/biblioteca/rollback","nome":"/biblioteca/rollback","processamento":"PENDENCIAS_E_MOTOR","grupo":"BIBLIOTECA"},
  {"url":"/chat/aceitar-decisao","nome":"/chat/aceitar-decisao","processamento":"PENDENCIAS_E_MOTOR","grupo":"DUTOS"},
  {"url":"/config/caixa/alterar","nome":"alterarCaixa","processamento":"PENDENCIAS_E_MOTOR","grupo":"CONSULTA"},
  {"url":"/config/caixa/ler","nome":"lerCaixa","processamento":"NENHUM","grupo":"CONSULTA"},
  {"url":"/config/historico","nome":"historicoConfig","processamento":"NENHUM","grupo":"CONSULTA"},
  {"url":"/config/perfil","nome":"lerPerfil","processamento":"NENHUM","grupo":"CONSULTA"},
  {"url":"/config/perfil/salvar","nome":"salvarPerfil","processamento":"PENDENCIAS_E_MOTOR","grupo":"CONSULTA"},
  {"url":"/conhecimento/consultar","nome":"consultarConhecimento","processamento":"PENDENCIAS_E_MOTOR","grupo":"CONSULTA"},
  {"url":"/consulta/acoes-compostas/base","nome":"baseAcaoComposta","processamento":"NENHUM","grupo":"CONSULTA"},
  {"url":"/consulta/acoes-compostas/preparar","nome":"prepararAcaoComposta","processamento":"PENDENCIAS_E_MOTOR","grupo":"CONSULTA"},
  {"url":"/consulta/agenda","nome":"agenda","processamento":"NENHUM","grupo":"CONSULTA"},
  {"url":"/consulta/apac","nome":"apac","processamento":"NENHUM","grupo":"CONSULTA"},
  {"url":"/consulta/apac-rascunho/base","nome":"baseApacRascunho","processamento":"PENDENCIAS_E_MOTOR","grupo":"CONSULTA"},
  {"url":"/consulta/apac-rascunho/confirmar","nome":"confirmarApacRascunho","processamento":"PENDENCIAS_E_MOTOR","grupo":"CONSULTA"},
  {"url":"/consulta/apac-rascunho/preparar","nome":"prepararApacRascunho","processamento":"PENDENCIAS_E_MOTOR","grupo":"CONSULTA"},
  {"url":"/consulta/bundle","nome":"bundle","processamento":"NENHUM","grupo":"CONSULTA"},
  {"url":"/consulta/canal","nome":"canal","processamento":"NENHUM","grupo":"CONSULTA"},
  {"url":"/consulta/canal/resposta/confirmar","nome":"confirmarRespostaCanal","processamento":"PENDENCIAS_E_MOTOR","grupo":"CONSULTA"},
  {"url":"/consulta/canal/resposta/preparar","nome":"prepararRespostaCanal","processamento":"PENDENCIAS_E_MOTOR","grupo":"CONSULTA"},
  {"url":"/consulta/canal/vincular","nome":"vincularCanal","processamento":"PENDENCIAS_E_MOTOR","grupo":"CONSULTA"},
  {"url":"/consulta/carregar","nome":"carregarConsulta","processamento":"PENDENCIAS_E_MOTOR","grupo":"CONSULTA"},
  {"url":"/consulta/chat","nome":"chat","processamento":"NENHUM","grupo":"CONSULTA"},
  {"url":"/consulta/confirmar","nome":"confirmar","processamento":"PENDENCIAS_E_MOTOR","grupo":"CONSULTA"},
  {"url":"/consulta/contexto/selecionar","nome":"selecionarContexto","processamento":"NENHUM","grupo":"CONSULTA"},
  {"url":"/consulta/ditado","nome":"ditado","processamento":"PENDENCIAS_E_MOTOR","grupo":"CONSULTA"},
  {"url":"/consulta/estado-doenca/confirmar","nome":"confirmarEstadoDoenca","processamento":"PENDENCIAS_E_MOTOR","grupo":"CONSULTA"},
  {"url":"/consulta/estado-doenca/preparar","nome":"prepararEstadoDoenca","processamento":"PENDENCIAS_E_MOTOR","grupo":"CONSULTA"},
  {"url":"/consulta/estatistica","nome":"estatistica","processamento":"NENHUM","grupo":"CONSULTA"},
  {"url":"/consulta/extrair","nome":"extrair","processamento":"PENDENCIAS_E_MOTOR","grupo":"CONSULTA"},
  {"url":"/consulta/flash/preparar","nome":"prepararFlash","processamento":"PENDENCIAS_E_MOTOR","grupo":"CONSULTA"},
  {"url":"/consulta/flash/rascunho","nome":"rascunhoFlash","processamento":"PENDENCIAS_E_MOTOR","grupo":"CONSULTA"},
  {"url":"/consulta/instrumento/avaliar","nome":"avaliarInstrumento","processamento":"PENDENCIAS_E_MOTOR","grupo":"CONSULTA"},
  {"url":"/consulta/investigacao","nome":"investigacao","processamento":"PENDENCIAS_E_MOTOR","grupo":"CONSULTA"},
  {"url":"/consulta/leitura","nome":"leituraPubMed","processamento":"PENDENCIAS_E_MOTOR","grupo":"CONSULTA"},
  {"url":"/consulta/leitura/rascunhos","nome":"listarRascunhosPubMed","processamento":"NENHUM","grupo":"CONSULTA"},
  {"url":"/consulta/llm/documento-original","nome":"documentoOriginalLlm","processamento":"PENDENCIAS_E_MOTOR","grupo":"CONSULTA"},
  {"url":"/consulta/llm/extrair","nome":"extracaoLlm","processamento":"PENDENCIAS_E_MOTOR","grupo":"CONSULTA"},
  {"url":"/consulta/llm/resultado","nome":"resultadoExtracaoLlm","processamento":"NENHUM","grupo":"CONSULTA"},
  {"url":"/consulta/lotes","nome":"lotesPaciente","processamento":"NENHUM","grupo":"CONSULTA"},
  {"url":"/consulta/confirmacao/recuperar","nome":"recuperarConfirmacao","processamento":"PENDENCIAS_E_MOTOR","grupo":"CONSULTA"},
  {"url":"/consulta/documento-impressao","nome":"documentoImpressao","processamento":"NENHUM","grupo":"CONSULTA"},
  {"url":"/consulta/medicamentos/reconciliar","nome":"reconciliarMedicamentos","processamento":"PENDENCIAS_E_MOTOR","grupo":"CONSULTA"},
  {"url":"/consulta/oncoassist/classificar-fonte","nome":"oncoassistClassificar","processamento":"PENDENCIAS_E_MOTOR","grupo":"CONSULTA"},
  {"url":"/consulta/oncoassist/fontes","nome":"oncoassistFontes","processamento":"PENDENCIAS_E_MOTOR","grupo":"CONSULTA"},
  {"url":"/consulta/oncoassist/historico","nome":"oncoassistHistorico","processamento":"PENDENCIAS_E_MOTOR","grupo":"CONSULTA"},
  {"url":"/consulta/oncoassist/sintese","nome":"sinteseRetratoLlm","processamento":"PENDENCIAS_E_MOTOR","grupo":"CONSULTA"},
  {"url":"/consulta/atendimento/recuperar","nome":"recuperarAtendimentoV6","processamento":"NENHUM","grupo":"CONSULTA"},
  {"url":"/consulta/atendimento/preparar","nome":"prepararAtendimentoV6","processamento":"NENHUM","grupo":"CONSULTA"},
  {"url":"/consulta/oncoassist/status","nome":"oncoassistStatus","processamento":"NENHUM","grupo":"CONSULTA"},
  {"url":"/consulta/prescricao-executavel/base","nome":"basePrescricaoExecutavel","processamento":"NENHUM","grupo":"CONSULTA"},
  {"url":"/consulta/prescricao-executavel/confirmar","nome":"confirmarPrescricaoExecutavel","processamento":"PENDENCIAS_E_MOTOR","grupo":"CONSULTA"},
  {"url":"/consulta/prescricao-executavel/preparar","nome":"prepararPrescricaoExecutavel","processamento":"PENDENCIAS_E_MOTOR","grupo":"CONSULTA"},
  {"url":"/consulta/prescricao/fichas/instanciar","nome":"instanciarFichaPrescricao","processamento":"PENDENCIAS_E_MOTOR","grupo":"CONSULTA"},
  {"url":"/consulta/prescricao/fichas/listar","nome":"listarFichasPrescricao","processamento":"NENHUM","grupo":"CONSULTA"},
  {"url":"/consulta/prescricao/fichas/revisar","nome":"revisarFichaPrescricao","processamento":"PENDENCIAS_E_MOTOR","grupo":"CONSULTA"},
  {"url":"/consulta/prescricao/propor","nome":"proporPrescricao","processamento":"PENDENCIAS_E_MOTOR","grupo":"CONSULTA"},
  {"url":"/consulta/prescricao/rascunho","nome":"rascunhoPrescricao","processamento":"PENDENCIAS_E_MOTOR","grupo":"CONSULTA"},
  {"url":"/consulta/rascunho","nome":"rascunho","processamento":"NENHUM","grupo":"CONSULTA"},
  {"url":"/consulta/rascunho/preparar-revisao","nome":"prepararRevisao","processamento":"PENDENCIAS_E_MOTOR","grupo":"CONSULTA"},
  {"url":"/consulta/rascunho/reconciliar","nome":"reconciliarRascunhos","processamento":"PENDENCIAS_E_MOTOR","grupo":"CONSULTA"},
  {"url":"/consulta/rascunho/revisar","nome":"revisarRascunho","processamento":"PENDENCIAS_E_MOTOR","grupo":"CONSULTA"},
  {"url":"/consulta/receita/propor-dose","nome":"proporDoseReceita","processamento":"PENDENCIAS_E_MOTOR","grupo":"CONSULTA"},
  {"url":"/consulta/recist","nome":"recist","processamento":"NENHUM","grupo":"CONSULTA"},
  {"url":"/consulta/revisao-clinica","nome":"revisaoClinica","processamento":"PENDENCIAS_E_MOTOR","grupo":"CONSULTA"},
  {"url":"/consulta/salao","nome":"salao","processamento":"NENHUM","grupo":"CONSULTA"},
  {"url":"/consulta/salao/contingencia/gerar","nome":"gerarContingenciaSalao","processamento":"PENDENCIAS_E_MOTOR","grupo":"CONSULTA"},
  {"url":"/consulta/salao/contingencia/historico","nome":"historicoContingenciaSalao","processamento":"NENHUM","grupo":"CONSULTA"},
  {"url":"/consulta/salao/liberar","nome":"liberarSalao","processamento":"PENDENCIAS_E_MOTOR","grupo":"CONSULTA"},
  {"url":"/consulta/salao/triagem","nome":"salvarTriagemSalao","processamento":"PENDENCIAS_E_MOTOR","grupo":"CONSULTA"},
  {"url":"/consulta/skills","nome":"skillsClinicas","processamento":"PENDENCIAS_E_MOTOR","grupo":"CONSULTA"},
  {"url":"/consulta/timeline-multicamadas","nome":"timelineMulticamadas","processamento":"NENHUM","grupo":"CONSULTA"},
  {"url":"/consulta/trials/avaliar","nome":"avaliarEstudoTrial","processamento":"PENDENCIAS_E_MOTOR","grupo":"CONSULTA"},
  {"url":"/consulta/trials/fatos","nome":"fatosTrials","processamento":"NENHUM","grupo":"CONSULTA"},
  {"url":"/consulta/trials/importar","nome":"importarEstudoTrial","processamento":"PENDENCIAS_E_MOTOR","grupo":"CONSULTA"},
  {"url":"/consulta/trials/listar","nome":"listarEstudosTrials","processamento":"NENHUM","grupo":"CONSULTA"},
  {"url":"/consulta/trials/revisar","nome":"revisarEstudoTrial","processamento":"PENDENCIAS_E_MOTOR","grupo":"CONSULTA"},
  {"url":"/consulta/upload","nome":"upload","processamento":"PENDENCIAS_E_MOTOR","grupo":"CONSULTA"},
  {"url":"/farmacia/conferir","nome":"/farmacia/conferir","processamento":"PENDENCIAS_E_MOTOR","grupo":"DUTOS"},
  {"url":"/farmacia/enviar","nome":"/farmacia/enviar","processamento":"PENDENCIAS_E_MOTOR","grupo":"DUTOS"},
  {"url":"/login","nome":"login","processamento":"NENHUM","grupo":"CONSULTA"},
  {"url":"/salao/registrar-administracao","nome":"/salao/registrar-administracao","processamento":"PENDENCIAS_E_MOTOR","grupo":"DUTOS"},
  {"url":"/salao/revisar-relato-canal","nome":"/salao/revisar-relato-canal","processamento":"PENDENCIAS_E_MOTOR","grupo":"DUTOS"},
  {"url":"/tarefas/concluir","nome":"/tarefas/concluir","processamento":"PENDENCIAS_E_MOTOR","grupo":"DUTOS"},
  {"url":"/tarefas/receber","nome":"/tarefas/receber","processamento":"PENDENCIAS_E_MOTOR","grupo":"DUTOS"},
  {"url":"/consulta/documental/importar","nome":"/consulta/documental/importar","processamento":"NENHUM","grupo":"CONSULTA"},
  {"url":"/consulta/documental/listar","nome":"/consulta/documental/listar","processamento":"NENHUM","grupo":"CONSULTA"},
  {"url":"/consulta/documental/abrir","nome":"/consulta/documental/abrir","processamento":"NENHUM","grupo":"CONSULTA"},
  {"url":"/medico/agenda","nome":"/medico/agenda","processamento":"NENHUM","grupo":"CONSULTA"},
  {"url":"/medico/paciente/cadastrar","nome":"/medico/paciente/cadastrar","processamento":"PENDENCIAS_E_MOTOR","grupo":"CONSULTA"},
  {"url":"/medico/agenda/agendar","nome":"/medico/agenda/agendar","processamento":"PENDENCIAS_E_MOTOR","grupo":"CONSULTA"},
  {"url":"/medico/agenda/alterar","nome":"/medico/agenda/alterar","processamento":"PENDENCIAS_E_MOTOR","grupo":"CONSULTA"},
  {"url":"/medico/preconsulta","nome":"/medico/preconsulta","processamento":"NENHUM","grupo":"CONSULTA"},
  {"url":"/medico/preconsulta/salvar","nome":"/medico/preconsulta/salvar","processamento":"NENHUM","grupo":"CONSULTA"},
  {"url":"/medico/preconsulta/confirmar","nome":"/medico/preconsulta/confirmar","processamento":"PENDENCIAS_E_MOTOR","grupo":"CONSULTA"},
  {"url":"/medico/nutricao","nome":"/medico/nutricao","processamento":"NENHUM","grupo":"CONSULTA"},
  {"url":"/medico/nutricao/salvar","nome":"/medico/nutricao/salvar","processamento":"NENHUM","grupo":"CONSULTA"},
  {"url":"/consulta/assistente/historico","nome":"/consulta/assistente/historico","processamento":"NENHUM","grupo":"CONSULTA"},
  {"url":"/consulta/assistente/configurar","nome":"/consulta/assistente/configurar","processamento":"NENHUM","grupo":"CONSULTA"},
  {"url":"/consulta/assistente/responder","nome":"/consulta/assistente/responder","processamento":"NENHUM","grupo":"CONSULTA"},
  {"url":"/consulta/assistente/responder-stream","nome":"/consulta/assistente/responder-stream","processamento":"NENHUM","grupo":"CONSULTA"},
  {"url":"/consulta/assistente/cancelar","nome":"/consulta/assistente/cancelar","processamento":"NENHUM","grupo":"CONSULTA"},
  {"url":"/medico/paciente/ler","nome":"/medico/paciente/ler","processamento":"NENHUM","grupo":"CONSULTA"},
  {"url":"/medico/paciente/alterar","nome":"/medico/paciente/alterar","processamento":"PENDENCIAS_E_MOTOR","grupo":"CONSULTA"},
  {"url":"/acervo/buscar","nome":"/acervo/buscar","processamento":"NENHUM","grupo":"CONSULTA"},
  {"url":"/acervo/ler","nome":"/acervo/ler","processamento":"NENHUM","grupo":"CONSULTA"},
  {"url":"/integracoes/estado","nome":"/integracoes/estado","processamento":"NENHUM","grupo":"CONSULTA"},
] as const;
const porUrl = new Map<string, (typeof ROTAS_HTTP)[number]>(ROTAS_HTTP.map(r=>[r.url,r]));
export function rotaHttp(url:string|undefined) { return porUrl.get(url??'')??null; }

/** Prefixo do webhook do canal: fora do catálogo, autenticado por conta/chave em canalWebhookHttp.ts. */
export const PREFIXO_WEBHOOK_CANAL = "/canal/webhook/";
/**
 * A entrada do webhook vira pendência no ledger; quem a processa é processarPendenciasClinicasCanal
 * logo após a resposta 2xx, e o motor F1 em seguida. Se o processamento falhar ou o servidor cair,
 * a recuperação no início de criarServidorLocal processa as pendências gravadas.
 */
export const POLITICA_WEBHOOK_CANAL: PoliticaProcessamento = "PENDENCIAS_E_MOTOR";

/** Política para um POST 2xx. Fora do catálogo e do webhook, rotear responde 404: nunca há 2xx. */
export function politicaProcessamento(url:string|undefined): PoliticaProcessamento {
  const rota = rotaHttp(url);
  if (rota) return rota.processamento;
  const caminho = new URL(url ?? '/', 'http://127.0.0.1').pathname;
  return caminho.startsWith(PREFIXO_WEBHOOK_CANAL) ? POLITICA_WEBHOOK_CANAL : "NENHUM";
}
