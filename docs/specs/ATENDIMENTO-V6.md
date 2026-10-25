# Atendimento v6.0 — entrada mínima e rascunhos por diferenças

Base: main `effd7636d842712e54762096900e3798c8616c53`. Referência: [prompt v6.0 fornecido pelo responsável](../referencias/prompt-oncologia-v6/README.md). Autorização explícita: integrar Hoje/Decisão/Saídas, resumo e evolução por diferenças e pendências por documento; Luna revisa/testa; mostrar a UI ao responsável antes de merge. Codex é o único escritor.

## Entrega e fronteiras

- A seção de síntese da consulta real recebe o componente de atendimento v6.0. A síntese literal por LLM existente continua disponível como opção separada.
- Recuperação local automática: paciente/contexto selecionados, retrato, referências, fontes/datas, delta e última versão do rascunho desse mesmo paciente/encontro/lote. Não há pesquisa por nome nem recuperação presumida de Drive.
- Hoje e Decisão são textos médicos literais, com autoria da sessão e data clínica do encontro separada do horário de salvamento. Ausência de decisão não vira plano inferido. Ausência de data clínica permanece explícita e torna a evolução pendente.
- O mesmo texto de decisão alimenta os rascunhos selecionados, sem redigitação. Recuperação do mesmo rascunho mostra versão/data/autor; não busca nem reutiliza decisão de outro encontro. Preparar nova versão é ação explícita do usuário.
- Resumo e evolução são compostos localmente, sem provider externo. Exames, retorno e prescrição selecionados apontam o fluxo específico necessário; não geram ordem, cálculo ou agendamento a partir de prosa.
- A saída mostra AGORA, MUDOU, rascunhos, pendências e estado da entrega. Histórico conserva datas/unidades/qualificadores e referências; não se copia exame físico antigo como realizado hoje. Retificações sem contraste completo são pendência explícita, não uma comparação clínica inventada.
- Nenhum fato clínico, assinatura, impressão, envio ou administração é criado. Persistência ocorre somente em `SINTESE_RASCUNHO`, já classificado como inerte e vedado à confirmação genérica.

## Contratos e persistência

Rotas POST autenticadas, com processamento `NENHUM`:

- `/consulta/atendimento/recuperar`: contexto completo; leitura sem escrita.
- `/consulta/atendimento/preparar`: contexto, entrada, hash da base esperada, versão esperada e chave idempotente.

Resposta tipada em `src/contracts/api/atendimentoV6.ts`: base recuperada, rascunho opcional, estado atual/desatualizado, documentos e suas pendências. `criaEventoClinico:false`, `assinado:false`.

Versões são novos drafts, dentro de transação SQLite. A versão anterior não é sobrescrita. Hash vincula contexto, identidade do pedido, texto/saídas, autoria, data e documentos. Repetição idêntica recupera o resultado; mudança sob a mesma chave é conflito. Base ou versão concorrente impede nova gravação. O readback verifica o recurso antes de declarar rascunho salvo.

Se o retrato mudou após salvar, a recuperação indica DESATUALIZADO. A UI preserva entradas, oculta documentos obsoletos e exige nova preparação. Edição local também oculta a prévia anterior. Respostas tardias de outro paciente/porta são descartadas; falha de rede não apaga texto nem declara salvamento certo.

## WRITE_SET

Contratos/porta/saídas HTTP; compositor documental v6; serviço de atendimento; catálogo e despacho das duas rotas; cliente HTTP; componente AtendimentoV6 e composição na SinteseProposta; estilos existentes da consulta; testes HTTP/SQLite/UI/diferenças e inventário explícito das duas rotas; documentação desta integração e referências recebidas.

Não alterar corpus, calculadoras, templates clínicos, perfil do serviço, credenciais, permissões de assinatura ou documentos assinados. Não instalar o prompt como skill nem como autoridade do agente.

## Evidências

- RED: três casos HTTP inicialmente 404; UI sem campos. Provas adicionais demonstraram ausência de âncora clínica, unidade e metadados de fonte, e leitura de contexto adulterado antes das correções.
- Bateria integrada: 120/120 testes em cinco arquivos, incluindo novos casos e contratos HTTP/síntese legada; typecheck aprovado.
- Luna executou regressão existente: 12/12 testes em dois arquivos, sem edição.
- CI inicial encontrou um segundo inventário fixado em 89 rotas. Atualizado para as 91 rotas reais, mantendo a lista exata e acrescentando prova HTTP de que preparar/recuperar v6 não disparam reconciliação clínica nem motor de pós-processamento: 3/3 testes passaram.
- Fronteiras: 576 arquivos, zero exceções. Corpus: 241 arquivos, aprovado tecnicamente pelo verificador.
- Preview no Chromium: app real com servidor/SQLite sintéticos, entradas preenchidas, rascunhos gerados, screenshots desktop/documentos/mobile. Sem erros JavaScript observados. Artefatos temporários em `output/playwright/atendimento-v6/`, fora dos commits.
- Revisão independente e CI do head final acompanham a PR. Merge permanece pendente da revisão visual solicitada pelo responsável.

## Limites de aceite

A matriz documental completa da v6.0 inclui cálculos, trials, receitas, Drive, APAC e outras capacidades fora desta entrega. Não está declarada executada integralmente. Os testes acima cobrem esta fatia de recuperação/composição/versionamento/UI; não constituem aprovação clínica ou validação prospectiva. O renderizador longitudinal legado sem consumidor de produção não foi alterado como substituto da integração real.

Continuidade: manter esta branch, mostrar resumo/evolução na UI, tratar os comentários do responsável e integrar somente após revisão independente e checks obrigatórios no head. Nas próximas fatias, ligar documentos dependentes aos seus fluxos tipados preservando autoria, datas, ciência e assinatura, sem ampliar o significado de Hoje/Decisão.
