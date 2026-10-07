# W10 · Progresso FUGU

Worktree `w10-fugu`, branch `f0/w10-fugu`; base no início `d2af9e7`. Apenas dados sintéticos. Retomar da primeira fatia não FEITA; mesclar `f0/w1-integrado` antes de começar cada fatia.

| Fatia | Estado | Commit | Evidência / pendência |
|---|---|---|---|
| FUGU-01 · Tipos e esqueleto | FEITA | `W10-FUGU-01` (commit desta fatia) | Nove etapas puras, 5 testes novos; tipos locais provisórios até contratos W10 |
| FUGU-02 · Conversão local | NÃO_INICIADA | — | — |
| FUGU-03 · Segmentação | NÃO_INICIADA | — | — |
| FUGU-04 · PatientResolver | NÃO_INICIADA | — | — |
| FUGU-05 · Extrator | NÃO_INICIADA | — | — |
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
