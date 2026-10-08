# W12-GROK — progresso

Worktree `C:\Users\silas\Projects\OncoGlobal-wt\w12-grok`, branch `f0/w12-grok`. Retomada desta tabela. Nada foi enviado ao remoto.

| Fatia | Estado | Commit | Notas |
|---|---|---|---|
| GROK-01 corte do salão 1.1.0 | FEITA | W12-GROK-01 | FC &lt; 50 corta na FN-01. CREAT 150 ativo. PAS &gt; 160 no corte do salão. |
| GROK-02 um corpo de triagem e porta | FEITA | W12-GROK-02 | Barrel reexporta a mesma função. Porta lê `LimiaresBula`. |
| GROK-03 CTCAE v6 no corpus | | | |
| GROK-04 texto para grau | | | |
| GROK-05 retorno com toxicidade | | | |
| GROK-06 tontura | | | |
| GROK-07 intervalo de 30 dias | | | |
| GROK-08 red flags do canal | | | |
| GROK-09 valor atual | | | |
| GROK-10 fechamento | | | |

## GROK-01

`salao-triagem` foi de 1.0.0 para 1.1.0. Cada limiar do corte do salão traz fonte `D-W9-37`. Febre continua estritamente acima de 37,8 (`decisoes.temp` = D-W9-38). Igual ao limite passa.

Antes: FN-01 anotava FC 49 em `naoCortes` e o destino ficava SALAO. Depois (D-W9-58): FC 49 gera `corte.fc.baixa` e FILA_MEDICO. FC 50 passa. O campo do contrato continua `fcMinNaoCorta` (pedido de rename em `docs/w12/PEDIDOS-GROK.md`).

`corteSalao` ganhou `pasMax` 160. PAS 160 passa; 161 corta com `corteSalao.pas.alta`. FC &gt; 120 permanece só na FN-01, para não fundir com o teto 110 da triagem do ciclo.

CREAT em `lab-thresholds`: ativo, `limiarSuperior` 150 centésimos de mg/dL, fonte D-W9-37. 150 passa no corte; 151 corta.

Expectativas atualizadas, com a decisão no teste: `tests/rules/triagem.test.ts`, `tests/rules/adv-016-bordas.test.ts`, `tests/rules/peso.test.ts` (a versão do peso segue o header do salão), `tests/w10-grok/grok-01-portoes.test.ts`, `tests/corpus/lab-thresholds.test.ts`. Teste novo: `tests/w12-grok/grok-01-corte.test.ts`.

### Saídas

`npx tsc --noEmit` — exit 0, sem diagnóstico.

`npm run check:boundaries` — `fronteiras ok (280 arquivos)`.

`npm run check:corpus` — `corpus ok (124 arquivos)`. `lab-thresholds.v1.json` header ok, 18 `[VERIFICAR]`, coluna ATIVOS 5.

`npx vitest run tests/w12-grok tests/rules tests/modules --no-file-parallelism` — 52 files, 395 tests, exit 0.

`npx vitest run tests/w3/auditoria-regressao.test.ts` — 9 tests, exit 0.

## GROK-02

O barrel já era fachada (uma implementação em `triagem.ts`). Esta fatia reexporta `portaCiclo`, `grauCtcae`, `lerSalaoCtcae` e `limiaresDaBula` do mesmo módulo. Teste prova identidade de referência (`toBe`).

`portaCiclo` aceita `LimiaresBula` (`neutrofilosMin`, `plaquetasMin`, `clcrMinMlMin`, `fevePctMin`). Null não declara o limiar. Os quatro nulos viram PENDENTE, sem usar grau. O `ProtocoloCiclo` provisório continua no mesmo corpo, para a suíte e o red team que já chamam essa forma. `grauUsadoNaPorta` permanece false. `portaPorGrau` continua ignorado.

Triagem do ciclo e corte do salão seguem portões distintos: FC 49 só corta o salão; PAS 150 só corta o ciclo.

### Saídas

`npx tsc --noEmit` — exit 0, sem diagnóstico.

`npm run check:boundaries` — `fronteiras ok (280 arquivos)`.

`npm run check:corpus` — `corpus ok (124 arquivos)`.

`npx vitest run tests/w12-grok tests/rules tests/modules --no-file-parallelism` — 55 files, 428 tests, exit 0 (a corrida também incluiu `tests/w10-grok/grok-02-bula-ctcae.test.ts` e `tests/redteam/rt07-labs-salao.test.ts`).

`npx vitest run tests/w3/auditoria-regressao.test.ts` — 9 tests, exit 0.
