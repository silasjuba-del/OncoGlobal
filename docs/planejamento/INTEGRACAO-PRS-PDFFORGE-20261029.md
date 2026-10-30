# Integração autorizada em 29/10/2026

## Objetivo e fronteiras

Silas autorizou revisar/ajustar/mesclar PRs abertas e confirmou a incorporação do PDFforge completo original do Claude. Base remota: e036d0f3. PRs: #76 077ce975, #78 2e2758a8 (dependente da #76), #79 2562e9a1, #80 736c06f5. Integrador único: Codex, branch codex/integracao-prs-pdfforge-20261029. Sem alteração de corpus ou da frente SBOC em leitura pelo Kimi. Validação técnica não é aprovação clínica.

## Preservação

Checkout principal em 8fa9b3fe, com WIP preservado. Cópia externa dos 26 arquivos modificados/não rastreados e hashes em OncoGlobal-coordination/20261029-integracao-prs. Nenhum reset, stash, limpeza, force push ou apagamento de branch. Original PDFforge externo preservado; manifesto dos 88 arquivos em integrations/pdfforge/original-sha256.json. Dependências, builds, .claude e dados de usuário não são versionados.

## Integração

Histórias das quatro PRs incorporadas com merges, sem squash. Seis conflitos resolvidos conservando ambas as jornadas, contratos e proteção dos documentos Flash. Catálogo combinado: 114 rotas (113 de M123/acervo mais leitura de fonte integral do pack). Conferir contra baseline e catálogo, sem remover rotas.

A incorporação completa vive em apps/pdfforge, com dependências próprias e comandos na raiz. A ponte existente foi aplicada sobre hashes conhecidos. Novas alterações restringem-se à integração, correções de revisão e provas de regressão.

## Correções em revisão

Preservação das entradas de resumo pertencentes ao mesmo evento; seleção de evidência por referência específica; reabertura de tarefa de retorno após cancelamento; proteção de edição/salvamento da agenda; consumo de solicitação de fonte; recusa de citação em branco; timeout distinguido de cancelamento; comparação TNM pelo literal; omissão explícita de texto auxiliar excessivo sem perda do PDF original. Anotações acima do limite continuam recusadas, não são descartadas silenciosamente.

## Aceite e recuperação

Typecheck, fronteiras, corpus, suíte completa, adversariais W10/W8/F1, jornadas Chromium M123/Flash/B2 e suíte/build/smoke nativo PDFforge devem passar no commit final. Integrar por PR, sem autoaprovação, sem contornar proteção. Se necessário recuperar, reverter o merge por nova PR, preservando arquivos de dados e eventos; o original externo e o WIP não são substituídos.

## Estado

Integração local em verificação. Smoke Electron no Windows reproduz falha do processo GPU; CI Linux com Xvfb deverá verificar o aplicativo nativo e não substituir essa limitação por teste simulado. Nenhum merge remoto realizado até este registro.


Atualização de validação: revisão independente identificou P2 na limpeza compartilhada do dirty da agenda; corrigido em ca5a526d e reavaliado como resolvido. O smoke Electron real passou no runner Linux após configurar o helper sandbox com proprietário/permissões corretos, sem desabilitá-lo. Builds e 46 testes originais PDFforge passaram. Jornada M123 e jornada Flash/evolução com reinício SQLite e viewport mobile passaram localmente; entrada Flash adaptada à AgendaMedica da #76. Conferência de preservação: 26 WIP e 88 originais, zero divergências. PR de integração: #81. CI final e merge remoto ainda devem ser confirmados no GitHub.


Revisao automatica do PDFforge original: corrigidos travamento de Markdown parcial, vinculo de anotacoes por SHA-256 (legadas preservadas sem reatribuicao), encerramento dos recursos da captura, colisoes de nomes no ZIP e pergunta da rodada preservada tambem nos exports. Suite PDFforge ampliada: 50 testes aprovados; smoke real agora exige anotacao criada pela UI no pacote. Scanner PHI identificou quatro sequencias dentro de hashes do manifesto original: disposicoes tecnicas exatas por hash/linha/ordinal/contexto adicionadas ao manifesto existente, sem alterar scanner ou omitir arquivos. CI deve repetir no novo HEAD.


Revisao complementar: rascunhos do editor agora tambem sao ligados ao SHA-256, com montagem isolada por conteudo e autosave somente apos restauracao. Rascunhos legados por caminho permanecem preservados sem reaplicacao automatica. Biblioteca conserva pergunta e contexto literal das fontes associados a cada resposta, independentemente de buscas posteriores. Smoke Electron testa ausencia de reaplicacao legada e restauracao de rascunho ligado aos mesmos bytes.


Revisao final de estado concorrente e fontes: cadastro/agendamento e remarcacao usam datas/horarios independentes; regressao preserva o cadastro enquanto outro encontro e cancelado. Microfone usa ciclo de recursos com encerramento no unmount e rejeicao de captura tardia, sem iniciar transcricao na limpeza. Chat conserva fontes numeradas com IDs monotonicos e snapshots cumulativos por conversa, exibidos e incluidos nos exports, inclusive continuacao sem nova busca; nova conversa limpa esse registro. Biblioteca tambem exporta o contexto literal capturado. Revisao independente confirmou a correcao desses pontos. Suite PDFforge: 53 testes; interface medica: 8 testes aprovados.


Lote consolidado de confiabilidade do PDFforge: lifecycle compartilhado cancela todas as chamadas de IA no descarte e recusa conclusoes tardias; biblioteca remove debounce, envia snapshots imediatamente, serializa escrita atomica no main, mostra gravacao/falha e protege fechamento. Leitura invalida preserva o arquivo e exige recuperacao, sem biblioteca vazia implicita. WhatsApp recusa texto excedente sem truncar nem alegar arquivo inexistente. NotebookLM mantem titulo vinculado a saida; Drive resolve subpasta no main por path.join. Captura desaparecida e recusada; video declara fonte inteira e nao oferece recorte falso; fotos/frames mantem recorte. Revisao independente consolidada: sem bloqueador residual. Suite PDFforge: 57 testes aprovados; build aprovado. Smoke ampliado confere pasta Drive sintetica e biblioteca persistida em disco. CI do commit publicado ainda deve ser conferida antes do merge.
