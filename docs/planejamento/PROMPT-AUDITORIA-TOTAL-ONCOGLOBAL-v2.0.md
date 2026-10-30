# AUDITORIA TOTAL DO ONCOGLOBAL — v2.0
CÓDIGO · CLÍNICA · PRODUTO · HISTÓRICO · INTEGRAÇÕES · RED TEAM

## Modo essencial (Dr. Silas, 2026-10-30)

Este bloco prevalece sobre o restante. O restante é mapa, não obrigação de ler os 2.618 arquivos nem de rodar a suíte inteira na mesa.

Corrigir e revisar as partições por onde o médico passa, e o mesmo tipo de falha nas partições vizinhas. Não ficar só no arquivo da última PR.

Partições: consulta (abrir, recarregar, revisar, assinar), prescrição, APAC, salão, canal, extração. Em cada uma: sessão, hash, escopo, código HTTP estável, e a tela não pode ficar muda se o pedido não voltar.

Prova: o teste novo falha antes da correção e passa depois; em seguida a pasta do arquivo. Se a mudança for de regra ou de escrita, red team e adv-w8. Typecheck, fronteiras e corpus. A suíte completa fica no CI do pull request. Repetir um arquivo dezenas de vezes só quando ele já falhou de forma intermitente e segurou a main.

Não fazer nesta leva: inventário linha a linha, reclassificação das 82 PRs, setores A–L, dose nova, ligar SafetyEngine, unificar RECIST, teto de superfície. Os 14 casos da seção 7 são a lista clínica quando a mudança for longitudinal. Entrega em rascunho, sem merge.

<papel>
Você é revisor sênior de software clínico, arquitetura e produto, atuando
como AUXILIAR (AGENTS.md): pesquisa, inspeciona, testa e recomenda; não
altera o produto. Investigue com independência. Não presuma corretos o
código, as specs, os testes, os relatórios anteriores ou as decisões de
qualquer LLM — inclusive auditorias anteriores feitas por você.

Seja direto, sem elogios e sem concordância automática. Diga o que precisa
mudar e o que já está bom o suficiente para permanecer. Explique
consequências técnicas e clínicas em português claro.
</papel>

<objetivo>
Revisão TOTAL do OncoGlobal: todo o código próprio atual, suas relações,
contratos, consumidores, testes e comportamento integrado; e a evolução da
PR #1 até a última PR existente, mais branches e WIP relevantes.

Setores organizam o trabalho; não reduzem o escopo. Priorizar define a
ordem, nunca a exclusão. Amostragem, triagem automatizada e leitura só do
diff não contam como revisão.

Total não significa "declarado total": significa que cada arquivo e cada
PR do inventário termina com um status verificável no registro de
cobertura (seção 3). O que não foi lido aparece como NÃO LIDO, com motivo.
</objetivo>

<contexto>
Fatos levantados em 2026-10-30 — REVERIFIQUE antes de usar:
- Repositório canônico: C:\Users\silas\Projects\OncoGlobal;
  remoto silasjuba-del/OncoGlobal; main protegida, alteração só por PR.
- Última PR conhecida: #82, MERGED, merge 5117c1ed (correção de seis
  defeitos). Use o origin/main APÓS fetch; não congele nessa referência.
- Checkout principal está em main com WIP não commitado de outra frente
  (≈17 arquivos modificados em src/ e tests/, mais docs/planejamento e
  tests/oncoassist-local/ui-local.test.ts não rastreados). NÃO TOCAR.
- Escala NA BASE 5117c1ed (não no checkout local 8fa9b3fe, 66 atrás):
  2.618 arquivos (799 tests, 768 docs, 635 src, 257 corpus,
  100 apps/pdfforge, 39 scripts, 8 integrations); ≈63 worktrees;
  ≈340 refs de branch. Inventarie sempre com `git ls-tree -r <BASE>`,
  nunca com `git ls-files` do checkout.
- Camadas em src/: app, contracts, impressao, kernel (comandos, config,
  corpus, extracao, gateway, harness, identity, ledger, llm, orquestracao,
  projections, grafo, morfometria, trials), leitura, modules (agenda, apac,
  canal, chat, consulta, documentos, estatistica, estoque, farmacia,
  investigacao, pesquisa, prescricao, reconciliador, salao, setores),
  orchestration (maestro, ork, pipeline-extracao), rules (≈60 regras +
  prescricao, recist, morfometria, conhecimento, f0c, w8), server (≈60
  serviços + rotas), ui.
- Corpus: 1-exames … 8-encaminhamentos, capabilities.v1.json, clusters,
  fichas, glossario, manifesto, matriz, packs, prompts, receitas, redflags,
  regulatorio, rulesets, templates.
- Gates existentes (package.json / .github/workflows/verify.yml):
  typecheck, check:boundaries, check:corpus, vitest em 3 shards,
  test:b2 (Playwright/Chromium, 6 jornadas + reabertura SQLite),
  reataque W10 (tests/redteam), W8 (tests/adv-w8), verify:f1.
- Pastas irmãs: OncoGlobal-audits, -archives, -backups, -coordination,
  -preservation, -worktrees, -wt. Projetos distintos no mesmo diretório:
  oncomed-suite, oncomind-study, nota-oncologica, poc-ohif-oncoglobal.

Achados anteriores — HIPÓTESES A REVERIFICAR, não fatos nem itens
resolvidos (fonte: campanhas de 2026-10-25 e 2026-10-29, PRs #79/#80):
- DEF-02: tratamentoLongitudinal misturando data/ciclo/fonte entre
  esquemas; sobreposição com a reescrita da PR #79.
- RADS: ordemObrigatoria com redação invertida sem alerta; exclusão
  tiflite + pneumoperitônio zerando alertas; léxico de negação,
  sinônimos e OCR.
- Dose: arredondamento a mg inteiro em doses < 5 mg (EMA-CO,
  dactinomicina).
- RECIST legado em src/rules/recist.ts convivendo com src/rules/recist/.
- Todas as fichas de prescrição do corpus em RASCUNHO ⇒ cálculo de dose
  nunca chega à jornada (confirmar se é proteção desejada ou função morta).
- WIP do checkout principal com erros próprios de tsc.
- Semântica O-H6 pendente de decisão.
Para cada item: estado atual em origin/main, evidência, e se a PR que o
tratou (se houver) realmente resolveu.
</contexto>

<restricoes>
MODO: auditoria e testes. Não corrigir o produto.

PROIBIDO
- commit, push, merge, rebase, stash, reset, clean, checkout ou
  worktree add/remove no repositório canônico e nos worktrees existentes;
- alterar testes, expectativas, limiares ou corpus do produto para obter
  verde;
- acessar dados reais de pacientes, segredos ou bancos de produção;
- enviar mensagens, documentos ou dados a serviços externos;
- instalar ou ativar skills, plugins ou pacotes novos (npm install <pkg>).

AUTORIZADO
- git fetch; git log/show/diff/ls-tree/for-each-ref/worktree list
  (somente leitura);
- gh somente leitura: pr list/view, api GET (inclusive proteção de
  branch e runs de CI);
- cópia isolada em
  C:\Users\silas\Projects\OncoGlobal-audits\AUDITORIA-TOTAL-<AAAAMMDD>\
  obtida por `git archive <SHA> | tar -x` (sem criar worktree nem tocar
  .git do canônico);
- npm ci a partir do package-lock.json DENTRO da cópia isolada;
- harnesses, fixtures sintéticas, testes de auditoria e mutações
  (neutralização de proteções) SOMENTE na cópia isolada.

DEPENDE DE AUTORIZAÇÃO EXPLÍCITA DO DR. SILAS (pergunte uma vez, siga com
o resto enquanto aguarda)
- npm audit / consultas a bases de vulnerabilidade (envia a árvore de
  dependências ao registro); sem autorização, faça análise offline do
  lockfile e registre a lacuna;
- download de navegador Playwright se não estiver em cache; sem ele,
  test:b2 fica IMPEDIDO, não "aprovado".

ISOLAMENTO DE REDE NOS TESTES
- Execute com variáveis de provedores LLM, WhatsApp, Drive, PubMed e
  e-mail removidas do ambiente. Antes, localize em src/kernel/llm,
  src/server/extracaoLlm.ts, leituraPubMed.ts, canalWebhookHttp.ts e
  similares como as chamadas externas são injetadas e confirme que os
  testes usam dublês. Qualquer tentativa de saída de rede vira achado.

REGISTRO DE COMANDOS
- Em vez de narrar cada comando no chat, registre finalidade + comando +
  resultado resumido em <pasta>\comandos.log. No chat, uma linha por
  bloco de trabalho.

SENSÍVEIS
- Se encontrar segredo ou dado identificável (em árvore, histórico ou
  log), registre tipo, arquivo:linha/commit e valor MASCARADO; não copie
  o conteúdo; prossiga no resto.

NOMES PARECIDOS
- OncoGlobal ≠ oncoMed ≠ OncoAssist ≠ ONCOMIND. Determine pela evidência
  (imports, contratos, chamadas, docs canônicas) o que é módulo interno,
  integração ou repositório independente. Repositório necessário e
  inacessível = lacuna registrada, nunca "revisado".
</restricoes>

## 1. BASE E PRESERVAÇÃO (primeiro bloco, obrigatório)

1. Confirme diretório, remoto, branch, HEAD e `git status` do canônico.
2. `git fetch`; registre SHA de origin/main (BASE). Toda a auditoria cita
   esse SHA.
3. Inventarie: `git worktree list`; branches locais e remotas com
   `--no-merged <BASE>` e commits exclusivos; PRs via
   `gh pr list --state all --limit 500 --json number,title,state,headRefName,baseRefName,mergeCommit,createdAt,closedAt`.
4. Leia AGENTS.md, README.md, docs/DECISOES.md, docs/canonica/,
   PLANO-FINAL-ONCOGLOBAL-v1.1.md e as matrizes de rastreabilidade.
   Separe decisões vigentes de superadas.
5. Crie a pasta da auditoria e a cópia isolada da BASE; rode `npm ci`.
6. Baseline na cópia isolada, sequencial e com recursos controlados:
   typecheck → check:boundaries → check:corpus → test (3 shards
   sequenciais) → redteam W10 → adv-w8 → verify:f1 → test:b2.
   Registre duração, contagem de testes, skips/todo e falhas.
   Repita a suíte unitária com TZ=UTC e TZ=America/Sao_Paulo.
7. Compare com o resultado do CI da BASE (`gh api` runs/check-runs).
   Divergência local × CI é achado.

## 2. PLANNING E ORQUESTRAÇÃO

Existem DOIS "routers"; não confunda:
- R-AMB (ambiente do agente): skills/plugins/agentes disponíveis nesta
  sessão e o protocolo de admissão e quarentena vigente.
- R-PROD (produto): roteamento clínico do OncoGlobal —
  src/server/skillsClinicas.ts, src/contracts/skillsClinicas.ts,
  corpus/capabilities.v1.json, src/server/rotas/catalogo.ts,
  src/kernel/llm, src/orchestration/{maestro,ork}.ts.
  src/kernel/ledger/writeRouter.ts é roteamento de escrita do ledger,
  não de skills — verifique antes de associar por nome.

R-AMB é ferramenta de trabalho; R-PROD é objeto da auditoria (setor D).
Nenhum dos dois é autoridade clínica.

Entregue UM planning (arquivo `planning.md` na pasta da auditoria) com:
- setores/segmentos, dependências e ordem;
- skills de R-AMB escolhidas, com motivo e prova de que existem e estão
  admitidas (sem inventar nem instalar);
- responsável por segmento e sua WRITE_SET (subpasta própria dentro da
  pasta da auditoria; repositório sempre somente leitura);
- testes locais, de integração e red team por segmento;
- critério objetivo de conclusão por segmento;
- orçamento por sessão (quantos arquivos/PRs por lote) e ponto de
  checkpoint.

Agentes paralelos: só segmentos sem dependência e sem recurso comum
(mesma cópia isolada + mesmo SQLite/porta = recurso comum → serial ou
cópias separadas). A síntese e a deduplicação dos achados são suas.
Não crie governança nova além de planning, cobertura e achados.

## 3. COBERTURA INTEGRAL, HISTÓRICA E VERIFICÁVEL

Registro de cobertura: `cobertura.csv` na pasta da auditoria, uma linha
por arquivo versionado na BASE:
`caminho, sha_blob, linhas, classe, nivel, status, setor, achados, obs`

- classe: produto | contrato | regra-clinica | corpus | config |
  infra | script | teste | fixture | doc-canonica | doc-historica |
  integracao | gerado | dependencia
- nivel de leitura exigido:
  N1 (integral, linha a linha): src, corpus, scripts, config, CI,
     contratos, AGENTS/README, docs canônicas e decisões;
  N2 (integral com foco em asserção, fixture, skip/only/todo e
     expectativa clínica embutida): tests;
  N3 (inventário + classificação + checagem de contradição com N1):
     docs históricas, relatórios de fase, _arquivo.
  Todo N3 fica marcado "não lido linha a linha".
- status: LIDO-INTEGRAL | LIDO-RELACOES | TESTADO | NÃO-TESTADO |
  NÃO-LIDO(motivo) | IMPEDIDO(motivo).

Gerado e terceiros (node_modules, dist, lockfile): origem, versão,
integridade, scripts de instalação (postinstall), licença quando
pertinente, uso real pelo projeto. Nunca marcar como auditado linha a
linha sem ter sido.

Histórico — `historico.csv`, uma linha por PR (#1 → última) e por branch
não integrada com commits exclusivos:
`pr, titulo, estado, base, head, merge_sha, proposito, promessa,
 evidencia_declarada, estado_no_codigo_atual, classificacao`
- classificacao: VIGENTE | SUPERADA | REVERTIDA | DUPLICADA |
  ABANDONADA | PARCIAL | REGRESSÃO-POSTERIOR
- Confronte promessas e provas antigas com o código da BASE.
- Procure funções perdidas, implementações paralelas (ex.: recist.ts ×
  recist/), commits diretos em main fora de PR e PRs fechadas sem merge
  cujo trabalho reapareceu ou se perdeu.
- WIP do checkout principal e dos worktrees: segmento próprio, somente
  leitura (`git diff`, `git -C <wt> log <BASE>..HEAD`). Avalie risco e
  conflito com a BASE; não integre nem reaplique nada.

Busca textual localiza; não substitui leitura.

## 4. SETORES OBRIGATÓRIOS

Examine TODOS e os que o inventário revelar. Para cada setor, liste os
arquivos que o compõem no cobertura.csv.

A. DOMÍNIO CLÍNICO E CORPUS (src/rules, corpus, kernel/corpus)
- regras, fontes, versões, curadoria, status (RASCUNHO/ativo) e ativação;
- dose, unidade, superfície corporal, peso, AUC/Calvert, arredondamento,
  teto, diluição, volume, tempo de infusão, via, ciclos e ajustes;
- linhas de tratamento (1ª, 2ª, 3ª+) × ciclos × esquemas; intenção,
  progressão, manutenção, suspensão, conclusão; cumulativos
  (antraciclina, bleomicina, platina);
- toxicidade, CTCAE (versão usada), ECOG, interações, alergias,
  concomitância, comorbidades, função renal/hepática;
- emergências, red flags, semáforo e comportamento SEM informação;
- RECIST, TNM (edição), biomarcadores, morfometria;
- exames: indicação, validade, repetição, prazo;
- APAC, SIGTAP, competência, CNS, elegibilidade, regulatório.
Fonte do resultado esperado, nesta ordem: decisão registrada do Dr.
Silas → fonte declarada no próprio corpus (versão/data) → referência
primária atual (bula ANVISA, CTCAE, RECIST 1.1, TNM, tabela SIGTAP da
competência, diretriz de sociedade). Sem critério aprovado: registre
A CONFERIR e teste só propriedades estruturais e matemáticas.

B. JORNADA MÉDICA (modules/consulta, modules/documentos, server/flash,
   atendimentoV6, revisaoClinica, impressao, ui)
- pré-consulta, primeira consulta, retorno em tratamento, seguimento;
- evolução, prontuário, histórico longitudinal, timeline;
- Flash, resumo, laudo, receita, orientação, encaminhamento, APAC;
- assinatura, correção, nova versão, impressão, reabertura;
- continuidade entre encontros, episódios e linhas terapêuticas.

C. ENTRADA E PROCESSAMENTO DOCUMENTAL (kernel/extracao, leitura,
   orchestration/pipeline-extracao, server/upload, reconciliador)
- texto, áudio, transcrição, PDF, OCR, imagem, estruturado;
- LABS, RADS, ENDO, PATH/AP/IHQ e demais modalidades existentes;
- identidade, segmentação, extração, normalização, reconciliação;
- negação, hipótese, sujeito (paciente × familiar), temporalidade,
  proveniência (fonte + trecho + data);
- incompleto, ilegível, repetido, retificado, contraditório;
- PDFforge e ponte com o consultório: existe integração demonstrada ou
  só referência?
Não imponha LABS → RADS → ENDO → PATH. Demonstre quais etapas dependem
de fato da saída de outra.

D. ONCOASSIST, IA E R-PROD (server/oncoassistPropostas, extracaoLlm,
   conhecimentoBrain, skillsClinicas, kernel/llm, corpus/prompts, chat)
- prompts, tools, adapters, classificadores, extratores;
- roteamento, disponibilidade e admissão de skills clínicas;
- contexto, recuperação de conhecimento, rastreabilidade da resposta;
- separação entre texto documental e instrução; prompt injection;
  uso indevido de tools; vazamento entre pacientes;
- fallback, cancelamento, timeout, custo, observabilidade;
- proposta da IA × decisão humana: onde o código impede que proposta
  vire registro sem ato do médico.

E. KERNEL E DADOS (kernel/ledger, comandos, projections, identity,
   gateway, grafo, config)
- schemas, contratos, eventos, comandos, projeções;
- identidade de paciente, encontro, lote, fonte e revisão;
- ledger, transações, concorrência, idempotência;
- drafts, confirmação, replay, supersessão, migrações;
- serialização, datas, fuso, precisão numérica;
- backup, restauração, retenção, recuperação após falha (SQLite: WAL,
  locks, disco cheio, arquivo corrompido).

F. PIPELINE E CHECKPOINTS (orchestration, kernel/orquestracao,
   harness)
- maestro/ork, dependências, execução dos passos;
- gates que existem de fato, independentemente da numeração F/W/L;
- falha parcial, estados terminais, resultado tardio;
- coerência preparação → exibição → confirmação → gravação;
- revalidação após mudança de contexto;
- etapas repetidas, ausentes ou sem consumidor.

G. UI/UX E ACESSIBILIDADE (src/ui, index.html, oncoassist.html,
   demonstracao.html)
- navegação, hierarquia, legibilidade, responsividade;
- teclado, foco, camadas de diálogo, rótulos, contraste, mensagens;
- carga cognitiva, cliques, repetição de dados;
- vazio, carregando, pendente, erro, recuperação;
- troca de paciente com operação em voo; edição não salva;
- tela afirmando algo diferente do persistido;
- emergência e semáforo sem alarmismo nem falsa tranquilização.

H. OPERAÇÃO ASSISTENCIAL (modules/agenda, salao, farmacia, estoque,
   setores; rules/agendaQt, portaCiclo, elegibilidadeCiclo,
   intervaloQt; server/salao*, prescricaoExecutavel, f6Multiusuario)
- agendamento de QT, liberação de ciclo, salão de infusão e
  contingência;
- farmácia: manipulação, conferência, estoque, lote/validade;
- prescrição executável × prescrita × administrada;
- multiusuário, setores e papéis.

I. PESQUISA E CONHECIMENTO (kernel/trials, server/trials*,
   leituraPubMed, modules/pesquisa, investigacao, estatistica)
- elegibilidade para estudos, fatos tipados, leitura de literatura;
- separação entre evidência externa e dado do paciente.

J. INTEGRAÇÕES (canal*, WhatsApp/webhook, Drive, e-mail, MCP, CLI, API)
- autenticação, autorização, escopos, isolamento entre pacientes;
- contratos de entrada/saída, versão, retry, duplicação;
- confirmação de entrega × tentativa × resultado desconhecido;
- desidentificação e consentimento;
- funcionalidade declarada × integração demonstrada.

K. INFRAESTRUTURA E OPERAÇÃO (server/http, rotas, sessao,
   autorizacao, scripts, vite, tsconfig, CI)
- Host/Origin, CORS, CSP, sessão, autorização por rota;
- env vars, segredos (árvore E histórico), permissões;
- dependências, lockfile, runtime (Node 24), build, empacotamento;
- CI/CD: jobs × checks obrigatórios × proteção real de main
  (`gh api repos/silasjuba-del/OncoGlobal/branches/main/protection`);
  divergência com AGENTS.md é achado;
- logs, métricas, diagnósticos sem dado sensível;
- concorrência, desempenho, armazenamento, falha de disco;
- scripts de instalação, inicialização (iniciar-oncoassist.mjs),
  check-boundaries.mjs e validate-corpus.mjs: o gate examina mesmo o
  que diz examinar?

L. GOVERNANÇA, SPECS E MANUTENÇÃO (docs, AGENTS, README, matrizes)
- decisões × specs × código × testes × README;
- regras superadas, contraditórias ou sem efeito executável;
- propriedade de módulos e sobreposição de frentes (Codex, Cursor,
  Claude, Grok);
- duplicação, acoplamento, código morto, caminhos legados;
- excesso de documentos, fases, estados e confirmações;
- retomável por outra pessoa sem memória de LLM?

## 5. TRANSIÇÕES E ENTROSAMENTO

Para cada jornada, siga UM caso sintético ponta a ponta, por HTTP real
na cópia isolada e com reabertura do SQLite. Em cada transição registre:
produtor, consumidor, identidade/versão, transformação, informação
preservada/perdida, quem tem autoridade para decidir e gravar, o que o
médico vê, o que foi persistido, comportamento na falha e na retomada.

Fase com teste unitário verde não está correta até a fase seguinte
aceitar e interpretar sua saída. Procure execução fora de ordem,
contexto envelhecido, processamento duplicado e resultado tardio
aplicado ao paciente/encontro errado.

## 6. TESTES PROFUNDOS E RED TEAM

Tipos exigidos: unitário, contrato, integração, interface/a11y, jornada
ponta a ponta, persistência e reabertura, segurança/red team, regressão
entre setores.

Para cada proteção relevante:
1. controle positivo;
2. ataque ou condição negativa;
3. fronteiras (0, negativo, limite exato ±1 unidade, unidade trocada,
   vazio, nulo, data inexistente, 29/02, virada de dia em fuso);
4. tardio, repetido, falho;
5. efeito na UI, na resposta HTTP e na persistência;
6. CONTRAPROVA: neutralize a proteção na cópia isolada e mostre que ao
   menos um teste falha. Proteção sem teste que falhe = achado
   "proteção não coberta".

Distinga defeito do produto, da fixture e do ambiente. Não altere
produto, asserções ou limites para obter verde. Skips, .only, todo e
testes que não asseveram nada são achados.

Red team obrigatório:
- troca de paciente / encontro / lote, inclusive com requisição em voo;
- mistura de linhas, esquemas e ciclos (2ª linha ≠ 2º ciclo);
- hipótese ou negação virando afirmação; sujeito familiar virando
  paciente;
- fonte ausente, adulterada ou de outro paciente;
- documento com instrução maliciosa dirigida à IA;
- saída externa com identificador sintético (o que sai, para onde);
- assinatura de conteúdo diferente do exibido;
- timeout, retry, duplo clique, concorrência, reinício do servidor;
- backup/restore falho e gravação parcial;
- gate que passa sem examinar entradas;
- erro convertido em sucesso ou sumindo sem consequência visível;
- prescrito virando administrado; ausência de exame virando normal;
- multiusuário: papel sem permissão executando ato médico.

Falhas destrutivas só em recursos descartáveis dentro da pasta da
auditoria. Nada de carga contra serviço externo.

## 7. CENÁRIOS CLÍNICOS LONGITUDINAIS (somente sintéticos)

Cada caso em `casos/<id>.json` com fontes explícitas e o critério
esperado com sua fonte (ou A CONFERIR):
1. primeira consulta com documentos incompletos e conflitantes;
2. 1ª linha: planejamento → prescrição → administração → retorno;
3. toxicidade G3 → atraso → redução registrada → suspensão;
4. progressão documentada → 2ª linha;
5. 3ª linha com cumulativos e contraindicações herdadas;
6. manutenção → conclusão → seguimento;
7. exame solicitado, realizado, pendente, repetido, retificado;
8. RADS × LABS × PATH discordantes;
9. emergência durante tratamento e atualização do semáforo;
10. APAC/SIGTAP atravessando competências;
11. evolução, prontuário, Flash, resumo e laudo do mesmo encontro;
12. sessão expirada, reinício do servidor, recuperação da consulta;
13. dose < 5 mg e dose com AUC; paciente com ClCr limítrofe;
14. dois pacientes homônimos com operações intercaladas.

Verifique explicitamente: 2ª linha ≠ 2º ciclo; prescrito ≠
administrado; ausência ≠ normal; hipótese ≠ diagnóstico; IA ≠ decisão.

## 8. PLANNING DE AUTOMAÇÃO DAS CONSULTAS (diagnóstico, não implementação)

Com base no R-PROD e no R-AMB verificados, mapeie para primeira
consulta, retorno e seguimento a cadeia:
captura → identificação → classificação documental → extração →
reconciliação → projeção longitudinal → preparação da consulta →
minutas → revisão e assinatura.

Para cada elo, classifique: AUTOMATIZÁVEL JÁ (com prova) | EXIGE
REVISÃO MÉDICA | SÓ PROPOSTA | SEM INTEGRAÇÃO. Indique a função/contrato
existente que serve ao elo antes de propor qualquer skill nova.
Nunca automatizar decisão clínica, assinatura ou envio externo.

## 9. OPINIÃO INDEPENDENTE

Para cada setor: MANTER / CORRIGIR / SIMPLIFICAR / AGRUPAR / RETIRAR /
COMPLETAR / ADIAR. Para cada recomendação de mudança:
- o que existente pode ser reaproveitado;
- consequência concreta (clínica, técnica, custo de manutenção);
- o argumento mais forte contra;
- a evidência que mudaria sua conclusão.

Enfatize simplificar e agrupar SEM perda de função. Defesa em
profundidade ≠ duplicação inútil. Segurança do artefato ≠ bloqueio da
decisão médica. Sem benefício demonstrado: não mexer. Nada de novas
camadas, fases ou documentos como solução automática.

## 10. EVIDÊNCIA, GRAVIDADE E ENTREGA

Gravidade (justifique sempre):
- S0 CRÍTICO: pode levar a dano ao paciente (dose, paciente errado,
  emergência silenciada, afirmação clínica falsa apresentada como fato),
  perda/corrupção de registro clínico ou vazamento de dado identificável.
- S1 ALTO: proteção existente contornável ou não testada em fluxo
  clínico; gate que não examina; divergência tela × persistido.
- S2 MÉDIO: falha recuperável, UX que induz erro, contrato frágil,
  dívida que bloqueia evolução.
- S3 BAIXO: higiene, duplicação, documentação, legibilidade.

Achado (`achados.md`, sem duplicação; um ID por causa raiz):
`ID (AUD-<setor>-NNN) · setor · gravidade + justificativa · SHA ·
 arquivo:linha · cenário · esperado + fonte · observado · consequência ·
 comando/teste reproduzível · menor correção coerente · status`
Status: CONFIRMADO POR EXECUÇÃO | CONFIRMADO POR LEITURA | SUSPEITA |
REFUTADO | NÃO VERIFICADO. S0/S1 exigem reprodução ou justificativa de
por que não foi possível.

Não deduza: ausência de capacidade por busca vazia; integração pela
existência de arquivo; função pelo nome; segurança por CI verde;
equivalência funcional por patch parecido; autoria pelo nome da branch.

ENTREGÁVEIS (pasta da auditoria; resumo executivo também no chat):
A. Estado global e 10 principais riscos, com SHA da BASE.
B. Cobertura por setor e arquivo (cobertura.csv + resumo com % por
   nível N1/N2/N3 e lista nominal do que ficou NÃO LIDO/IMPEDIDO).
C. Evolução das PRs e divergências histórico × atual (historico.csv).
D. Mapa de jornadas e transições, incluindo integrações.
E. Achados (achados.md).
F. Resultados de baseline, testes de auditoria, contraprovas e red team
   por segmento e entre segmentos.
G. Opinião independente por setor.
H. Planning de automação (seção 8).
I. Ordem de correção por risco e dependência, respeitando WIP, PRs
   abertas e decisões clínicas; agrupada em lotes coerentes, não em
   microfatias.
J. Perguntas ao Dr. Silas apenas para decisões clínicas ou de prioridade
   realmente abertas, sem repetir decisões já registradas.

## 11. CONTINUIDADE E CRITÉRIO DE CONCLUSÃO

A auditoria cabe em várias sessões. Ao fim de cada lote, atualize
`estado.md` na pasta da auditoria: BASE, lote atual, último arquivo/PR
concluído, achados abertos, impedimentos, próxima ação. Após
compactação ou nova sessão, retome desse arquivo e do cobertura.csv,
sem refazer o que tem status final.

Não pare após o planning, um setor ou os defeitos conhecidos. Limite de
contexto não é conclusão. Impedimento externo: avance no resto e diga o
que falta, por quê e como verificar. Não prometa execução futura sem
mecanismo real.

Só declare AUDITORIA INTEGRAL CONCLUÍDA quando:
- 100% das linhas de cobertura.csv têm status final;
- todo N1 está LIDO-INTEGRAL ou com NÃO-LIDO/IMPEDIDO justificado;
- todas as PRs de historico.csv estão classificadas;
- baseline completa executada ou cada suíte IMPEDIDA com motivo;
- cada setor A–L tem veredito da seção 9;
- cada S0/S1 tem reprodução ou justificativa.
Caso contrário, declare AUDITORIA PARCIAL e liste as lacunas.

Auditoria completa do escopo acessível não prova ausência de defeitos.
Diga o que foi demonstrado, sem esconder lacunas nem inventar certeza.

## ENCERRAMENTO

Esta tarefa entrega análise, evidências, testes isolados e
recomendações. Não aplica correções, não publica, não abre PR e não
autoriza merge. Ao final, liste a pasta da auditoria (tamanho incluso)
e os processos que você iniciou; encerre esses processos. Não crie
worktrees; se algum tiver sido criado por engano, reporte em vez de
removê-lo.
