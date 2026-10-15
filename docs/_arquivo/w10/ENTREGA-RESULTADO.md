# W10 — resultado da integração e execução Astra + cinco Lunas

Data: 2026-10-07. Branch: `codex/w10-entrega-integrada`. Código validado: `8d060b5dd62125d8e957b73ac2046498511d0685`. **Entrega parcial; não é liberação clínica.**

## Integração e sincronização

O workspace recebeu as entregas Grok, Cursor e Astra já reunidas em `7c7586c`. A branch de entrega foi publicada antes das novas correções. A divergência com `origin/main` foi reconciliada em `7c078ef`, e as correções concorrentes commitadas em `2690fe1` foram incorporadas em `55e6cc1`. Nenhum trabalho não commitado de outro worktree foi movido ou descartado. Não houve merge em main nem deploy.

Astra planejou as dez fatias e fez duas revisões de código. Cinco agentes GPT-6 Luna receberam arquivos e tarefas explícitos, sem executar testes ou Git em paralelo. O orquestrador integrou, revisou e executou os testes com o lock global. Seis achados prioritários de revisão foram corrigidos; as provas de comportamento ficam nos testes da entrega. Saídas de LLM não são determinísticas por definição; a validação foi feita por código e testes.

## Dez fatias e limites

| Fatia | Estado | Resultado / pendência |
|---|---|---|
| F01 — extração | PASS no escopo corrigido; pipeline amplo parcial | Colo uterino separado de cólon; colo sem complemento ambíguo; múltiplos LABS; plaquetas; unidades/dúvida; negação por cláusula; rasura multilinha; data comparativa não é data atual; schema runtime. L-01…L-15 completos não foram declarados entregues. |
| F02 — revisão e persistência | PARCIAL | HTTP autenticado, vínculo separado, seleção por fato, writer, replay, escopo, recuperação após reabrir SQLite e conflitos multifonte testados. A UI da consulta ainda não consome integralmente esse novo percurso. |
| F03 — gateway | PASS no endurecimento; READ externo pendente | Evidência Map/não JSON recusada antes do efeito. READ externo não implementado; conexões permanecem desligadas. |
| F04 — sessão/temporalidade | PASS nas regressões executadas | Escopo de paciente/encontro/lote, replay, data/fuso e APAC cobertos pelas suítes existentes e novas. |
| F05 — Brain OS | PARCIAL | Consumidor HTTP autenticado executa consulta lexical local com fontes, status e hash; não transforma referência em regra ou ficha. Curadoria clínica não automatizada. |
| F06 — grafo/vetores | PASS como avaliação | 2.971 nós, 9.347 arestas, zero órfãs; 2.746 NAO_VERIFICADO, 225 DIRETRIZ_FINAL_SBOC_2026. 2.971 embedding_text, zero vetores numéricos. Índice/recuperação vetorial NOT_IMPLEMENTED. |
| F07 — longitudinal/RECIST | PARCIAL | Série LAB com data clínica, conflito no mesmo dia/sem data, histórico TNM e supersessão preservados. Motor RECIST testado; texto livre ainda não monta uma avaliação estruturada completa. |
| F08 — estatística | PARCIAL | Contagem operacional com denominador/exclusões/escopo explícitos. Ledger completo, periodoClinico=null; sem filtro de período clínico ou estatística clínica ampla. |
| F09 — caso clínico | PARCIAL | Texto e fontes simulados, revisão, recuperação, conhecimento e segurança HTTP provados. Plaud/Nova-3 não foram instalados; diarreia G3 textual e crescimento de 36% não acionam automaticamente CTCAE/RECIST nesse percurso. |
| F10 — validação e PR | Auditoria executada; entrega clínica pendente | CI regular verde, W8 verde, W10 adversarial com 12 falhas. PR deve permanecer rascunho até resolver/reclassificar os residuais com prova. |

## Evidência executada

- GitHub Actions: **238 arquivos / 1.565 testes PASS**, incluindo typecheck, fronteiras e corpus: https://github.com/silasjuba-del/OncoGlobal/actions/runs/37605329869 . A CI regular não inclui as provas `.adv.ts` dedicadas.
- Candidato `8d060b5`: typecheck + bloco focal integrado **32 arquivos / 196 testes PASS**. Log local `C:\Users\silas\Projects\OncoGlobal-wt\_w5-locks\logs\20261007-070746-ORQ.log`.
- Reataque W10 no candidato: **214 PASS / 12 FAIL, 28 arquivos, 226 testes**. Log `20261007-070929-ORQ.log` na mesma pasta. A rodada inicial tinha 203 PASS / 24 FAIL / 227 testes; RT-04/RT-10 foram corrigidos para exercitar APIs e semântica reais, então os denominadores não são idênticos.
- W8 no candidato final: **9 arquivos / 41 testes PASS**, log `20261007-071342-ORQ.log`.
- UI: **41 arquivos / 103 testes PASS**, log `20261007-064629-ORQ.log`; build PASS, log `20261007-070457-ORQ.log`. Build emitiu aviso de externalização de node:crypto; não foi realizado smoke manual em navegador real nesta rodada.
- Fronteiras: **238 arquivos PASS**; corpus: **116 arquivos PASS**. Não somar os blocos locais à CI como se fossem testes distintos.

## Captura real do caso sintético

`ENTREGA-CASO-SINTETICO.json` contém resposta HTTP real após fechar e reabrir SQLite, obtida com cópia temporária instrumentada da fixture `fluxo-http.test.ts`, removida após a captura. Log: `20261007-071111-ORQ.log`. Nenhum dado do PDF de paciente foi utilizado.

A medida pulmonar de 38 mm com data explícita foi revisada e gravada como FATO; o linfonodo de 14 mm sem data clínica permaneceu candidato em ReviewDecision, sem valor projetável. A saída não fecha TNM, dose ou tratamento. O resumo ainda reúne rascunhos de revisões individuais, com suas pendências históricas; não equivale a uma evolução final assinada ou ao modelo clínico integral de 14 blocos.

A estatística da fixture registra **2 pacientes sintéticos** (inclui paciente de controle para teste de isolamento), **1 FATO**, **3 OUTRO**, zero documentos assinados e zero administrações. Isso prova o cálculo operacional dessa fixture, não uma coorte clínica ou desempenho diagnóstico. O conhecimento retornou uma referência lexical com fonte/hash e vetorial NOT_IMPLEMENTED.

No retorno textual, plaquetas são normalizadas para 20.000/mm³; diarreia G3 informada e crescimento de 36% permanecem no texto original. Não houve inferência de grau CTCAE, progressão RECIST ou tratamento pela prosa. Os testes do motor separado verificam que +36% com aumento absoluto menor que 5 mm não determina PD e que linfonodo de 14 mm não é alvo elegível.

## Doze falhas adversariais remanescentes

| Prova | Falhas | Próxima ação concreta |
|---|---:|---|
| RT-01 | 3 | Confronto nome×identificador e deduplicação de laudos no pipeline; reavaliar probe do executor ReviewAction contra o percurso HTTP atual, sem criar função fictícia. |
| RT-02 | 1 | Fronteira duvidosa para homônimos sem chamada explícita e com mudança de lateralidade; retenção de idade/tumor entre linhas foi corrigida, este cenário ainda falha. |
| RT-03 | 1 | Prova/consumidor de fármaco foneticamente incerto, homóglifo e zero-width no caminho efetivo. |
| RT-05 | 2 | Ligar a avaliação de cadeias e o corpus RADS à fachada consumida; validar formatos e estado de curadoria, sem ativar regra pendente. |
| RT-07 | 2 | Contrato/produtor tipado de laboratório com unidade e plausibilidade; não adivinhar unidade pela magnitude do número. |
| RT-09 | 1 | Restrição executável de composição agente→agente no ORK. Validação runtime de fatos foi implementada. |
| RT-12 | 1 | Contrato de READ externo com autorização, destinos, sanitização e auditoria; atualmente não há conexão externa ativa. |
| RT-15 | 1 | Exercitar reconciliação planejado×prescrito através da interface real; o probe procura export específico não disponível. Não considerar resolvido só porque uma função semelhante existe. |

Parte dessas provas usa buscas por nomes de funções ou interfaces antigas. Seus resultados continuam FAIL até revisão acompanhada de prova comportamental equivalente. Não foram desabilitadas nem convertidas em skips.

Além dessas provas, ficam dependências explícitas de dados/decisão: sites e credenciais de LABS/RADS reais, curadoria das fichas/interações/biomarcadores, layout SIA, filtro estatístico clínico, apresentação final na UI e acoplamento do retorno textual aos motores estruturados. Sem essas capacidades, não declarar W10 completa.
