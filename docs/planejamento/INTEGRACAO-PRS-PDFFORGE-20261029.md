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
