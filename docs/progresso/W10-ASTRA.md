# W10 — cadeia Astra e cinco Lunas

Data: 2026-10-07. Base original `04b53db31598fb80ff78192d4cd3eafde36428fd`. Branch de integracao `f0/w10-astra`; diretorio `C:\Users\silas\Projects\OncoGlobal-wt\w10-astra`.

**Estado atual: EM_EXECUCAO.** Este registro sera fechado depois da integracao e dos testes HTTP. Nao e declaracao de prontidao clinica ou de producao.

Planejamento e revisao independente: `gpt-6-astra`. Implementadores reais: cinco agentes `gpt-6-luna` (L1 servidor, L2 gateway/tempo, L3 corpus, L4 RECIST/estatistica, L5 configuracoes). Root coordenou worktrees, verificacao, correcoes de integracao e merges seriais. Maximo de tres subagentes simultaneos; checks com um worker e lock externo.

## Dez fatias

| Fatia | Estado da implementacao nesta revisao | Evidencia / limite |
|---|---|---|
| F01 — leituras autenticadas | EM_EXECUCAO | L1: consulta, agenda, salao, canal, APAC e chat derivados de eventos locais. |
| F02 — composicao governada | EM_EXECUCAO | L1: extracao/revisao/gates, prescricao/APAC e servicos auxiliares. |
| F03 — gateway | INTEGRADA / PASS focal | G-02/G-27, evidencia imutavel, recibo opaco, auditoria e destino canonico. |
| F04 — tempo | INTEGRADA / PASS focal | -03:00, calendario estrito; consumidor HTTP depende da F02. |
| F05 — glossario/regulacao | INTEGRADA / PASS | 47 caixas; 12 pendencias regulatorias fora da tabela ativa. |
| F06 — receitas/red flags | INTEGRADA / PASS estrutural | 47 fichas/56 modelos RASCUNHO, 16 secoes toxicidade, 25 sinais; nenhuma ativacao clinica automatica. |
| F07 — RECIST | INTEGRADA / PASS focal | Categorias propostas; mensurabilidade, nadir zero, overflow e independencia de ponto futuro reatacados. |
| F08 — estatistica | PARCIAL / PASS do escopo tipado | Contagens operacionais e administracao tipada com conflito preservado; categorias clinicas amplas exigem contratos/produtores. |
| F09 — perfil/conexoes | INTEGRADA / PASS focal | Perfil persistente, conexoes desligadas, sessao valida. |
| F10 — caixas/historico | INTEGRADA / PASS operacional | Historico atomico/idempotente; envelope global PROVISORIO-W10 em SQLite operacional, pedido de contrato canonico. |

## Evidencias ja executadas

Logs completos ficam em `C:\Users\silas\Projects\OncoGlobal-wt\_w10-astra\logs`. Cada validacao tem transcript e saidas `.typecheck.txt`, `.boundaries.txt`, `.corpus.txt`, `.vitest.txt` quando executadas. Os totais abaixo se sobrepoem: **nao somar como testes unicos**.

| Execucao | Resultado real |
|---|---|
| Baseline isolada | 29 arquivos / 229 testes PASS; typecheck, fronteiras174 e corpus91 PASS na baseline. |
| Baseline adversarial W8 | 9 arquivos / 41 testes: 36 PASS e 5 FAIL preexistentes, fora das faixas Astra. |
| L2 inicial | 15 arquivos / 88 testes PASS e checks estruturais PASS. |
| ASTRA-04 RED | 2 falhas reproduziram bypass de destino canonico. |
| ASTRA-04 GREEN | 12 arquivos / 76 testes PASS e checks estruturais PASS. |
| L3 separado por fatias | 3 arquivos / 13 testes PASS; fronteiras174/corpus98/typecheck PASS. |
| L4 anterior a revisao | 3 arquivos / 35 testes PASS; insuficiente para fechar achados ASTRA-01/02/03/08. |
| L4 reataque Astra | 3 arquivos / 42 testes PASS; fronteiras176/corpus91/typecheck PASS. |
| L5 reataque Astra | 3 arquivos / 26 testes PASS; fronteiras175/corpus91/typecheck PASS. |
| Atualizacao canonica D-W9-61 | 8 arquivos / 79 testes PASS (prescricao + W3); typecheck/fronteiras176/corpus98 PASS. |

Primeira baseline Vitest com pool padrao excedeu timeout HTTP e parou de avancar: resultado INCOMPLETO, processo proprio interrompido. Reexecucao com forks, um worker e timeout de I/O 30 s passou; expectativas antigas preservadas. Outros FAILs de desenvolvimento e suas correcoes permanecem nos logs/relatorios individuais.

## Revisao e limites

Plano e prompts: `docs/w10/astra/PLANO-EXECUCAO.md`, `LUNA1.md` a `LUNA5.md`. Achados com reproducoes: `docs/w10/astra/REVISAO-ASTRA.md` e `ACHADOS-REVISAO.md`. Pedidos externos: `docs/w10/PEDIDOS-ASTRA.md` e pedidos individuais de cada Luna.

Cinco falhas adversariais anteriores: deduplicacao de exames (Fugu), interacoes, ficha aprovada por hash, manifesto de merge e ownership de escrita (Grok). Os quatro testes de gates G-07/G-08/G-09/G-27 passaram no mesmo reataque; isso nao encerra aquelas dependencias.

Nenhum contrato congelado, package.json/lock, checker de fronteiras ou checkout de executor externo foi editado pela cadeia. A base principal avancou durante a execucao: o commit canonico `4679e240557e925ec06a26e424737dfb6f2fa287` (D-W9-61 e BSA Mosteller, publicado pelo tech lead) foi recebido por merge controlado, com seus testes e decisao preservados. Sem push, deploy ou merge de volta em `f0/w1-integrado`. Prescricoes-modelo, mensagens e regulacao pendente continuam nos estados registrados por suas fontes. Somente dados sinteticos usados nos testes.
