# W10 · Progresso FUGU

Worktree `w10-fugu`, branch `f0/w10-fugu`; base no início `d2af9e7`. Apenas dados sintéticos. Retomar da primeira fatia não FEITA; mesclar `f0/w1-integrado` antes de começar cada fatia.

| Fatia | Estado | Commit | Evidência / pendência |
|---|---|---|---|
| FUGU-01 · Tipos e esqueleto | FEITA | `W10-FUGU-01` (commit desta fatia) | Nove etapas puras, 5 testes novos; tipos locais provisórios até contratos W10 |
| FUGU-02 · Conversão local | BLOQUEADA_DEPENDENCIA (parcial) | `W10-FUGU-02` (commit desta fatia) | Texto/DOCX locais, 5 testes novos; PDF digital não extraído sem parser aprovado; pedido ao tech lead |
| FUGU-03 · Segmentação | FEITA | `W10-FUGU-03` (commit desta fatia) | 4 testes: maratona de 3 pacientes, fronteira incerta, pausa longa, acompanhante; sem vínculo automático |
| FUGU-04 · PatientResolver | FEITA | `W10-FUGU-04` (commit desta fatia) | Ranking por pesos, razões, homônimos por cadastro e nome zerado em Plaud; 4 testes, nunca AUTO_MERGE |
| FUGU-05 · Extrator | FEITA (dublê sintético) | `W10-FUGU-05` (commit desta fatia) | Porta síncrona + regex determinísticas, 7 testes novos; PT07–PT10, negação e números falados; sem LLM/autoridade clínica |
| FUGU-06 · Normalização | NÃO_INICIADA | — | — |
| FUGU-07 · Reconciliação | NÃO_INICIADA | — | — |
| FUGU-08 · SafetyValidator | NÃO_INICIADA | — | — |
| FUGU-09 · Caixa de revisão | NÃO_INICIADA | — | — |
| FUGU-10 · Timeline | NÃO_INICIADA | — | — |
| FUGU-11 · Radiologia e biomarcadores | NÃO_INICIADA | — | — |
| FUGU-12 · E2E e fechamento | NÃO_INICIADA | — | — |

## Saídas reais · FUGU-01 (comandos em série)

`npx tsc --noEmit` — exit 0, sem diagnósticos (após `npm ci --offline --ignore-scripts --no-audit --no-fund`; o primeiro `npx tsc` falhou porque ainda não havia `@types/node` neste worktree).

```text
> oncoglobal@0.0.1 check:boundaries
> node scripts/check-boundaries.mjs
fronteiras ok (138 arquivos)

> oncoglobal@0.0.1 check:corpus
> node scripts/validate-corpus.mjs
corpus ok (29 arquivos)

RUN  v5.0.3 C:/Users/silas/Projects/OncoGlobal-wt/w10-fugu
Test Files  7 passed (7)
Tests  30 passed (30)

RUN  v5.0.3 C:/Users/silas/Projects/OncoGlobal-wt/w10-fugu
Test Files  1 passed (1)
Tests  9 passed (9)
```

Comandos Vitest: `npx vitest run tests/kernel/extracao tests/projections tests/orchestration tests/leitura tests/w10-fugu --no-file-parallelism`, seguido de `npx vitest run tests/w3/auditoria-regressao.test.ts --no-file-parallelism`. Apenas a FUGU-01 foi executada: não declarar pipeline clínico, integração ao ledger ou liberação de LLM. Testes `.adv.ts` W8 não executados nesta fatia; nenhum convertido em verde aqui.

Pedido de contrato: `docs/w10/PEDIDOS-FUGU.md`. Sem novos valores clínicos `[VERIFICAR]` introduzidos.

## Saídas reais · FUGU-02 (comandos em série)

Primeira execução dos testes direcionados: **1 FAIL/34 PASS** por expectativa equivocada do teste sobre a fixture (rótulo `PACIENTE TESTE 07` em maiúsculas e rasuras). A lógica foi corrigida para deixar o documento com `[RISCADO]` em PENDENTE; a expectativa foi ajustada para a fonte real, sem alterar teste existente.

`npx tsc --noEmit` — exit 0, sem diagnósticos.

```text
> oncoglobal@0.0.1 check:boundaries
> node scripts/check-boundaries.mjs
fronteiras ok (139 arquivos)

> oncoglobal@0.0.1 check:corpus
> node scripts/validate-corpus.mjs
corpus ok (29 arquivos)

RUN  v5.0.3 C:/Users/silas/Projects/OncoGlobal-wt/w10-fugu
Test Files  8 passed (8)
Tests  35 passed (35)

RUN  v5.0.3 C:/Users/silas/Projects/OncoGlobal-wt/w10-fugu
Test Files  1 passed (1)
Tests  9 passed (9)
```

`npx vitest run --config tests/adv-w8/vitest.config.ts --no-file-parallelism`: **exit 1; 9 arquivos falharam; 10 testes FAIL/31 PASS** (`SEM_IMPLEMENTACAO`, inclusive Caso 07/dedupe, que não faz parte da conversão FUGU-02). Nenhum teste `.adv.ts` tornou-se verde. Não confundir suíte regular verde com adversarial aprovado.

## Saídas reais · FUGU-03 (comandos em série)

Houve um typecheck intermediário FAIL (`TS2339` ao estreitar `prior` no segmenter), corrigido antes da rodada final abaixo. `npx tsc --noEmit`: exit 0, sem diagnósticos.

```text
> oncoglobal@0.0.1 check:boundaries
> node scripts/check-boundaries.mjs
fronteiras ok (140 arquivos)

> oncoglobal@0.0.1 check:corpus
> node scripts/validate-corpus.mjs
corpus ok (29 arquivos)

RUN  v5.0.3 C:/Users/silas/Projects/OncoGlobal-wt/w10-fugu
Test Files  9 passed (9)
Tests  39 passed (39)

RUN  v5.0.3 C:/Users/silas/Projects/OncoGlobal-wt/w10-fugu
Test Files  1 passed (1)
Tests  9 passed (9)
```

Heurísticas de fronteira permanecem propostas, não provam identidade: toda ligação ao paciente segue na caixa de revisão. O score/limiar técnico de fronteira não é validação clínica.

## Saídas reais · FUGU-04 (comandos em série)

`npx tsc --noEmit`: exit 0, sem diagnósticos.

```text
> oncoglobal@0.0.1 check:boundaries
> node scripts/check-boundaries.mjs
fronteiras ok (141 arquivos)

> oncoglobal@0.0.1 check:corpus
> node scripts/validate-corpus.mjs
corpus ok (29 arquivos)

RUN  v5.0.3 C:/Users/silas/Projects/OncoGlobal-wt/w10-fugu
Test Files  10 passed (10)
Tests  43 passed (43)

RUN  v5.0.3 C:/Users/silas/Projects/OncoGlobal-wt/w10-fugu
Test Files  1 passed (1)
Tests  9 passed (9)
```

O cadastro é parâmetro local; o resultado carrega apenas ID de candidato, score e razões sem valores identificáveis. Homônimos permanecem distintos e todo candidato exige revisão.

## Saídas reais · FUGU-05 (comandos em série)

Rodada intermediária direcionada: 2 FAIL/46 PASS ao detectar expressão regular incorreta para `%`/`+` e negação “não há”; corrigido no parser. `npx tsc --noEmit`: exit 0, sem diagnósticos.

```text
> oncoglobal@0.0.1 check:boundaries
> node scripts/check-boundaries.mjs
fronteiras ok (142 arquivos)

> oncoglobal@0.0.1 check:corpus
> node scripts/validate-corpus.mjs
corpus ok (29 arquivos)

RUN  v5.0.3 C:/Users/silas/Projects/OncoGlobal-wt/w10-fugu
Test Files  11 passed (11)
Tests  50 passed (50)

RUN  v5.0.3 C:/Users/silas/Projects/OncoGlobal-wt/w10-fugu
Test Files  1 passed (1)
Tests  9 passed (9)
```

Regex são um **dublê limitado aos padrões sintéticos testados**, não um extrator clínico geral. Valor literal de Plaud e achado de imagem permanecem propostas sem promoção; FUGU-06 a FUGU-12 ainda não foram concluídas. PDF digital continua pendente (FUGU-02). Os 10 FAIL adversariais W8 não foram corrigidos nesta fatia.
