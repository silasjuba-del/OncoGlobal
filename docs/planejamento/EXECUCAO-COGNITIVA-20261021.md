# Execução persistente do OncoAssist cognitivo

## Objetivo e autoridade

**Estado de retomada: NÃO CONCLUÍDO; candidata clínica e definição visual pendentes.** Em resposta posterior, Silas definiu os alvos de integração abaixo, resolvendo a dependência de identificação dos serviços. O status do mecanismo de goal foi marcado blocked na etapa anterior; este registro não altera esse status automaticamente. Há agora trabalho de integração delimitável pelos alvos confirmados. Não substituir o conteúdo clínico que Silas está preparando com Claude nem reformular a UI antes das orientações prometidas.

### Alvos de integração confirmados em 21/10/2026

Adição posterior de Silas: “MEM0 E ALTERNATIVO A MEMORIAS”. Interpretado como inclusão de Mem0 e avaliação de alternativas para memória; não como autorização para substituir o ledger clínico ou instalar dependências automaticamente. Mem0 e Graphiti entram como candidatos. Mem0 OSS admite biblioteca/servidor próprios, mas self-hosting não garante inferência local: os provedores LLM/embeddings precisam ser configurados. Graphiti atende modelagem temporal e relações com histórico. O banco atual permanece dono de fatos, revisões, assinaturas e documentos; qualquer memória inteligente deve ser derivada/reconstruível, com referência à fonte e sem escrever fatos clínicos autonomamente.

Primeiro escopo proposto para avaliação: preferências de formato e comportamento do médico, contexto de trabalho e recuperação de referências. Critérios: recuperação útil, proveniência, validade temporal, correção/revogação, isolamento por usuário/paciente/projeto, latência e custo. Não promover atualização automática de memória a decisão clínica. Fontes verificadas: https://docs.mem0.ai/open-source/overview e https://help.getzep.com/v4/graphiti/getting-started/overview . Nenhuma instalação, migração ou envio de dados foi executado.

Pedido literal: “WHATSAPP, PLAUD, GOOGLE DRIVE, GOOGLE AGENDA, WORDS E EXCEL MICROSOFT, PUBMED E OS CIENTIFICOS. QUERO TAMBEM PLUGGINS DE SOFTWARE PARA MANUTENÇÃO, FRONTEND E DESIGN, HIGGSFIELD, 21 ST.DEV”. Word é a interpretação adotada para “WORDS”.

| Frente | Rota de integração e estado confirmado |
|---|---|
| WhatsApp | Reutilizar canalOperacao, canalEntrada, canalResposta e executor existente; ingresso e saída autorizada separados. Código encontrado; conexão real da conta não verificada. |
| Plaud | Importação/transcrição e proveniência já têm suporte local. Documentação oficial atual oferece MCP/CLI para dados da conta e Embedded para incorporação ao produto; acesso real ainda não verificado. |
| Google Drive | Entrada documental e recuperação de arquivos via API Drive/OAuth; aproveitar arquivos locais disponíveis sem assumir que G: comprova OAuth do app. |
| Google Agenda | Calendar API para agenda externa. Agendar é efeito externo e usa autorização/idempotência próprias, separado de leitura. |
| Word / Excel | Geração/preenchimento de arquivos locais e, quando necessário, integração Microsoft 365. Word Add-ins/Word API e Excel Graph são superfícies distintas. Escolher a operação adequada sem fingir que um único conector cobre todas. |
| PubMed / científicos | E-utilities para PubMed/PMC; Crossref é candidato complementar para metadados/DOI. Núcleo possui executarLeitura com destino PUBMED, mas nenhum transporte de produção conectado. Identificar outras bases por contrato oficial e licença antes de usar. |
| Manutenção / frontend / design | Ferramentas de desenvolvimento (revisão, testes, segurança, observabilidade e componentes) separadas dos fluxos de atendimento. Reutilizar ferramentas já presentes antes de adquirir pacotes. |
| Higgsfield | Rota inicial proposta: ativos visuais pelo API/MCP oficial; modelos e operações a escolher conforme o trabalho de design. Nenhuma geração paga ou instalação executada. |
| 21st.dev | Rota inicial proposta: componentes e apoio à implementação visual, usando o MCP atual. Documentação oficial indica migração do Magic legado para o endpoint unificado; autenticação/acesso da conta não verificados. |

Fontes oficiais consultadas (21/10/2026):
- Plaud: https://support.plaud.ai/hc/en-us/articles/60726890231449-How-can-I-get-API-access-to-my-Plaud-data
- Google Drive: https://developers.google.com/workspace/drive/api/guides/about-sdk
- Google Calendar: https://developers.google.com/workspace/calendar/api/guides/overview
- Microsoft Word: https://learn.microsoft.com/en-us/office/dev/add-ins/word/
- Microsoft Excel: https://learn.microsoft.com/graph/excel-concept-overview
- NCBI: https://www.ncbi.nlm.nih.gov/home/develop/api/
- PMC: https://pmc.ncbi.nlm.nih.gov/tools/developers/
- Crossref: https://www.crossref.org/documentation/retrieve-metadata/rest-api
- Higgsfield: https://open.higgsfield.ai/quick-start
- 21st: https://github.com/21st-dev/magic-mcp/blob/main/README.md

Próxima implementação independente sugerida: ligar o transporte de pesquisa PubMed à porta READ existente, com pesquisa sem identificação de pacientes, cancelamento, limites de requisição/resposta e referências persistidas; depois OAuth documental/agenda e validação da conta Plaud/WhatsApp. Nenhuma das integrações desta lista foi anunciada como conectada por esta pesquisa. Aquisição/ativação de pacotes externos continua sujeita à admissão Fugu/Kimi.

Retomada: receber a skill candidata como material para avaliação (sem instalação automática), confrontá-la com o fluxo confirmado de primeira consulta, separar requisitos clínicos de operações do runtime e então adaptar o protótipo. Para MCP/plugins, usar os serviços/links informados por Silas e verificar o contrato real. Para UI, aguardar as orientações prometidas. Trabalho local preservado na branch `feat/quatro-pilares-harness-20261021`, HEAD-base `39b1836`; alterações seguem sem commit/merge. Não confundir bloqueio da tarefa ampla com falha dos testes já registrados ou aprovação do app.

Pedido de Silas em 21/10/2026: avaliar, atualizar, corrigir e executar tarefa longa até o término do app, priorizando código. Capacidades: OncoAssist cognitivo, Brain_OS, harness, claims, Second Brain Genspark, MCP, plugins, skills, voz e caixa universal. Detalhamento visual da UI será fornecido pelo médico. Aprovação clínica e publicação não são inferidas de testes.

Esclarecimento recebido do médico nesta execução: “NAO SO UMA, QUERIA COMANDAR O COMPORTAMENTO DELE POR SKILLS. MAS A PRIMEIRA SERIA DA EXTRAÇÃO-RESUMO DE CASO ASSOCIADO A DOCUMENTAÇÃO, RECEITAS, EXAMES ETC. EM PRIMEIRA CONSULTA ELE JA DEIXA GRAVADO GRANDE PARTE DOS DOCUMENTOS.”

Direção posterior do médico: “VOU MONTAR UMA COM CLAUDE E TE PASSO PARA VC AVALIAR”. A candidata clínica virá de Silas/Claude. Não consolidar conteúdo clínico, estrutura definitiva de resumo ou regras da skill antes de receber e avaliar essa candidata. A infraestrutura técnica pode continuar; o comportamento nativo esboçado nesta execução é PROTÓTIPO DE INTEGRAÇÃO, não a skill clínica aprovada nem substituta da candidata. Nenhuma instalação/ativação global foi realizada. A meta ampla não foi pausada.

Requisito confirmado: skills como comportamentos configuráveis do produto, não apenas escolha de uma skill instalada no Codex. Primeiro comportamento: jornada completa de primeira consulta, kit documental → extração com proveniência → resumo → preparação e persistência de rascunhos de documentos/receitas/exames. Reutilizar `modules/documentos/consulta.ts`, `server/flash.ts`, revisão de extração e os writers existentes. Preparar rascunhos não implica inventar conduta, prescrever, assinar ou enviar. A seleção de uma skill deixou de ser impedimento; o conteúdo/configuração do comportamento será desenvolvido a partir desse requisito. A admissão de pacotes externos continua separada e bloqueada conforme a política vigente.

## Base confirmada

- Raiz: `C:\Users\silas\Projects\OncoGlobal`; remoto `silasjuba-del/OncoGlobal`.
- Branch: `feat/quatro-pilares-harness-20261021`.
- HEAD inicial: `39b1836`.
- CANONICA é contexto documental, sem Git.
- WIP preexistente em 13 arquivos UI e `src/ui/tema/base.css`: preservar. Nenhuma reformulação visual autorizada por inferência.
- Codex é writer de implementação deste lote. Fugu autorizado nominalmente para auditoria/testes adversariais; WRITE_SET vazio nesta primeira missão.

## Lote atual: integridade das propostas e ligação ao runtime

WRITE_SET inicial: `src/kernel/harness/runtime.ts`, `tests/harness/fontes-nao-verificaveis.test.ts` e este registro. Expandir somente após localizar consumidores e contratos, sem tocar WIP alheio.

Reproduzido: fonte citada desconhecida e lista vazia de citações recebiam APTO_PARA_REVISAO_HUMANA quando havia fonte íntegra não relacionada. Trecho vazio também não gerava manifestação de citação inválida. Corrigido para manifestar CITACAO_NAO_SUSTENTADA e bloquear.

Evidências: teste novo falhou nos três cenários antes da correção; depois, `npx vitest run tests/harness` passou com 17 testes em quatro arquivos. `npm run typecheck` e `npm run check:boundaries` passaram (538 arquivos, zero exceções). Não prova E2E, integração clínica nem produção.

Na leitura inicial, produzirPropostaBrainOs e verificarPropostaNoHarnessRuntime apareciam apenas nas definições. Essa lacuna foi parcialmente fechada pela ligação à extração HTTP descrita abaixo. Ainda falta conectar a execução local de skills e os consumidores da UI.

## Fugu

Ativado pelo script oficial com `-ActivateFugu`; responses e image_generation=false preservados. Primeira CLI falhou por SAKANA_API_KEY ausente no processo. Credencial existente no escopo User foi carregada somente no processo da segunda CLI, sem exibição. Sessão real: `01a15f6c-9aef-7302-905d-805c8c895f7b`, concluída com exit 0 e FUGU_RETURN. Fugu não alterou arquivos. Vitest foi impedido pelo sandbox (EPERM em temporários); o auditor executou 13 cenários em memória e duas sondas Brain→Harness. Esses resultados não são uma suíte Vitest aprovada.

## Marco de implementação: 21/10/2026

Estado: IMPLEMENTADO LOCALMENTE e sob verificação técnica; sem commit, PR, integração em main ou aprovação clínica. A rodada anterior e esta continuação produziram progresso verificável.

WRITE_SET expandido, proprietário Codex:

- `src/contracts/{brainOs,harnessRuntime,cognitivoExtracao}.ts` e `src/contracts/api/saidasHttp.ts`.
- `src/kernel/harness/runtime.ts`, `src/kernel/llm/{brainOs,cognitivoExtracao}.ts`.
- `src/server/extracaoLlm.ts`, `src/server/rotas.ts`, `src/server/rotas/catalogo.ts`.
- `tests/harness/{fontes-nao-verificaveis,integridade-cognitiva,cognitivo-extracao}.test.ts`.
- `tests/f1/s11/http-llm.test.ts`, `tests/server/contratos-saida.test.ts`, `tests/server/fixtures/rotas-baseline.json`.
- Este registro. WIP de UI permanece fora do território.

Correções causais com contraprovas sintéticas:

- Colisão de sourceId não sobrescreve silenciosamente a fonte.
- Citação recortada é confrontada com o contexto original; qualificadores divergentes entre ocorrências não são resolvidos pela última citação. Fronteira de oração/lista ambígua não atesta polaridade emprestada.
- Número e unidade são conferidos como par; unidade parcial, perdida, expoente truncado e separador de milhar ambíguo não sustentam normalização.
- Flag fornecida pelo candidato não suprime destaque de número crítico, inclusive áudio.
- PatientId da proposta deve coincidir com identidade esperada da fonte quando fornecida; nome isolado exige resolução e não prova vínculo.
- Localizador exige mapa local inequívoco. Página virtual enviada ao modelo não é apresentada como página física: extração usa localizador do segmento persistido.
- Cobertura parcial exige resolução; referência idêntica repetida não duplica corroboração; metadados conflitantes na mesma versão excluem as variantes; trecho exibido contém o termo correspondente.

Integração funcional:

- `/consulta/llm/extrair` agora chama Brain_OS e harness, salva `CognitivoExtracao@1` no MESMO `LLM_EXTRACAO_RASCUNHO` e devolve o relatório também no replay.
- `/consulta/llm/resultado` é leitura autenticada por paciente/consulta/lote; devolve relatório persistido e validade da fonte, contexto e política. Nenhum novo store/writer clínico foi criado.
- Leitura genérica e promoção do rascunho inerte continuam vedadas. Falha de verificação conserva a resposta original e o relatório bloqueado; não cria fato.
- Teste HTTP cobre fonte desidentificada, contraexemplo de negação, destaque de áudio, replay, escopo, gravação, reinício do servidor/SQLite e mudança de fonte.
- Transporte LLM real permanece sujeito ao bloqueio vigente `D_F1_40_LLM_SO_LOCAL`; a prova de integração usa transporte sintético injetado. Não declarar inferência real disponível.

Limites conhecidos: verificação lexical não é interpretação clínica completa; ausência de identificador não vira vínculo automático; o adaptador não cria fatos ou decisões médicas; a UI ainda não consome o novo relatório.

Verificação final deste marco: `npx vitest run tests/harness tests/f1/s11 tests/server/contratos-saida.test.ts --no-file-parallelism` — **19 arquivos, 266 testes aprovados**, incluindo reinício real de SQLite sintético. `npm run typecheck`, `npm run check:boundaries` (540 arquivos, zero exceções) e `git diff --check` passaram. A aprovação independente do diff final ainda não foi obtida; o Fugu auditou snapshots anteriores durante as correções. Objetivo amplo continua ATIVO.

Próxima frente: mapear e implementar a execução local de skills sobre os donos atuais de conhecimento/admissão, preservando os gates Fugu/Kimi. `src/kernel/corpus/biblioteca.ts` já oferece pacotes `GENSPARK_MANUAL` com hashes/curadoria; `conhecimento.ts` oferece consulta lexical local. O plano distingue Knowledge Store (métodos/playbooks) e ledger clínico. Não criar catálogo paralelo antes de mapear esses donos.

## Marco: conhecimento local curado conectado ao Brain

Continuação confirmada sobre o mesmo HEAD e WIP. Progresso: implementada ligação entre biblioteca existente e relatório cognitivo; não criado segundo catálogo.

WRITE_SET adicional de Codex: `src/contracts/conhecimentoBrain.ts`, `src/server/conhecimentoBrain.ts`, `src/kernel/corpus/biblioteca.ts` (leitura de manifesto validado), `tests/harness/conhecimento-brain.test.ts`; extensão dos arquivos cognitivos e teste HTTP já atribuídos.

- Extração aceita filtros de biblioteca explícitos; eles ficam marcados como seleção de consulta, nunca fatos clínicos.
- Referências vêm exclusivamente do pacote local ativo com hash e curadoria. Brain recebe estado, escopo e aprovação transitiva das dependências; propostas mantêm inclusões e exclusões com motivos.
- Relatório conserva origem GENSPARK_MANUAL/CURADOR_LOCAL, versão/hash da biblioteca e das referências, URL, datas e trecho bibliográfico. Nenhum transporte Genspark foi criado nem verificado.
- Conhecimento é consultado localmente depois da extração, sem envio das referências ao modelo. Revogação altera a correlação e invalida o uso atual de propostas anteriores; histórico é preservado.
- Replay com filtros divergentes é recusado. Sigla só corresponde a token completo; dependência revogada não é rotulada erroneamente como incompatibilidade de tumor.
- Teste HTTP sintético percorre importação → curadoria → ativação → Brain → revogação → leitura histórica e nova proposta sem referência revogada.

Descoberta de skills: `src/kernel/config/settings.ts` armazena apenas listas de skills/plugins/MCP, com conexões desabilitadas; não foi encontrado executor. A política real `C:\Users\silas\.codex\skills\router-skills-hub\admission-policy.json` e o protocolo `references/admission.md` permanecem em `HOLD_PENDING_CANONICAL_ADMISSION`. Nenhuma skill foi baixada, instalada, ativada ou carregada como nova instrução. Pergunta assíncrona enviada ao Dr. Silas sobre qual skill quer executar primeiro; resposta ainda pendente neste marco. Essa dependência não bloqueou a integração independente de conhecimento.

Verificação deste marco: `npx vitest run tests/harness tests/f1/s3 tests/f1/s11/http-llm.test.ts --no-file-parallelism` — 16 arquivos e **220 testes aprovados**. Typecheck, fronteiras (542 arquivos/zero exceções) e diff-check passaram. Limites: inferência sintética, nenhuma conexão real ao Second Brain, nenhum executor de skill admitida e nenhum consumidor visual novo. Próxima ação: definir a skill inicial com a resposta do médico e mapear o contrato de execução e a porta de admissão; enquanto isso, completar a auditoria das entradas de voz/caixa universal e suas ligações ao núcleo cognitivo. Meta ampla permanece ATIVA.

## Sequência e aceite

### Marco de voz e proveniência (21/10/2026)

Progresso confirmado: `medical_note` com captura LOCAL_DICTATION/DEEPGRAM_CLOUD não ativava as proteções limitadas a `sourceType=plaud`. Dois testes reproduziram números sem confirmação; correção preserva a classe documental e propaga método de captura separadamente.

WRITE_SET adicional Codex: `src/contracts/capturaTranscricao.ts`, `src/contracts/w10/extracao.ts`, `src/kernel/extracao/{deduplicacao,segmenter,pipeline,extrator,safety,prepararRevisao}.ts`, `tests/kernel/extracao/origem-voz.test.ts`, `tests/f1/s11/transcricao-http.test.ts`; extensões nos arquivos de rotas, extração LLM, contrato cognitivo e teste HTTP já atribuídos. UI preexistente permanece fora do WRITE_SET.

- Métodos de captura acompanham segmentos, candidatos e registro da revisão; números ditados exigem confirmação e aparecem como SPOKEN_NUMBER para captura local e Deepgram, além de Plaud.
- Brain/harness reconhecem origem de áudio pelo método de captura. Relatório conserva hashes do texto capturado/revisado e sinaliza edição, sem declarar conferência do áudio.
- Original completo permanece no ledger; a leitura de um segmento vinculado devolve metadados/hash de captura sem expor o texto de outros segmentos.
- Reconciliação entre fontes conserva captureMethod. Revisão de extração antiga que perdeu essa proveniência é recusada com REPROCESSAMENTO_VOZ_NECESSARIO; exige reimportação/reprocessamento da fonte, não promoção silenciosa.
- Voz sem transcrição capturada é recusada. Fontes mistas não transferem modalidade de áudio para documentos.
- Não houve captura real de microfone nem envio de áudio; provas usam fontes sintéticas e transporte injetado.

Verificação ampliada: 15 arquivos e 192 testes aprovados (kernel de extração, invariantes, pipeline adversarial, transcrição HTTP e integração LLM). Verificação complementar concluída: 4 arquivos/28 testes aprovados (origem de voz, revisão HTTP, deduplicação e consumidor de voz; não somar como testes únicos porque há sobreposição). Typecheck, fronteiras (543 arquivos/zero exceções) e diff-check passaram. Meta ampla permanece ATIVA; próxima frente independente é o roteamento da caixa universal e recuperação do contexto de execução. Skill inicial e detalhamento visual continuam pendentes do médico.

### Marco de retomada da caixa de revisão (21/10/2026)

Lacuna encontrada: havia leitura de relatório cognitivo por ID, mas nenhum mecanismo de redescoberta após reabrir o aplicativo. Agora o histórico OncoAssist existente inclui `extracoesCognitivas` como projeção dos mesmos rascunhos, sem fila/store paralelo.

WRITE_SET adicional Codex: `src/contracts/api/{oncoassist,porta}.ts`, `src/server/oncoassistPropostas.ts`, `src/ui/api/http.ts` (apenas transporte/validação; sem layout), `tests/oncoassist-jev/cognitivo-cliente.test.ts`; extensões nos contratos de saída, extração LLM e seu teste HTTP já atribuídos.

- Listagem paginada: padrão 20, máximo 50, cursor por rascunho e ordenação temporal com desempate estável. Cursor é validado somente dentro do paciente/consulta/lote solicitado.
- Resumos não incluem texto clínico; preservam estado capturado, validade de fonte/contexto/política e acesso por ID ao relatório completo.
- Porta HTTP tipada confere rascunho, paciente e consulta na resposta. Legados sem relatório não são convertidos em prova positiva.
- Prova de reinício passou a redescobrir o ID pelo histórico antes de ler detalhes, em vez de depender do ID guardado pelo teste.
- Histórico Jev permanece no contrato anterior; o campo cognitivo é adicional e opcional para consumidores legados.
- Uma rodada durante consolidação dos contratos apresentou falhas 500 na leitura; o caso isolado passou no estado consolidado. Rodada completa congelada em andamento para confirmar ausência de regressão; não usar a rodada anterior como prova de aprovação.

Atualização: a rodada congelada terminou com três arquivos aprovados e um worker encerrado pelo Windows (exit 0xC0000409) no arquivo `http-llm.test.ts`; não é aprovação completa. Reexecução isolada desse arquivo com `--maxWorkers=1 --no-isolate`: 13 testes aprovados, exit 0. Reexecução dos quatro arquivos com um único worker/reuso está ativa na sessão exec **79217**; consultar esse handle, não reiniciar por ausência de saída. Typecheck/fronteiras/diff-check já passaram no estado atual.

Fechamento da reexecução 79217: terminou com exit 0, quatro arquivos e **133 testes aprovados**. Nenhum processo de teste desse handle permanece pendente. Histórico paginado, cliente tipado, recuperação HTTP/SQLite e compatibilidade Jev verificados no conjunto selecionado.

### Exemplos documentais privados recebidos para orientar a primeira consulta

Silas forneceu kits reais e informou que utiliza a skill Silas Negrão, mas não gosta muito dela. Foi feita inspeção estrutural local dos PDFs (inventário de páginas/texto, amostras de texto e contato visual dos digitalizados) e leitura crítica da skill instalada, tratada como objeto de avaliação, não executada como pipeline clínico. Não foram produzidos diagnósticos, estádios, prescrições ou nove resumos clínicos. Nenhum nome, identificador, conteúdo clínico ou caminho dos kits deve entrar no repositório/fixtures; testes derivados serão inteiramente sintéticos.

Requisitos de produto derivados da estrutura, sem dados de pacientes:

- Inventariar TODAS as páginas; documento com camada de texto pode conter OCR corrompido. Texto extraível não prova leitura fiel.
- Lidar com páginas giradas/invertidas, páginas predominantemente administrativas e páginas sem texto legível, conservando cobertura de leitura por página.
- Classificar pela função/conteúdo: cabeçalho “Receituário” pode acompanhar encaminhamento, sem prescrição de medicamentos. Preparo/agendamento de exame não é resultado nem comprovação de realização.
- Preservar laudo primário, citação no encaminhamento, complementação por IHQ e possível duplicata como relações distintas. Repetição/cópia não cria corroboração independente.
- Separar cadastro administrativo da síntese clínica; guardar o material completo e mostrar um resumo selecionado, sem descartar dados porque pareçam pouco relevantes naquele momento.
- Preferir comportamento configurável por etapa e destino a uma sequência fixa de agentes com saída apenas no chat.
- Separar regras de extração/proveniência, conhecimento clínico versionado e configuração do médico. Não admitir automaticamente exemplos/regras clínicas da skill instalada como regras do produto.
- Primeira consulta deve produzir um dossiê rastreável e alimentar rascunhos persistidos dos documentos; evitar forçar fatos recebidos a CONFIRMADO apenas para caber no renderizador atual.

Pergunta assíncrona pendente: qual incômodo principal com a skill atual (omissão, organização, excesso de pendências ou falta de documentos). A resposta ajustará o comportamento; não presume que esses sejam os motivos pessoais do médico. A skill global não foi alterada nem reinstalada.

### Próximo lote confirmado: skills de comportamento e primeira consulta

Infraestrutura esboçada antes da direção posterior de Silas: `src/contracts/skillsClinicas.ts`, `src/modules/documentos/primeiraConsulta.ts`, `src/server/skillsClinicas.ts`, `tests/server/skills-primeira-consulta.test.ts`; extensões em registro de rascunhos, catálogo/rotas, contratos de saída/porta e cliente HTTP. Proprietário: Codex; UI visual preservada. Status PROTÓTIPO TÉCNICO, conteúdo clínico aguardando candidata Silas/Claude. Fonte só é aceita após conferência de vínculo médico persistido, contexto, versão e hash; gravação de documentos/execução é atômica no draft_envelope existente. Receitas/exames no protótipo são apenas rascunhos explícitos ou campos pendentes, nunca inferidos do histórico.

Verificação focada: `tests/server/skills-primeira-consulta.test.ts` com um worker e sem isolamento — 4 testes aprovados. Inclui criação/retomada após reinício, idempotência, configuração por execução, recusa de vínculo forjado, fonte alterada, integridade de documento e proibição de promoção genérica a FATO. Corrigidas incompatibilidade de parsing de metadados de vínculo e seleção explícita dos campos de contexto. Nenhum dado real foi usado. Avaliação clínica, incorporação da skill candidata e interface continuam pendentes.

Verificação complementar posterior à decisão de aguardar a candidata: `tests/server/skills-primeira-consulta.test.ts`, `tests/server/contratos-saida.test.ts` e `tests/harness/funil-escrita-unico.test.ts` — **3 arquivos, 103 testes aprovados**, exit 0, sessão 51592 concluída. Nenhuma nova definição de conteúdo clínico foi feita nessa rodada.

Pesquisa de integração de 21/10/2026: as páginas oficiais https://www.genspark.ai/helpcenter/secondbrain e https://www.genspark.ai/helpcenter/connectors-and-integrations descrevem SecondBrain como contexto usado pelo Super Agent e Genspark como consumidor de servidores MCP. Essas páginas não fornecem contrato de API de leitura direta do SecondBrain pelo OncoAssist; não interpretar a existência de conectores no Genspark como prova da direção inversa. Não usar endpoints de diretórios de terceiros como API confirmada. Nenhuma conexão externa autenticada nem envio de dados foi executado. Pergunta assíncrona enviada para identificar os MCPs/plugins desejados, com nomes/links; resposta pendente.

Dependências atuais para conclusão do objetivo amplo: candidata clínica Silas/Claude e sua avaliação/admissão; requisitos visuais prometidos por Silas; identificação dos MCPs/plugins alvo e contratos de acesso; contrato/acesso verificável para eventual integração direta SecondBrain. O protótipo técnico e as provas sintéticas não satisfazem essas dependências e não encerram o app. Esta continuação produziu evidências novas de compatibilidade e de direção da integração; não classificar como conclusão ou aprovação clínica.

Resultado observável: o médico escolhe uma skill e seus parâmetros de comportamento; a primeira recebe referências ao kit documental local e prepara resumo e conjunto de rascunhos documentais persistentes, recuperáveis na consulta. Não implementar apenas seletor ou catálogo vazio como entrega final.

Sequência prevista:

1. Definir contrato versionado de skill de produto: objetivos, entradas, operações permitidas e saídas esperadas. Implementações nativas compostas dos serviços existentes; pacotes externos seguem admissão canônica, sem scripts/hooks arbitrários.
2. Resolver fontes do ledger por paciente/consulta/segmento. Vínculo médico e revisão de fonte não podem ser fabricados pela skill.
3. Executar extração/proveniência/harness e montar resumo com lacunas, conflitos e datas. Preservar transcrição original e alterações.
4. Preparar e salvar rascunhos de documentação, receitas e exames com os campos sustentados e pendências. Medicação histórica não vira nova prescrição; exame citado não vira pedido novo. Reutilizar geração documental existente, sem declarar dados recebidos como CONFIRMADO para satisfazer seus schemas.
5. Persistir progresso, versão da skill, hashes das entradas/saídas e idempotência no mecanismo local existente. Recuperar após reinício e invalidar saídas quando a fonte/configuração mudar.
6. Expor execução e recuperação por porta tipada para a UI futura. Provar a jornada sintética inteira: kit → resumo → rascunhos → reinício → revisão, sem assinatura ou efeitos externos automáticos.

Donos identificados: `modules/documentos/consulta.ts` renderiza documentos a partir de fatos/decisões confirmados; `server/flash.ts` prepara e salva o conjunto; `kernel/extracao/prepararRevisao.ts` preserva propostas e pendências; `draft_envelope` é o armazenamento existente. Antes de codificar, fechar WRITE_SET para as adaptações de prévia não confirmada e do orquestrador. Não modificar UI visual nem a política global de admissão.

1. Recolher FUGU_RETURN, reproduzir achados e corrigir defeitos delimitados; registrar evidências.
2. Mapear entrada universal, extração, orquestração, revisão e persistência existentes; conectar proposta e verificação sem duplicar writers/stores. Testar jornada sintética completa e recuperação.
3. Mapear execução de skills, catálogo, admissão e capacidades MCP/plugins. Skill absorvida não equivale a instalação/ativação: manter admissão canônica e proveniência.
4. Integrar conhecimento Genspark conforme plano R-22: proposta sem PHI, revisão, versão local. Sem API/MCP comprovada, usar exportação manual prevista no plano.
5. Verificar voz e caixa universal de entrada a revisão, sem converter transcrição em fato validado.
6. Receber especificação visual de Silas e implementar UI sobre capacidades comprovadas.

Conclusão exige capacidades conectadas e jornadas sintéticas verificadas, persistência recuperável, pendências externas explícitas e revisão humana. Não encerrar o objetivo amplo por concluir apenas este primeiro lote.

## Marco: painel consome a extração cognitiva (21/10/2026, noite)

O Gemini desta data não alterou arquivos: a sessão `326817fe-bd0b-44df-b1ff-89b2571a1c0c` respondeu BLOQUEADO_PELO_ONLY e não recebeu `/only off`. Silas autorizou nesta continuação, de forma explícita, que o escritor desta fatia toque o código, com prioridade no OncoAssist cognitivo e na UI. A regra permanente de autoria em `AGENTS.md` não foi reescrita.

Lacuna fechada: o histórico já devolvia `extracoesCognitivas` e o cliente já lia `/consulta/llm/resultado`, mas `PainelOncoassist` ignorava os dois. Agora a lista mostra só estado, contagens e validade. O valor proposto e a manifestação do harness aparecem depois de "Abrir conferência". Fonte ou consulta alterada fica marcada como leitura histórica. Falha ao abrir ou ao paginar preserva a lista. Nenhum botão confirma fato, prescrição ou conduta.

WRITE_SET desta fatia: `src/ui/consulta/PainelOncoassist.tsx`, `src/contracts/api/oncoassist.ts` (somente rótulos operacionais), `tests/oncoassist-jev/painel-cognitivo.test.tsx`, `tests/oncoassist-jev/oa01-contrato.test.ts` e este registro. WIP visual preexistente não foi reestilizado. A skill de primeira consulta continua protótipo técnico e não foi exposta como conduta.

Verificação: `npx vitest run` dos arquivos `painel-cognitivo`, `painel`, `oa01-contrato`, `oa01-estados` — 4 arquivos, 29 testes aprovados. Em seguida, `npm run typecheck`, `npm run check:boundaries` (546 arquivos, zero exceções) e `oa02-interface` + `cognitivo-cliente` — 2 arquivos, 23 testes aprovados. Não houve commit, integração em main, chamada de LLM real nem aprovação clínica.

Permanece fora deste marco: candidata clínica Silas/Claude, especificação visual além desta ligação, executor de skill admitida, Second Brain externo, Mem0/Graphiti e os transportes nomeados (PubMed, WhatsApp, Plaud, Drive, Agenda, Word, Excel, Higgsfield, 21st). O objetivo amplo continua ativo.

## Marco: leitura PubMed no porto READ (21/10/2026, noite)

Silas continuava a skill clínica com Claude. Esta fatia não leu, não instalou e não expôs essa skill. A exceção de autoria permanece só neste registro: Silas autorizou o escritor desta continuação a alterar código. `AGENTS.md` não foi reescrito.

O transporte E-utilities fica em `src/kernel/gateway/executores/pubmed.ts` e só recebe `{ query?, refs?, signal }`. Sessão, paciente e prontuário não entram na URL. A rota `POST /consulta/leitura` resolve território STUDY, proveniência `ncbi-eutils-pubmed` e o dicionário local. G-02 corre antes da rede. Consulta com forma de identificador é recusada pelo adaptador antes do fetch. O resultado é rascunho bibliográfico com `patientId` nulo, `criaEventoClinico: false` e `consultaClinica: false`. Não vira `clinical_event` nem fato do prontuário. O mesmo `requestId` com a mesma consulta devolve `REPLAY` sem nova rede; consulta diferente no mesmo `requestId` devolve `READ_OPERACAO_DIVERGENTE`.

Nenhum teste chamou `eutils.ncbi.nlm.nih.gov`. O fetch foi sempre injetado.

Verificação nesta fatia: `npx vitest run` de `pubmed-transporte`, `leitura-pubmed` e `read-gate` — 3 arquivos, 14 testes aprovados. Antes, `contratos-saida` — 97 testes aprovados. `npm run typecheck` aprovado. `npm run check:boundaries` — 549 arquivos, zero exceções. `git diff --check` limpo nos arquivos desta fatia. Não houve commit, integração em main nem aprovação clínica.

O parágrafo de pesquisa acima, que registrava PubMed sem transporte, fica superado por este marco. Permanecem fora: candidata clínica, especificação visual, executor de skill admitida, LLM real, Second Brain, Mem0/Graphiti, WhatsApp, Plaud, Drive, Agenda, Word, Excel, Higgsfield e 21st. O objetivo amplo continua ativo. Próxima fatia independente, quando a skill ainda estiver em autoria: mostrar na consulta a lista local desses rascunhos bibliográficos, sem promovê-los a fato.

## Marco: lista local dos rascunhos bibliográficos (21/10/2026, noite)

`POST /consulta/leitura/rascunhos` lê só `draft_envelope` com `patientId` nulo e kind `PUBMED_REFERENCIAS_RASCUNHO`. Exige sessão e consulta aberta. O corpo tem de ser `{}`. A resposta traz título, periódico, data, PMID e URL canônica do PubMed, com `criaEventoClinico: false` e `consultaClinica: false`. Rascunho ilegível ou com URL fora de `https://pubmed.ncbi.nlm.nih.gov/{pmid}/` entra na contagem `omitidos` e não é inventado. Acima de 40 pesquisas válidas, a lista fica nas mais recentes e marca `truncado`. Rascunho vinculado a paciente não aparece. Não há chamada de rede nem escrita em `clinical_event`.

A consulta mostra a seção somente quando a porta oferece `listarRascunhosPubMed`. O texto diz que são rascunhos deste computador e não fatos do prontuário. Falha ao atualizar preserva a lista já aberta. Não há botão de confirmação. A skill clínica não foi aberta.

Verificação: `leitura-pubmed`, `lista-rascunhos-pubmed` e `contratos-saida` — 3 arquivos, 107 testes aprovados. `npm run typecheck` aprovado. `npm run check:boundaries` — 550 arquivos, zero exceções. `git diff --check` limpo nos arquivos rastreados desta fatia. Não houve commit, integração em main, chamada ao NCBI nem aprovação clínica.

Permanece fora: candidata clínica, especificação visual, executor de skill admitida, LLM real, Second Brain, Mem0/Graphiti, WhatsApp, Plaud, Drive, Agenda, Word, Excel, Higgsfield e 21st. Também falta, na consulta, o campo que dispara a pesquisa PubMed; a lista só relê o que já foi salvo. O objetivo amplo continua ativo.

## Marco: campo de pesquisa bibliográfica na consulta (22/10/2026)

Silas continuava a skill clínica com Claude. Esta fatia não leu, não instalou e não expôs essa skill. Não houve rota nova. O campo da consulta chama o `POST /consulta/leitura` já existente. `montarPedidoPubMed` monta um `ReadIntent` só com a consulta aparada, finalidade `RESEARCH` e destino `PUBMED`. Não envia paciente, sessão nem URL. A mesma consulta reutiliza o mesmo `requestId`, então o servidor devolve `REPLAY` sem nova rede. Consulta vazia não dispara a porta.

Identificador conhecido, consulta fechada e operação divergente têm aviso próprio. Qualquer outra falha da pesquisa preserva a lista. Depois de 200 ou 201, a lista local é relida pelo mesmo contador de geração. Não há `confirmar()`. O rascunho continua com `patientId` nulo e fora de `clinical_event`.

Nenhum teste chamou `eutils.ncbi.nlm.nih.gov`. O transporte foi injetado.

Verificação: `leitura-pubmed`, `lista-rascunhos-pubmed` e `contratos-saida` — 3 arquivos, 117 testes aprovados. `npm run typecheck` aprovado. `npm run check:boundaries` — 551 arquivos, zero exceções. `git diff --check` limpo nos arquivos rastreados desta fatia. Não houve commit, integração em main, chamada ao NCBI nem aprovação clínica. A interface foi provada em jsdom, sem navegador.

A consulta passa a pesquisar e a reler referências bibliográficas neste computador. Elas não são fatos do prontuário. Permanece fora: candidata clínica, especificação visual, executor de skill admitida, LLM real, Second Brain, Mem0/Graphiti, WhatsApp, Plaud, Drive, Agenda, Word, Excel, Higgsfield e 21st. O objetivo amplo continua ativo.

## Marco: reconciliação com o remoto da PR #45 (23/10/2026)

Escritor: Claude, por pedido explícito de Silas. Sem push e sem commit na branch da PR.

- WIP preservado no commit local `16d055a` da branch `backup/wip-cognitivo-20261023` (base `39b1836`).
- `feat/quatro-pilares-harness-20261021` avançada por fast-forward até `origin` (`4635d9b`, 27 commits, incluindo a separação de rotas da PR #44). WIP reaplicado por cima.
- Conflitos: `brainOs.ts` combina a correspondência por token inteiro do WIP com o limite de trecho do remoto (o trecho sempre contém o termo); `harness/runtime.ts` mantém a mensagem por campo do remoto.
- Rotas novas portadas para `src/server/rotas/cognitivo.ts` (`skillsClinicas`, `resultadoExtracaoLlm`, `leituraPubMed`, `listarRascunhosPubMed`). O roteador principal só delega. Proveniência de voz (`captureMethod`, hash da captura, `REPROCESSAMENTO_VOZ_NECESSARIO`) reaplicada em `src/server/rotas/extracaoRevisao.ts`.
- Falhas: as 12 de vínculo/identidade/canal eram herdadas de `39b1836` e somem com o remoto. As 3 do WIP foram corrigidas: e-mail do teste PubMed montado em tempo de execução, hash longo e código de saída do Windows reescritos neste registro, RT-04 alinhado à mensagem genérica de número falado e ampliado com um caso de ditado local em nota médica.
- Verificação: `npm run verify` com exit 0 — fronteiras 557 arquivos/zero exceções, corpus 241, 620 arquivos e 5378 testes aprovados. Arquivos do lote ficam staged para o scanner comparar índice e worktree.

Não prova LLM real, NCBI real, navegador nem aprovação clínica. Próximo passo: revisar o diff staged e decidir entre commitar na PR #45 ou abrir uma PR própria para o lote cognitivo.
