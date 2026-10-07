# W10 — plano da entrega integrada e despacho das cinco Lunas

Data: 2026-10-07. Responsável: Astra, planejamento e revisão. Escopo desta contribuição: somente este documento; nenhum teste executado, código alterado, commit ou push realizado pelo planejador.

## Atualização de despacho — prevalece sobre a proposta abaixo

O orquestrador confirmou o despacho efetivo ao fechar este plano. A ordem atual do usuário prevalece sobre as faixas históricas e sobre as atribuições propostas adiante:

| Dono efetivo | Faixa exclusiva e ajuste das fatias |
|---|---|
| Luna 1, já despachada | F01: extrator, normalização, leitura, **caso07**, novos `tests/w10-entrega/extracao`. Não assume servidor/app. |
| Luna 2, já despachada | F03/F04 no **gateway exclusivamente**. Sessão/autorização no servidor são de L5; reportar interface/achados a ela. |
| Luna 3, próxima | F05/F06: Brain/corpus/grafo e testes da própria faixa. Consumidor HTTP é integrado pela L5; não editar servidor/app/UI. |
| Luna 4, próxima | F07/F08: exclusivamente `reconciliacao.ts`, projeções, estatística e RECIST, com seus testes. |
| Luna 5, próxima | F02/F09: exclusivamente app/servidor/UI e testes de integração. **Não editar caso07**, já atribuído a L1. Configuração não foi reatribuída neste despacho. |
| Orquestrador raiz | Todos os testes serializados, revisão, evidências e Git. Agentes **proibidos de executar testes**. |

Base local e cloud sincronizada em `7c078ef`; depois o orquestrador integrou o commit concorrente revisado `2690fe1` no candidato publicado **`55e6cc1`**. As informações de WIP continuam exigindo preservação; não assumir que esse merge libera a faixa inteira. A tabela abaixo conserva o planejamento inicial com objetivos/aceites; leia responsáveis e escopos conforme este despacho efetivo. Este ajuste é explícito para evitar edição concorrente por instruções anteriores.

## Base e autoridade

- Candidato informado pelo orquestrador: `codex/w10-entrega-integrada`, integração Grok + Cursor + Astra em `7c7586c`. Durante a leitura, HEAD já era `7c078ef` (`merge: reconciliar main na entrega W10`). São pontos de reconstrução, não evidência de testes do candidato.
- Fontes normativas lidas: `docs/DECISOES.md`, `docs/ondas/W10-COMUM.md`, `docs/ondas/W8-COMUM.md`, `docs/ondas/W10-CADEIA-ASTRA.md`, `docs/CONTEXTO-NOVA-ABA.md`, prompt de conclusão anexado pelo usuário, distribuição/achados red team e relatórios L1/L5.
- O prompt atual autoriza correção comportamental de `tests/cobertura/caso07.test.ts`, branch de entrega e PR após validação. Supera o veto histórico a publicar a entrega. Não autoriza merge em main, deploy, instalação de providers, Plaud, Nova-3 ou novas skills.
- As quantidades históricas de commits e testes nos documentos não são o estado atual. Astra registra ancestry/diff e SHA efetivo antes do fechamento.
- Há WIP concorrente no worktree principal em `src/kernel/harness/gates.ts`, `src/modules/apac/emissao.ts`, `src/modules/documentos/dedupe.ts` e dois testes associados informados pelo orquestrador. Nenhuma Luna assume esses arquivos. Os dois testes devem ser identificados pelo status do worktree antes de qualquer atribuição específica.

## Matriz das dez fatias

Estados abaixo descrevem o início desta rodada. `NOT_RUN` é a validação do candidato atual; evidência histórica permanece separada. F01–F10 são fatias desta conclusão, não renumeração retroativa dos commits antigos.

| Fatia / estado inicial | Objetivo | Arquivos e dono único | Dependências | Aceite e testes específicos |
|---|---|---|---|---|
| F01 · PARCIAL / NOT_RUN | Corrigir perdas de informação na entrada textual e no trecho riscado | **L1**: `src/kernel/extracao/extrator.ts`, `normalizacao.ts`, `segmenter.ts`, `safety.ts`; testes novos `tests/w10-luna1/` | Reatribuição estreita da faixa histórica Fugu confirmada no despacho do orquestrador; contratos existentes | Colo uterino distinto de cólon; mais de um LAB na mesma linha; PLQ 20.000 com unidade preservada; negação restrita ao achado; trecho riscado retido na fonte e apresentado para revisão, sem virar fato confirmado. Regressões RT-03/04/13 e caso07, com teste final do caso07 sob L5. |
| F02 · PARCIAL / NOT_RUN | Completar extração → caixa → decisão médica → evolução → reabertura | **L1**: `src/server/{rotas,http,leituras}.ts`, `src/app/**`, `src/orchestration/pipeline-extracao.ts`, `src/kernel/extracao/{caixaRevisao,eventoRevisao}.ts`, `src/leitura/**`; `tests/w10-luna1/**` | F01; interfaces F05/F07; writer/ledger canônicos somente consumidos | HTTP autenticado, vínculo explicitamente confirmado, revisão de fato distinta de revisão de identidade, expectedRevision, eventos rastreáveis e reload SQLite. Retorno recupera decisão e fontes. Produzir evolução real do fixture; não montar saída documental à mão. Testes `tests/server/extracao-rascunho.test.ts`, `leituras-http.test.ts` e cenário F09. |
| F03 · PARCIAL / NOT_RUN | Revisar gateway WRITE e criar/provar READ externo controlado | **L2**: `src/kernel/gateway/**`; `tests/w10-luna2/**` | G-02/G-27 existentes; gates.ts fora da faixa; nenhuma conexão real ativada | READ simulado passa por controle de destino/payload/proveniência e auditoria sem PHI; WRITE continua exigir autoridade persistida, escopo, assinatura e hash; replay não duplica efeito; erro não ecoa PHI. Não fabricar artefato assinado para viabilizar READ. RT-12 e `gateway-egress.test.ts`; necessidade de contrato novo vira pedido ao orquestrador. |
| F04 · PARCIAL / NOT_RUN | Confirmar sessão, isolamento e datas civis em -03:00 | **L2**: `src/server/{sessao,autorizacao}.ts`, `src/kernel/gateway/tempo.ts`; `tests/w10-luna2/**` | F03; leitores F02 consomem funções sem duplicá-las | Identidade/autor vêm da sessão; sessão futura/expirada e troca de paciente recusadas; revisão/assinatura não migram de encontro; D85 nunca atrasado e D90 bloqueia emissão, mantendo consulta. Bordas de meia-noite/fuso e replay após revogação. `identidade-http.test.ts`, `tempo-apac.test.ts` e regressões CP-001. |
| F05 · PARCIAL / NOT_RUN | Provar Brain OS com corpus versionado e consumidor real | **L3**: `src/rules/conhecimento/**`, `src/kernel/{conhecimento,grafo}.ts`, `src/server/corpus.ts`, `corpus/{glossario,regulatorio,receitas,redflags}/**`; `tests/w10-luna3/**` | F02 expõe/consome interface de L3; regras de fonte D-W9-22; reatribuição explícita de regras/conhecimento | Consulta chega ao consumidor do app e retorna fonte/versão/status; aula NAO_VERIFICADO não ativa prescrição; trial negativo não é benefício; divergência aparece. Ficha RASCUNHO não ativa. RT-11 e HTTP integrado com captura do resultado retornado. |
| F06 · UNVERIFIED / NOT_RUN | Inventariar e testar ingestão, grafo e vetor sem simular funcionalidade | **L3**: mesmos módulos de conhecimento F05; testes `tests/w10-luna3/**`; referências ragGRAFO somente leitura | F05; CKG continua PROPOSTA; nenhuma instalação/modelo/embedding externo | Validar JSONL, nós, arestas, órfãos, filtro, versão e fonte; provar recuperação do grafo no consumidor. Procurar vetor numérico gerado + índice + busca de similaridade. `embedding_text` não conta. Se inexistente, registrar **NOT_IMPLEMENTED** para embeddings/índice/recuperação vetorial; não inventar vetor para marcar PASS. Nenhum dado identificável no corpus. |
| F07 · PARCIAL / NOT_RUN | Preservar série longitudinal e confirmar RECIST no fluxo | **L4**: `src/kernel/extracao/reconciliacao.ts`, `src/kernel/projections/**`, `src/rules/recist/**`; `tests/w10-luna4/**` | F01 normaliza datas/unidades; F02 consome projeção; reatribuição estreita da faixa histórica Fugu | Valores em datas diferentes formam série; divergência do mesmo exame/instante continua revisão; data desconhecida permanece incerta. RECIST exige elegibilidade, eixo, método, soma e nadir; +35% isolado não prova PD. Testar +20% e +5 mm, fonte ausente, nó 14 mm não elegível como alvo e pulmão 38 mm sem fechar N/M/estádio. `recist.test.ts`, `http-recist-estatistica.test.ts`, RT-06/10/15. |
| F08 · PARCIAL / NOT_RUN | Tornar estatística auditável por período e exclusões | **L4**: `src/estatistica/**`; `tests/w10-luna4/**` | Ledger real de F02; leitores HTTP L1; F07 | Denominador explícito e reproduzível, período/fuso, exclusões e versão; dedupe por paciente, supersessão e rascunho não contado como confirmado. Rastreabilidade local dos cálculos sem exportar IDs/PHI no agregado. `estatistica.test.ts`, HTTP e coorte sintética com exclusões controladas. |
| F09 · PARCIAL / NOT_RUN | Provar jornada sintética completa e substituir âncora RISCADO desatualizada | **L5**: `tests/w10-luna5/**`, `tests/cobertura/caso07.test.ts`, fixtures sintéticos próprios; `src/config/**` apenas correções necessárias | F01–F08 estabilizadas; L5 não modifica módulos clínicos para acomodar teste | Entrada colada, transcrições representativas Plaud/Nova-3 e adapters LAB/RADS simulados; revisão/decisão/reinício/evolução; retorno com CTCAE v6 grau 3 informado pelo médico, PLQ 20.000, TC +35%; prova de isolamento, série, alertas, assinatura separada. Pulmão 38 mm + nó ipsilateral 14 mm mantém estação/acometimento/M pendentes. Caso07 afirma trecho+fonte+revisão, não ausência da palavra no código. |
| F10 · PENDENTE / NOT_RUN | Reataque, verificação do candidato e PR revisável | **Astra** integra/revisa; **L5** fornece testes/resultados. Relatórios/evidências e Git são do orquestrador; testes dedicados somente por dono | F01–F09; WIP concorrente preservado; candidato contra main reconciliado | Typecheck, fronteiras, corpus, testes das áreas, W3, HTTP/UI pertinente, adv-w8, redteam dedicados em blocos com lock. Achados classificados corrigido/reproduzido/desatualizado/bloqueado por decisão; comando/SHA/exit/log por bloco. Branch publicada e PR anexado somente após checks necessários concluídos; nenhuma conclusão clínica baseada apenas no verde regular. |

## Despacho estreito por Luna

Texto comum obrigatório: **Você compartilha este código com outros agentes. Edite somente seus arquivos, preserve alterações alheias e comunique dependências; não reverta trabalho dos demais. Não execute testes, commits ou mudanças Git concorrentes sem coordenação do orquestrador.** Contratos, package/lock/tsconfig, scripts de fronteira, CANONICA e DECISOES permanecem fora do escopo. Tipo provisório só local e explicitamente marcado; mudança de contrato vai ao tech lead/orquestrador.

### Luna 1 — F01/F02

1. Reproduza por leitura/fixture os quatro defeitos explícitos do extrator: colo uterino, negação cruzada, PLQ ausente e múltiplos resultados. Acrescente regressões positivas/negativas/borda na sua pasta, preservando trecho, data, unidade, fonte e identidade.
2. Não esconda trechos riscados: preserve o documento e encaminhe o trecho para revisão. Não confirme conteúdo riscado como fato.
3. Ligue a API existente à revisão clínica persistida. Confirmar vínculo não equivale a confirmar todos os fatos. Use o writer existente e recupere pelo leitor após reabrir o banco.
4. Consuma interface de L3 para conhecimento e de L4 para longitudinal/estatística. L1 é o único editor de `rotas.ts`, `http.ts` e `leituras.ts`; os demais fornecem assinaturas/casos esperados.
5. Não edite `reconciliacao.ts` (L4), `corpus.ts` (L3), `sessao.ts`/`autorizacao.ts` (L2), gates.ts ou módulos APAC/dedupe ocupados.

### Luna 2 — F03/F04

1. Reataque egress, autorização, hash/destino, idempotência, sessão e temporalidade antes de ampliar o gateway.
2. A lacuna READ é concreta no inventário; implemente somente caminho simulado necessário para provar o gateway, com validação e auditoria, sem rede real ou ativação de provider. Consumidor HTTP eventual é integrado por L1.
3. Leia G-02/G-27 como dependências; não os altere. Defeito cuja correção exija gates.ts é reportado ao orquestrador com reprodução, por haver WIP concorrente.
4. Separe exceção documental D-W9-66 de autorização genérica: não ampliar exceção PDF a qualquer payload. Provider continua desligado neste trabalho.

### Luna 3 — F05/F06

1. Trabalhe sobre `src/rules/conhecimento/index.ts` e suas fachadas existentes; não criar um segundo Brain OS nem converter CKG proposto em contrato ativo.
2. Entregue ao L1 uma função consumível e um caso sintético de consulta com status, fonte, versão e divergência. O registro da chamada/resultado pelo app é a evidência funcional.
3. Exercite parser de grafo, arestas órfãs e nós NAO_VERIFICADO. Referência de estudo não se converte em dose/ficha.
4. Audite separadamente ingestão, embedding numérico, índice, filtro e recuperação. Para componente ausente, use NOT_IMPLEMENTED com caminho pesquisado e consumidor ausente; não instalar infraestrutura vetorial.
5. Preserve corpus sem PHI e conteúdos clínicos pendentes sem promoção. Não editar contratos nem `src/server/rotas.ts`.

### Luna 4 — F07/F08

1. Corrija o agrupamento temporal em reconciliação sem apagar conflitos reais; preserve interfaces onde possível e combine a chave com o L1 antes de mudar o formato consumido.
2. Não usar data de ingestão como data clínica. Não deduzir identidade de lesão apenas por órgão quando múltiplas lesões podem coexistir. Chave de dedupe de exames ainda depende de decisão e módulo ocupado; não implementá-la por aproximação.
3. O motor RECIST já calcula elegibilidade/eixo/nadir/+20% e +5 mm. Reutilize-o e teste o percurso de dados até o leitor HTTP. Categoria continua proposta, com ausência marcada pendente.
4. Acrescente período, denominador e exclusões à projeção estatística sem vazar IDs no agregado. Discuta assinatura da função com L1, editor do leitor HTTP.

### Luna 5 — F09 e prova independente F10

1. Escreva o cenário ponta a ponta com eventos e endpoints reais, identidade Paciente Teste NN e CPF/CNS inválidos quando usados; fontes LAB/RADS e transcrições são fixtures.
2. Não confundir importação textual com integração instalada Plaud/Nova-3. Não gerar CTCAE pela IA: o grau 3 entra como declaração médica explícita e versionada.
3. Substitua exclusivamente a âncora obsoleta em caso07 por prova de preservação do trecho/fonte e revisão. Mantenha os dois trechos riscados do fixture e prove que nenhum vira fato confirmado automaticamente.
4. Registre a evolução devolvida pelo app depois da revisão e depois da reabertura; compare conteúdo/proveniência, não apenas status HTTP 200.
5. Novos testes adversariais entram na sua pasta; testes redteam existentes são reexecutados sem enfraquecer expectativas. Achado fora do escopo retorna ao dono do código.

## Riscos de integração e ordem de execução

| Prioridade | Evidência de leitura e impacto | Ação / dono |
|---|---|---|
| P0 | `extrator.ts` usa negação por linha e `raw.match` único para LAB; não reconhece plaquetas. Informação relevante pode desaparecer. | L1 primeiro; L5 prova preservação multifonte no HTTP. |
| P0 | `extrator.ts` captura uma palavra após neoplasia/carcinoma; colo uterino exige contexto composto. | L1 testa colo uterino versus cólon e preserva literal/contexto. |
| P0 | `reconciliacao.ts` agrupa lab por marcador e imaging por sítio sem data; valores diferentes disputam o mesmo campo. | L4 corrige sem apagar divergências realmente contemporâneas; L1 alinha consumidor. |
| P0 | READ externo não aparece no gateway de verbos de efeito; documentos históricos registram RT-12c. Gates têm WIP concorrente. | L2 prova arquitetura READ/WRITE e reporta dependência de gate sem editá-lo. |
| P1 | Fachadas de grafo existem, mas busca estática desta rodada não encontrou chamadas de consumidor HTTP. Inventário não comprova Brain. | L3 interface, L1 ligação, L5 chamada real. Embedding/índice sem evidência permanece UNVERIFIED até inventário conclusivo, então NOT_IMPLEMENTED se ausente. |
| P1 | `timelinePaciente.ts` inicializa `recist: []`; leitor HTTP separado já chama o motor RECIST. | L4/L1 verificam se projeções realmente recuperam o mesmo estado e evitam duas verdades. |
| P1 | `ProjecaoEstatistica` expõe contagens, sem campos explícitos de período e exclusões. | L4 define projeção auditável; L5 verifica coorte e saída sem PHI. |
| P1 | caso07 exige ausência textual de RISCADO em todos os arquivos src; isso contradiz implementação necessária. | L5 troca por asserção de comportamento solicitada pelo usuário. |
| P1 | Status histórico de L1 registra F02 PARCIAL; exemplos de gates chamados com entrada ausente não provam reconciliação real. | L1/L5 testam revisão de fontes discordantes e reabertura com consumidor real. |
| P2 | Configuração global usa SQLite operacional PROVISORIO-W10; não é clinical_event nem prova de Memory OS clínico. | L5 preserva distinção e testa história/autor/revisão; promove contrato somente via orquestrador, se necessário. |

O orquestrador deve despachar em ondas por limite de slots: primeira L1 + L2 + L4; segunda L3 + L5 após slots liberados. L3 pode começar antes se L2 terminar cedo. L5 pode preparar fixture/asserções antes da integração, mas só declara prova funcional após F02/F05/F07/F08. Não usar paralelismo de testes.

## Validação e critérios de parada

O wrapper vivo é `docs/w10/astra/validar.ps1`: lock atômico compartilhado em `C:\Users\silas\Projects\OncoGlobal-wt\_w5-locks\vitest.lock`, logs em `_w10-astra\logs`, `--no-file-parallelism`, pool forks e um worker. Ele já registra HEAD e exits de typecheck/fronteiras/corpus/Vitest. A execução pertence ao orquestrador nesta rodada.

1. Bloco por dono com suas pastas + W3; em seguida HTTP integrado e caso07.
2. Rodar testes dedicados com `-ConfigVitest tests/redteam/vitest.config.ts`, em grupos de arquivos, e adv-w8 com configuração própria. `.adv.ts` não pode ficar excluído pela configuração regular.
3. Para cada falha: registrar comando, SHA, nome, entrada, resultado observado, dono e categoria (corrigida/reproduzida/desatualizada/bloqueada por decisão). Só chamar corrigida após execução do teste representativo.
4. Revalidar o candidato final após mudanças; não transplantar PASS de um SHA anterior para outro. UI pertinente deve exercitar apresentação de fonte/revisão/evolução, sem confundir teste só HTTP com demo UI.
5. Falha em código ocupado: preservar WIP, fornecer reprodução ao dono/orquestrador e registrar bloqueio concreto. Ausência de vetor não autoriza alegação de implementação nem impede registrar conclusão da auditoria dessa capacidade.
6. Não fechar estádio pulmonar a partir de 38 mm + nó ipsilateral 14 mm: estação, confirmação de acometimento e metástases permanecem pendentes. Nenhuma decisão de tratamento é sintetizada para fazer o teste passar.
7. PR exige relato honesto das capacidades PARCIAL/NOT_IMPLEMENTED e dependências. Concluir a auditoria não equivale a concluir capacidade clínica ausente. Se faltar decisão indispensável, informar pergunta clínica concreta ao Dr. Silas pelo orquestrador.

## Resultado desta contribuição

Plano e leitura estática: concluídos. Testes desta contribuição: **NOT_RUN**. Não foram realizados testes clínicos, chamadas externas, instalação, commit ou push. Os riscos acima são achados de leitura e precisam de reprodução pelos donos antes da classificação final de entrega.
