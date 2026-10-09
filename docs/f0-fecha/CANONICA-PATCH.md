# Proposta de atualização da CANONICA — E11 / D5

**PROPOSTA NÃO APLICADA.** Este arquivo não altera, substitui nem aprova documento canônico. Aplicação exige ordem expressa do Dr. Silas. Os arquivos de CANONICA e seus espelhos permanecem intocados nesta missão.

Alvos documentais: `SSOT-ONCOMIND-v1.md`, `PLATFORM-GOVERNANCE.md` e `ONCOGLOBAL-RAIZ-CANONICA.md`. Antes de aplicar, comparar a versão vigente com as decisões D-W9-66, D-W9-72 e D-W9-80; não restaurar vocabulário ou políticas já superados no repositório.

## 1. Permissões por responsabilidade

Texto proposto para substituir a regra genérica que trata todos os agentes como sem ferramentas:

> Extratores clínicos delimitados recebem somente a entrada autorizada de sua tarefa e devolvem propostas estruturadas, com proveniência e incerteza. Não vinculam pacientes, não promovem fatos, não assinam nem produzem efeitos externos. Não recebem ferramentas, memória persistente ou delegação por padrão.
>
> OncoAssist e o orquestrador possuem contratos de capacidade próprios. A disponibilidade de ferramenta não constitui autorização de uso: leitura, escrita local e efeito externo têm escopos e gates distintos. O gateway verifica sessão, contexto, destino e finalidade; o médico mantém a autoridade clínica. A configuração de um extrator não herda automaticamente as permissões do assistente.

## 2. Evidência pendente separada de fato confirmado

Texto proposto para a seção Memory_OS:

> O recebimento de um documento pode ser registrado localmente antes da confirmação clínica. Documento original, referência/hash da fonte, rascunho de extração, conflitos e proposta de vínculo compõem a área de evidência pendente. Sua persistência não equivale a fato confirmado.
>
> A promoção ao ledger clínico ocorre pelo caminho autorizado de revisão e confirmação, vinculado ao paciente, encontro, revisão e conteúdo exibido. Um vínculo de identidade não confirma fatos. Divergências conservam as versões e as fontes; a decisão médica que as resolve é registrada, sem apagar o histórico. Correções mantêm a proveniência do conteúdo anterior.

Correspondência a verificar na implementação final: DraftEnvelope/draft, caixa de revisão, vínculo explícito, bundle exibido, WriteRouter e clinical_event append-only. A palavra “existe” somente deve ser promovida com os testes finais da matriz e da consulta completa.

## 3. Gate de saída antes de habilitar modelo externo

Texto proposto para a seção de PHI:

> Modelos externos permanecem desligados até a validação do adaptador e dos gates de saída. Nos caminhos que exigem desidentificação, a verificação deve abranger o payload efetivamente enviado: texto livre, extração textual, identificadores em nome de arquivo, metadados, imagens quando aplicável e registros operacionais. Correspondência de nomes conhecidos não prova anonimização universal.
>
> Falha ou incerteza na preparação de um payload que exige desidentificação conserva a evidência local e oferece revisão manual, sem transmissão automática. Logs e erros não reproduzem payload clínico nem segredos.
>
> Exceções expressamente autorizadas pelo Dr. Silas precisam constar nominalmente no contrato do caminho, com destino, finalidade e condições. A exceção de kit documental de D-W9-66 não é revogada por esta proposta nem estendida a outras ferramentas: eventual envio continua condicionado ao gateway, ao provider autorizado, à configuração store:false, aos gates exigidos e à revisão local de retorno. Nenhuma exceção permite promoção ou assinatura automática.

## Condição de aplicação

Revisão humana do texto, compatibilização com as decisões vigentes e ordem expressa D5. A conclusão da F0 técnica não aplica este patch nem habilita conectores/modelos.
